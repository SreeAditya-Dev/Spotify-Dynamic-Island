import React, { useState, useEffect, useCallback } from 'react';
import { IslandSettings, DEFAULT_SETTINGS } from '../types/settings';
import { MediaState, MediaCommand } from '../types/media';
import logoImg from './assets/logo.png';
import { Toggle, GooeyFilter } from '@/components/ui/liquid-toggle';
import {
  Sliders,
  MousePointer,
  Sparkles,
  Volume2,
  ExternalLink,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Power,
  Check,
  Layout,
  Info
} from 'lucide-react';

declare global {
  interface Window {
    niloSettings?: {
      getSettings: () => Promise<IslandSettings>;
      updateSettings: (partial: Partial<IslandSettings>) => Promise<IslandSettings>;
      resetSettings: () => Promise<IslandSettings>;
      onSettingsChange: (callback: (settings: IslandSettings) => void) => () => void;
      getMediaState: () => Promise<MediaState>;
      onMediaState: (callback: (state: MediaState) => void) => () => void;
      sendCommand: (cmd: MediaCommand) => Promise<boolean>;
      openSpotifyWeb: () => void;
      triggerDemo: () => Promise<boolean>;
      closeSettingsWindow: () => void;
      minimizeSettingsWindow: () => void;
      quitApp: () => void;
    };
  }
}

type TabType = 'general' | 'display' | 'media' | 'about';

export const SettingsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [settings, setSettings] = useState<IslandSettings>(DEFAULT_SETTINGS);
  const [savedNotice, setSavedNotice] = useState(false);
  const [demoActive, setDemoActive] = useState(false);

  const [media, setMedia] = useState<MediaState>({
    id: 'idle',
    title: '',
    artist: '',
    album: '',
    artworkUrl: '',
    isPlaying: false,
    position: 0,
    duration: 0,
    source: 'system',
    timestamp: Date.now()
  });

  useEffect(() => {
    if (!window.niloSettings) return;

    window.niloSettings.getSettings().then((s) => {
      if (s) setSettings(s);
    });

    window.niloSettings.getMediaState().then((m) => {
      if (m) setMedia(m);
    });

    const unsubSettings = window.niloSettings.onSettingsChange((newSettings) => {
      setSettings(newSettings);
      triggerSaveFlash();
    });

    const unsubMedia = window.niloSettings.onMediaState(setMedia);

    return () => {
      unsubSettings();
      unsubMedia();
    };
  }, []);

  const triggerSaveFlash = useCallback(() => {
    setSavedNotice(true);
    const timer = setTimeout(() => setSavedNotice(false), 1400);
    return () => clearTimeout(timer);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof IslandSettings>(key: K, value: IslandSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        window.niloSettings?.updateSettings({ [key]: value });
        return next;
      });
      triggerSaveFlash();
    },
    [triggerSaveFlash]
  );

  const handleReset = useCallback(async () => {
    if (!window.niloSettings) return;
    const def = await window.niloSettings.resetSettings();
    setSettings(def);
    triggerSaveFlash();
  }, [triggerSaveFlash]);

  const handleTriggerDemo = useCallback(async () => {
    if (!window.niloSettings) return;
    setDemoActive(true);
    await window.niloSettings.triggerDemo();
    setTimeout(() => setDemoActive(false), 10000);
  }, []);

  const handleCommand = useCallback((cmd: MediaCommand) => {
    window.niloSettings?.sendCommand(cmd);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0b0f] text-zinc-200 select-none overflow-hidden font-sans border border-white/[0.08]">
      <GooeyFilter />
      {/* SaaS App Header */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#0e1017]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/[0.1] flex items-center justify-center p-1 shadow-sm">
            <img src={logoImg} alt="Nilo Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-white">Nilo</h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-400 border border-white/[0.06]">
                Preferences
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">Spotify Dynamic Island Controller</p>
          </div>
        </div>

        {/* Live sync indicator & Quick actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
            {savedNotice ? (
              <>
                <Check className="w-3.5 h-3.5 text-zinc-200" />
                <span className="text-zinc-200">Applied</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Connected</span>
              </>
            )}
          </div>

          <button
            onClick={() => window.niloSettings?.openSpotifyWeb()}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-white/[0.05] hover:bg-white/[0.09] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors"
          >
            <span>Open Web Player</span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-52 p-3 border-r border-white/[0.08] bg-[#0c0d13] flex flex-col justify-between">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'general'
                  ? 'bg-white/[0.08] text-white border border-white/[0.08]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <MousePointer className="w-4 h-4 text-zinc-400" />
              <span>General & Behavior</span>
            </button>

            <button
              onClick={() => setActiveTab('display')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'display'
                  ? 'bg-white/[0.08] text-white border border-white/[0.08]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Layout className="w-4 h-4 text-zinc-400" />
              <span>Display & Position</span>
            </button>

            <button
              onClick={() => setActiveTab('media')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'media'
                  ? 'bg-white/[0.08] text-white border border-white/[0.08]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Volume2 className="w-4 h-4 text-zinc-400" />
              <span>Playback & Diagnostics</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'about'
                  ? 'bg-white/[0.08] text-white border border-white/[0.08]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Info className="w-4 h-4 text-zinc-400" />
              <span>About & System</span>
            </button>
          </nav>

          {/* Sidebar Footer Actions */}
          <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <button
              onClick={() => window.niloSettings?.quitApp()}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Quit Nilo</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#0a0b0f]">
          {/* TAB 1: GENERAL & BEHAVIOR */}
          {activeTab === 'general' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <h2 className="text-sm font-semibold text-white">General & Interaction</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure cursor hover expansion and capsule triggers.
                </p>
              </div>

              {/* Hover Expansion Card */}
              <div className="bg-[#121319] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-white">Expand on Mouse Hover</h3>
                  </div>
                  <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                    Morphs the compact pill into full playback controls when the cursor moves over it.
                  </p>
                </div>

                <Toggle
                  checked={settings.hoverEnabled}
                  onCheckedChange={(val) => updateSetting('hoverEnabled', val)}
                  variant="success"
                />
              </div>

              {/* Click to Expand Card */}
              <div className="bg-[#121319] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold text-white">Click Capsule to Expand / Collapse</h3>
                  <p className="text-xs text-zinc-400 max-w-md">
                    Allow clicking the compact island pill to manually toggle full controls.
                  </p>
                </div>

                <Toggle
                  checked={settings.clickToExpand}
                  onCheckedChange={(val) => updateSetting('clickToExpand', val)}
                  variant="success"
                />
              </div>

              {/* Startup Option Card */}
              <div className="bg-[#121319] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold text-white">Launch at Startup</h3>
                  <p className="text-xs text-zinc-400 max-w-md">
                    Start Nilo automatically in the background when logging in.
                  </p>
                </div>

                <Toggle
                  checked={settings.launchOnStartup}
                  onCheckedChange={(val) => updateSetting('launchOnStartup', val)}
                  variant="success"
                />
              </div>
            </div>
          )}

          {/* TAB 2: DISPLAY & POSITION */}
          {activeTab === 'display' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <h2 className="text-sm font-semibold text-white">Display & Positioning</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Alignment and vertical offset settings for your display.
                </p>
              </div>

              {/* Position Card - Top Center Only */}
              <div className="bg-[#121319] border border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h3 className="text-xs font-semibold text-white">Screen Alignment</h3>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.06]">
                    Top Center (Fixed)
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  The Dynamic Island docks symmetrically at the top center of your primary display.
                  Its morph animation expands evenly from the center.
                </p>
              </div>

              {/* Top Screen Gap / Offset */}
              <div className="bg-[#121319] border border-white/[0.08] rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-white">Top Screen Offset</h3>
                    <p className="text-xs text-zinc-400">
                      Vertical distance from the top border of the monitor.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-md bg-white/[0.06] text-zinc-200 border border-white/[0.08]">
                    {settings.topOffset} px
                  </span>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-2">
                  {[
                    { label: 'Flush (0px)', val: 0 },
                    { label: 'Default (6px)', val: 6 },
                    { label: 'Floating (14px)', val: 14 }
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      onClick={() => updateSetting('topOffset', preset.val)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                        settings.topOffset === preset.val
                          ? 'bg-white/[0.14] border-white/[0.22] text-white font-medium'
                          : 'bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Proper styled range slider with track and fill */}
                <div className="pt-2">
                  <div className="relative flex items-center w-full">
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={2}
                      value={settings.topOffset}
                      onChange={(e) => updateSetting('topOffset', parseInt(e.target.value, 10))}
                      className="settings-range-slider"
                      style={{
                        background: `linear-gradient(to right, #10B981 0%, #10B981 ${(settings.topOffset / 24) * 100}%, rgba(255,255,255,0.14) ${(settings.topOffset / 24) * 100}%, rgba(255,255,255,0.14) 100%)`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-2 px-1">
                    <span>0px (Flush)</span>
                    <span>6px (Default)</span>
                    <span>14px</span>
                    <span>24px (Max)</span>
                  </div>
                </div>
              </div>

              {/* Ambient Glow Toggle */}
              <div className="bg-[#121319] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold text-white">Subtle Ambient Glow</h3>
                  <p className="text-xs text-zinc-400 max-w-md">
                    Soft backlight illumination behind the island that gently responds to media playback.
                  </p>
                </div>

                <Toggle
                  checked={settings.glowEnabled}
                  onCheckedChange={(val) => updateSetting('glowEnabled', val)}
                  variant="success"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PLAYBACK & DIAGNOSTICS */}
          {activeTab === 'media' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <h2 className="text-sm font-semibold text-white">Playback & Live Diagnostics</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Inspect the media stream and test player expansion.
                </p>
              </div>

              {/* Current Track Card */}
              <div className="bg-[#121319] border border-white/[0.08] rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Live Media Source</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400 border border-white/[0.06]">
                    {media.source || 'idle'}
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  {media.artworkUrl ? (
                    <img
                      src={media.artworkUrl}
                      alt="Album Cover"
                      className="w-14 h-14 rounded-lg object-cover border border-white/[0.1]"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center">
                      <img src={logoImg} alt="Nilo" className="w-6 h-6 opacity-40 object-contain" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-white truncate">
                      {media.title || 'No media playing'}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {media.artist || 'Waiting for Spotify desktop or web playback...'}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {media.album || 'Dynamic Island is listening in the background'}
                    </p>
                  </div>
                </div>

                {/* Transport Controls */}
                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCommand('previous')}
                      className="p-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.06] transition-colors"
                      title="Previous"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCommand('toggle')}
                      className="p-1.5 rounded-md bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.1] transition-colors"
                      title="Play / Pause"
                    >
                      {media.isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCommand('next')}
                      className="p-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.06] transition-colors"
                      title="Next"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleTriggerDemo}
                    disabled={demoActive}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.05] hover:bg-white/[0.09] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors"
                  >
                    <span>{demoActive ? 'Demo Active (10s)...' : 'Test Demo Animation'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ABOUT & SYSTEM */}
          {activeTab === 'about' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <h2 className="text-sm font-semibold text-white">About Nilo</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Spotify Dynamic Island for Windows, macOS, and Linux.
                </p>
              </div>

              <div className="bg-[#121319] border border-white/[0.08] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.1] flex items-center justify-center p-1.5">
                    <img src={logoImg} alt="Nilo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Nilo Desktop</h3>
                    <p className="text-xs text-zinc-400">Version 1.0.0</p>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed pt-2 border-t border-white/[0.06]">
                  A hardware-accelerated, zero-flicker dynamic capsule overlay built with Electron,
                  React, and Tailwind CSS. Connects natively to OS media transport controls and browser players.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04]">
                    <span className="text-zinc-500 block">OS Integration</span>
                    <span className="text-zinc-300">GSMTC / MPRIS / AppleScript</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04]">
                    <span className="text-zinc-500 block">Extension Bridge</span>
                    <span className="text-zinc-300">WebSocket 127.0.0.1:9876</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Subtle Footer */}
      <footer className="px-5 py-2.5 border-t border-white/[0.08] bg-[#0c0d12] flex items-center justify-between text-[11px] text-zinc-500">
        <span>Nilo v1.0.0 • Clean Top Center Capsule</span>
        <button
          onClick={() => window.niloSettings?.closeSettingsWindow()}
          className="px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
        >
          Close Window
        </button>
      </footer>
    </div>
  );
};
