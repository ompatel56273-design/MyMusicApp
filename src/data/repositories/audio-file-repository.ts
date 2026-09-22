import type { IAudioFileRepository } from '../../domain/repositories/repository-contracts';
import type { AudioFile } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class AudioFileRepository implements IAudioFileRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getById(id: EntityId): Promise<AudioFile | null> {
    return this.db.get<AudioFile>(STORES.AUDIO_FILES, id);
  }

  public async getByPath(path: string): Promise<AudioFile | null> {
    return this.db.getByIndex<AudioFile>(STORES.AUDIO_FILES, 'by_path', path);
  }

  public async save(file: AudioFile): Promise<void> {
    await this.db.put(STORES.AUDIO_FILES, file);
  }

  public async saveBatch(files: readonly AudioFile[]): Promise<void> {
    await this.db.putBatch(STORES.AUDIO_FILES, files);
  }

  public async delete(id: EntityId): Promise<void> {
    await this.db.delete(STORES.AUDIO_FILES, id);
  }

  public async listAllPaths(): Promise<Map<string, { id: EntityId; sizeBytes: number; modifiedTimeMs: number }>> {
    const files = await this.db.getAll<AudioFile>(STORES.AUDIO_FILES);
    const map = new Map<string, { id: EntityId; sizeBytes: number; modifiedTimeMs: number }>();
    for (const f of files) {
      map.set(f.path, {
        id: f.id,
        sizeBytes: f.sizeBytes,
        modifiedTimeMs: f.modifiedTimeMs
      });
    }
    return map;
  }
}
