import React, { useState, useEffect, useCallback } from 'react';
import { IslandSettings, IslandPosition, DEFAULT_SETTINGS } from '../types/settings';
import { MediaState, MediaCommand } from '../types/media';
import {
  Sliders,
  Monitor,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  MousePointer,
  Pin,
  RotateCcw,
  ExternalLink,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Check,
  Power,
  Volume2,
  Tv,
  CheckCircle2
} from 'lucide-react';

// Type declaration for niloSettings exposed in preload
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

type TabType = 'placement' | 'behavior' | 'appearance' | 'playback' | 'about';

export const SettingsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('placement');
  const [settings, setSettings] = useState<IslandSettings>(DEFAULT_SETTINGS);
  const [savedNotification, setSavedNotification] = useState(false);
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

  // Load initial settings and subscribe to live changes
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
      flashSavedNotice();
    });

    const unsubMedia = window.niloSettings.onMediaState(setMedia);

    return () => {
      unsubSettings();
      unsubMedia();
    };
  }, []);

  const flashSavedNotice = useCallback(() => {
    setSavedNotification(true);
    const t = setTimeout(() => setSavedNotification(false), 1600);
    return () => clearTimeout(t);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof IslandSettings>(key: K, value: IslandSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        window.niloSettings?.updateSettings({ [key]: value });
        return next;
      });
      flashSavedNotice();
    },
    [flashSavedNotice]
  );

  const handleReset = useCallback(async () => {
    if (!window.niloSettings) return;
    const def = await window.niloSettings.resetSettings();
    setSettings(def);
    flashSavedNotice();
  }, [flashSavedNotice]);

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
    <div className="flex flex-col h-screen w-screen bg-[#0d0e12] text-zinc-100 select-none overflow-hidden font-sans border border-white/10 rounded-lg">
      {/* App Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#12141a]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#1DB954] to-emerald-400 p-[1.5px] shadow-lg shadow-[#1DB954]/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#0d0e12] rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#1DB954]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Nilo Preferences</h1>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#1DB954]/15 text-[#1ed760] border border-[#1DB954]/25">
                Separate Companion App
              </span>
            </div>
            <p className="text-xs text-zinc-400">Desktop Spotify Dynamic Island Controller</p>
          </div>
        </div>

        {/* Live sync indicator & Quick actions */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all duration-300 ${
              savedNotification
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/5 text-zinc-400 border border-white/5'
            }`}
          >
            {savedNotification ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Applied live!</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Sync Active</span>
              </>
            )}
          </div>

          <button
            onClick={() => window.niloSettings?.openSpotifyWeb()}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors"
            title="Open Spotify Web"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#1DB954]" />
            <span>Spotify Web</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Tabs */}
        <aside className="w-56 p-3 border-r border-white/10 bg-[#0f1016] flex flex-col justify-between">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('placement')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'placement'
                  ? 'bg-[#1DB954] text-black font-semibold shadow-md shadow-[#1DB954]/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Placement & Screen</span>
            </button>

            <button
              onClick={() => setActiveTab('behavior')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'behavior'
                  ? 'bg-[#1DB954] text-black font-semibold shadow-md shadow-[#1DB954]/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MousePointer className="w-4 h-4" />
              <span>Hover & Triggers</span>
            </button>

            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'appearance'
                  ? 'bg-[#1DB954] text-black font-semibold shadow-md shadow-[#1DB954]/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Appearance & Glow</span>
            </button>

            <button
              onClick={() => setActiveTab('playback')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'playback'
                  ? 'bg-[#1DB954] text-black font-semibold shadow-md shadow-[#1DB954]/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Media & Test Demo</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'about'
                  ? 'bg-[#1DB954] text-black font-semibold shadow-md shadow-[#1DB954]/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>System & About</span>
            </button>
          </nav>

          {/* Bottom Sidebar Action */}
          <div className="pt-3 border-t border-white/5 space-y-2">
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <button
              onClick={() => window.niloSettings?.quitApp()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400/90 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-red-500/10"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Quit Application</span>
            </button>
          </div>
        </aside>

        {/* Tab Panel Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0d0e12]">
          {/* TAB 1: PLACEMENT & SCREEN POSITION */}
          {activeTab === 'placement' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-[#1DB954]" />
                  Island Placement
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Place the Dynamic Island either in the top center or in the next parallel sides flanking the center (not on the extreme screen edges).
                </p>
              </div>

              {/* Interactive Visual Monitor Display Preview */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Live Display Simulation
                  </span>
                  <span className="text-[11px] text-zinc-500">Click any parallel side to apply</span>
                </div>

                {/* Monitor Bezels Mockup */}
                <div className="relative w-full h-44 bg-zinc-950 border-2 border-zinc-700 rounded-xl overflow-hidden shadow-inner flex flex-col justify-between p-2">
                  {/* Top bezel with camera and parallel docking zones */}
                  <div className="relative w-full h-10 border-b border-white/5 flex items-center justify-center gap-4 px-2">
                    {/* Left Parallel Dock Zone */}
                    <button
                      onClick={() => updateSetting('position', 'left')}
                      className={`group relative h-7 px-3.5 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
                        settings.position === 'left'
                          ? 'bg-[#1DB954] text-black font-bold shadow-lg shadow-[#1DB954]/50 scale-105 ring-2 ring-white/40'
                          : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 border border-white/10'
                      }`}
                      title="Dock to Left Parallel Side of Center"
                    >
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <AlignLeft className="w-3.5 h-3.5" />
                        <span>Left Parallel Side</span>
                      </div>
                    </button>

                    {/* Center Camera dot indicator & Center Dock Zone */}
                    <button
                      onClick={() => updateSetting('position', 'center')}
                      className={`group relative h-7 px-4 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
                        settings.position === 'center'
                          ? 'bg-[#1DB954] text-black font-bold shadow-lg shadow-[#1DB954]/50 scale-105 ring-2 ring-white/40'
                          : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 border border-white/10'
                      }`}
                      title="Center Dynamic Island"
                    >
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <AlignCenter className="w-3.5 h-3.5" />
                        <span>Top Center</span>
                      </div>
                    </button>

                    {/* Right Parallel Dock Zone */}
                    <button
                      onClick={() => updateSetting('position', 'right')}
                      className={`group relative h-7 px-3.5 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
                        settings.position === 'right'
                          ? 'bg-[#1DB954] text-black font-bold shadow-lg shadow-[#1DB954]/50 scale-105 ring-2 ring-white/40'
                          : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 border border-white/10'
                      }`}
                      title="Dock to Right Parallel Side of Center"
                    >
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <AlignRight className="w-3.5 h-3.5" />
                        <span>Right Parallel Side</span>
                      </div>
                    </button>
                  </div>

                  {/* Simulated screen background wallpaper */}
                  <div className="flex-1 flex items-center justify-center opacity-25">
                    <div className="text-center">
                      <Tv className="w-8 h-8 mx-auto text-zinc-600 mb-1" />
                      <span className="text-[10px] text-zinc-600 font-mono">
                        Screen Center & Parallel Lanes
                      </span>
                    </div>
                  </div>

                  {/* Bottom taskbar mockup */}
                  <div className="w-full h-4 bg-zinc-900/90 rounded border-t border-white/5 flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded bg-[#1DB954]/70" />
                    <div className="w-2 h-2 rounded bg-zinc-600" />
                    <div className="w-2 h-2 rounded bg-zinc-600" />
                  </div>
                </div>
              </div>

              {/* Position Selection Cards */}
              <div className="grid grid-cols-3 gap-3">
                {/* Left Parallel Side Option */}
                <div
                  onClick={() => updateSetting('position', 'left')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    settings.position === 'left'
                      ? 'bg-emerald-950/20 border-[#1DB954] shadow-md shadow-[#1DB954]/10'
                      : 'bg-[#14161f] border-white/10 hover:border-white/20 hover:bg-[#181a24]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-lg bg-zinc-800/80 text-[#1ed760]">
                        <AlignLeft className="w-5 h-5" />
                      </div>
                      {settings.position === 'left' && (
                        <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white">Left Parallel Side</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Places the island in the parallel lane left of center, avoiding the extreme screen edge.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/5 text-[11px] font-mono text-[#1ed760]">
                    Next parallel side (Left)
                  </div>
                </div>

                {/* Top Center Option */}
                <div
                  onClick={() => updateSetting('position', 'center')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    settings.position === 'center'
                      ? 'bg-emerald-950/20 border-[#1DB954] shadow-md shadow-[#1DB954]/10'
                      : 'bg-[#14161f] border-white/10 hover:border-white/20 hover:bg-[#181a24]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-lg bg-zinc-800/80 text-[#1ed760]">
                        <AlignCenter className="w-5 h-5" />
                      </div>
                      {settings.position === 'center' && (
                        <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white">Top Center</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Traditional Dynamic Island centered horizontally at the top.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/5 text-[11px] font-mono text-zinc-400">
                    Symmetrical expansion
                  </div>
                </div>

                {/* Right Parallel Side Option */}
                <div
                  onClick={() => updateSetting('position', 'right')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    settings.position === 'right'
                      ? 'bg-emerald-950/20 border-[#1DB954] shadow-md shadow-[#1DB954]/10'
                      : 'bg-[#14161f] border-white/10 hover:border-white/20 hover:bg-[#181a24]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-lg bg-zinc-800/80 text-[#1ed760]">
                        <AlignRight className="w-5 h-5" />
                      </div>
                      {settings.position === 'right' && (
                        <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white">Right Parallel Side</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Places the island in the parallel lane right of center, avoiding the extreme screen edge.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/5 text-[11px] font-mono text-[#1ed760]">
                    Next parallel side (Right)
                  </div>
                </div>
              </div>

              {/* Parallel Distance from Center Control */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Parallel Distance from Center</h3>
                    <p className="text-xs text-zinc-400">
                      Distance from the center of the display to the parallel side island.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-zinc-800 font-mono text-xs text-[#1ed760] border border-white/10">
                    {settings.centerOffset ?? 100} px
                  </span>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-2">
                  {[
                    { label: 'Snug (60px)', val: 60 },
                    { label: 'Parallel Lane (100px)', val: 100 },
                    { label: 'Comfort (160px)', val: 160 },
                    { label: 'Wide (240px)', val: 240 }
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      onClick={() => updateSetting('centerOffset', preset.val)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        (settings.centerOffset ?? 100) === preset.val
                          ? 'bg-[#1DB954]/20 border-[#1DB954] text-[#1ed760] font-semibold'
                          : 'bg-zinc-800/60 border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min={40}
                  max={400}
                  step={10}
                  value={settings.centerOffset ?? 100}
                  onChange={(e) => updateSetting('centerOffset', parseInt(e.target.value, 10))}
                  className="w-full accent-[#1DB954] cursor-pointer"
                />
              </div>

              {/* Top Offset Control */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Top Screen Gap</h3>
                    <p className="text-xs text-zinc-400">
                      Vertical distance from the very top border of the monitor.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-zinc-800 font-mono text-xs text-[#1ed760] border border-white/10">
                    {settings.topOffset} px
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={30}
                  step={2}
                  value={settings.topOffset}
                  onChange={(e) => updateSetting('topOffset', parseInt(e.target.value, 10))}
                  className="w-full accent-[#1DB954] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 2: BEHAVIOR & HOVER TOGGLE */}
          {activeTab === 'behavior' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MousePointer className="w-5 h-5 text-[#1DB954]" />
                  Hover & Interaction Settings
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Configure cursor hover expansion and interaction triggers for the island.
                </p>
              </div>

              {/* FEATURE TOGGLE: HOVER FEATURE */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-6 shadow-xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Expand on Mouse Hover</h3>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        settings.hoverEnabled
                          ? 'bg-emerald-500/20 text-[#1ed760] border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-white/10'
                      }`}
                    >
                      {settings.hoverEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
                    When enabled, moving the mouse cursor over the compact pill smoothly morphs it
                    into the full Spotify expanded controls. When turned off, the island remains
                    compact and won't expand accidentally when moving your mouse across the screen.
                  </p>
                </div>

                {/* Custom Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.hoverEnabled}
                  onClick={() => updateSetting('hoverEnabled', !settings.hoverEnabled)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.hoverEnabled ? 'bg-[#1DB954]' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      settings.hoverEnabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Click to Expand Toggle */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">Click Capsule to Expand / Collapse</h3>
                  <p className="text-xs text-zinc-400 max-w-lg">
                    Allow clicking the compact pill to manually toggle full player expansion.
                    Particularly useful when hover expansion is turned off.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.clickToExpand}
                  onClick={() => updateSetting('clickToExpand', !settings.clickToExpand)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.clickToExpand ? 'bg-[#1DB954]' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      settings.clickToExpand ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Pin Island Open Toggle */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Pin className="w-4 h-4 text-zinc-400" />
                    <h3 className="text-sm font-semibold text-white">Pin Island Always Open</h3>
                  </div>
                  <p className="text-xs text-zinc-400 max-w-lg">
                    Keeps the Dynamic Island permanently in its full expanded state on your desktop.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    window.niloSettings?.sendCommand({ type: 'toggle' } as any);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 border border-white/10 transition-colors"
                >
                  Use Tray Menu to Pin
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: APPEARANCE & GLOW */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#1DB954]" />
                  Visual Effects & Appearance
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Customize the glassmorphic aesthetics and ambient lighting.
                </p>
              </div>

              {/* Ambient Glow Toggle */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-6 shadow-xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Dynamic Reactive Ambient Glow</h3>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        settings.glowEnabled
                          ? 'bg-emerald-500/20 text-[#1ed760] border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-white/10'
                      }`}
                    >
                      {settings.glowEnabled ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 max-w-lg">
                    Casts a soft ambient illumination behind the island that reacts to music playback
                    and album artwork coloring.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.glowEnabled}
                  onClick={() => updateSetting('glowEnabled', !settings.glowEnabled)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.glowEnabled ? 'bg-[#1DB954]' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      settings.glowEnabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Visual Preview Card */}
              <div className="p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-[#14161f] to-[#0f1016] flex items-center justify-center min-h-[160px] relative overflow-hidden">
                {settings.glowEnabled && (
                  <div className="absolute w-44 h-16 rounded-full bg-[#1DB954]/30 blur-2xl pointer-events-none" />
                )}
                <div className="relative z-10 px-5 py-2.5 rounded-full bg-black/95 border border-white/15 shadow-2xl flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1DB954] flex items-center justify-center">
                    <Play className="w-2.5 h-2.5 text-black fill-black ml-0.5" />
                  </div>
                  <span className="text-xs font-medium text-white">Dynamic Island Preview</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PLAYBACK & TEST DEMO */}
          {activeTab === 'playback' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-[#1DB954]" />
                  Media Diagnostics & Test Simulation
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Inspect the live media connection or simulate playback to test morph animations.
                </p>
              </div>

              {/* Current Track Card */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Live Media Stream
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                    Source: {media.source}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {media.artworkUrl ? (
                    <img
                      src={media.artworkUrl}
                      alt="Cover"
                      className="w-16 h-16 rounded-xl object-cover shadow-lg border border-white/10"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/10">
                      <Sparkles className="w-6 h-6 text-zinc-500" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {media.title || 'No track playing (Idle)'}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {media.artist || 'Waiting for Spotify or browser playback...'}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {media.album || 'Dynamic Island is ready in background'}
                    </p>
                  </div>
                </div>

                {/* Quick Transport Controls */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCommand('previous')}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                      title="Previous"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCommand('toggle')}
                      className="p-2 rounded-lg bg-[#1DB954] hover:bg-[#1ed760] text-black transition-colors font-bold"
                      title="Play / Pause"
                    >
                      {media.isPlaying ? (
                        <Pause className="w-4 h-4 fill-black" />
                      ) : (
                        <Play className="w-4 h-4 fill-black ml-0.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCommand('next')}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                      title="Next"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleTriggerDemo}
                    disabled={demoActive}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      demoActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-[#1DB954]/20 hover:bg-[#1DB954]/30 text-[#1ed760] border border-[#1DB954]/30'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{demoActive ? 'Demo Active (10s)...' : 'Test 10s Demo Animation'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ABOUT & SYSTEM */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#1DB954]" />
                  System & Application Info
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Companion settings app for Spotify Dynamic Island (Nilo).
                </p>
              </div>

              {/* Startup Toggle */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">Launch at Startup</h3>
                  <p className="text-xs text-zinc-400 max-w-lg">
                    Automatically start Nilo Dynamic Island in the background when you log into Windows.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.launchOnStartup}
                  onClick={() => updateSetting('launchOnStartup', !settings.launchOnStartup)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.launchOnStartup ? 'bg-[#1DB954]' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      settings.launchOnStartup ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Architecture specs */}
              <div className="bg-[#14161f] border border-white/10 rounded-2xl p-5 space-y-3 text-xs">
                <h3 className="font-semibold text-white">System Architecture</h3>
                <div className="grid grid-cols-2 gap-3 text-zinc-400 font-mono text-[11px]">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-zinc-500 block">SMTC Provider</span>
                    <span className="text-zinc-200">Windows Global System Media Transport</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-zinc-500 block">Web Extension Bridge</span>
                    <span className="text-zinc-200">WebSocket 127.0.0.1:9876</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-zinc-500 block">Display Placement</span>
                    <span className="text-[#1ed760] font-bold">
                      {settings.position.toUpperCase()} (Margin: {settings.edgeMargin}px)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-zinc-500 block">Hover Morph Feature</span>
                    <span className={settings.hoverEnabled ? 'text-emerald-400' : 'text-amber-400'}>
                      {settings.hoverEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer bar */}
      <footer className="px-6 py-3 border-t border-white/10 bg-[#101217] flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <span>Nilo v1.0.0</span>
          <span>•</span>
          <span>Standalone Configuration Companion</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-emerald-400 flex items-center gap-1 font-medium">
            <Check className="w-3.5 h-3.5" /> Changes apply instantly
          </span>
          <button
            onClick={() => window.niloSettings?.closeSettingsWindow()}
            className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
          >
            Close Settings
          </button>
        </div>
      </footer>
    </div>
  );
};
