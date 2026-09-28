/**
 * Ambient Background System for MyMusicApp.
 * Defines ambient background modes, semantic descriptions, and helper utilities.
 */

export type AmbientMode = 'off' | 'aurora' | 'gradient-flow' | 'soft-glow' | 'static-gradient';

export interface AmbientModeDefinition {
  id: AmbientMode;
  name: string;
  description: string;
  icon: string;
  animated: boolean;
}

export const DEFAULT_AMBIENT_MODE: AmbientMode = 'off';

export const AMBIENT_MODES: Record<AmbientMode, AmbientModeDefinition> = {
  off: {
    id: 'off',
    name: 'Off (Default)',
    description: 'Clean, solid dark background preserving original UI aesthetics',
    icon: 'slash',
    animated: false
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora Borealis',
    description: 'Dynamic drifting cosmic color waves matching your accent color',
    icon: 'sparkles',
    animated: true
  },
  'gradient-flow': {
    id: 'gradient-flow',
    name: 'Gradient Flow',
    description: 'Smooth liquid gradient animation with deep atmospheric hues',
    icon: 'waves',
    animated: true
  },
  'soft-glow': {
    id: 'soft-glow',
    name: 'Soft Ambient Glow',
    description: 'Subtle pulsing radial glow centered behind your player',
    icon: 'sun',
    animated: true
  },
  'static-gradient': {
    id: 'static-gradient',
    name: 'Static Gradient',
    description: 'Elegant non-animated multi-tone background gradient',
    icon: 'layers',
    animated: false
  }
};

/**
 * Helper to safely get an ambient mode definition.
 */
export function getAmbientMode(mode: string | null | undefined): AmbientModeDefinition {
  if (mode && mode in AMBIENT_MODES) {
    return AMBIENT_MODES[mode as AmbientMode];
  }
  return AMBIENT_MODES[DEFAULT_AMBIENT_MODE];
}

/**
 * Returns an array of all available ambient background modes.
 */
export function getAllAmbientModes(): AmbientModeDefinition[] {
  return Object.values(AMBIENT_MODES);
}
