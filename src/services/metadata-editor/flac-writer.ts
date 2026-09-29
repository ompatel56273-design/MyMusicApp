import type { EditableMetadataFields, ArtworkPayload } from './metadata-write-types';

interface FlacMetadataBlock {
  type: number; // 0 = STREAMINFO, 4 = VORBIS_COMMENT, 6 = PICTURE
  data: Uint8Array;
}

export class FlacWriter {
  private static textEncoder = new TextEncoder();

  /**
   * Writes/updates Vorbis Comments and PICTURE blocks in a FLAC file buffer.
   */
  public static writeTags(
    originalBuffer: Uint8Array,
    fields: EditableMetadataFields,
    artwork?: ArtworkPayload | undefined
  ): Uint8Array {
    // 1. Verify FLAC signature 'fLaC'
    if (
      originalBuffer.length < 4 ||
      originalBuffer[0] !== 0x66 ||
      originalBuffer[1] !== 0x4c ||
      originalBuffer[2] !== 0x61 ||
      originalBuffer[3] !== 0x43
    ) {
      throw new Error('Not a valid FLAC file (missing fLaC signature).');
    }

    // 2. Parse existing metadata blocks and locate start of audio data
    let offset = 4;
    const existingBlocks: FlacMetadataBlock[] = [];
    let isLastBlock = false;

    while (offset + 4 <= originalBuffer.length && !isLastBlock) {
      const headerByte = originalBuffer[offset]!;
      isLastBlock = (headerByte & 0x80) !== 0;
      const blockType = headerByte & 0x7f;
      const length =
        (originalBuffer[offset + 1]! << 16) |
        (originalBuffer[offset + 2]! << 8) |
        originalBuffer[offset + 3]!;

      offset += 4;
      if (offset + length > originalBuffer.length) {
        throw new Error('Truncated FLAC metadata block.');
      }

      const blockData = originalBuffer.subarray(offset, offset + length);
      existingBlocks.push({ type: blockType, data: blockData });
      offset += length;
    }

    const audioPayload = originalBuffer.subarray(offset);

    // 3. Build new VORBIS_COMMENT block
    const vorbisCommentBlockData = this.buildVorbisCommentBlock(fields);

    // 4. Build new PICTURE block if artwork replaced/kept
    let newPictureBlockData: Uint8Array | undefined;
    let removePicture = false;

    if (artwork) {
      if (artwork.action === 'replace' && artwork.data && artwork.data.length > 0) {
        newPictureBlockData = this.buildPictureBlock(artwork.data, artwork.mimeType || 'image/jpeg');
      } else if (artwork.action === 'remove') {
        removePicture = true;
      }
    }

    // 5. Assemble updated blocks list
    const finalBlocks: FlacMetadataBlock[] = [];

    // Keep STREAMINFO block (Block type 0)
    for (const b of existingBlocks) {
      if (b.type === 0) {
        finalBlocks.push(b);
      }
    }

    // Insert VORBIS_COMMENT (Block type 4)
    finalBlocks.push({ type: 4, data: vorbisCommentBlockData });

    // Handle PICTURE block (Block type 6)
    if (newPictureBlockData) {
      finalBlocks.push({ type: 6, data: newPictureBlockData });
    } else if (!removePicture) {
      // Retain existing PICTURE block if present and action is keep
      for (const b of existingBlocks) {
        if (b.type === 6) {
          finalBlocks.push(b);
          break;
        }
      }
    }

    // Retain other blocks (except STREAMINFO, VORBIS_COMMENT, PICTURE)
    for (const b of existingBlocks) {
      if (b.type !== 0 && b.type !== 4 && b.type !== 6) {
        finalBlocks.push(b);
      }
    }

    // 6. Calculate total size and serialize header + blocks + audio
    let totalMetadataSize = 4; // 'fLaC' signature
    for (const b of finalBlocks) {
      totalMetadataSize += 4 + b.data.length;
    }

    const finalBuffer = new Uint8Array(totalMetadataSize + audioPayload.length);
    finalBuffer[0] = 0x66;
    finalBuffer[1] = 0x4c;
    finalBuffer[2] = 0x61;
    finalBuffer[3] = 0x43;

    let writeOffset = 4;
    for (let i = 0; i < finalBlocks.length; i++) {
      const block = finalBlocks[i]!;
      const isLast = i === finalBlocks.length - 1;
      const headerByte = (isLast ? 0x80 : 0x00) | (block.type & 0x7f);
      const len = block.data.length;

      finalBuffer[writeOffset] = headerByte;
      finalBuffer[writeOffset + 1] = (len >> 16) & 0xff;
      finalBuffer[writeOffset + 2] = (len >> 8) & 0xff;
      finalBuffer[writeOffset + 3] = len & 0xff;
      writeOffset += 4;

      finalBuffer.set(block.data, writeOffset);
      writeOffset += block.data.length;
    }

    finalBuffer.set(audioPayload, writeOffset);
    return finalBuffer;
  }

  private static buildVorbisCommentBlock(fields: EditableMetadataFields): Uint8Array {
    const comments: string[] = [];

    const addComment = (name: string, val?: string | number) => {
      if (val === undefined || val === null || String(val).trim() === '') return;
      comments.push(`${name.toUpperCase()}=${String(val).trim()}`);
    };

    addComment('TITLE', fields.title);
    addComment('ARTIST', fields.artist);
    addComment('ALBUMARTIST', fields.albumArtist);
    addComment('ALBUM', fields.album);
    addComment('GENRE', fields.genre);
    addComment('DATE', fields.year);
    addComment('TRACKNUMBER', fields.trackNumber);
    addComment('TRACKTOTAL', fields.totalTracks);
    addComment('DISCNUMBER', fields.discNumber);
    addComment('DISCTOTAL', fields.totalDiscs);
    addComment('COMPOSER', fields.composer);
    addComment('COMMENT', fields.comment);

    const vendorStr = 'MyMusicApp 1.0';
    const vendorBytes = this.textEncoder.encode(vendorStr);

    let payloadSize = 4 + vendorBytes.length + 4;
    const commentByteArrays: Uint8Array[] = [];

    for (const c of comments) {
      const b = this.textEncoder.encode(c);
      commentByteArrays.push(b);
      payloadSize += 4 + b.length;
    }

    const buffer = new Uint8Array(payloadSize);
    const view = new DataView(buffer.buffer);
    let offset = 0;

    // Vendor string length (uint32 LE) + string
    view.setUint32(offset, vendorBytes.length, true);
    offset += 4;
    buffer.set(vendorBytes, offset);
    offset += vendorBytes.length;

    // Comment count (uint32 LE)
    view.setUint32(offset, commentByteArrays.length, true);
    offset += 4;

    // Each comment length (uint32 LE) + comment string
    for (const cb of commentByteArrays) {
      view.setUint32(offset, cb.length, true);
      offset += 4;
      buffer.set(cb, offset);
      offset += cb.length;
    }

    return buffer;
  }

  private static buildPictureBlock(imgData: Uint8Array, mimeType: string): Uint8Array {
    const mimeBytes = this.textEncoder.encode(mimeType);

    // 4 (picture type 3) + 4 (mime len) + mime + 4 (desc len 0) + 4 (width) + 4 (height) + 4 (depth) + 4 (colors) + 4 (img len) + img
    const payloadSize = 4 + 4 + mimeBytes.length + 4 + 4 + 4 + 4 + 4 + 4 + imgData.length;
    const buffer = new Uint8Array(payloadSize);
    const view = new DataView(buffer.buffer);
    let offset = 0;

    // Picture type 3 (Cover Front) BE
    view.setUint32(offset, 3, false);
    offset += 4;

    // MIME length + MIME string BE
    view.setUint32(offset, mimeBytes.length, false);
    offset += 4;
    buffer.set(mimeBytes, offset);
    offset += mimeBytes.length;

    // Description length 0
    view.setUint32(offset, 0, false);
    offset += 4;

    // Width, Height, Depth, Colors (0 default)
    view.setUint32(offset, 0, false); offset += 4;
    view.setUint32(offset, 0, false); offset += 4;
    view.setUint32(offset, 24, false); offset += 4; // 24-bit depth
    view.setUint32(offset, 0, false); offset += 4;

    // Image Data Length + Data
    view.setUint32(offset, imgData.length, false);
    offset += 4;
    buffer.set(imgData, offset);

    return buffer;
  }
}
