import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LibraryService } from '../../src/services/library/library-service';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { Track, Album, Artist } from '../../src/domain/entities/models';

describe('LibraryService', () => {
  let libraryService: LibraryService;
  let eventBus: EventBus;
  let mockTrackRepo: any;
  let mockAlbumRepo: any;
  let mockArtistRepo: any;

  const sampleTrack: Track = {
    id: 'track_1',
    fileId: 'file_1',
    title: 'Sample Track',
    artistName: 'Sample Artist',
    durationMs: 200000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 5,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const sampleAlbum: Album = {
    id: 'album_1',
    title: 'Sample Album',
    artistName: 'Sample Artist',
    trackCount: 8,
    durationMs: 1600000,
    isCompilation: false,
    dateAdded: Date.now()
  };

  const sampleArtist: Artist = {
    id: 'artist_1',
    name: 'Sample Artist',
    trackCount: 8,
    albumCount: 1
  };

  beforeEach(() => {
    eventBus = new EventBus();

    mockTrackRepo = {
      getById: vi.fn((id: string) => Promise.resolve(id === 'track_1' ? sampleTrack : null)),
      list: vi.fn().mockResolvedValue({ items: [sampleTrack], total: 1, offset: 0, limit: 50 }),
      setFavorite: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(42)
    };

    mockAlbumRepo = {
      getById: vi.fn((id: string) => Promise.resolve(id === 'album_1' ? sampleAlbum : null)),
      list: vi.fn().mockResolvedValue({ items: [sampleAlbum], total: 5, offset: 0, limit: 50 })
    };

    mockArtistRepo = {
      getById: vi.fn((id: string) => Promise.resolve(id === 'artist_1' ? sampleArtist : null)),
      list: vi.fn().mockResolvedValue({ items: [sampleArtist], total: 3, offset: 0, limit: 50 })
    };

    libraryService = new LibraryService({
      trackRepo: mockTrackRepo,
      albumRepo: mockAlbumRepo,
      artistRepo: mockArtistRepo,
      eventBus
    });
  });

  it('should retrieve individual entities and list paginated results', async () => {
    const track = await libraryService.getTrack('track_1');
    expect(track?.title).toBe('Sample Track');

    const tracks = await libraryService.listTracks({ offset: 0, limit: 10 });
    expect(tracks.items).toHaveLength(1);

    const album = await libraryService.getAlbum('album_1');
    expect(album?.title).toBe('Sample Album');

    const artist = await libraryService.getArtist('artist_1');
    expect(artist?.name).toBe('Sample Artist');
  });

  it('should toggle favorite status and broadcast event', async () => {
    let emittedEvent: any = null;
    eventBus.subscribe(DomainEvents.FAVORITE_CHANGED, (data: any) => {
      emittedEvent = data;
    });

    const newState = await libraryService.toggleFavorite('track_1');
    expect(newState).toBe(true); // Flipped from false to true
    expect(mockTrackRepo.setFavorite).toHaveBeenCalledWith('track_1', true);
    expect(emittedEvent).toEqual({ trackId: 'track_1', isFavorite: true });
  });

  it('should calculate library stats from repositories', async () => {
    const stats = await libraryService.getLibraryStats();
    expect(stats.trackCount).toBe(42);
    expect(stats.albumCount).toBe(5);
    expect(stats.artistCount).toBe(3);
  });
});
