import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { IslandSettings, DEFAULT_SETTINGS } from '../../types/settings';

export class SettingsManager extends EventEmitter {
  private settings: IslandSettings;
  private filePath: string;
  private appInstance: any;

  constructor(customPath?: string, appInstance?: any) {
    super();
    this.appInstance = appInstance;

    if (customPath) {
      this.filePath = customPath;
    } else {
      this.filePath = this.resolveConfigPath();
    }
    this.settings = this.loadSettings();
  }

  public getSettings(): IslandSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<IslandSettings>): IslandSettings {
    this.settings = {
      ...this.settings,
      ...partial,
      position: 'center'
    };

    // Ensure topOffset is within valid screen bounds
    if (typeof this.settings.topOffset === 'number') {
      this.settings.topOffset = Math.max(0, Math.min(50, this.settings.topOffset));
    }

    this.saveSettings();
    this.applySystemPreferences();
    this.emit('settings-changed', this.getSettings());
    return this.getSettings();
  }

  public resetSettings(): IslandSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
    this.applySystemPreferences();
    this.emit('settings-changed', this.getSettings());
    return this.getSettings();
  }

  private resolveConfigPath(): string {
    try {
      if (this.appInstance && typeof this.appInstance.getPath === 'function') {
        return path.join(this.appInstance.getPath('userData'), 'nilo-settings.json');
      }
    } catch {}

    const home = os.homedir();
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appData, 'Nilo', 'nilo-settings.json');
    } else if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Nilo', 'nilo-settings.json');
    } else {
      const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      return path.join(configDir, 'nilo', 'nilo-settings.json');
    }
  }

  private loadSettings(): IslandSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(content);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          position: 'center'
        };
      }
    } catch (e) {
      console.error('[SettingsManager] Failed to load settings from file:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (e) {
      console.error('[SettingsManager] Failed to save settings to file:', e);
    }
  }

  private applySystemPreferences(): void {
    try {
      if (this.appInstance && typeof this.appInstance.setLoginItemSettings === 'function') {
        this.appInstance.setLoginItemSettings({
          openAtLogin: Boolean(this.settings.launchOnStartup)
        });
      }
    } catch (e) {
      console.warn('[SettingsManager] Could not update login item settings:', e);
    }
  }
}
