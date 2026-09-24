/**
 * Accent Theme System for MyMusicApp.
 * Provides strongly typed accent theme definitions, curated color palettes,
 * derived UI tokens, and helper resolution functions.
 */

export type AccentThemeId = 'purple' | 'cyan' | 'blue' | 'emerald' | 'amber' | 'pink' | 'rose';

export interface AccentThemeDefinition {
  readonly id: AccentThemeId;
  readonly name: string;
  readonly description: string;
  readonly primaryColor: string;
  readonly glowColor: string;
  readonly deepColor: string;
  readonly softColor: string;
  readonly hoverColor: string;
  readonly activeColor: string;
  readonly secondaryColor: string;
  readonly gradient: string;
  readonly glowShadow: string;
  readonly pillShadow: string;
  readonly borderHighlight: string;
  readonly borderInteractive: string;
  readonly mutedBackground: string;
  readonly subtleBackground: string;
  readonly contrastText: string;
}

export const DEFAULT_ACCENT_THEME: AccentThemeId = 'purple';

export const ACCENT_THEMES: Record<AccentThemeId, AccentThemeDefinition> = {
  purple: {
    id: 'purple',
    name: 'Neon Purple',
    description: 'Signature cosmic purple with vibrant ultraviolet highlights',
    primaryColor: '#8b5cf6',
    glowColor: '#a855f7',
    deepColor: '#7c3aed',
    softColor: '#c084fc',
    hoverColor: '#9d72f8',
    activeColor: '#6d28d9',
    secondaryColor: '#38bdf8',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    glowShadow: '0 0 20px rgba(168, 85, 247, 0.35)',
    pillShadow: '0 4px 20px rgba(139, 92, 246, 0.45)',
    borderHighlight: 'rgba(168, 85, 247, 0.4)',
    borderInteractive: 'rgba(168, 85, 247, 0.45)',
    mutedBackground: 'rgba(139, 92, 246, 0.2)',
    subtleBackground: 'rgba(139, 92, 246, 0.12)',
    contrastText: '#ffffff'
  },
  cyan: {
    id: 'cyan',
    name: 'Electric Cyan',
    description: 'High-energy cybernetic cyan with crisp contrast',
    primaryColor: '#06b6d4',
    glowColor: '#38bdf8',
    deepColor: '#0891b2',
    softColor: '#67e8f9',
    hoverColor: '#22d3ee',
    activeColor: '#0e7490',
    secondaryColor: '#818cf8',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #06b6d4 100%)',
    glowShadow: '0 0 20px rgba(56, 189, 248, 0.35)',
    pillShadow: '0 4px 20px rgba(6, 182, 212, 0.45)',
    borderHighlight: 'rgba(56, 189, 248, 0.4)',
    borderInteractive: 'rgba(6, 182, 212, 0.45)',
    mutedBackground: 'rgba(6, 182, 212, 0.2)',
    subtleBackground: 'rgba(6, 182, 212, 0.12)',
    contrastText: '#ffffff'
  },
  blue: {
    id: 'blue',
    name: 'Ocean Blue',
    description: 'Deep oceanic blue with smooth ambient radiance',
    primaryColor: '#3b82f6',
    glowColor: '#60a5fa',
    deepColor: '#2563eb',
    softColor: '#93c5fd',
    hoverColor: '#4f93f7',
    activeColor: '#1d4ed8',
    secondaryColor: '#06b6d4',
    gradient: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
    glowShadow: '0 0 20px rgba(96, 165, 250, 0.35)',
    pillShadow: '0 4px 20px rgba(59, 130, 246, 0.45)',
    borderHighlight: 'rgba(96, 165, 250, 0.4)',
    borderInteractive: 'rgba(59, 130, 246, 0.45)',
    mutedBackground: 'rgba(59, 130, 246, 0.2)',
    subtleBackground: 'rgba(59, 130, 246, 0.12)',
    contrastText: '#ffffff'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Green',
    description: 'Fresh organic emerald green with luminous highlights',
    primaryColor: '#10b981',
    glowColor: '#34d399',
    deepColor: '#059669',
    softColor: '#6ee7b7',
    hoverColor: '#28caa5',
    activeColor: '#047857',
    secondaryColor: '#06b6d4',
    gradient: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
    glowShadow: '0 0 20px rgba(52, 211, 153, 0.35)',
    pillShadow: '0 4px 20px rgba(16, 185, 129, 0.45)',
    borderHighlight: 'rgba(52, 211, 153, 0.4)',
    borderInteractive: 'rgba(16, 185, 129, 0.45)',
    mutedBackground: 'rgba(16, 185, 129, 0.2)',
    subtleBackground: 'rgba(16, 185, 129, 0.12)',
    contrastText: '#ffffff'
  },
  amber: {
    id: 'amber',
    name: 'Amber Gold',
    description: 'Warm golden amber with sunset warmth and brilliance',
    primaryColor: '#f59e0b',
    glowColor: '#fbbf24',
    deepColor: '#d97706',
    softColor: '#fcd34d',
    hoverColor: '#fab728',
    activeColor: '#b45309',
    secondaryColor: '#f43f5e',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
    glowShadow: '0 0 20px rgba(251, 191, 36, 0.35)',
    pillShadow: '0 4px 20px rgba(245, 158, 11, 0.45)',
    borderHighlight: 'rgba(251, 191, 36, 0.4)',
    borderInteractive: 'rgba(245, 158, 11, 0.45)',
    mutedBackground: 'rgba(245, 158, 11, 0.2)',
    subtleBackground: 'rgba(245, 158, 11, 0.12)',
    contrastText: '#ffffff'
  },
  pink: {
    id: 'pink',
    name: 'Neon Pink',
    description: 'Vivid synthwave pink with radiant saturation',
    primaryColor: '#ec4899',
    glowColor: '#f472b6',
    deepColor: '#db2777',
    softColor: '#f9a8d4',
    hoverColor: '#f16cae',
    activeColor: '#be185d',
    secondaryColor: '#a855f7',
    gradient: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
    glowShadow: '0 0 20px rgba(244, 114, 182, 0.35)',
    pillShadow: '0 4px 20px rgba(236, 72, 153, 0.45)',
    borderHighlight: 'rgba(244, 114, 182, 0.4)',
    borderInteractive: 'rgba(236, 72, 153, 0.45)',
    mutedBackground: 'rgba(236, 72, 153, 0.2)',
    subtleBackground: 'rgba(236, 72, 153, 0.12)',
    contrastText: '#ffffff'
  },
  rose: {
    id: 'rose',
    name: 'Crimson Red',
    description: 'Bold cinematic crimson red with high-impact vitality',
    primaryColor: '#f43f5e',
    glowColor: '#fb7185',
    deepColor: '#e11d48',
    softColor: '#fda4af',
    hoverColor: '#f65874',
    activeColor: '#be123c',
    secondaryColor: '#ec4899',
    gradient: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
    glowShadow: '0 0 20px rgba(251, 113, 133, 0.35)',
    pillShadow: '0 4px 20px rgba(244, 63, 94, 0.45)',
    borderHighlight: 'rgba(251, 113, 133, 0.4)',
    borderInteractive: 'rgba(244, 63, 94, 0.45)',
    mutedBackground: 'rgba(244, 63, 94, 0.2)',
    subtleBackground: 'rgba(244, 63, 94, 0.12)',
    contrastText: '#ffffff'
  }
};

/**
 * Returns the AccentThemeDefinition for the provided ID, falling back to default if invalid.
 */
export function getAccentTheme(id?: string | null): AccentThemeDefinition {
  if (id && id in ACCENT_THEMES) {
    return ACCENT_THEMES[id as AccentThemeId];
  }
  return ACCENT_THEMES[DEFAULT_ACCENT_THEME];
}

/**
 * Returns all available predefined accent themes.
 */
export function getAllAccentThemes(): readonly AccentThemeDefinition[] {
  return Object.values(ACCENT_THEMES);
}
