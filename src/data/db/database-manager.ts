import { IndexedDbAdapter, type IDatabaseAdapter } from './database-adapter';
import { TrackRepository } from '../repositories/track-repository';
import { AudioFileRepository } from '../repositories/audio-file-repository';
import { ArtistRepository } from '../repositories/artist-repository';
import { AlbumRepository } from '../repositories/album-repository';
import { GenreRepository } from '../repositories/genre-repository';
import { FolderRepository } from '../repositories/folder-repository';
import { PlaylistRepository } from '../repositories/playlist-repository';
import { HistoryRepository } from '../repositories/history-repository';
import { QueueRepository } from '../repositories/queue-repository';
import { LyricsRepository } from '../repositories/lyrics-repository';
import { RepositoryTokens } from '../../app/container/service-tokens';
import type { ServiceContainer } from '../../app/container/service-container';
import { Logger } from '../../core/logging/logger';

export class DatabaseManager {
  private readonly adapter: IDatabaseAdapter;
  private readonly logger = new Logger('DatabaseManager');

  constructor(adapter?: IDatabaseAdapter) {
    this.adapter = adapter || new IndexedDbAdapter();
  }

  public getAdapter(): IDatabaseAdapter {
    return this.adapter;
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Database Subsystem...');
    await this.adapter.open();
    this.logger.info('Database Subsystem initialized.');
  }

  public registerRepositories(container: ServiceContainer): void {
    container.registerSingleton(RepositoryTokens.TrackRepository, new TrackRepository(this.adapter));
    container.registerSingleton(RepositoryTokens.AudioFileRepository, new AudioFileRepository(this.adapter));
    container.registerSingleton(RepositoryTokens.ArtistRepository, new ArtistRepository(this.adapter));
    container.registerSingleton(RepositoryTokens.AlbumRepository, new AlbumRepository(this.adapter));
    container.registerSingleton(RepositoryTokens.GenreRepository, new GenreRepository(this.adapter));
    container.registerSingleton(RepositoryTokens.FolderRepository, new FolderRepository(this.adapter));
    container.registerSingleton(RepositoryTokens.PlaylistRepository, new PlaylistRepository(this.adapter));
    container.registerSingleton(RepositoryTokens.HistoryRepository, new HistoryRepository(this.adapter));
    container.registerSingleton(RepositoryTokens.QueueRepository, new QueueRepository(this.adapter));
    container.registerSingleton(RepositoryTokens.LyricsRepository, new LyricsRepository(this.adapter));
    this.logger.info('All database repositories registered in ServiceContainer.');
  }

  public close(): void {
    this.adapter.close();
  }
}
