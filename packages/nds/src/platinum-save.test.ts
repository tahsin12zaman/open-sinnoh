
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
  readPlatinumSaveFooter,
  selectPlatinumSaveBlocks,
  validatePlatinumSaveBlock,
  validatePlatinumSaveSize,
  readPlatinumTrainerData,
  writePlatinumSave,
  writePlatinumTrainerMoney,
  writePlatinumTrainerData,
  readPlatinumPlayerLocation,
  writePlatinumPlayerLocation,
  readPlatinumRivalData,
  writePlatinumRivalData,
} from './platinum-save.ts';

function makeBlock(
  size: number,
  blockId: number,
  saveCounter = 4,
  blockCounter = 7,
): Uint8Array {
  const bytes = new Uint8Array(size);

  for (let i = 0; i < size - PLATINUM_SAVE_FOOTER_SIZE; i++) {
    bytes[i] = (i * 17 + 3) & 0xff;
  }

  const footerOffset = size - PLATINUM_SAVE_FOOTER_SIZE;
  const view = new DataView(bytes.buffer);

  view.setUint32(footerOffset, saveCounter, true);
  view.setUint32(footerOffset + 4, blockCounter, true);
  view.setUint32(footerOffset + 8, size, true);
  view.setUint32(footerOffset + 12, PLATINUM_SAVE_SIGNATURE, true);
  view.setUint8(footerOffset + 16, blockId);
  view.setUint8(footerOffset + 17, 0);
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

function refreshBlockChecksum(
  save: Uint8Array,
  blockOffset: number,
  blockSize: number,
): void {
  const footerOffset =
    blockOffset + blockSize - PLATINUM_SAVE_FOOTER_SIZE;

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  view.setUint16(
    footerOffset + 18,
    crc16Ccitt(save, blockOffset, footerOffset),
    true,
  );
}
  


describe('Platinum save blocks', () => {
  it('reads and validates a block footer', () => {
    const bytes = makeBlock(0x80, 0);

    expect(validatePlatinumSaveBlock(bytes, 0, bytes.length, 0)).toEqual({
      saveCounter: 4,
      blockCounter: 7,
      size: 0x80,
      signature: PLATINUM_SAVE_SIGNATURE,
      blockId: 0,
      checksum: readPlatinumSaveFooter(bytes, 0x80 - 0x14).checksum,
    });
  });

  it('rejects a changed byte', () => {
    const bytes = makeBlock(0x80, 0);
    bytes[5] = bytes[5]! ^ 1;

    expect(() =>
      validatePlatinumSaveBlock(bytes, 0, bytes.length, 0),
    ).toThrow(/checksum/i);
  });

  it('rejects a non-Platinum save size', () => {
    expect(() => validatePlatinumSaveSize(new Uint8Array(123))).toThrow(
      /expected 524288/,
    );
  });
  it('selects the newest valid general and storage copies', () => {
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 8, 10);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 8, 11);

  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 8, 10);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 7, 99);

  const selected = selectPlatinumSaveBlocks(save);

  expect(selected.general.offset).toBe(
    backup + PLATINUM_GENERAL_BLOCK.offset,
  );

  expect(selected.storage.offset).toBe(
    primary + PLATINUM_STORAGE_BLOCK.offset,
  );
});

it('uses the other copy when one block is corrupt', () => {
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 5, 2);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 5, 1);
  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 5, 2);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 5, 1);

  save[primary + 20] =
    save[primary + 20]! ^ 1;

  const selected = selectPlatinumSaveBlocks(save);

  expect(selected.general.offset).toBe(
    backup + PLATINUM_GENERAL_BLOCK.offset,
  );
});

it('rejects general and storage blocks from different full saves', () => {
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 9, 1);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 8, 1);
  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 7, 1);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 6, 1);

  expect(() => selectPlatinumSaveBlocks(save)).toThrow(
    /counters disagree/,
  );
});


it('writes a cloned selected block and preserves its duplicate', () => {
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 10, 2);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 9, 1);
  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 10, 2);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 9, 1);

  const original = save.slice();

  const written = writePlatinumSave(
    save,
    ({ general }) => {
      general[5] = general[5]! ^ 1;
    },
  );

  expect(save).toEqual(original);
  expect(written).not.toBe(save);
  expect(written[primary + 5]).not.toBe(
    original[primary + 5],
  );

  expect(
    written.subarray(
      backup,
      backup + 0x40000,
    ),
  ).toEqual(
    original.subarray(
      backup,
      backup + 0x40000,
    ),
  );

  validatePlatinumSaveBlock(
    written,
    primary + PLATINUM_GENERAL_BLOCK.offset,
    PLATINUM_GENERAL_BLOCK.size,
    PLATINUM_GENERAL_BLOCK.blockId,
  );

  validatePlatinumSaveBlock(
    written,
    primary + PLATINUM_STORAGE_BLOCK.offset,
    PLATINUM_STORAGE_BLOCK.size,
    PLATINUM_STORAGE_BLOCK.blockId,
  );
});

it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
  'validates and selects the blocks of a real Platinum save',
  () => {
    const path = process.env.OPENSINNOH_NDS_SAV!;
    const bytes = new Uint8Array(readFileSync(path));
    const selected = selectPlatinumSaveBlocks(bytes);
    const trainer = readPlatinumTrainerData(bytes);
    console.log('trainer data:', trainer);

    expect(selected.general.footer.signature).toBe(
      PLATINUM_SAVE_SIGNATURE,
    );

    expect(selected.storage.footer.signature).toBe(
      PLATINUM_SAVE_SIGNATURE,
    );

    console.log(
      `general 0x${selected.general.offset.toString(16)}, ` +
        `storage 0x${selected.storage.offset.toString(16)}, ` +
        `save counter ${selected.general.footer.saveCounter}`,
    );
  },
);

it('reads trainer data from the selected general block', () => {
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 12, 1);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 12, 2);
  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 12, 1);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 12, 2);

  const base = backup + PLATINUM_GENERAL_BLOCK.offset;
  const view = new DataView(save.buffer);

  const nameCodes = [
    0x012b,
    0x0136,
    0x012a,
    0x0132,
    0xFFFF,
    0xFFFF,
    0xFFFF,
    0xFFFF,
  ];

  nameCodes.forEach((code, index) => {
    view.setUint16(base + 0x68 + index * 2, code, true);
  });

  view.setUint32(base + 0x78, (54321 << 16) | 12345, true);
  view.setUint32(base + 0x7c, 987654, true);
  view.setUint8(base + 0x80, 1);
  view.setUint8(base + 0x81, 2);
  view.setUint8(base + 0x82, 0b10101101);
  view.setUint8(base + 0x83, 7);
  view.setUint8(base + 0x84, 0);
  view.setUint8(base + 0x85, 0b00000011);
  view.setUint16(base + 0x88, 4321, true);
  view.setUint16(base + 0x8a, 127, true);
  view.setUint8(base + 0x8c, 34);
  view.setUint8(base + 0x8d, 56);

refreshBlockChecksum(
    save,
    base,
    PLATINUM_GENERAL_BLOCK.size,
  );

  expect(readPlatinumTrainerData(save)).toEqual({
    nameCodes,
    trainerId: 12345,
    secretId: 54321,
    money: 987654,
    gender: 1,
    language: 2,
    badges: 0b10101101,
    appearance: 7,
    gameCode: 0,
    mainStoryCleared: true,
    hasNationalDex: true,
    coins: 4321,
    playTime: {
      hours: 127,
      minutes: 34,
      seconds: 56,
    },
  });
});
});

describe('Platinum trainer writing', () => {
  it('round-trips all modeled trainer fields', () => {
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

    const trainer = {
      nameCodes: [
        0x012b,
        0x0136,
        0x012a,
        0x0132,
        0xffff,
        0xffff,
        0xffff,
        0xffff,
      ],
      trainerId: 12345,
      secretId: 54321,
      money: 999999,
      gender: 1,
      language: 2,
      badges: 0b10101101,
      appearance: 7,
      gameCode: 0,
      mainStoryCleared: true,
      hasNationalDex: true,
      coins: 9999,
      playTime: {
        hours: 999,
        minutes: 59,
        seconds: 58,
      },
    };

    const original = save.slice();
    const written =
      writePlatinumTrainerData(
        save,
        trainer,
      );

    expect(save).toEqual(original);
    expect(
      readPlatinumTrainerData(written),
    ).toEqual(trainer);
  });

  it('preserves unrelated completion bits', () => {
    const save = new Uint8Array(
      PLATINUM_SAVE_SIZE,
    );
    const [primary, backup] =
      PLATINUM_SAVE_COPY_OFFSETS;

    for (const copy of [primary, backup]) {
      writeBlock(
        save,
        copy,
        PLATINUM_GENERAL_BLOCK,
        31,
        copy === primary ? 1 : 2,
      );
      writeBlock(
        save,
        copy,
        PLATINUM_STORAGE_BLOCK,
        31,
        copy === primary ? 1 : 2,
      );
    }

    const base =
      backup +
      PLATINUM_GENERAL_BLOCK.offset;

    save[base + 0x85] = 0b11111100;
    refreshBlockChecksum(
      save,
      base,
      PLATINUM_GENERAL_BLOCK.size,
    );

    const current = {
      ...readPlatinumTrainerData(save),
      money: 0,
      gender: 0,
      coins: 0,
      playTime: {
        hours: 0,
        minutes: 0,
        seconds: 0,
      },
    };

    const written =
      writePlatinumTrainerData(
        save,
        {
          ...current,
          mainStoryCleared: true,
          hasNationalDex: false,
        },
      );

    expect(
      written[base + 0x85],
    ).toBe(0b11111101);
  });
});

describe('Platinum save writing', () => {
  function trainerSave(): Uint8Array {
    const save = new Uint8Array(
      PLATINUM_SAVE_SIZE,
    );

    const [primary, backup] =
      PLATINUM_SAVE_COPY_OFFSETS;

    writeBlock(
      save,
      primary,
      PLATINUM_GENERAL_BLOCK,
      20,
      1,
    );

    writeBlock(
      save,
      backup,
      PLATINUM_GENERAL_BLOCK,
      20,
      2,
    );

    writeBlock(
      save,
      primary,
      PLATINUM_STORAGE_BLOCK,
      20,
      1,
    );

    writeBlock(
      save,
      backup,
      PLATINUM_STORAGE_BLOCK,
      20,
      2,
    );

    return save;
  }

  it.each([0, 1, 999999])(
    'round-trips trainer money %i',
    (money) => {
      const original = trainerSave();
      const before = original.slice();

      const written =
        writePlatinumTrainerMoney(
          original,
          money,
        );

      expect(original).toEqual(before);
      expect(
        readPlatinumTrainerData(written).money,
      ).toBe(money);

      expect(
        selectPlatinumSaveBlocks(
          written,
        ).general.offset,
      ).toBe(
        PLATINUM_SAVE_COPY_OFFSETS[1] +
          PLATINUM_GENERAL_BLOCK.offset,
      );
    },
  );

  it.each([-1, 1000000, 1.5, NaN])(
    'rejects invalid trainer money %s',
    (money) => {
      expect(() =>
        writePlatinumTrainerMoney(
          trainerSave(),
          money,
        ),
      ).toThrow(/money/i);
    },
  );
});


describe('Platinum location writing', () => {
  function locationSave(): Uint8Array {
    const save = new Uint8Array(
      PLATINUM_SAVE_SIZE,
    );
    const [primary, backup] =
      PLATINUM_SAVE_COPY_OFFSETS;

    for (const copy of [primary, backup]) {
      const blockCounter =
        copy === primary ? 1 : 2;

      writeBlock(
        save,
        copy,
        PLATINUM_GENERAL_BLOCK,
        40,
        blockCounter,
      );
      writeBlock(
        save,
        copy,
        PLATINUM_STORAGE_BLOCK,
        40,
        blockCounter,
      );
    }

    return save;
  }

  it('round-trips the player location', () => {
    const original = locationSave();
    const before = original.slice();

    const location = {
      mapHeaderId: 411,
      warpId: -1,
      x: 232,
      z: 656,
      faceDirection: 2,
    };

    const written =
      writePlatinumPlayerLocation(
        original,
        location,
      );

    expect(original).toEqual(before);
    expect(
      readPlatinumPlayerLocation(written),
    ).toEqual(location);
  });

  it.each([
    [
      'map header',
      {
        mapHeaderId: -1,
        warpId: 0,
        x: 0,
        z: 0,
        faceDirection: 0,
      },
    ],
    [
      'facing direction',
      {
        mapHeaderId: 1,
        warpId: 0,
        x: 0,
        z: 0,
        faceDirection: 4,
      },
    ],
    [
      'x coordinate',
      {
        mapHeaderId: 1,
        warpId: 0,
        x: 1.5,
        z: 0,
        faceDirection: 0,
      },
    ],
  ])(
    'rejects an invalid %s',
    (_, location) => {
      expect(() =>
        writePlatinumPlayerLocation(
          locationSave(),
          location,
        ),
      ).toThrow(/invalid/i);
    },
  );
});


describe('Platinum rival writing', () => {
  function rivalSave(): Uint8Array {
    const save = new Uint8Array(
      PLATINUM_SAVE_SIZE,
    );
    const [primary, backup] =
      PLATINUM_SAVE_COPY_OFFSETS;

    for (const copy of [primary, backup]) {
      const counter =
        copy === primary ? 1 : 2;

      writeBlock(
        save,
        copy,
        PLATINUM_GENERAL_BLOCK,
        50,
        counter,
      );
      writeBlock(
        save,
        copy,
        PLATINUM_STORAGE_BLOCK,
        50,
        counter,
      );
    }

    return save;
  }

  it('round-trips the rival name', () => {
    const save = rivalSave();
    const original = save.slice();

    const rival = {
      nameCodes: [
        0x012b,
        0x012a,
        0x013b,
        0x013b,
        0x0142,
        0xffff,
        0xffff,
        0xffff,
      ],
    };

    const written =
      writePlatinumRivalData(
        save,
        rival,
      );

    expect(save).toEqual(original);
    expect(
      readPlatinumRivalData(written),
    ).toEqual(rival);
  });

  it('rejects an invalid rival-name length', () => {
    expect(() =>
      writePlatinumRivalData(
        rivalSave(),
        { nameCodes: [1, 2] },
      ),
    ).toThrow(/length/i);
  });

  it('rejects an invalid rival-name code', () => {
    expect(() =>
      writePlatinumRivalData(
        rivalSave(),
        {
          nameCodes: [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            0x10000,
          ],
        },
      ),
    ).toThrow(/code/i);
  });
});
