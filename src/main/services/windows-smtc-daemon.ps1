# Windows GSMTC Persistent Daemon for Spotify Dynamic Island
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
# NOTE: the type is WindowsRuntimeStreamExtensions. WindowsRuntimeSystemExtensions
# does not exist, and looking it up left $asStreamMethod null, so album artwork
# could never be read from the media session.
$global:asStreamMethod = [System.IO.WindowsRuntimeStreamExtensions].GetMethods() | ? { $_.Name -eq 'AsStream' -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1

function AwaitTask($winRtOp, $resultType) {
    if ($null -eq $winRtOp) { return $null }
    $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
    $netTask = $asTask.Invoke($null, @($winRtOp))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
$global:mgr = AwaitTask ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

# --- System volume via Core Audio (SMTC exposes no volume of its own) ---
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    int GetChannelCount(out uint pnChannelCount);
    int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int dwStateMask, IntPtr ppDevices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject { }

public static class SystemVolume {
    private static IAudioEndpointVolume Endpoint() {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice device;
        // eRender (0), eMultimedia (1)
        Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
        var iid = typeof(IAudioEndpointVolume).GUID;
        object obj;
        Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out obj));
        return (IAudioEndpointVolume)obj;
    }

    public static int Get() {
        float level;
        Marshal.ThrowExceptionForHR(Endpoint().GetMasterVolumeLevelScalar(out level));
        return (int)Math.Round(level * 100f);
    }

    public static void Set(int percent) {
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;
        var empty = Guid.Empty;
        Marshal.ThrowExceptionForHR(Endpoint().SetMasterVolumeLevelScalar(percent / 100f, ref empty));
    }

    public static bool GetMute() {
        bool muted;
        Marshal.ThrowExceptionForHR(Endpoint().GetMute(out muted));
        return muted;
    }

    public static void SetMute(bool muted) {
        var empty = Guid.Empty;
        Marshal.ThrowExceptionForHR(Endpoint().SetMute(muted, ref empty));
    }
}
"@

$global:volumeAvailable = $null -ne ('SystemVolume' -as [type])

$global:lastTrackKey = ""
$global:cachedThumb = ""

# Thumbnails are embedded as base64 data URIs, so they must never be re-sent on
# every poll - some apps publish multi-megabyte covers. Anything above this is
# dropped and the app falls back to its online artwork lookup.
$global:maxThumbBytes = 900000

function ReadThumbnail($media) {
    try {
        if ($null -eq $media -or $null -eq $media.Thumbnail) { return "" }
        $stream = AwaitTask ($media.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        # NOTE: do not gate on $stream.Size - PowerShell does not project that
        # property, so it reads as $null and skipped every thumbnail.
        if ($null -eq $stream) { return "" }
        if ($null -eq $global:asStreamMethod) { return "" }

        $netStream = $global:asStreamMethod.Invoke($null, @($stream))
        $ms = New-Object System.IO.MemoryStream
        $netStream.CopyTo($ms)
        $bytes = $ms.ToArray()
        if ($bytes.Length -le 0 -or $bytes.Length -gt $global:maxThumbBytes) { return "" }

        $contentType = "image/jpeg"
        try { if ($stream.ContentType) { $contentType = $stream.ContentType } } catch {}
        return "data:$contentType;base64,$([Convert]::ToBase64String($bytes))"
    } catch {
        return ""
    }
}

function GetBestMediaSession() {
    try {
        if ($null -eq $global:mgr) { return $null }
        $sessionList = @($global:mgr.GetSessions())
        $total = $sessionList.Count
        if ($total -eq 0) {
            return $global:mgr.GetCurrentSession()
        }

        $bestSession = $null
        $bestScore = -1

        # The OS tracks which session the user last interacted with; use it to
        # break ties between two equally-scoring sessions.
        $currentId = ""
        try {
            $cur = $global:mgr.GetCurrentSession()
            if ($null -ne $cur) { $currentId = "$($cur.SourceAppUserModelId)" }
        } catch {}

        for ($i = 0; $i -lt $total; $i++) {
            $s = $sessionList[$i]
            if ($null -eq $s) { continue }
            $info = $s.GetPlaybackInfo()
            $status = if ($info) { "$($info.PlaybackStatus)".ToLower() } else { "" }

            # Playing outranks everything else. Metadata and app bonuses only
            # decide between sessions in the same playback state - otherwise a
            # paused browser tab could outrank whatever is actually playing.
            $score = 0
            if ($status -eq "playing") { $score += 1000 }

            $title = ""
            $artist = ""
            $album = ""
            try {
                $props = AwaitTask ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                if ($null -ne $props) {
                    $title = "$($props.Title)"
                    $artist = "$($props.Artist)"
                    $album = "$($props.AlbumTitle)"
                }
            } catch {}

            # NOTE: SourceAppUserModelId is the real property. SourceAppId does
            # not exist, so this was always empty and no app bonus ever applied.
            $appId = "$($s.SourceAppUserModelId)"
            $app = $appId.ToLower()

            if (![string]::IsNullOrEmpty($title)) { $score += 10 }
            if (![string]::IsNullOrEmpty($artist)) { $score += 30 }
            if (![string]::IsNullOrEmpty($album)) { $score += 5 }

            if ($title.ToLower().Contains("spotify") -or $app.Contains("spotify")) {
                $score += 200
            } elseif ($app -match "chrome|msedge|firefox|brave|opera|vivaldi|chromium") {
                # A song in a browser should beat a generic video/media player
                # that exposes no artist metadata.
                $score += 50
            }

            if (![string]::IsNullOrEmpty($currentId) -and $appId -eq $currentId) { $score += 20 }

            if ($score -gt $bestScore) {
                $bestScore = $score
                $bestSession = $s
            }
        }

        if ($bestScore -gt 0 -and $null -ne $bestSession) {
            return $bestSession
        }

        return $global:mgr.GetCurrentSession()
    } catch {
        return $null
    }
}

function GetSessionMediaState() {
    try {
        if ($null -eq $global:mgr) {
            return '{"isPlaying":false,"title":"","artist":"","album":"","source":"none","position":0,"duration":0,"artworkUrl":""}'
        }

        $session = GetBestMediaSession
        if ($null -eq $session) {
            return '{"isPlaying":false,"title":"","artist":"","album":"","source":"none","position":0,"duration":0,"artworkUrl":""}'
        }

        $appId = "$($session.SourceAppUserModelId)"
        $playback = $session.GetPlaybackInfo()
        $status = "$($playback.PlaybackStatus)".ToLower()
        $isPlaying = ($status -eq "playing")

        $timeline = $session.GetTimelineProperties()
        $pos = 0
        $end = 0
        if ($null -ne $timeline) {
            $pos = [Math]::Max(0, [Math]::Round($timeline.Position.TotalSeconds, 1))
            $end = [Math]::Max(0, [Math]::Round($timeline.EndTime.TotalSeconds, 1))
        }

        $media = AwaitTask ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $title = ""
        $artist = ""
        $album = ""
        if ($null -ne $media) {
            $title = "$($media.Title)"
            $artist = "$($media.Artist)"
            $album = "$($media.AlbumTitle)"
        }

        # Only read - and only transmit - artwork when the track actually
        # changes. Every other poll reports an empty artworkUrl and the app
        # keeps showing the cover it already has.
        $trackKey = "$title|$artist|$album"
        $artPayload = ""
        if ($trackKey -ne $global:lastTrackKey) {
            $global:lastTrackKey = $trackKey
            $global:cachedThumb = ReadThumbnail $media
            $artPayload = $global:cachedThumb
        }

        $cleanTitle = $title.Replace('\', '\\').Replace('"', '\"').Replace("`n", ' ').Replace("`r", '')
        $cleanArtist = $artist.Replace('\', '\\').Replace('"', '\"').Replace("`n", ' ').Replace("`r", '')
        $cleanAlbum = $album.Replace('\', '\\').Replace('"', '\"').Replace("`n", ' ').Replace("`r", '')
        $cleanApp = $appId.Replace('\', '\\').Replace('"', '\"')
        $cleanThumb = $artPayload

        # Whether this session actually accepts a seek, so the UI can show the
        # scrubber as disabled instead of silently swallowing drags.
        $canSeek = $false
        try {
            $controls = $playback.Controls
            if ($null -ne $controls) { $canSeek = [bool]$controls.IsPlaybackPositionEnabled }
        } catch {}

        $volume = -1
        $muted = $false
        if ($global:volumeAvailable) {
            try {
                $volume = [SystemVolume]::Get()
                $muted = [SystemVolume]::GetMute()
            } catch {}
        }

        $shuffle = $false
        try { if ($null -ne $playback.IsShuffleActive) { $shuffle = [bool]$playback.IsShuffleActive } } catch {}
        $repeat = "off"
        try {
            if ($null -ne $playback.AutoRepeatMode) {
                $m = "$($playback.AutoRepeatMode)".ToLower()
                if ($m -eq "list") { $repeat = "context" } elseif ($m -eq "track") { $repeat = "track" }
            }
        } catch {}


        $json = "{" +
            """isPlaying"":$($isPlaying.ToString().ToLower())," +
            """status"":""$status""," +
            """title"":""$cleanTitle""," +
            """artist"":""$cleanArtist""," +
            """album"":""$cleanAlbum""," +
            """sourceApp"":""$cleanApp""," +
            """position"":$pos," +
            """duration"":$end," +
            """artworkUrl"":""$cleanThumb""," +
            """canSeek"":$($canSeek.ToString().ToLower())," +
            """volume"":$volume," +
            """isMuted"":$($muted.ToString().ToLower())," +
            """shuffle"":$($shuffle.ToString().ToLower())," +
            """repeat"":""$repeat""," +
            """timestamp"":$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" +
        "}"

        return $json
    } catch {
        return '{"isPlaying":false,"title":"","artist":"","album":"","source":"error","position":0,"duration":0,"artworkUrl":""}'
    }
}

function ExecuteCommand($cmd) {
    try {
        # Commands carrying a value arrive as "name:value" (e.g. "seek:93.5").
        $raw = "$cmd".Trim()
        $name = $raw
        $arg = ""
        $sep = $raw.IndexOf(":")
        if ($sep -ge 0) {
            $name = $raw.Substring(0, $sep)
            $arg = $raw.Substring($sep + 1)
        }
        $name = $name.ToLower()

        # Volume is a system-wide concern; it has no media session to act on.
        if ($name -eq "volume") {
            if (-not $global:volumeAvailable) { return $false }
            $pct = 0
            if ([int]::TryParse($arg, [ref]$pct)) {
                [SystemVolume]::Set($pct)
                if ($pct -gt 0) { [SystemVolume]::SetMute($false) }
                return $true
            }
            return $false
        }
        if ($name -eq "mute") {
            if (-not $global:volumeAvailable) { return $false }
            [SystemVolume]::SetMute(-not [SystemVolume]::GetMute())
            return $true
        }

        $session = GetBestMediaSession
        if ($null -eq $session) { return $false }

        switch ($name) {
            "play" { AwaitTask ($session.TryPlayAsync()) ([bool]) | Out-Null; return $true }
            "pause" { AwaitTask ($session.TryPauseAsync()) ([bool]) | Out-Null; return $true }
            "toggle" { AwaitTask ($session.TryTogglePlayPauseAsync()) ([bool]) | Out-Null; return $true }
            "next" { AwaitTask ($session.TrySkipNextAsync()) ([bool]) | Out-Null; return $true }
            "previous" { AwaitTask ($session.TrySkipPreviousAsync()) ([bool]) | Out-Null; return $true }
            "prev" { AwaitTask ($session.TrySkipPreviousAsync()) ([bool]) | Out-Null; return $true }
            "seek" {
                $seconds = 0.0
                if (-not [double]::TryParse($arg, [ref]$seconds)) { return $false }
                # TryChangePlaybackPositionAsync takes 100-nanosecond ticks.
                $ticks = [long]([Math]::Max(0, $seconds) * 10000000)
                AwaitTask ($session.TryChangePlaybackPositionAsync($ticks)) ([bool]) | Out-Null
                return $true
            }
            "toggleshuffle" {
                $info = $session.GetPlaybackInfo()
                $current = $false
                try { if ($null -ne $info.IsShuffleActive) { $current = [bool]$info.IsShuffleActive } } catch {}
                AwaitTask ($session.TryChangeShuffleActiveAsync(-not $current)) ([bool]) | Out-Null
                return $true
            }
            "togglerepeat" {
                $info = $session.GetPlaybackInfo()
                $mode = "none"
                try { if ($null -ne $info.AutoRepeatMode) { $mode = "$($info.AutoRepeatMode)".ToLower() } } catch {}
                # none -> list -> track -> none
                $next = 1
                if ($mode -eq "list") { $next = 2 } elseif ($mode -eq "track") { $next = 0 }
                AwaitTask ($session.TryChangeAutoRepeatModeAsync($next)) ([bool]) | Out-Null
                return $true
            }
        }
    } catch {}
    return $false
}

Write-Host "DAEMON_READY"

# Background thread for non-blocking stdin
$inputQueue = [System.Collections.Queue]::Synchronized((New-Object System.Collections.Queue))
$stdinRunspace = [powershell]::Create().AddScript({
    param($q)
    while ($true) {
        $line = [Console]::In.ReadLine()
        if ($null -eq $line) { break }
        $q.Enqueue($line)
    }
}).AddArgument($inputQueue)
$asyncStdin = $stdinRunspace.BeginInvoke()

$lastPoll = [DateTime]::MinValue
while ($true) {
    while ($inputQueue.Count -gt 0) {
        $rawLine = $inputQueue.Dequeue()
        if ($rawLine) {
            $line = "$rawLine".Trim()
            if ($line.StartsWith("CMD:")) {
                $cmd = $line.Substring(4)
                $res = ExecuteCommand $cmd
                Write-Host "CMD_RESULT:$res"
            } elseif ($line -eq "POLL") {
                $st = GetSessionMediaState
                Write-Host "STATE:$st"
            } elseif ($line -eq "EXIT") {
                [System.Environment]::Exit(0)
            }
        }
    }

    $now = [DateTime]::UtcNow
    if (($now - $lastPoll).TotalMilliseconds -ge 1000) {
        $lastPoll = $now
        $st = GetSessionMediaState
        Write-Host "STATE:$st"
    }

    Start-Sleep -Milliseconds 100
}
