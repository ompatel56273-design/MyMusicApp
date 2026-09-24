import {
  type AccentThemeId,
  type AccentThemeDefinition,
  DEFAULT_ACCENT_THEME,
  ACCENT_THEMES,
  getAccentTheme,
  getAllAccentThemes
} from './accent-theme';
import {
  type AmbientMode,
  type AmbientModeDefinition,
  DEFAULT_AMBIENT_MODE,
  AMBIENT_MODES,
  getAmbientMode,
  getAllAmbientModes
} from './ambient-background';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface ThemeChangeListener {
  (resolvedTheme: ResolvedTheme, preference: ThemePreference): void;
}

export interface AccentThemeChangeListener {
  (accent: AccentThemeId, definition: AccentThemeDefinition): void;
}

export interface AmbientModeChangeListener {
  (mode: AmbientMode, definition: AmbientModeDefinition): void;
}

const STORAGE_KEY = 'mymusicapp_theme_preference';
const ACCENT_STORAGE_KEY = 'mymusicapp_accent_theme';
const AMBIENT_STORAGE_KEY = 'mymusicapp_ambient_mode';

/**
 * Centralized Theme Manager for MyMusicApp.
 * Supports:
 * - 'dark': Dark Atmosphere (Default approved theme)
 * - 'light': Light Mode
 * - 'system': Follows OS prefers-color-scheme dynamically via matchMedia
 * - Accent Themes: User-selectable color accents (Purple, Cyan, Blue, Emerald, Amber, Pink, Rose)
 * - Ambient Backgrounds: Optional atmospheric visual backgrounds (Off, Aurora, Gradient Flow, Soft Glow, Static Gradient)
 *
 * Persists preferences and updates documentElement attributes and custom CSS properties.
 */
export class ThemeManager {
  private static instance: ThemeManager | null = null;
  private preference: ThemePreference = 'dark';
  private accentTheme: AccentThemeId = DEFAULT_ACCENT_THEME;
  private ambientMode: AmbientMode = DEFAULT_AMBIENT_MODE;
  private mediaQuery: MediaQueryList | null = null;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private listeners: Set<ThemeChangeListener> = new Set();
  private accentListeners: Set<AccentThemeChangeListener> = new Set();
  private ambientListeners: Set<AmbientModeChangeListener> = new Set();

  private constructor() {
    this.loadPreference();
    this.setupMediaQuery();
    this.applyTheme();
    this.applyAccentTheme();
    this.applyAmbientMode();
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  public getPreference(): ThemePreference {
    return this.preference;
  }

  public getResolvedTheme(): ResolvedTheme {
    if (this.preference === 'system') {
      return this.getSystemPreferredTheme();
    }
    return this.preference;
  }

  public setPreference(pref: ThemePreference): void {
    if (this.preference === pref) return;
    this.preference = pref;
    this.savePreference();
    this.applyTheme();
    this.notifyListeners();
  }

  public getAccentTheme(): AccentThemeId {
    return this.accentTheme;
  }

  public getAccentThemeDefinition(): AccentThemeDefinition {
    return getAccentTheme(this.accentTheme);
  }

  public getAvailableAccentThemes(): readonly AccentThemeDefinition[] {
    return getAllAccentThemes();
  }

  public setAccentTheme(accent: AccentThemeId | string): void {
    const validAccent = (accent && accent in ACCENT_THEMES ? accent : DEFAULT_ACCENT_THEME) as AccentThemeId;
    if (this.accentTheme === validAccent) return;
    this.accentTheme = validAccent;
    this.saveAccentPreference();
    this.applyAccentTheme();
    this.notifyAccentListeners();
  }

  public getAmbientMode(): AmbientMode {
    return this.ambientMode;
  }

  public getAmbientModeDefinition(): AmbientModeDefinition {
    return getAmbientMode(this.ambientMode);
  }

  public getAvailableAmbientModes(): readonly AmbientModeDefinition[] {
    return getAllAmbientModes();
  }

  public setAmbientMode(mode: AmbientMode | string): void {
    const validMode = (mode && mode in AMBIENT_MODES ? mode : DEFAULT_AMBIENT_MODE) as AmbientMode;
    if (this.ambientMode === validMode) return;
    this.ambientMode = validMode;
    this.saveAmbientPreference();
    this.applyAmbientMode();
    this.notifyAmbientListeners();
  }

  public subscribe(listener: ThemeChangeListener): () => void {
    this.listeners.add(listener);
    // Immediately notify current state
    listener(this.getResolvedTheme(), this.preference);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeAccent(listener: AccentThemeChangeListener): () => void {
    this.accentListeners.add(listener);
    // Immediately notify current state
    listener(this.accentTheme, this.getAccentThemeDefinition());
    return () => {
      this.accentListeners.delete(listener);
    };
  }

  public subscribeAmbient(listener: AmbientModeChangeListener): () => void {
    this.ambientListeners.add(listener);
    // Immediately notify current state
    listener(this.ambientMode, this.getAmbientModeDefinition());
    return () => {
      this.ambientListeners.delete(listener);
    };
  }

  private loadPreference(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
          this.preference = stored;
        }
        const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentThemeId | null;
        if (storedAccent && storedAccent in ACCENT_THEMES) {
          this.accentTheme = storedAccent;
        }
        const storedAmbient = localStorage.getItem(AMBIENT_STORAGE_KEY) as AmbientMode | null;
        if (storedAmbient && storedAmbient in AMBIENT_MODES) {
          this.ambientMode = storedAmbient;
        }
      }
    } catch (_e) {
      // Fallback to default
    }
  }

  private savePreference(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, this.preference);
      }
    } catch (_e) {
      // Ignore storage errors in restricted contexts
    }
  }

  private saveAccentPreference(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACCENT_STORAGE_KEY, this.accentTheme);
      }
    } catch (_e) {
      // Ignore storage errors in restricted contexts
    }
  }

  private saveAmbientPreference(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AMBIENT_STORAGE_KEY, this.ambientMode);
      }
    } catch (_e) {
      // Ignore storage errors in restricted contexts
    }
  }

  private getSystemPreferredTheme(): ResolvedTheme {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }

  private setupMediaQuery(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener = () => {
      if (this.preference === 'system') {
        this.applyTheme();
        this.notifyListeners();
      }
    };

    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', this.mediaQueryListener);
    } else if ('addListener' in this.mediaQuery) {
      // Fallback for older WebKit / Safari
      (this.mediaQuery as { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(this.mediaQueryListener);
    }
  }

  private applyTheme(): void {
    const resolved = this.getResolvedTheme();
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.style.colorScheme = resolved;
    }
  }

  public applyAccentTheme(): void {
    const def = this.getAccentThemeDefinition();
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-accent', this.accentTheme);
      const rootStyle = document.documentElement.style;
      if (rootStyle) {
        if (typeof rootStyle.setProperty === 'function') {
          rootStyle.setProperty('--color-accent', def.primaryColor);
          rootStyle.setProperty('--color-accent-primary', def.primaryColor);
          rootStyle.setProperty('--color-accent-hover', def.hoverColor);
          rootStyle.setProperty('--color-accent-active', def.activeColor);
          rootStyle.setProperty('--color-accent-muted', def.mutedBackground);
          rootStyle.setProperty('--color-accent-subtle', def.subtleBackground);
          rootStyle.setProperty('--color-accent-contrast', def.contrastText);
          rootStyle.setProperty('--color-accent-purple', def.primaryColor);
          rootStyle.setProperty('--color-accent-purple-glow', def.glowColor);
          rootStyle.setProperty('--color-accent-purple-deep', def.deepColor);
          rootStyle.setProperty('--color-accent-purple-soft', def.softColor);
          rootStyle.setProperty('--color-accent-gradient', def.gradient);
          rootStyle.setProperty('--color-text-accent', def.glowColor);
          rootStyle.setProperty('--shadow-glow', def.glowShadow);
          rootStyle.setProperty('--shadow-glow-purple', def.glowShadow);
          rootStyle.setProperty('--shadow-glow-pill', def.pillShadow);
          rootStyle.setProperty('--glass-border-highlight', def.borderHighlight);
          rootStyle.setProperty('--glass-border-interactive', def.borderInteractive);
        } else {
          (rootStyle as any)['--color-accent'] = def.primaryColor;
          (rootStyle as any)['--color-accent-primary'] = def.primaryColor;
          (rootStyle as any)['--color-accent-hover'] = def.hoverColor;
          (rootStyle as any)['--color-accent-active'] = def.activeColor;
          (rootStyle as any)['--color-accent-muted'] = def.mutedBackground;
          (rootStyle as any)['--color-accent-subtle'] = def.subtleBackground;
          (rootStyle as any)['--color-accent-contrast'] = def.contrastText;
          (rootStyle as any)['--color-accent-purple'] = def.primaryColor;
          (rootStyle as any)['--color-accent-purple-glow'] = def.glowColor;
          (rootStyle as any)['--color-accent-purple-deep'] = def.deepColor;
          (rootStyle as any)['--color-accent-purple-soft'] = def.softColor;
          (rootStyle as any)['--color-accent-gradient'] = def.gradient;
          (rootStyle as any)['--color-text-accent'] = def.glowColor;
          (rootStyle as any)['--shadow-glow'] = def.glowShadow;
          (rootStyle as any)['--shadow-glow-purple'] = def.glowShadow;
          (rootStyle as any)['--shadow-glow-pill'] = def.pillShadow;
          (rootStyle as any)['--glass-border-highlight'] = def.borderHighlight;
          (rootStyle as any)['--glass-border-interactive'] = def.borderInteractive;
        }
      }
    }
  }

  public applyAmbientMode(): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-ambient', this.ambientMode);

      let bgContainer = document.getElementById('app-ambient-bg');
      if (!bgContainer && document.body) {
        bgContainer = document.createElement('div');
        bgContainer.id = 'app-ambient-bg';
        bgContainer.setAttribute('aria-hidden', 'true');
        bgContainer.innerHTML = `
          <div class="ambient-blob ambient-blob-1"></div>
          <div class="ambient-blob ambient-blob-2"></div>
          <div class="ambient-blob ambient-blob-3"></div>
        `;
        if (typeof document.body.prepend === 'function') {
          document.body.prepend(bgContainer);
        } else if (document.body.firstChild) {
          document.body.insertBefore(bgContainer, document.body.firstChild);
        } else {
          document.body.appendChild(bgContainer);
        }
      }

      if (bgContainer) {
        bgContainer.className = `ambient-bg-root ambient-mode-${this.ambientMode}`;
      }
    }
  }

  private notifyListeners(): void {
    const resolved = this.getResolvedTheme();
    for (const listener of this.listeners) {
      try {
        listener(resolved, this.preference);
      } catch (err) {
        console.error('Error in ThemeManager listener:', err);
      }
    }
  }

  private notifyAccentListeners(): void {
    const def = this.getAccentThemeDefinition();
    for (const listener of this.accentListeners) {
      try {
        listener(this.accentTheme, def);
      } catch (err) {
        console.error('Error in ThemeManager accent listener:', err);
      }
    }
  }

  private notifyAmbientListeners(): void {
    const def = this.getAmbientModeDefinition();
    for (const listener of this.ambientListeners) {
      try {
        listener(this.ambientMode, def);
      } catch (err) {
        console.error('Error in ThemeManager ambient listener:', err);
      }
    }
  }
}
