import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbAdapter } from '../../src/data/db/database-adapter';
import { TrackRepository } from '../../src/data/repositories/track-repository';
import { AudioFileRepository } from '../../src/data/repositories/audio-file-repository';
import { ArtistRepository } from '../../src/data/repositories/artist-repository';
import { AlbumRepository } from '../../src/data/repositories/album-repository';
import { GenreRepository } from '../../src/data/repositories/genre-repository';
import { MetadataReader } from '../../src/services/metadata/metadata-reader';
import { ArtworkService } from '../../src/services/artwork/artwork-service';
import { MetadataService } from '../../src/services/metadata/metadata-service';
import { EventBus } from '../../src/core/events/event-bus';
import type { Track, AudioFile } from '../../src/domain/entities/models';

describe('MetadataService Integration', () => {
  let adapter: IndexedDbAdapter;
  let trackRepo: TrackRepository;
  let fileRepo: AudioFileRepository;
  let artistRepo: ArtistRepository;
  let albumRepo: AlbumRepository;
  let genreRepo: GenreRepository;
  let artworkService: ArtworkService;
  let eventBus: EventBus;
  let metadataService: MetadataService;

  beforeEach(async () => {
    const dbName = `meta_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    adapter = new IndexedDbAdapter(dbName, 1);
    await adapter.open();

    trackRepo = new TrackRepository(adapter);
    fileRepo = new AudioFileRepository(adapter);
    artistRepo = new ArtistRepository(adapter);
    albumRepo = new AlbumRepository(adapter);
    genreRepo = new GenreRepository(adapter);
    artworkService = new ArtworkService();
    eventBus = new EventBus();

    metadataService = new MetadataService(
      new MetadataReader(),
      artworkService,
      trackRepo,
      fileRepo,
      artistRepo,
      albumRepo,
      genreRepo,
      eventBus
    );
  });

  afterEach(() => {
    adapter.close();
  });

  it('should enrich newly scanned track and create linked Artist, Album, and Genre records', async () => {
    const audioFile: AudioFile = {
      id: 'f_test_1',
      path: 'C:/Music/Rock/track1.flac',
      filename: 'track1.flac',
      extension: 'flac',
      sizeBytes: 10000000,
      modifiedTimeMs: Date.now(),
      availability: 'available'
    };
    await fileRepo.save(audioFile);

    const initialTrack: Track = {
      id: 't_test_1',
      fileId: audioFile.id,
      title: 'track1',
      durationMs: 0,
      format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 5,
      isFavorite: true, // User already marked as favorite!
      hasLyrics: false,
      availability: 'available'
    };
    await trackRepo.save(initialTrack);

    // Create minimal FLAC header buffer with comments
    const comments = ['TITLE=Comfortably Numb', 'ARTIST=Pink Floyd', 'ALBUM=The Wall', 'GENRE=Progressive Rock', 'TRACKNUMBER=6', 'DATE=1979'];
    const commentBytes = comments.map(c => new TextEncoder().encode(c));
    const vendor = new TextEncoder().encode('libFLAC');
    let vLen = 4 + vendor.length + 4;
    for (const b of commentBytes) vLen += 4 + b.length;

    const vorbis = new Uint8Array(vLen);
    const view = new DataView(vorbis.buffer);
    view.setUint32(0, vendor.length, true);
    vorbis.set(vendor, 4);
    let off = 4 + vendor.length;
    view.setUint32(off, commentBytes.length, true);
    off += 4;
    for (const b of commentBytes) {
      view.setUint32(off, b.length, true);
      off += 4;
      vorbis.set(b, off);
      off += b.length;
    }

    const flacBuffer = new Uint8Array(4 + 4 + 34 + 4 + vLen);
    flacBuffer[0] = 0x66; flacBuffer[1] = 0x4c; flacBuffer[2] = 0x61; flacBuffer[3] = 0x43; // 'fLaC'
    flacBuffer[4] = 0x00; flacBuffer[7] = 34; // STREAMINFO
    flacBuffer[8 + 34] = 0x84; // VORBIS_COMMENT (last)
    flacBuffer[8 + 34 + 3] = vLen;
    flacBuffer.set(vorbis, 8 + 34 + 4);

    const enriched = await metadataService.enrichTrackMetadata('t_test_1', flacBuffer);

    expect(enriched).toBeDefined();
    expect(enriched?.title).toBe('Comfortably Numb');
    expect(enriched?.artistName).toBe('Pink Floyd');
    expect(enriched?.albumTitle).toBe('The Wall');
    expect(enriched?.genreName).toBe('Progressive Rock');
    expect(enriched?.year).toBe(1979);

    // Verify STRICT PRESERVATION of user favorite and play count
    expect(enriched?.isFavorite).toBe(true);
    expect(enriched?.playCount).toBe(5);

    // Verify relational entities were created in DB
    const artist = await artistRepo.getByName('Pink Floyd');
    expect(artist).toBeDefined();
    expect(artist?.name).toBe('Pink Floyd');

    const genre = await genreRepo.getByName('Progressive Rock');
    expect(genre).toBeDefined();
  });
});
