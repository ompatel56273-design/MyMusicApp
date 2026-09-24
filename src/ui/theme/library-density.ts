/**
 * Library Density Types & Definitions for MyMusicApp.
 * Provides user-selectable information density modes (Comfortable, Standard, Compact)
 * for library tracks, albums, artists, playlists, folders, and search results.
 */

export type LibraryDensityId = 'comfortable' | 'standard' | 'compact';

export interface LibraryDensityDefinition {
  id: LibraryDensityId;
  name: string;
  description: string;
  icon: string;
  rowHeight: number;
  rowHeightCss: string;
  itemPadding: string;
  gridGap: string;
  sectionGap: string;
  artworkSize: string;
  cardPadding: string;
}

export const DEFAULT_LIBRARY_DENSITY: LibraryDensityId = 'standard';

export const LIBRARY_DENSITIES: Record<LibraryDensityId, LibraryDensityDefinition> = {
  comfortable: {
    id: 'comfortable',
    name: 'Comfortable',
    description: 'Spacious presentation with larger row heights, relaxed padding, and extra breathing room',
    icon: 'maximize-2',
    rowHeight: 64,
    rowHeightCss: '64px',
    itemPadding: '10px 18px',
    gridGap: 'var(--space-5)',
    sectionGap: 'var(--space-8)',
    artworkSize: '44px',
    cardPadding: '18px'
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'Balanced default layout with standard row heights and natural spacing',
    icon: 'layout',
    rowHeight: 56,
    rowHeightCss: '56px',
    itemPadding: '8px 14px',
    gridGap: 'var(--space-4)',
    sectionGap: 'var(--space-6)',
    artworkSize: '38px',
    cardPadding: '14px'
  },
  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'Dense streamlined layout maximizing screen efficiency with tighter spacing and rows',
    icon: 'minimize-2',
    rowHeight: 46,
    rowHeightCss: '46px',
    itemPadding: '4px 10px',
    gridGap: 'var(--space-3)',
    sectionGap: 'var(--space-4)',
    artworkSize: '32px',
    cardPadding: '10px'
  }
};

export function getLibraryDensity(id: LibraryDensityId): LibraryDensityDefinition {
  return LIBRARY_DENSITIES[id] ?? LIBRARY_DENSITIES[DEFAULT_LIBRARY_DENSITY];
}

export function getAllLibraryDensities(): readonly LibraryDensityDefinition[] {
  return Object.values(LIBRARY_DENSITIES);
}
