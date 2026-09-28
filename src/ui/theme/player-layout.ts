/**
 * Player Layout Types & Definitions for MyMusicApp.
 * Provides user-selectable player presentation modes (Standard, Compact, Expanded).
 */

export type PlayerLayoutId = 'standard' | 'compact' | 'expanded';

export interface PlayerLayoutDefinition {
  id: PlayerLayoutId;
  name: string;
  description: string;
  icon: string;
  artworkMaxWidth: string;
  gridColumns: string;
  gridGap: string;
  layoutPadding: string;
  controlsMaxWidth: string;
}

export const DEFAULT_PLAYER_LAYOUT: PlayerLayoutId = 'standard';

export const PLAYER_LAYOUTS: Record<PlayerLayoutId, PlayerLayoutDefinition> = {
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'Default balanced presentation with full hero artwork and side panel',
    icon: 'layout',
    artworkMaxWidth: '440px',
    gridColumns: 'minmax(0, 1.1fr) minmax(360px, 0.9fr)',
    gridGap: 'var(--space-8)',
    layoutPadding: 'var(--space-6) var(--space-8)',
    controlsMaxWidth: '480px'
  },
  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'Streamlined reduced footprint prioritizing essential controls and info',
    icon: 'minimize-2',
    artworkMaxWidth: '260px',
    gridColumns: 'minmax(0, 0.85fr) minmax(320px, 1.15fr)',
    gridGap: 'var(--space-4)',
    layoutPadding: 'var(--space-4) var(--space-6)',
    controlsMaxWidth: '400px'
  },
  expanded: {
    id: 'expanded',
    name: 'Expanded',
    description: 'Spacious presentation with enlarged hero artwork and prominent controls',
    icon: 'maximize-2',
    artworkMaxWidth: '540px',
    gridColumns: 'minmax(0, 1.25fr) minmax(380px, 0.75fr)',
    gridGap: 'var(--space-10)',
    layoutPadding: 'var(--space-8) var(--space-10)',
    controlsMaxWidth: '560px'
  }
};

export function getPlayerLayout(id: PlayerLayoutId): PlayerLayoutDefinition {
  return PLAYER_LAYOUTS[id] ?? PLAYER_LAYOUTS[DEFAULT_PLAYER_LAYOUT];
}

export function getAllPlayerLayouts(): readonly PlayerLayoutDefinition[] {
  return Object.values(PLAYER_LAYOUTS);
}
