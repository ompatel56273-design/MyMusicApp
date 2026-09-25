export type DashboardSectionId =
  | 'recently-played'
  | 'playlists'
  | 'artists'
  | 'favorites'
  | 'recently-added'
  | 'most-played'
  | 'albums'
  | 'genres'
  | 'folders';

export interface DashboardSectionDefinition {
  readonly id: DashboardSectionId;
  readonly label: string;
  readonly defaultVisible: boolean;
  readonly defaultOrder: number;
}

export interface DashboardSectionConfig {
  readonly id: DashboardSectionId;
  readonly label: string;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly order: number;
}

export interface DashboardSettings {
  readonly sectionOrder: readonly DashboardSectionId[];
  readonly hiddenSections: readonly DashboardSectionId[];
}

export const SUPPORTED_DASHBOARD_SECTIONS: readonly DashboardSectionDefinition[] = [
  { id: 'recently-played', label: 'Recently Played', defaultVisible: true, defaultOrder: 1 },
  { id: 'playlists', label: 'Playlists & Mixes', defaultVisible: true, defaultOrder: 2 },
  { id: 'artists', label: 'Top Artists', defaultVisible: true, defaultOrder: 3 },
  { id: 'favorites', label: 'Favorites', defaultVisible: true, defaultOrder: 4 },
  { id: 'recently-added', label: 'Recently Added', defaultVisible: true, defaultOrder: 5 },
  { id: 'most-played', label: 'Most Played', defaultVisible: true, defaultOrder: 6 },
  { id: 'albums', label: 'Top Albums', defaultVisible: true, defaultOrder: 7 },
  { id: 'genres', label: 'Top Genres', defaultVisible: true, defaultOrder: 8 },
  { id: 'folders', label: 'Folders', defaultVisible: true, defaultOrder: 9 }
] as const;

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  sectionOrder: [
    'recently-played',
    'playlists',
    'artists',
    'favorites',
    'recently-added',
    'most-played',
    'albums',
    'genres',
    'folders'
  ],
  hiddenSections: []
};
