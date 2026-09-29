import type { EditableMetadataFields } from './metadata-write-types';

export class WAVWriter {
  private static textEncoder = new TextEncoder();

  /**
   * Writes/updates RIFF LIST-INFO metadata chunks in a WAV file buffer.
   */
  public static writeTags(
    originalBuffer: Uint8Array,
    fields: EditableMetadataFields
  ): Uint8Array {
    // 1. Verify RIFF WAVE signature
    if (
      originalBuffer.length < 12 ||
      originalBuffer[0] !== 0x52 ||
      originalBuffer[1] !== 0x49 ||
      originalBuffer[2] !== 0x46 ||
      originalBuffer[3] !== 0x46 ||
      originalBuffer[8] !== 0x57 ||
      originalBuffer[9] !== 0x41 ||
      originalBuffer[10] !== 0x56 ||
      originalBuffer[11] !== 0x45
    ) {
      throw new Error('Not a valid WAV file (missing RIFF WAVE signature).');
    }

    // 2. Build LIST INFO chunk
    const listInfoChunk = this.buildListInfoChunk(fields);

    // 3. Traverse existing chunks and strip any previous LIST-INFO chunk
    const view = new DataView(originalBuffer.buffer, originalBuffer.byteOffset, originalBuffer.byteLength);
    let offset = 12;
    const keptChunks: Uint8Array[] = [];

    while (offset + 8 <= originalBuffer.length) {
      const chunkId = String.fromCharCode(
        originalBuffer[offset]!,
        originalBuffer[offset + 1]!,
        originalBuffer[offset + 2]!,
        originalBuffer[offset + 3]!
      );
      const chunkSize = view.getUint32(offset + 4, true);

      // Handle word boundary alignment padding for odd sizes
      const totalChunkLen = 8 + chunkSize + (chunkSize % 2 !== 0 ? 1 : 0);
      if (offset + totalChunkLen > originalBuffer.length) break;

      const isListInfo =
        chunkId === 'LIST' &&
        offset + 12 <= originalBuffer.length &&
        String.fromCharCode(
          originalBuffer[offset + 8]!,
          originalBuffer[offset + 9]!,
          originalBuffer[offset + 10]!,
          originalBuffer[offset + 11]!
        ) === 'INFO';

      if (!isListInfo) {
        keptChunks.push(originalBuffer.subarray(offset, offset + totalChunkLen));
      }

      offset += totalChunkLen;
    }

    if (listInfoChunk) {
      keptChunks.push(listInfoChunk);
    }

    // 4. Calculate new RIFF size and reassemble
    const chunksLength = keptChunks.reduce((sum, c) => sum + c.length, 0);
    const totalRiffSize = 4 + chunksLength; // 4 bytes for 'WAVE' + all chunks

    const finalBuffer = new Uint8Array(8 + totalRiffSize);
    const finalView = new DataView(finalBuffer.buffer);

    finalBuffer[0] = 0x52; finalBuffer[1] = 0x49; finalBuffer[2] = 0x46; finalBuffer[3] = 0x46; // 'RIFF'
    finalView.setUint32(4, totalRiffSize, true);
    finalBuffer[8] = 0x57; finalBuffer[9] = 0x41; finalBuffer[10] = 0x56; finalBuffer[11] = 0x45; // 'WAVE'

    let writePos = 12;
    for (const chunk of keptChunks) {
      finalBuffer.set(chunk, writePos);
      writePos += chunk.length;
    }

    return finalBuffer;
  }

  private static buildListInfoChunk(fields: EditableMetadataFields): Uint8Array | null {
    const subChunks: Uint8Array[] = [];

    const addInfoSubChunk = (id: string, value?: string | number) => {
      if (value === undefined || value === null || String(value).trim() === '') return;
      const str = String(value).trim() + '\0'; // null-terminated
      const strBytes = this.textEncoder.encode(str);
      const isOdd = strBytes.length % 2 !== 0;

      const chunkLen = 8 + strBytes.length + (isOdd ? 1 : 0);
      const chunk = new Uint8Array(chunkLen);
      const view = new DataView(chunk.buffer);

      for (let i = 0; i < 4; i++) {
        chunk[i] = id.charCodeAt(i) || 0x20;
      }
      view.setUint32(4, strBytes.length, true);
      chunk.set(strBytes, 8);
      // odd padding byte 0x00 at the end if needed

      subChunks.push(chunk);
    };

    addInfoSubChunk('INAM', fields.title);
    addInfoSubChunk('IART', fields.artist);
    addInfoSubChunk('IPRD', fields.album);
    addInfoSubChunk('IGNR', fields.genre);
    addInfoSubChunk('ICRD', fields.year);
    addInfoSubChunk('ICMT', fields.comment);

    if (subChunks.length === 0) return null;

    const infoPayloadLen = 4 + subChunks.reduce((sum, c) => sum + c.length, 0); // 4 bytes 'INFO' + sub-chunks
    const isOdd = infoPayloadLen % 2 !== 0;
    const totalListChunkLen = 8 + infoPayloadLen + (isOdd ? 1 : 0);

    const listChunk = new Uint8Array(totalListChunkLen);
    const view = new DataView(listChunk.buffer);

    listChunk[0] = 0x4c; listChunk[1] = 0x49; listChunk[2] = 0x53; listChunk[3] = 0x54; // 'LIST'
    view.setUint32(4, infoPayloadLen, true);
    listChunk[8] = 0x49; listChunk[9] = 0x4e; listChunk[10] = 0x46; listChunk[11] = 0x4f; // 'INFO'

    let pos = 12;
    for (const sc of subChunks) {
      listChunk.set(sc, pos);
      pos += sc.length;
    }

    return listChunk;
  }
}
