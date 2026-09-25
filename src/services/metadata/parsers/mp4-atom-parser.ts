import type { ExtractedMetadata, ExtractedArtwork } from '../metadata-types';

/**
 * Binary MP4 / M4A / AAC / ALAC Atom Parser
 * Traverses moov -> udta -> meta -> ilst atom hierarchy and extracts metadata and covr artwork.
 */
export class Mp4AtomParser {
  private static textDecoder = new TextDecoder('utf-8');

  public static isMp4(buffer: Uint8Array): boolean {
    if (buffer.length < 8) return false;
    const type = String.fromCharCode(buffer[4], buffer[5], buffer[6], buffer[7]);
    return type === 'ftyp' || type === 'moov';
  }

  public static parse(buffer: Uint8Array): Partial<ExtractedMetadata> {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const tags: Record<string, any> = {};
    let artwork: ExtractedArtwork | undefined;

    // Traverse root atoms searching for 'moov'
    const ilstAtom = this.findAtomPath(buffer, view, 0, buffer.length, ['moov', 'udta', 'meta', 'ilst']);

    if (ilstAtom) {
      let offset = ilstAtom.dataOffset;
      const endOffset = ilstAtom.offset + ilstAtom.size;

      while (offset + 8 <= endOffset) {
        const atomSize = view.getUint32(offset);
        if (atomSize < 8 || offset + atomSize > endOffset) break;

        const atomName = String.fromCharCode(
          buffer[offset + 4],
          buffer[offset + 5],
          buffer[offset + 6],
          buffer[offset + 7]
        );

        // Inside each item atom, find 'data' atom
        const dataOffset = offset + 8;
        const dataEnd = offset + atomSize;
        const dataAtom = this.findChildAtom(buffer, view, dataOffset, dataEnd, 'data');

        if (dataAtom) {
          // data atom header is 8 bytes + 4 bytes type indicator + 4 bytes locale = 16 bytes
          if (dataAtom.size >= 16) {
            const typeIndicator = view.getUint32(dataAtom.offset + 8);
            const valueBytes = buffer.subarray(dataAtom.offset + 16, dataAtom.offset + dataAtom.size);

            if (atomName === 'covr') {
              if (!artwork && valueBytes.length > 0) {
                // typeIndicator 13 = JPEG, 14 = PNG
                const mimeType = typeIndicator === 14 ? 'image/png' : 'image/jpeg';
                artwork = {
                  mimeType,
                  data: valueBytes,
                  type: 'cover_front'
                };
              }
            } else if (atomName === 'trkn' && valueBytes.length >= 4) {
              const trackNum = (valueBytes[2] << 8) | valueBytes[3];
              const totalTracks = valueBytes.length >= 6 ? (valueBytes[4] << 8) | valueBytes[5] : undefined;
              tags['trkn'] = { trackNum, totalTracks };
            } else if (atomName === 'disk' && valueBytes.length >= 4) {
              const discNum = (valueBytes[2] << 8) | valueBytes[3];
              const totalDiscs = valueBytes.length >= 6 ? (valueBytes[4] << 8) | valueBytes[5] : undefined;
              tags['disk'] = { discNum, totalDiscs };
            } else if (atomName === 'cpil') {
              tags['cpil'] = valueBytes[0] === 1;
            } else {
              // Standard UTF-8 text
              tags[atomName] = this.textDecoder.decode(valueBytes).trim();
            }
          }
        }

        offset += atomSize;
      }
    }

    // 2. Extract duration from 'mvhd' atom
    let durationMs: number | undefined;
    const mvhdAtom = this.findAtomPath(buffer, view, 0, buffer.length, ['moov', 'mvhd']);
    if (mvhdAtom && mvhdAtom.size >= 28) {
      const version = view.getUint8(mvhdAtom.offset + 8);
      let timescale = 0;
      let duration = 0;
      if (version === 0 && mvhdAtom.size >= 32) {
        timescale = view.getUint32(mvhdAtom.offset + 20);
        duration = view.getUint32(mvhdAtom.offset + 24);
      } else if (version === 1 && mvhdAtom.size >= 44) {
        timescale = view.getUint32(mvhdAtom.offset + 28);
        const high = view.getUint32(mvhdAtom.offset + 32);
        const low = view.getUint32(mvhdAtom.offset + 36);
        duration = high * 4294967296 + low;
      }
      if (timescale > 0 && duration > 0) {
        durationMs = Math.round((duration / timescale) * 1000);
      }
    }

    const title = tags['©nam'];
    const artist = tags['©ART'];
    const albumArtist = tags['aART'];
    const album = tags['©alb'];
    const genre = tags['©gen'];
    const dateStr = tags['©day'];
    const composer = tags['©wrt'];
    const isCompilation = tags['cpil'] === true;

    let year: number | undefined;
    if (dateStr) {
      const m = dateStr.match(/\b(19\d\d|20\d\d)\b/);
      if (m && m[1]) year = parseInt(m[1], 10);
    }

    return {
      title,
      artist,
      albumArtist,
      album,
      genre,
      year,
      durationMs,
      trackNumber: tags['trkn']?.trackNum || undefined,
      totalTracks: tags['trkn']?.totalTracks || undefined,
      discNumber: tags['disk']?.discNum || undefined,
      totalDiscs: tags['disk']?.totalDiscs || undefined,
      composer,
      isCompilation,
      artwork,
      container: 'm4a',
      codec: 'aac',
      isLossless: false
    };
  }

  private static findAtomPath(
    buffer: Uint8Array,
    view: DataView,
    start: number,
    end: number,
    path: string[]
  ): { offset: number; size: number; dataOffset: number } | null {
    let currentStart = start;
    let currentEnd = end;
    let currentAtom: { offset: number; size: number; dataOffset: number } | null = null;

    for (let i = 0; i < path.length; i++) {
      const targetName = path[i];
      currentAtom = this.findChildAtom(buffer, view, currentStart, currentEnd, targetName);
      if (!currentAtom) return null;

      // 'meta' atom has 4 extra version/flags bytes before child atoms
      if (targetName === 'meta') {
        currentStart = currentAtom.offset + 12;
      } else {
        currentStart = currentAtom.offset + 8;
      }
      currentEnd = currentAtom.offset + currentAtom.size;
    }

    return currentAtom;
  }

  private static findChildAtom(
    buffer: Uint8Array,
    view: DataView,
    start: number,
    end: number,
    name: string
  ): { offset: number; size: number; dataOffset: number } | null {
    let offset = start;

    while (offset + 8 <= end) {
      const atomSize = view.getUint32(offset);
      if (atomSize < 8 || offset + atomSize > end) break;

      const atomName = String.fromCharCode(
        buffer[offset + 4],
        buffer[offset + 5],
        buffer[offset + 6],
        buffer[offset + 7]
      );

      if (atomName === name) {
        return { offset, size: atomSize, dataOffset: offset + 8 };
      }

      offset += atomSize;
    }

    return null;
  }
}
