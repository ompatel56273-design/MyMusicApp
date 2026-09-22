import { describe, it, expect } from 'vitest';
import { Mp4AtomParser } from '../../src/services/metadata/parsers/mp4-atom-parser';

describe('Mp4AtomParser', () => {
  function createSyntheticMp4Buffer(): Uint8Array {
    const createDataAtom = (text: string): Uint8Array => {
      const textBytes = new TextEncoder().encode(text);
      const atom = new Uint8Array(16 + textBytes.length);
      const view = new DataView(atom.buffer);
      view.setUint32(0, atom.length);
      atom[4] = 0x64; atom[5] = 0x61; atom[6] = 0x74; atom[7] = 0x61; // 'data'
      view.setUint32(8, 1); // text flag
      view.setUint32(12, 0); // locale
      atom.set(textBytes, 16);
      return atom;
    };

    const createItemAtom = (name: string, dataAtom: Uint8Array): Uint8Array => {
      const atom = new Uint8Array(8 + dataAtom.length);
      const view = new DataView(atom.buffer);
      view.setUint32(0, atom.length);
      for (let i = 0; i < 4; i++) atom[4 + i] = name.charCodeAt(i);
      atom.set(dataAtom, 8);
      return atom;
    };

    const namAtom = createItemAtom('©nam', createDataAtom('Get Lucky'));
    const artAtom = createItemAtom('©ART', createDataAtom('Daft Punk'));
    const albAtom = createItemAtom('©alb', createDataAtom('Random Access Memories'));

    const ilstPayload = new Uint8Array(namAtom.length + artAtom.length + albAtom.length);
    ilstPayload.set(namAtom, 0);
    ilstPayload.set(artAtom, namAtom.length);
    ilstPayload.set(albAtom, namAtom.length + artAtom.length);

    const ilstAtom = new Uint8Array(8 + ilstPayload.length);
    new DataView(ilstAtom.buffer).setUint32(0, ilstAtom.length);
    ilstAtom[4] = 0x69; ilstAtom[5] = 0x6c; ilstAtom[6] = 0x73; ilstAtom[7] = 0x74; // 'ilst'
    ilstAtom.set(ilstPayload, 8);

    const metaAtom = new Uint8Array(12 + ilstAtom.length);
    new DataView(metaAtom.buffer).setUint32(0, metaAtom.length);
    metaAtom[4] = 0x6d; metaAtom[5] = 0x65; metaAtom[6] = 0x74; metaAtom[7] = 0x61; // 'meta'
    metaAtom.set(ilstAtom, 12);

    const udtaAtom = new Uint8Array(8 + metaAtom.length);
    new DataView(udtaAtom.buffer).setUint32(0, udtaAtom.length);
    udtaAtom[4] = 0x75; udtaAtom[5] = 0x64; udtaAtom[6] = 0x74; udtaAtom[7] = 0x61; // 'udta'
    udtaAtom.set(metaAtom, 8);

    const moovAtom = new Uint8Array(8 + udtaAtom.length);
    new DataView(moovAtom.buffer).setUint32(0, moovAtom.length);
    moovAtom[4] = 0x6d; moovAtom[5] = 0x6f; moovAtom[6] = 0x6f; moovAtom[7] = 0x76; // 'moov'
    moovAtom.set(udtaAtom, 8);

    // ftyp (8 bytes) + moov
    const buffer = new Uint8Array(8 + moovAtom.length);
    new DataView(buffer.buffer).setUint32(0, 8);
    buffer[4] = 0x66; buffer[5] = 0x74; buffer[6] = 0x79; buffer[7] = 0x70; // 'ftyp'
    buffer.set(moovAtom, 8);

    return buffer;
  }

  it('should parse MP4 atoms and extract title, artist, and album', () => {
    const buffer = createSyntheticMp4Buffer();
    const parsed = Mp4AtomParser.parse(buffer);

    expect(parsed.title).toBe('Get Lucky');
    expect(parsed.artist).toBe('Daft Punk');
    expect(parsed.album).toBe('Random Access Memories');
    expect(parsed.container).toBe('m4a');
  });
});
