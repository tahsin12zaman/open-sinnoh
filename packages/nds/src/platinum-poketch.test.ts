import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLATINUM_POKETCH_APP_COUNT,
  PLATINUM_POKETCH_DOT_ART_SIZE,
  PLATINUM_POKETCH_HISTORY_COUNT,
  PLATINUM_POKETCH_MARKER_COUNT,
  PLATINUM_POKETCH_OFFSET,
  PLATINUM_POKETCH_REGISTRY_SIZE,
  readPlatinumPoketch,
  writePlatinumPoketch,
  type PlatinumPoketchData,
} from './platinum-poketch.ts';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

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

  view.setUint32(footerOffset, saveCounter, true);
  view.setUint32(footerOffset + 4, blockCounter, true);
  view.setUint32(footerOffset + 8, size, true);
  view.setUint32(
    footerOffset + 12,
    PLATINUM_SAVE_SIGNATURE,
    true,
  );
  view.setUint8(footerOffset + 16, blockId);
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
  const save = new Uint8Array(PLATINUM_SAVE_SIZE);
  const [primary, backup] =
    PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 130, 1);
  writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 130, 2);
  writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 130, 1);
  writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 130, 2);

  return save;
}

function makePoketch(): PlatinumPoketchData {
  return {
    enabled: true,
    pedometerEnabled: true,
    dotArtModified: true,
    color: 6,
    appCount: 5,
    currentApp: 12,
    registeredApps: [0, 3, 7, 12, 24],
    steps: 123456789,
    alarm: {
      on: true,
      hour: 23,
      minute: 59,
    },
    dotArt: Uint8Array.from(
      { length: PLATINUM_POKETCH_DOT_ART_SIZE },
      (_, index) => (index * 13 + 7) & 0xff,
    ),
    calendar: {
      month: 12,
      marks: 0x89abcdef,
    },
    markers: Array.from(
      { length: PLATINUM_POKETCH_MARKER_COUNT },
      (_, index) => ({
        x: index * 20,
        y: 255 - index * 10,
      }),
    ),
    history: [
      {
        species: 25,
        icon: 1,
        form: 0,
      },
      {
        species: 479,
        icon: 42,
        form: 5,
      },
      {
        species: 493,
        icon: 65535,
        form: 0xffffffff,
      },
    ],
  };
}

describe('Platinum Pokétch', () => {
  it('round-trips all modeled Pokétch data', () => {
    const poketch = makePoketch();

    const written = writePlatinumPoketch(
      makeSave(),
      poketch,
    );

    expect(readPlatinumPoketch(written)).toEqual(
      poketch,
    );
  });

  it('writes an empty disabled Pokétch', () => {
    const poketch: PlatinumPoketchData = {
      ...makePoketch(),
      enabled: false,
      pedometerEnabled: false,
      dotArtModified: false,
      color: 0,
      appCount: 0,
      currentApp: null,
      registeredApps: [],
      steps: 0,
      alarm: {
        on: false,
        hour: 0,
        minute: 0,
      },
      calendar: {
        month: 0,
        marks: 0,
      },
      history: [],
    };

    const written = writePlatinumPoketch(
      makeSave(),
      poketch,
    );

    expect(readPlatinumPoketch(written)).toEqual(
      poketch,
    );
  });

  it('preserves reserved settings, alarm and registry bytes', () => {
    const marked = writePlatinumSave(
      makeSave(),
      ({ general }) => {
        const view = new DataView(
          general.buffer,
          general.byteOffset,
          general.byteLength,
        );

        view.setUint8(
          PLATINUM_POKETCH_OFFSET,
          0xc0,
        );

        view.setUint16(
          PLATINUM_POKETCH_OFFSET + 0x28,
          0xf000,
          true,
        );

        general.fill(
          0xa5,
          PLATINUM_POKETCH_OFFSET + 0x03 +
            PLATINUM_POKETCH_APP_COUNT,
          PLATINUM_POKETCH_OFFSET + 0x03 +
            PLATINUM_POKETCH_REGISTRY_SIZE,
        );
      },
    );

    const written = writePlatinumPoketch(
      marked,
      makePoketch(),
    );

    const { general } =
      selectPlatinumSaveBlocks(written);

    const view = new DataView(
      written.buffer,
      written.byteOffset,
      written.byteLength,
    );

    expect(
      view.getUint8(
        general.offset + PLATINUM_POKETCH_OFFSET,
      ) & 0xc0,
    ).toBe(0xc0);

    expect(
      view.getUint16(
        general.offset +
          PLATINUM_POKETCH_OFFSET +
          0x28,
        true,
      ) & 0xf000,
    ).toBe(0xf000);

    expect(
      written.slice(
        general.offset +
          PLATINUM_POKETCH_OFFSET +
          0x03 +
          PLATINUM_POKETCH_APP_COUNT,
        general.offset +
          PLATINUM_POKETCH_OFFSET +
          0x03 +
          PLATINUM_POKETCH_REGISTRY_SIZE,
      ),
    ).toEqual(
      new Uint8Array(
        PLATINUM_POKETCH_REGISTRY_SIZE -
          PLATINUM_POKETCH_APP_COUNT,
      ).fill(0xa5),
    );
  });

  it('clears unused history entries', () => {
    const full = makePoketch();

    full.history = Array.from(
      { length: PLATINUM_POKETCH_HISTORY_COUNT },
      (_, index) => ({
        species: index + 1,
        icon: index,
        form: index,
      }),
    );

    const first = writePlatinumPoketch(
      makeSave(),
      full,
    );

    const shortened = {
      ...makePoketch(),
      history: [makePoketch().history[0]!],
    };

    const second = writePlatinumPoketch(
      first,
      shortened,
    );

    expect(
      readPlatinumPoketch(second).history,
    ).toEqual(shortened.history);
  });

  it('rejects inconsistent Pokétch data', () => {
    const poketch = makePoketch();

    expect(() =>
      writePlatinumPoketch(makeSave(), {
        ...poketch,
        appCount: 4,
      }),
    ).toThrow(/does not match/i);

    expect(() =>
      writePlatinumPoketch(makeSave(), {
        ...poketch,
        currentApp: 1,
      }),
    ).toThrow(/not registered/i);

    expect(() =>
      writePlatinumPoketch(makeSave(), {
        ...poketch,
        registeredApps: [0, 0, 3, 7, 12],
      }),
    ).toThrow(/duplicate/i);

    expect(() =>
      writePlatinumPoketch(makeSave(), {
        ...poketch,
        alarm: {
          ...poketch.alarm,
          hour: 24,
        },
      }),
    ).toThrow(/alarm hour/i);

    expect(() =>
      writePlatinumPoketch(makeSave(), {
        ...poketch,
        markers: [],
      }),
    ).toThrow(/marker count/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum Pokétch',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const poketch = readPlatinumPoketch(save);

      expect(poketch.appCount).toBe(
        poketch.registeredApps.length,
      );

      if (poketch.currentApp !== null) {
        expect(
          poketch.registeredApps,
        ).toContain(poketch.currentApp);
      }

      expect(poketch.color).toBeGreaterThanOrEqual(0);
      expect(poketch.color).toBeLessThanOrEqual(7);
      expect(poketch.markers).toHaveLength(6);
      expect(poketch.dotArt).toHaveLength(120);

      console.log('poketch:', poketch);
    },
  );
});
