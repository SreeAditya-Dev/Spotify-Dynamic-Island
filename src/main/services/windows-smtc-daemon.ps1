# Windows GSMTC Persistent Daemon for Spotify Dynamic Island
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asStreamMethod = [System.IO.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsStream' -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1

function AwaitTask($winRtOp, $resultType) {
    if ($null -eq $winRtOp) { return $null }
    $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
    $netTask = $asTask.Invoke($null, @($winRtOp))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
$global:mgr = AwaitTask ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

$global:lastTitle = ""
$global:lastArtist = ""
$global:cachedThumb = ""

function GetSessionMediaState() {
    try {
        if ($null -eq $global:mgr) {
            return '{"isPlaying":false,"title":"","artist":"","album":"","source":"none","position":0,"duration":0,"artworkUrl":""}'
        }

        $session = $global:mgr.GetCurrentSession()
        if ($null -eq $session) {
            $sessions = $global:mgr.GetSessions()
            if ($sessions.Count -gt 0) {
                $session = $sessions[0]
            }
        }

        if ($null -eq $session) {
            return '{"isPlaying":false,"title":"","artist":"","album":"","source":"none","position":0,"duration":0,"artworkUrl":""}'
        }

        $appId = "$($session.SourceAppId)"
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

        if ($title -ne $global:lastTitle -or $artist -ne $global:lastArtist -or [string]::IsNullOrEmpty($global:cachedThumb)) {
            $global:cachedThumb = ""
            if ($null -ne $media -and $null -ne $media.Thumbnail) {
                try {
                    $stream = AwaitTask ($media.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                    if ($null -ne $stream -and $stream.Size -gt 0) {
                        $netStream = $global:asStreamMethod.Invoke($null, @($stream))
                        $ms = New-Object System.IO.MemoryStream
                        $netStream.CopyTo($ms)
                        $bytes = $ms.ToArray()
                        if ($bytes.Length -gt 0) {
                            $base64 = [Convert]::ToBase64String($bytes)
                            $contentType = if ($stream.ContentType) { $stream.ContentType } else { "image/jpeg" }
                            $global:cachedThumb = "data:$contentType;base64,$base64"
                        }
                    }
                } catch {}
            }
            $global:lastTitle = $title
            $global:lastArtist = $artist
        }

        $cleanTitle = $title.Replace('\', '\\').Replace('"', '\"').Replace("`n", ' ').Replace("`r", '')
        $cleanArtist = $artist.Replace('\', '\\').Replace('"', '\"').Replace("`n", ' ').Replace("`r", '')
        $cleanAlbum = $album.Replace('\', '\\').Replace('"', '\"').Replace("`n", ' ').Replace("`r", '')
        $cleanApp = $appId.Replace('\', '\\').Replace('"', '\"')
        $cleanThumb = $global:cachedThumb

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
            """timestamp"":$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" +
        "}"

        return $json
    } catch {
        return '{"isPlaying":false,"title":"","artist":"","album":"","source":"error","position":0,"duration":0,"artworkUrl":""}'
    }
}

function ExecuteCommand($cmd) {
    try {
        $session = $global:mgr.GetCurrentSession()
        if ($null -eq $session) {
            $sessions = $global:mgr.GetSessions()
            if ($sessions.Count -gt 0) { $session = $sessions[0] }
        }
        if ($null -eq $session) { return $false }

        switch ($cmd.Trim().ToLower()) {
            "play" { AwaitTask ($session.TryPlayAsync()) ([bool]) | Out-Null; return $true }
            "pause" { AwaitTask ($session.TryPauseAsync()) ([bool]) | Out-Null; return $true }
            "toggle" { AwaitTask ($session.TryTogglePlayPauseAsync()) ([bool]) | Out-Null; return $true }
            "next" { AwaitTask ($session.TrySkipNextAsync()) ([bool]) | Out-Null; return $true }
            "previous" { AwaitTask ($session.TrySkipPreviousAsync()) ([bool]) | Out-Null; return $true }
            "prev" { AwaitTask ($session.TrySkipPreviousAsync()) ([bool]) | Out-Null; return $true }
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
