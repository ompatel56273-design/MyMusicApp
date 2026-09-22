import { describe, it, expect } from 'vitest';
import { ID3Parser } from '../../src/services/metadata/parsers/id3-parser';

describe('ID3Parser', () => {
  function createSyntheticID3v23Buffer(tags: { title?: string; artist?: string; album?: string; year?: string; track?: string; hasArtwork?: boolean }): Uint8Array {
    const frames: Uint8Array[] = [];

    const createTextFrame = (id: string, text: string) => {
      const textBytes = new TextEncoder().encode(text);
      const frameData = new Uint8Array(1 + textBytes.length);
      frameData[0] = 3; // UTF-8 encoding
      frameData.set(textBytes, 1);

      const frame = new Uint8Array(10 + frameData.length);
      frame[0] = id.charCodeAt(0);
      frame[1] = id.charCodeAt(1);
      frame[2] = id.charCodeAt(2);
      frame[3] = id.charCodeAt(3);

      const size = frameData.length;
      frame[4] = (size >> 24) & 0xff;
      frame[5] = (size >> 16) & 0xff;
      frame[6] = (size >> 8) & 0xff;
      frame[7] = size & 0xff;

      frame.set(frameData, 10);
      return frame;
    };

    if (tags.title) frames.push(createTextFrame('TIT2', tags.title));
    if (tags.artist) frames.push(createTextFrame('TPE1', tags.artist));
    if (tags.album) frames.push(createTextFrame('TALB', tags.album));
    if (tags.year) frames.push(createTextFrame('TYER', tags.year));
    if (tags.track) frames.push(createTextFrame('TRCK', tags.track));

    if (tags.hasArtwork) {
      // APIC Frame with dummy JPEG magic bytes: FF D8 FF
      const imgPayload = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const mime = new TextEncoder().encode('image/jpeg\0');
      const apicData = new Uint8Array(1 + mime.length + 1 + 1 + imgPayload.length);
      apicData[0] = 0; // Latin1
      apicData.set(mime, 1);
      apicData[1 + mime.length] = 3; // Cover front
      apicData[1 + mime.length + 1] = 0; // Null desc
      apicData.set(imgPayload, 1 + mime.length + 2);

      const frame = new Uint8Array(10 + apicData.length);
      frame[0] = 0x41; frame[1] = 0x50; frame[2] = 0x49; frame[3] = 0x43; // 'APIC'
      const size = apicData.length;
      frame[4] = (size >> 24) & 0xff;
      frame[5] = (size >> 16) & 0xff;
      frame[6] = (size >> 8) & 0xff;
      frame[7] = size & 0xff;
      frame.set(apicData, 10);
      frames.push(frame);
    }

    const totalPayloadSize = frames.reduce((acc, f) => acc + f.length, 0);
    const header = new Uint8Array(10 + totalPayloadSize);
    header[0] = 0x49; header[1] = 0x44; header[2] = 0x33; // 'ID3'
    header[3] = 3; // v2.3
    header[4] = 0; // revision
    header[5] = 0; // flags

    // Synchsafe size
    header[6] = (totalPayloadSize >> 21) & 0x7f;
    header[7] = (totalPayloadSize >> 14) & 0x7f;
    header[8] = (totalPayloadSize >> 7) & 0x7f;
    header[9] = totalPayloadSize & 0x7f;

    let offset = 10;
    for (const frame of frames) {
      header.set(frame, offset);
      offset += frame.length;
    }

    return header;
  }

  it('should parse ID3v2.3 text frames and APIC artwork accurately', () => {
    const buffer = createSyntheticID3v23Buffer({
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      year: '1975',
      track: '4/12',
      hasArtwork: true
    });

    const parsed = ID3Parser.parse(buffer);

    expect(parsed.title).toBe('Bohemian Rhapsody');
    expect(parsed.artist).toBe('Queen');
    expect(parsed.album).toBe('A Night at the Opera');
    expect(parsed.year).toBe(1975);
    expect(parsed.trackNumber).toBe(4);
    expect(parsed.totalTracks).toBe(12);
    expect(parsed.artwork).toBeDefined();
    expect(parsed.artwork?.mimeType).toBe('image/jpeg');
    expect(parsed.artwork?.data.length).toBeGreaterThan(0);
  });
});
