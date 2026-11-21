import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumImageClips,
  PLATINUM_CONTEST_PHOTO_COUNT,
  PLATINUM_DRESS_UP_PHOTO_COUNT,
  PLATINUM_IMAGE_CLIPS_ENTRY_SIZE,
  readPlatinumImageClips,
} from './platinum-image-clips.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

const EMPTY_MAGIC = 0x1234;
const FULL_MAGIC = 0x2345;
const DRESS_SIZE = 0x74;
const CONTEST_OFFSET = 0x4fc;
const CONTEST_SIZE = 0x98;

function setCodes(
  view: DataView,
  offset: number,
  codes: readonly number[],
): void {
  codes.forEach((code, index) => {
    view.setUint16(
      offset + index * 2,
      code,
      true,
    );
  });
}

function initializeEmptyPhotos(
  view: DataView,
): void {
  for (let slot = 0; slot < 11; slot++) {
    view.setUint32(
      slot * DRESS_SIZE,
      EMPTY_MAGIC,
      true,
    );
  }

  for (let slot = 0; slot < 5; slot++) {
    view.setUint32(
      CONTEST_OFFSET + slot * CONTEST_SIZE,
      EMPTY_MAGIC,
      true,
    );
  }
}

function imageClipsFixture(): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_IMAGE_CLIPS_ENTRY_SIZE,
  );

  const view = new DataView(bytes.buffer);

  initializeEmptyPhotos(view);

  const dress = DRESS_SIZE;

  view.setUint32(dress, FULL_MAGIC, true);
  view.setUint32(dress + 4, 0x12345678, true);
  view.setUint32(dress + 8, 0x87654321, true);
  view.setUint16(dress + 0x0c, 403, true);

  setCodes(
    view,
    dress + 0x0e,
    [403, 0xffff],
  );

  setCodes(
    view,
    dress + 0x24,
    [318, 329, 343, 344, 0xffff],
  );

  view.setInt8(dress + 0x34, -2);
  view.setUint8(dress + 0x35, 190);
  view.setUint8(dress + 0x36, 70);
  view.setUint8(dress + 0x37, 1);
  view.setUint8(dress + 0x38, 1);

  view.setUint32(dress + 0x3c, 0b101, true);
  view.setUint16(dress + 0x44, 1234, true);

  view.setUint8(dress + 0x48, 5);
  view.setUint8(dress + 0x49, 20);
  view.setUint8(dress + 0x4a, 30);
  view.setInt8(dress + 0x4b, -1);

  view.setUint8(dress + 0x50, 99);
  view.setUint8(dress + 0x51, 40);
  view.setUint8(dress + 0x52, 50);
  view.setInt8(dress + 0x53, 2);

  view.setUint8(dress + 0x70, 3);
  view.setUint8(dress + 0x71, 2);

  const contest = CONTEST_OFFSET;

  view.setUint32(
    contest,
    FULL_MAGIC,
    true,
  );
  view.setUint32(contest + 4, 3, true);
  view.setUint32(
    contest + 8,
    0x11111111,
    true,
  );
  view.setUint32(
    contest + 0x0c,
    0x22222222,
    true,
  );
  view.setUint16(
    contest + 0x10,
    456,
    true,
  );

  setCodes(
    view,
    contest + 0x12,
    [456, 0xffff],
  );

  setCodes(
    view,
    contest + 0x28,
    [318, 329, 343, 344, 0xffff],
  );

  view.setInt8(contest + 0x38, 1);
  view.setUint8(contest + 0x39, 120);
  view.setUint8(contest + 0x3a, 80);
  view.setUint8(contest + 0x3b, 2);
  view.setUint8(contest + 0x3c, 0);

  view.setUint32(
    contest + 0x40,
    0b10,
    true,
  );

  view.setUint8(contest + 0x48, 7);
  view.setUint8(contest + 0x49, 60);
  view.setUint8(contest + 0x4a, 90);
  view.setInt8(contest + 0x4b, -3);

  view.setUint8(contest + 0x94, 4);

  return bytes;
}

describe('Platinum ImageClips photos', () => {
  it('decodes Dress Up and Contest photos', () => {
    const decoded =
      decodePlatinumImageClips(
        imageClipsFixture(),
      );

    expect(decoded.dressUpPhotos).toHaveLength(
      PLATINUM_DRESS_UP_PHOTO_COUNT,
    );

    expect(decoded.dressUpPhotos[1]).toEqual({
      mon: {
        pid: 0x12345678,
        otId: 0x87654321,
        species: 403,
        nicknameCodes: [
          403,
          0xffff,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ],
        trainerNameCodes: [
          318,
          329,
          343,
          344,
          0xffff,
          0,
          0,
          0,
        ],
        priority: -2,
        x: 190,
        y: 70,
        form: 1,
        trainerGender: 1,
      },
      accessories: [
        {
          accessory: 5,
          x: 20,
          y: 30,
          priority: -1,
        },
        {
          accessory: 99,
          x: 40,
          y: 50,
          priority: 2,
        },
      ],
      backdrop: 3,
      title: 1234,
      language: 2,
    });

    expect(decoded.contestPhotos).toHaveLength(
      PLATINUM_CONTEST_PHOTO_COUNT,
    );

    expect(
      decoded.contestPhotos[0],
    ).toMatchObject({
      rank: 3,
      mon: {
        pid: 0x11111111,
        otId: 0x22222222,
        species: 456,
        priority: 1,
        form: 2,
      },
      accessories: [
        {
          accessory: 7,
          x: 60,
          y: 90,
          priority: -3,
        },
      ],
      backdrop: 4,
    });
  });

  it('rejects invalid photo integrity', () => {
    const fixture = imageClipsFixture();
    const view = new DataView(fixture.buffer);

    view.setUint32(0, 0x9999, true);

    expect(() =>
      decodePlatinumImageClips(fixture),
    ).toThrow(/integrity/i);
  });

  it('rejects an invalid accessory', () => {
    const fixture = imageClipsFixture();

    fixture[DRESS_SIZE + 0x48] = 100;

    expect(() =>
      decodePlatinumImageClips(fixture),
    ).toThrow(/accessory 100/i);
  });

  it('rejects a truncated entry', () => {
    expect(() =>
      decodePlatinumImageClips(
        new Uint8Array(
          PLATINUM_IMAGE_CLIPS_ENTRY_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it.skipIf(!savePath)(
    'reads real Platinum ImageClips photos',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const decoded =
        readPlatinumImageClips(save);

      console.log('image clips photos:', {
        dressUpPhotos:
          decoded.dressUpPhotos,
        contestPhotos:
          decoded.contestPhotos,
      });

      expect(decoded.dressUpPhotos).toEqual(
        new Array(11).fill(null),
      );

      expect(decoded.contestPhotos).toEqual(
        new Array(5).fill(null),
      );
    },
  );
});
