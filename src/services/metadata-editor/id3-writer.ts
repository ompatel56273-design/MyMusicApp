import type { EditableMetadataFields, ArtworkPayload } from './metadata-write-types';

export class ID3Writer {
  private static textEncoder = new TextEncoder();

  /**
   * Writes/updates ID3v2.3 tags on an MP3 buffer.
   */
  public static writeTags(
    originalBuffer: Uint8Array,
    fields: EditableMetadataFields,
    artwork?: ArtworkPayload | undefined
  ): Uint8Array {
    // 1. Locate existing ID3v2 header size if present
    let mpegOffset = 0;
    if (
      originalBuffer.length >= 10 &&
      originalBuffer[0] === 0x49 &&
      originalBuffer[1] === 0x44 &&
      originalBuffer[2] === 0x33
    ) {
      const tagSize =
        ((originalBuffer[6]! & 0x7f) << 21) |
        ((originalBuffer[7]! & 0x7f) << 14) |
        ((originalBuffer[8]! & 0x7f) << 7) |
        (originalBuffer[9]! & 0x7f);
      mpegOffset = 10 + tagSize;
    }

    const audioPayload = originalBuffer.subarray(mpegOffset);

    // 2. Build ID3v2 frames
    const frameBuffers: Uint8Array[] = [];

    const addTextFrame = (id: string, value?: string | number) => {
      if (value === undefined || value === null || String(value).trim() === '') return;
      const strVal = String(value).trim();
      const encodedText = this.textEncoder.encode(strVal);
      // Encoding byte: 0x03 (UTF-8)
      const frameContent = new Uint8Array(1 + encodedText.length);
      frameContent[0] = 3;
      frameContent.set(encodedText, 1);

      frameBuffers.push(this.createFrame(id, frameContent));
    };

    addTextFrame('TIT2', fields.title);
    addTextFrame('TPE1', fields.artist);
    addTextFrame('TPE2', fields.albumArtist);
    addTextFrame('TALB', fields.album);
    addTextFrame('TCON', fields.genre);
    addTextFrame('TYER', fields.year);
    addTextFrame('TCOM', fields.composer);

    if (fields.trackNumber !== undefined) {
      const trackStr = fields.totalTracks ? `${fields.trackNumber}/${fields.totalTracks}` : `${fields.trackNumber}`;
      addTextFrame('TRCK', trackStr);
    }

    if (fields.discNumber !== undefined) {
      const discStr = fields.totalDiscs ? `${fields.discNumber}/${fields.totalDiscs}` : `${fields.discNumber}`;
      addTextFrame('TPOS', discStr);
    }

    if (fields.comment !== undefined && fields.comment.trim() !== '') {
      const commBytes = this.createCommentFrame(fields.comment);
      frameBuffers.push(this.createFrame('COMM', commBytes));
    }

    // Handle Artwork
    if (artwork && artwork.action === 'replace' && artwork.data && artwork.data.length > 0) {
      const apicBytes = this.createApicFrame(artwork.data, artwork.mimeType || 'image/jpeg');
      frameBuffers.push(this.createFrame('APIC', apicBytes));
    }

    // Calculate total frames payload length
    const totalFramesLength = frameBuffers.reduce((sum, f) => sum + f.length, 0);

    // Create 10-byte ID3v2 header
    const id3Header = new Uint8Array(10);
    id3Header[0] = 0x49; // 'I'
    id3Header[1] = 0x44; // 'D'
    id3Header[2] = 0x33; // '3'
    id3Header[3] = 0x03; // ID3v2.3
    id3Header[4] = 0x00; // revision
    id3Header[5] = 0x00; // flags

    // Synchsafe size encoding for 4 bytes
    id3Header[6] = (totalFramesLength >> 21) & 0x7f;
    id3Header[7] = (totalFramesLength >> 14) & 0x7f;
    id3Header[8] = (totalFramesLength >> 7) & 0x7f;
    id3Header[9] = totalFramesLength & 0x7f;

    // Combine ID3 header + frames + audio payload
    const totalSize = 10 + totalFramesLength + audioPayload.length;
    const finalBuffer = new Uint8Array(totalSize);

    finalBuffer.set(id3Header, 0);
    let currentPos = 10;
    for (const frame of frameBuffers) {
      finalBuffer.set(frame, currentPos);
      currentPos += frame.length;
    }
    finalBuffer.set(audioPayload, currentPos);

    return finalBuffer;
  }

  private static createFrame(id: string, content: Uint8Array): Uint8Array {
    const frame = new Uint8Array(10 + content.length);
    // Frame ID (4 bytes)
    for (let i = 0; i < 4; i++) {
      frame[i] = id.charCodeAt(i) || 0x20;
    }
    // Frame size (4 bytes uint32 BE)
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    view.setUint32(4, content.length, false);
    // Flags (2 bytes zero)
    frame[8] = 0;
    frame[9] = 0;

    // Payload
    frame.set(content, 10);
    return frame;
  }

  private static createCommentFrame(comment: string): Uint8Array {
    const textBytes = this.textEncoder.encode(comment);
    // Encoding (1 byte) + Language (3 bytes 'eng') + Short desc (1 byte 0x00) + Text
    const payload = new Uint8Array(1 + 3 + 1 + textBytes.length);
    payload[0] = 3; // UTF-8
    payload[1] = 0x65; // 'e'
    payload[2] = 0x6e; // 'n'
    payload[3] = 0x67; // 'g'
    payload[4] = 0x00; // Empty description null terminator
    payload.set(textBytes, 5);
    return payload;
  }

  private static createApicFrame(imgData: Uint8Array, mimeType: string): Uint8Array {
    const mimeBytes = this.textEncoder.encode(mimeType);
    // Encoding (1) + Mime + Null (1) + PictureType (1: 0x03 cover front) + Desc Null (1) + ImgData
    const payload = new Uint8Array(1 + mimeBytes.length + 1 + 1 + 1 + imgData.length);
    let pos = 0;
    payload[pos++] = 3; // UTF-8
    payload.set(mimeBytes, pos);
    pos += mimeBytes.length;
    payload[pos++] = 0x00; // null byte
    payload[pos++] = 0x03; // Cover Front
    payload[pos++] = 0x00; // Description null byte
    payload.set(imgData, pos);
    return payload;
  }
}
