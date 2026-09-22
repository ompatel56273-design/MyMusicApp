export type AppRoute = 'home' | 'library' | 'playlists' | 'galaxy' | 'settings' | 'search' | 'nowplaying';

export type LibraryTab = 'songs' | 'albums' | 'artists' | 'genres' | 'folders' | 'favorites';

export interface RouteParams {
  readonly id?: string | undefined;
  readonly tab?: LibraryTab | undefined;
  readonly query?: string | undefined;
}

export interface RouteState {
  readonly route: AppRoute;
  readonly params: RouteParams;
  readonly timestamp: number;
}
