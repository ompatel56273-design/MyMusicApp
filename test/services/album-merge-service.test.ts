import { describe, it, expect, beforeEach } from 'vitest';
import { AlbumMergeService } from '../../src/services/library/album-merge-service';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { Album, Track } from '../../src/domain/entities/models';

class MockAlbumRepo {
  public albums: Album[] = [];

  async list() {
    return { items: this.albums, total: this.albums.length, offset: 0, limit: 10000 };
  }

  async getById(id: string) {
    return this.albums.find(a => a.id === id) || null;
  }

  async save(album: Album) {
    const idx = this.albums.findIndex(a => a.id === album.id);
    if (idx !== -1) {
      this.albums[idx] = album;
    } else {
      this.albums.push(album);
    }
  }

  async saveBatch(albums: readonly Album[]) {
    for (const a of albums) {
      await this.save(a);
    }
  }

  async delete(id: string) {
    this.albums = this.albums.filter(a => a.id !== id);
  }
}

class MockTrackRepo {
  public tracks: Track[] = [];

  async list(_options?: any, filter?: any) {
    let result = [...this.tracks];
    if (filter?.albumId) {
      result = result.filter(t => t.albumId === filter.albumId);
    }
    return { items: result, total: result.length, offset: 0, limit: 10000 };
  }

  async getById(id: string) {
    return this.tracks.find(t => t.id === id) || null;
  }

  async save(track: Track) {
    const idx = this.tracks.findIndex(t => t.id === track.id);
    if (idx !== -1) {
      this.tracks[idx] = track;
    } else {
      this.tracks.push(track);
    }
  }

  async saveBatch(tracks: readonly Track[]) {
    for (const t of tracks) {
      await this.save(t);
    }
  }

  async count() {
    return this.tracks.length;
  }
}

describe('AlbumMergeService', () => {
  let albumRepo: MockAlbumRepo;
  let trackRepo: MockTrackRepo;
  let eventBus: EventBus;
  let mergeService: AlbumMergeService;

  beforeEach(() => {
    albumRepo = new MockAlbumRepo();
    trackRepo = new MockTrackRepo();
    eventBus = new EventBus();

    mergeService = new AlbumMergeService({
      albumRepo: albumRepo as any,
      trackRepo: trackRepo as any,
      eventBus
    });
  });

  it('should normalize album titles and artists deterministically', () => {
    const key1 = mergeService.normalizeIdentityKey('Hybrid Theory', 'Linkin Park');
    const key2 = mergeService.normalizeIdentityKey(' hybrid theory  ', 'LINKIN PARK');
    const key3 = mergeService.normalizeIdentityKey('Hybrid Theory!', 'Linkin Park');

    expect(key1).toBe('hybrid theory:::linkin park');
    expect(key2).toBe('hybrid theory:::linkin park');
    expect(key3).toBe('hybrid theory:::linkin park');
  });

  it('should exclude Unknown Album records from merge candidate detection', async () => {
    albumRepo.albums = [
      { id: 'a1', title: 'Unknown Album', artistName: 'Unknown Artist', trackCount: 5, durationMs: 500000, isCompilation: false, dateAdded: 100 },
      { id: 'a2', title: 'Unknown Album', artistName: 'Artist B', trackCount: 3, durationMs: 300000, isCompilation: false, dateAdded: 200 },
      { id: 'a3', title: '', artistName: 'Artist C', trackCount: 2, durationMs: 200000, isCompilation: false, dateAdded: 300 }
    ];

    const candidates = await mergeService.findMergeCandidates();
    expect(candidates.length).toBe(0);
  });

  it('should detect candidate duplicate albums with case or whitespace variations', async () => {
    albumRepo.albums = [
      { id: 'alb1', title: 'Meteora', artistName: 'Linkin Park', trackCount: 10, durationMs: 2000000, isCompilation: false, dateAdded: 100, artworkId: 'art1', year: 2003 },
      { id: 'alb2', title: ' meteora ', artistName: 'Linkin Park', trackCount: 3, durationMs: 600000, isCompilation: false, dateAdded: 200 },
      { id: 'alb3', title: 'Parachutes', artistName: 'Coldplay', trackCount: 10, durationMs: 2400000, isCompilation: false, dateAdded: 150 }
    ];

    const candidates = await mergeService.findMergeCandidates();
    expect(candidates.length).toBe(1);
    expect(candidates[0].albums.length).toBe(2);
    expect(candidates[0].canonicalAlbumId).toBe('alb1'); // Chosen due to artworkId & higher trackCount
    expect(candidates[0].totalTracks).toBe(13);
  });

  it('should distinguish albums with the same title by different artists', async () => {
    albumRepo.albums = [
      { id: 'alb1', title: 'Greatest Hits', artistName: 'Queen', trackCount: 17, durationMs: 3600000, isCompilation: false, dateAdded: 100 },
      { id: 'alb2', title: 'Greatest Hits', artistName: 'Blink-182', trackCount: 15, durationMs: 3000000, isCompilation: false, dateAdded: 200 }
    ];

    const candidates = await mergeService.findMergeCandidates();
    expect(candidates.length).toBe(0);
  });

  it('should produce accurate read-only merge preview', async () => {
    albumRepo.albums = [
      { id: 'a1', title: 'Discovery', artistName: 'Daft Punk', trackCount: 10, durationMs: 2000000, isCompilation: false, dateAdded: 100 },
      { id: 'a2', title: 'discovery', artistName: 'Daft Punk', trackCount: 4, durationMs: 800000, isCompilation: false, dateAdded: 200 }
    ];

    trackRepo.tracks = [
      { id: 't1', title: 'One More Time', albumId: 'a1', durationMs: 320000, playCount: 10, isFavorite: true, availability: 'available' } as unknown as Track,
      { id: 't2', title: 'Harder Better Faster Stronger', albumId: 'a2', durationMs: 224000, playCount: 5, isFavorite: false, availability: 'available' } as unknown as Track
    ];

    const preview = await mergeService.getMergePreview(['a1', 'a2'], 'a1');

    expect(preview.canonicalAlbum.id).toBe('a1');
    expect(preview.mergedAlbums.length).toBe(1);
    expect(preview.mergedAlbums[0].id).toBe('a2');
    expect(preview.affectedTracks.length).toBe(2);
    expect(preview.totalResultingDurationMs).toBe(544000);
  });

  it('should execute merge, updating track album relationships while strictly preserving Track IDs, play counts, and favorites', async () => {
    albumRepo.albums = [
      { id: 'a1', title: 'Meteora', artistName: 'Linkin Park', trackCount: 1, durationMs: 180000, isCompilation: false, dateAdded: 100 },
      { id: 'a2', title: ' meteora ', artistName: 'Linkin Park', trackCount: 1, durationMs: 200000, isCompilation: false, dateAdded: 200 }
    ];

    trackRepo.tracks = [
      { id: 'track_1', title: 'Numb', albumId: 'a1', albumTitle: 'Meteora', playCount: 25, isFavorite: true, durationMs: 180000 } as unknown as Track,
      { id: 'track_2', title: 'Faint', albumId: 'a2', albumTitle: ' meteora ', playCount: 14, isFavorite: false, durationMs: 200000 } as unknown as Track
    ];

    let publishedEvent: any = null;
    eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, payload => {
      publishedEvent = payload;
    });

    const result = await mergeService.executeMerge(['a1', 'a2'], 'a1');

    expect(result.success).toBe(true);
    expect(result.affectedTrackCount).toBe(1); // track_2 was updated
    expect(result.mergedAlbumIds).toEqual(['a2']);

    // Check track safety invariants
    const track2 = await trackRepo.getById('track_2');
    expect(track2).not.toBeNull();
    expect(track2?.id).toBe('track_2'); // ID preserved
    expect(track2?.albumId).toBe('a1'); // Pointing to canonical album
    expect(track2?.albumTitle).toBe('Meteora'); // Canonical title
    expect(track2?.playCount).toBe(14); // Play count preserved
    expect(track2?.isFavorite).toBe(false); // Favorite state preserved

    // Check track 1
    const track1 = await trackRepo.getById('track_1');
    expect(track1?.id).toBe('track_1');
    expect(track1?.playCount).toBe(25);
    expect(track1?.isFavorite).toBe(true);

    // Check canonical album updated
    const canonical = await albumRepo.getById('a1');
    expect(canonical).not.toBeNull();
    expect(canonical?.trackCount).toBe(2);
    expect(canonical?.durationMs).toBe(380000);

    // Check non-canonical album removed
    const deletedAlbum = await albumRepo.getById('a2');
    expect(deletedAlbum).toBeNull();

    // Check domain event published
    expect(publishedEvent).not.toBeNull();
    expect(publishedEvent.tracksUpdated).toBe(1);
  });
});
