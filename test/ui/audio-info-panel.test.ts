import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { AudioInfoPanelComponent } from '../../src/ui/components/player/audio-info-panel-component';
import type { IAudioFileRepository } from '../../src/domain/repositories/repository-contracts';
import type { Track, AudioFile } from '../../src/domain/entities/models';

describe('AudioInfoPanelComponent', () => {
  let container: HTMLElement;
  let mockAudioFileRepo: IAudioFileRepository;
  let component: AudioInfoPanelComponent;

  const sampleTrack: Track = {
    id: 'track_flac_1',
    title: 'Comfortably Numb',
    artistId: 'artist_pf',
    artistName: 'Pink Floyd',
    albumId: 'album_wall',
    albumTitle: 'The Wall',
    genreName: 'Progressive Rock',
    year: 1979,
    trackNumber: 6,
    durationMs: 382000,
    fileId: 'file_flac_1',
    format: {
      container: 'flac',
      codec: 'flac',
      sampleRate: 96000,
      bitDepth: 24,
      bitrate: 2800,
      channels: 2,
      isLossless: true
    },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 15,
    isFavorite: true,
    hasLyrics: true,
    availability: 'available'
  };

  const sampleAudioFile: AudioFile = {
    id: 'file_flac_1',
    path: 'C:/Music/Pink Floyd/The Wall/06 - Comfortably Numb.flac',
    filename: '06 - Comfortably Numb.flac',
    extension: 'flac',
    sizeBytes: 89456120, // ~85.31 MB
    modifiedTimeMs: Date.now(),
    availability: 'available'
  };

  beforeEach(() => {
    container = document.createElement('div');
    mockAudioFileRepo = {
      getById: vi.fn().mockResolvedValue(sampleAudioFile),
      getByPath: vi.fn(),
      save: vi.fn(),
      saveBatch: vi.fn(),
      delete: vi.fn(),
      listAllPaths: vi.fn()
    };

    component = new AudioInfoPanelComponent({
      audioFileRepo: mockAudioFileRepo
    });
  });

  afterEach(() => {
    if (component) {
      component.unmount();
    }
  });

  it('renders empty state when no track is selected', () => {
    component.mount(container, null);
    expect(container.textContent).toContain('No Track Selected');
    expect(container.textContent).toContain('Play a track to view its audio format parameters.');
  });

  it('renders track overview and technical parameters accurately', async () => {
    component.mount(container, sampleTrack);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(container.textContent).toContain('Comfortably Numb');
    expect(container.textContent).toContain('Pink Floyd');
    expect(container.textContent).toContain('The Wall');
    expect(container.textContent).toContain('Progressive Rock');
    expect(container.textContent).toContain('1979');
    expect(container.textContent).toContain('Trk 6');
    expect(container.textContent).toContain('6:22'); // 382000 ms -> 6:22
    expect(container.textContent).toContain('15 plays');

    // Technical specs
    expect(container.textContent).toContain('flac');
    expect(container.textContent).toContain('96.0 kHz');
    expect(container.textContent).toContain('24-bit');
    expect(container.textContent).toContain('2800 kbps');
    expect(container.textContent).toContain('Stereo');
    expect(container.textContent).toContain('HI-RES AUDIO');
  });

  it('resolves real file path and size from repository', async () => {
    component.mount(container, sampleTrack);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockAudioFileRepo.getById).toHaveBeenCalledWith('file_flac_1');
    expect(container.textContent).toContain('85.31 MB');
    expect(container.textContent).toContain('C:/Music/Pink Floyd/The Wall/06 - Comfortably Numb.flac');
  });

  it('displays LOSSLESS badge for 16-bit 44.1kHz lossless audio', async () => {
    const cdTrack: Track = {
      ...sampleTrack,
      id: 'track_cd_1',
      format: {
        container: 'flac',
        codec: 'flac',
        sampleRate: 44100,
        bitDepth: 16,
        bitrate: 950,
        channels: 2,
        isLossless: true
      }
    };

    component.mount(container, cdTrack);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(container.textContent).toContain('LOSSLESS');
    expect(container.textContent).not.toContain('HI-RES AUDIO');
  });

  it('displays STANDARD badge and handles missing values honestly without inventing numbers', async () => {
    const mp3Track: Track = {
      id: 'track_mp3_1',
      fileId: 'file_mp3_1',
      title: 'Unknown Title',
      durationMs: 0,
      format: {
        container: 'mp3',
        codec: 'mp3',
        sampleRate: 44100,
        channels: 2,
        isLossless: false
      },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    };

    (mockAudioFileRepo.getById as any).mockResolvedValueOnce(null);

    component.mount(container, mp3Track);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(container.textContent).toContain('STANDARD');
    expect(container.textContent).toContain('Unavailable'); // Duration, artist, album, bitrate, etc.
  });
});
