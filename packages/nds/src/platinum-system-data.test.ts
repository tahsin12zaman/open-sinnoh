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
  readPlatinumSystemData,
  writePlatinumSystemData,
  type PlatinumSystemData,
} from './platinum-system-data.ts';

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
    40,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    40,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    40,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    40,
    2,
  );

  return save;
}

const system: PlatinumSystemData = {
  now: {
    year: 2025,
    month: 8,
    day: 20,
    week: 3,
    hour: 17,
    minute: 48,
    second: 31,
  },
  dayNumber: 9332,
  startTimestamp: 805690550n,
  firstCompletionTimestamp: -123456789n,
  penaltyMinutes: 1311,
  mysteryGiftUnlocked: true,
};

describe('Platinum SystemData', () => {
  it('round-trips every modeled system field', () => {
    const save = makeSave();
    const written =
      writePlatinumSystemData(save, system);

    expect(
      readPlatinumSystemData(written),
    ).toEqual(system);

    expect(written).not.toBe(save);
  });

  it('round-trips boundary values', () => {
    const boundary: PlatinumSystemData = {
      now: {
        year: 2000,
        month: 1,
        day: 1,
        week: 0,
        hour: 0,
        minute: 0,
        second: 0,
      },
      dayNumber: 0xffffffff,
      startTimestamp: -(1n << 63n),
      firstCompletionTimestamp:
        (1n << 63n) - 1n,
      penaltyMinutes: 1440,
      mysteryGiftUnlocked: false,
    };

    const written =
      writePlatinumSystemData(
        makeSave(),
        boundary,
      );

    expect(
      readPlatinumSystemData(written),
    ).toEqual(boundary);
  });

  it('rejects invalid clock and system values', () => {
    const save = makeSave();

    expect(() =>
      writePlatinumSystemData(
        save,
        {
          ...system,
          now: {
            ...system.now,
            month: 13,
          },
        },
      ),
    ).toThrow(/month/i);

    expect(() =>
      writePlatinumSystemData(
        save,
        {
          ...system,
          now: {
            ...system.now,
            second: 1.5,
          },
        },
      ),
    ).toThrow(/second/i);

    expect(() =>
      writePlatinumSystemData(
        save,
        {
          ...system,
          penaltyMinutes: 1441,
        },
      ),
    ).toThrow(/penalty/i);

    expect(() =>
      writePlatinumSystemData(
        save,
        {
          ...system,
          startTimestamp: 1n << 63n,
        },
      ),
    ).toThrow(/timestamp/i);
  });

  it.skipIf(!savePath)(
    'reads the saved clock from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const realSystem =
        readPlatinumSystemData(save);

      expect(realSystem.now).toEqual({
        year: 2025,
        month: 8,
        day: 20,
        week: 0,
        hour: 1,
        minute: 48,
        second: 31,
      });

      expect(realSystem.dayNumber).toBe(9332);
      expect(realSystem.startTimestamp).toBe(
        805690550n,
      );
      expect(
        realSystem.firstCompletionTimestamp,
      ).toBe(0n);
      expect(
        realSystem.penaltyMinutes,
      ).toBe(1311);

      console.log(
        'system data:',
        realSystem,
      );
    },
  );
});
