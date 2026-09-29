import type { EditableMetadataFields, ArtworkPayload } from './metadata-write-types';

export class MP4Writer {
  private static textEncoder = new TextEncoder();

  /**
   * Writes/updates ilst metadata atoms in an MP4 / M4A file buffer.
   */
  public static writeTags(
    originalBuffer: Uint8Array,
    fields: EditableMetadataFields,
    artwork?: ArtworkPayload | undefined
  ): Uint8Array {
    // 1. Build new ilst atom content
    const ilstAtomBytes = this.buildIlstAtom(fields, artwork);

    // 2. Parse top-level atoms and reconstruct file with updated moov
    const view = new DataView(originalBuffer.buffer, originalBuffer.byteOffset, originalBuffer.byteLength);
    let offset = 0;
    const atoms: Array<{ type: string; offset: number; size: number; headerSize: number }> = [];

    while (offset + 8 <= originalBuffer.length) {
      let size = view.getUint32(offset, false);
      const type = String.fromCharCode(
        originalBuffer[offset + 4]!,
        originalBuffer[offset + 5]!,
        originalBuffer[offset + 6]!,
        originalBuffer[offset + 7]!
      );

      let headerSize = 8;
      if (size === 1) {
        // 64-bit size
        size = Number(view.getBigUint64(offset + 8, false));
        headerSize = 16;
      } else if (size === 0) {
        size = originalBuffer.length - offset;
      }

      if (size < headerSize || offset + size > originalBuffer.length) break;

      atoms.push({ type, offset, size, headerSize });
      offset += size;
    }

    const moovInfo = atoms.find(a => a.type === 'moov');
    if (!moovInfo) {
      throw new Error('Not a valid MP4/M4A file (missing moov atom).');
    }

    // 3. Update moov atom by injecting/replacing ilst
    const newMoovBytes = this.updateMoovAtom(originalBuffer.subarray(moovInfo.offset, moovInfo.offset + moovInfo.size), ilstAtomBytes);

    // 4. Assemble final file (replacing old moov with newMoovBytes)
    const newSize = originalBuffer.length - moovInfo.size + newMoovBytes.length;
    const finalBuffer = new Uint8Array(newSize);

    let writePos = 0;
    for (const atom of atoms) {
      if (atom.type === 'moov') {
        finalBuffer.set(newMoovBytes, writePos);
        writePos += newMoovBytes.length;
      } else {
        const slice = originalBuffer.subarray(atom.offset, atom.offset + atom.size);
        finalBuffer.set(slice, writePos);
        writePos += slice.length;
      }
    }

    return finalBuffer;
  }

  private static buildIlstAtom(fields: EditableMetadataFields, artwork?: ArtworkPayload | undefined): Uint8Array {
    const itemBuffers: Uint8Array[] = [];

    const addTextItem = (type: string, value?: string | number) => {
      if (value === undefined || value === null || String(value).trim() === '') return;
      const textBytes = this.textEncoder.encode(String(value).trim());
      // data atom header: 4 size + 4 'data' + 4 (type flag 1 = UTF8) + 4 locale (0)
      const dataAtom = this.createAtom('data', this.concat(new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0]), textBytes));
      itemBuffers.push(this.createAtom(type, dataAtom));
    };

    addTextItem('©nam', fields.title);
    addTextItem('©ART', fields.artist);
    addTextItem('aART', fields.albumArtist);
    addTextItem('©alb', fields.album);
    addTextItem('©gen', fields.genre);
    addTextItem('©day', fields.year);
    addTextItem('©wrt', fields.composer);
    addTextItem('©cmt', fields.comment);

    // Track Number (trkn)
    if (fields.trackNumber !== undefined) {
      // trkn data payload: 2 reserved + 2 trackNum + 2 totalTracks + 2 reserved
      const payload = new Uint8Array(8);
      const view = new DataView(payload.buffer);
      view.setUint16(2, fields.trackNumber, false);
      if (fields.totalTracks) view.setUint16(4, fields.totalTracks, false);
      const dataAtom = this.createAtom('data', this.concat(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]), payload));
      itemBuffers.push(this.createAtom('trkn', dataAtom));
    }

    // Disc Number (disk)
    if (fields.discNumber !== undefined) {
      const payload = new Uint8Array(6);
      const view = new DataView(payload.buffer);
      view.setUint16(2, fields.discNumber, false);
      if (fields.totalDiscs) view.setUint16(4, fields.totalDiscs, false);
      const dataAtom = this.createAtom('data', this.concat(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]), payload));
      itemBuffers.push(this.createAtom('disk', dataAtom));
    }

    // Artwork (covr)
    if (artwork && artwork.action === 'replace' && artwork.data && artwork.data.length > 0) {
      const isPng = artwork.mimeType === 'image/png';
      const typeFlag = isPng ? 14 : 13; // 13 = JPEG, 14 = PNG
      const header = new Uint8Array([0, 0, 0, typeFlag, 0, 0, 0, 0]);
      const dataAtom = this.createAtom('data', this.concat(header, artwork.data));
      itemBuffers.push(this.createAtom('covr', dataAtom));
    }

    const payload = this.concat(...itemBuffers);
    return this.createAtom('ilst', payload);
  }

  private static updateMoovAtom(moovBuffer: Uint8Array, newIlstBytes: Uint8Array): Uint8Array {
    // Traverse moov to locate udta -> meta -> ilst
    const view = new DataView(moovBuffer.buffer, moovBuffer.byteOffset, moovBuffer.byteLength);

    // Build replacement udta / meta / ilst
    const metaHeader = new Uint8Array([0, 0, 0, 0]); // meta version + flags
    const metaAtom = this.createAtom('meta', this.concat(metaHeader, newIlstBytes));
    const udtaAtom = this.createAtom('udta', metaAtom);

    // Reconstruct moov atom retaining non-udta children
    let offset = 8;
    const moovChildren: Uint8Array[] = [];

    while (offset + 8 <= moovBuffer.length) {
      const size = view.getUint32(offset, false);
      const type = String.fromCharCode(
        moovBuffer[offset + 4]!,
        moovBuffer[offset + 5]!,
        moovBuffer[offset + 6]!,
        moovBuffer[offset + 7]!
      );

      if (size < 8 || offset + size > moovBuffer.length) break;

      if (type !== 'udta') {
        moovChildren.push(moovBuffer.subarray(offset, offset + size));
      }
      offset += size;
    }

    moovChildren.push(udtaAtom);
    const moovPayload = this.concat(...moovChildren);
    return this.createAtom('moov', moovPayload);
  }

  private static createAtom(type: string, content: Uint8Array): Uint8Array {
    const size = 8 + content.length;
    const atom = new Uint8Array(size);
    const view = new DataView(atom.buffer);

    view.setUint32(0, size, false);
    for (let i = 0; i < 4; i++) {
      atom[4 + i] = type.charCodeAt(i) || 0x20;
    }
    atom.set(content, 8);
    return atom;
  }

  private static concat(...buffers: Uint8Array[]): Uint8Array {
    const totalLen = buffers.reduce((sum, b) => sum + b.length, 0);
    const res = new Uint8Array(totalLen);
    let pos = 0;
    for (const b of buffers) {
      res.set(b, pos);
      pos += b.length;
    }
    return res;
  }
}
