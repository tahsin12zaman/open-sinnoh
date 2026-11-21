import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
} from './platinum-save.ts';
import {
  readPlatinumFieldState,
  writePlatinumFieldState,
  type PlatinumFieldState,
} from './platinum-field-state.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function makeBlock(
  size: number,
  blockId: number,
  saveCounter: number,
  blockCounter: number,
): Uint8Array {
  const bytes = new Uint8Array(size);
  const footerOffset =
    size - PLATINUM_SAVE_FOOTER_SIZE;
  const view = new DataView(bytes.buffer);

  view.setUint32(
    footerOffset,
    saveCounter,
    true,
  );
  view.setUint32(
    footerOffset + 4,
    blockCounter,
    true,
  );
  view.setUint32(
    footerOffset + 8,
    size,
    true,
  );
  view.setUint32(
    footerOffset + 12,
    PLATINUM_SAVE_SIGNATURE,
    true,
  );
  view.setUint8(
    footerOffset + 16,
    blockId,
  );
  view.setUint16(
    footerOffset + 18,
    crc16Ccitt(bytes, 0, footerOffset),
    true,
  );

  return bytes;
}

function writeBlock(
  save: Uint8Array,
  copyOffset: number,
  specification: {
    offset: number;
    size: number;
    blockId: number;
  },
  saveCounter: number,
  blockCounter: number,
): void {
  save.set(
    makeBlock(
      specification.size,
      specification.blockId,
      saveCounter,
      blockCounter,
    ),
    copyOffset + specification.offset,
  );
}

function makeSave(): Uint8Array {
  const save = new Uint8Array(
    PLATINUM_SAVE_SIZE,
  );
  const [primary, backup] =
    PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(
    save,
    primary,
    PLATINUM_GENERAL_BLOCK,
    30,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    30,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    30,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    30,
    2,
  );

  return save;
}

const field: PlatinumFieldState = {
  player: {
    mapHeaderId: 200,
    warpId: 3,
    x: 232,
    z: 656,
    faceDirection: 1,
  },
  entrance: {
    mapHeaderId: 201,
    warpId: -1,
    x: 10,
    z: 20,
    faceDirection: 2,
  },
  previous: null,
  special: {
    mapHeaderId: 202,
    warpId: 4,
    x: -12,
    z: 48,
    faceDirection: 3,
  },
  exit: null,
  bgm: 1174,
  weather: 9,
  blackOutWarpId: 42,
  cameraType: 7,
  poisonSteps: 123,
  safariSteps: 456,
  safariBalls: 30,
};

describe('Platinum field state', () => {
  it('round-trips the complete field state', () => {
    const save = makeSave();
    const written =
      writePlatinumFieldState(save, field);

    expect(
      readPlatinumFieldState(written),
    ).toEqual(field);

    expect(written).not.toBe(save);
  });

  it('encodes null optional locations as zeroed locations', () => {
    const written =
      writePlatinumFieldState(
        makeSave(),
        {
          ...field,
          entrance: null,
          previous: null,
          special: null,
          exit: null,
        },
      );

    const decoded =
      readPlatinumFieldState(written);

    expect(decoded.entrance).toBeNull();
    expect(decoded.previous).toBeNull();
    expect(decoded.special).toBeNull();
    expect(decoded.exit).toBeNull();
  });

  it('rejects invalid locations and counters', () => {
    const save = makeSave();

    expect(() =>
      writePlatinumFieldState(
        save,
        {
          ...field,
          player: {
            ...field.player,
            faceDirection: 4,
          },
        },
      ),
    ).toThrow(/facing direction/i);

    expect(() =>
      writePlatinumFieldState(
        save,
        {
          ...field,
          player: {
            ...field.player,
            x: 1.5,
          },
        },
      ),
    ).toThrow(/x coordinate/i);

    expect(() =>
      writePlatinumFieldState(
        save,
        {
          ...field,
          safariBalls: 0x10000,
        },
      ),
    ).toThrow(/Safari Balls/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum field state',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const realField =
        readPlatinumFieldState(save);

      expect(
        realField.player.mapHeaderId,
      ).toBe(200);
      expect(realField.player.x).toBe(232);
      expect(realField.player.z).toBe(656);

      console.log(
        'field state:',
        realField,
      );
    },
  );
});
