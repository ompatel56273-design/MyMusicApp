import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbAdapter } from '../../src/data/db/database-adapter';
import { STORES } from '../../src/data/db/schema';

describe('IndexedDbAdapter', () => {
  let adapter: IndexedDbAdapter;

  beforeEach(async () => {
    const testDbName = `test_db_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    adapter = new IndexedDbAdapter(testDbName, 1);
    await adapter.open();
  });

  afterEach(() => {
    adapter.close();
  });

  it('should open database and report isOpen = true', () => {
    expect(adapter.isOpen()).toBe(true);
  });

  it('should put and get an item from a store', async () => {
    const item = { id: 'track_1', title: 'Bohemian Rhapsody', artistId: 'queen_1' };
    await adapter.put(STORES.TRACKS, item);

    const retrieved = await adapter.get<typeof item>(STORES.TRACKS, 'track_1');
    expect(retrieved).toEqual(item);
  });

  it('should perform batch put and count items', async () => {
    const items = [
      { id: 'track_10', title: 'Song 10' },
      { id: 'track_11', title: 'Song 11' },
      { id: 'track_12', title: 'Song 12' }
    ];

    await adapter.putBatch(STORES.TRACKS, items);
    const count = await adapter.count(STORES.TRACKS);
    expect(count).toBe(3);
  });

  it('should query items using indexes', async () => {
    const item = { id: 'file_1', path: '/music/song.flac', sizeBytes: 1000, modifiedTimeMs: 12345 };
    await adapter.put(STORES.AUDIO_FILES, item);

    const byPath = await adapter.getByIndex<typeof item>(STORES.AUDIO_FILES, 'by_path', '/music/song.flac');
    expect(byPath).toEqual(item);
  });

  it('should execute multi-store atomic transaction', async () => {
    const result = await adapter.transaction(
      [STORES.TRACKS, STORES.AUDIO_FILES],
      'readwrite',
      async (tx) => {
        const trackStore = tx.objectStore(STORES.TRACKS);
        const fileStore = tx.objectStore(STORES.AUDIO_FILES);

        trackStore.put({ id: 'tx_t1', title: 'Atomic Song' });
        fileStore.put({ id: 'tx_f1', path: '/atomic/path.mp3' });
        return 'success';
      }
    );

    expect(result).toBe('success');
    expect(await adapter.get(STORES.TRACKS, 'tx_t1')).toBeDefined();
    expect(await adapter.get(STORES.AUDIO_FILES, 'tx_f1')).toBeDefined();
  });
});
