export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface ThemeChangeListener {
  (resolvedTheme: ResolvedTheme, preference: ThemePreference): void;
}

const STORAGE_KEY = 'mymusicapp_theme_preference';

/**
 * Centralized Theme Manager for MyMusicApp.
 * Supports:
 * - 'dark': Dark Atmosphere (Default approved theme)
 * - 'light': Light Mode
 * - 'system': Follows OS prefers-color-scheme dynamically via matchMedia
 *
 * Persists preference and updates documentElement data-theme attribute.
 */
export class ThemeManager {
  private static instance: ThemeManager | null = null;
  private preference: ThemePreference = 'dark';
  private mediaQuery: MediaQueryList | null = null;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private listeners: Set<ThemeChangeListener> = new Set();

  private constructor() {
    this.loadPreference();
    this.setupMediaQuery();
    this.applyTheme();
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

  public subscribe(listener: ThemeChangeListener): () => void {
    this.listeners.add(listener);
    // Immediately notify current state
    listener(this.getResolvedTheme(), this.preference);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private loadPreference(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
          this.preference = stored;
          return;
        }
      }
    } catch (_e) {
      // Fallback to default
    }
    this.preference = 'dark';
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
}
