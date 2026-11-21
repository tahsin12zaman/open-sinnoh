import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  crc16Ccitt,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
} from './platinum-save.ts';
import {
  parsePlatinumHallOfFameCopy,
  PLATINUM_HALL_OF_FAME_BACKUP_OFFSET,
  PLATINUM_HALL_OF_FAME_BODY_SIZE,
  PLATINUM_HALL_OF_FAME_ENTRY_SIZE,
  PLATINUM_HALL_OF_FAME_NEXT_INDEX_OFFSET,
  PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET,
  PLATINUM_HALL_OF_FAME_TOTAL_OFFSET,
  readPlatinumHallOfFame,
} from './platinum-hall-of-fame.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function writeName(
  view: DataView,
  offset: number,
  codes: readonly number[],
  capacity: number,
): void {
  for (let index = 0; index < capacity; index++) {
    view.setUint16(
      offset + index * 2,
      codes[index] ?? 0xffff,
      true,
    );
  }
}

function writeEntry(
  save: Uint8Array,
  copyOffset: number,
  physicalIndex: number,
  species: number,
  year: number,
): void {
  const view = new DataView(save.buffer);
  const entry =
    copyOffset +
    physicalIndex *
      PLATINUM_HALL_OF_FAME_ENTRY_SIZE;

  view.setUint16(entry, species, true);
  view.setUint8(entry + 2, 50);
  view.setUint8(entry + 3, 1);
  view.setUint32(entry + 4, 0x12345678, true);
  view.setUint32(entry + 8, 0x87654321, true);

  writeName(
    view,
    entry + 0x0c,
    [318, 329, 343, 344, 0xffff],
    11,
  );

  writeName(
    view,
    entry + 0x22,
    [318, 329, 343, 344, 0xffff],
    8,
  );

  view.setUint16(entry + 0x32, 33, true);
  view.setUint16(entry + 0x34, 45, true);

  view.setUint16(entry + 0x168, year, true);
  view.setUint8(entry + 0x16a, 11);
  view.setUint8(entry + 0x16b, 19);
}

function writeCopy(
  save: Uint8Array,
  copyOffset: number,
  options: {
    saveCounter: number;
    nextEntryIndex: number;
    total: number;
    entries: {
      physicalIndex: number;
      species: number;
      year: number;
    }[];
  },
): void {
  save.fill(
    0,
    copyOffset,
    copyOffset +
      PLATINUM_HALL_OF_FAME_BODY_SIZE +
      0x10,
  );

  const view = new DataView(save.buffer);

  for (const entry of options.entries) {
    writeEntry(
      save,
      copyOffset,
      entry.physicalIndex,
      entry.species,
      entry.year,
    );
  }

  view.setUint32(
    copyOffset +
      PLATINUM_HALL_OF_FAME_NEXT_INDEX_OFFSET,
    options.nextEntryIndex,
    true,
  );

  view.setUint32(
    copyOffset +
      PLATINUM_HALL_OF_FAME_TOTAL_OFFSET,
    options.total,
    true,
  );

  const footer =
    copyOffset +
    PLATINUM_HALL_OF_FAME_BODY_SIZE;

  view.setUint32(
    footer,
    PLATINUM_SAVE_SIGNATURE,
    true,
  );
  view.setUint32(
    footer + 4,
    options.saveCounter,
    true,
  );
  view.setUint32(
    footer + 8,
    PLATINUM_HALL_OF_FAME_BODY_SIZE,
    true,
  );
  view.setUint16(footer + 12, 0, true);

  view.setUint16(
    footer + 14,
    crc16Ccitt(save, copyOffset, footer + 14),
    true,
  );
}

function blankSave(): Uint8Array {
  const save = new Uint8Array(
    PLATINUM_SAVE_SIZE,
  );

  save.fill(0xff);
  return save;
}

describe('Platinum Hall of Fame', () => {
  it('treats erased copies as empty', () => {
    expect(
      readPlatinumHallOfFame(blankSave()),
    ).toEqual({
      total: 0,
      nextEntryIndex: 0,
      entries: [],
      source: 'none',
      saveCounter: null,
    });
  });

  it('reads a populated primary copy', () => {
    const save = blankSave();

    writeCopy(
      save,
      PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET,
      {
        saveCounter: 7,
        nextEntryIndex: 2,
        total: 2,
        entries: [
          {
            physicalIndex: 0,
            species: 387,
            year: 25,
          },
          {
            physicalIndex: 1,
            species: 390,
            year: 26,
          },
        ],
      },
    );

    const hall = readPlatinumHallOfFame(save);

    expect(hall.source).toBe('primary');
    expect(hall.saveCounter).toBe(7);
    expect(hall.total).toBe(2);
    expect(
      hall.entries.map((entry) => entry.number),
    ).toEqual([1, 2]);
    expect(
      hall.entries.map(
        (entry) => entry.pokemon[0]?.species,
      ),
    ).toEqual([387, 390]);

    expect(hall.entries[0]?.pokemon[0]).toMatchObject({
      level: 50,
      form: 1,
      personality: 0x12345678,
      otId: 0x87654321,
      moves: [33, 45],
    });
  });

  it('chooses the newer valid backup copy', () => {
    const save = blankSave();

    writeCopy(
      save,
      PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET,
      {
        saveCounter: 10,
        nextEntryIndex: 1,
        total: 1,
        entries: [
          {
            physicalIndex: 0,
            species: 387,
            year: 25,
          },
        ],
      },
    );

    writeCopy(
      save,
      PLATINUM_HALL_OF_FAME_BACKUP_OFFSET,
      {
        saveCounter: 11,
        nextEntryIndex: 1,
        total: 1,
        entries: [
          {
            physicalIndex: 0,
            species: 393,
            year: 26,
          },
        ],
      },
    );

    const hall = readPlatinumHallOfFame(save);

    expect(hall.source).toBe('backup');
    expect(hall.entries[0]?.pokemon[0]?.species).toBe(
      393,
    );
  });

  it('handles counter wraparound', () => {
    const save = blankSave();

    writeCopy(
      save,
      PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET,
      {
        saveCounter: 0,
        nextEntryIndex: 1,
        total: 1,
        entries: [
          {
            physicalIndex: 0,
            species: 390,
            year: 26,
          },
        ],
      },
    );

    writeCopy(
      save,
      PLATINUM_HALL_OF_FAME_BACKUP_OFFSET,
      {
        saveCounter: 0xffffffff,
        nextEntryIndex: 1,
        total: 1,
        entries: [
          {
            physicalIndex: 0,
            species: 387,
            year: 25,
          },
        ],
      },
    );

    expect(
      readPlatinumHallOfFame(save).source,
    ).toBe('primary');
  });

  it('reads a wrapped ring oldest first', () => {
    const bytes = new Uint8Array(
      PLATINUM_HALL_OF_FAME_BODY_SIZE,
    );

    const view = new DataView(bytes.buffer);

    for (let physical = 0; physical < 30; physical++) {
      writeEntry(
        bytes,
        0,
        physical,
        1 + physical,
        20 + physical,
      );
    }

    view.setUint32(
      PLATINUM_HALL_OF_FAME_NEXT_INDEX_OFFSET,
      2,
      true,
    );
    view.setUint32(
      PLATINUM_HALL_OF_FAME_TOTAL_OFFSET,
      32,
      true,
    );

    const hall = parsePlatinumHallOfFameCopy(
      bytes,
      0,
    );

    expect(hall.entries).toHaveLength(30);
    expect(hall.entries[0]?.number).toBe(3);
    expect(
      hall.entries[0]?.pokemon[0]?.species,
    ).toBe(3);
    expect(hall.entries[29]?.number).toBe(32);
    expect(
      hall.entries[29]?.pokemon[0]?.species,
    ).toBe(2);
  });

  it('rejects two corrupt non-erased copies', () => {
    const save = blankSave();

    save[
      PLATINUM_HALL_OF_FAME_PRIMARY_OFFSET
    ] = 0;

    save[
      PLATINUM_HALL_OF_FAME_BACKUP_OFFSET
    ] = 0;

    expect(() =>
      readPlatinumHallOfFame(save),
    ).toThrow(/both.*invalid/i);
  });

  it.skipIf(!savePath)(
    'reads an early real save as empty',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const hall = readPlatinumHallOfFame(save);

      console.log('hall of fame:', hall);

      expect(hall.total).toBe(0);
      expect(hall.entries).toEqual([]);
      expect(hall.source).toBe('none');
    },
  );
});
