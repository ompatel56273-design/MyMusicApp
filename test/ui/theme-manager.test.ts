import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { ThemeManager } from '../../src/ui/theme/theme-manager';
import { SettingsView } from '../../src/ui/views/settings-view';

setupMockDomEnvironment();

describe('ThemeManager & Settings Theme Modes', () => {
  let themeManager: ThemeManager;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    themeManager = ThemeManager.getInstance();
    themeManager.setPreference('dark');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with dark theme by default', () => {
    expect(themeManager.getPreference()).toBe('dark');
    expect(themeManager.getResolvedTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should switch to light theme and update documentElement data-theme', () => {
    themeManager.setPreference('light');
    expect(themeManager.getPreference()).toBe('light');
    expect(themeManager.getResolvedTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('mymusicapp_theme_preference')).toBe('light');
  });

  it('should switch to system theme and resolve from prefers-color-scheme', () => {
    themeManager.setPreference('system');
    expect(themeManager.getPreference()).toBe('system');
    expect(['dark', 'light']).toContain(themeManager.getResolvedTheme());
    expect(localStorage.getItem('mymusicapp_theme_preference')).toBe('system');
  });

  it('should notify subscribers when theme preference changes', () => {
    const listener = vi.fn();
    const unsub = themeManager.subscribe(listener);

    themeManager.setPreference('light');
    expect(listener).toHaveBeenCalledWith('light', 'light');

    themeManager.setPreference('dark');
    expect(listener).toHaveBeenCalledWith('dark', 'dark');

    unsub();
  });

  it('should mount SettingsView with functional theme cards and update theme on click', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const mockVisualizerService = {
      getSettings: vi.fn().mockResolvedValue({ enabled: true, mode: 'bars', fpsLimit: 60 }),
      setEnabled: vi.fn().mockResolvedValue(undefined),
      setMode: vi.fn().mockResolvedValue(undefined),
      saveSettings: vi.fn().mockResolvedValue(undefined)
    };

    const settingsView = new SettingsView({
      visualizerService: mockVisualizerService as any
    });

    settingsView.mount(container);

    const themeCards = container.querySelectorAll<HTMLElement>('.settings-theme-option');
    const darkCard = Array.from(themeCards).find(c => c.getAttribute('data-theme-val') === 'dark');
    const lightCard = Array.from(themeCards).find(c => c.getAttribute('data-theme-val') === 'light');
    const systemCard = Array.from(themeCards).find(c => c.getAttribute('data-theme-val') === 'system');

    expect(darkCard).toBeDefined();
    expect(lightCard).toBeDefined();
    expect(systemCard).toBeDefined();

    // Dark active initially
    expect(darkCard?.classList.contains('active')).toBe(true);

    // Click Light Card
    lightCard?.click();
    expect(themeManager.getPreference()).toBe('light');
    expect(lightCard?.classList.contains('active')).toBe(true);
    expect(darkCard?.classList.contains('active')).toBe(false);

    // Click System Card
    systemCard?.click();
    expect(themeManager.getPreference()).toBe('system');
    expect(systemCard?.classList.contains('active')).toBe(true);

    settingsView.unmount();
    container.remove();
  });

  it('should wire visualizer select options in SettingsView to VisualizerService', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const mockVisualizerService = {
      getSettings: vi.fn().mockResolvedValue({ enabled: true, mode: 'waveform', fpsLimit: 120 }),
      setEnabled: vi.fn().mockResolvedValue(undefined),
      setMode: vi.fn().mockResolvedValue(undefined),
      saveSettings: vi.fn().mockResolvedValue(undefined)
    };

    const settingsView = new SettingsView({
      visualizerService: mockVisualizerService as any
    });

    settingsView.mount(container);

    // Allow promise tick
    await new Promise(r => setTimeout(r, 0));

    const modeSelect = container.querySelector<HTMLSelectElement>('#settings-viz-mode');
    expect(modeSelect).not.toBeNull();
    expect(modeSelect?.value).toBe('waveform');

    if (modeSelect) {
      modeSelect.value = 'circular';
      modeSelect.dispatchEvent(new Event('change'));
      expect(mockVisualizerService.setMode).toHaveBeenCalledWith('circular');
    }

    settingsView.unmount();
    container.remove();
  });
});
