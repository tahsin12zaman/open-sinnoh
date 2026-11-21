import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLATINUM_POKEDEX_BITMAP_SIZE,
  PLATINUM_POKEDEX_OFFSET,
  readPlatinumPokedex,
  readPlatinumSpeciesBitmap,
  writePlatinumPokedex,
  writePlatinumSpeciesBitmap,
  type PlatinumPokedexData,
} from './platinum-pokedex.ts';
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
  const view = new DataView(
    bytes.buffer,
  );

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
    crc16Ccitt(
      bytes,
      0,
      footerOffset,
    ),
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
    copyOffset +
      specification.offset,
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
    80,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    80,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    80,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    80,
    2,
  );

  return save;
}

const pokedex: PlatinumPokedexData = {
  obtained: true,
  national: true,
  canDetectForms: true,
  canDetectLanguages: true,
  seen: [
    1,
    25,
    201,
    327,
    386,
    479,
    487,
    492,
    493,
  ],
  caught: [
    1,
    25,
    201,
    386,
    493,
  ],
  primaryGenderBits: [
    25,
    201,
    327,
  ],
  secondaryGenderBits: [
    201,
    327,
  ],
  spindaPersonality: 0x89abcdef,
  shellosForms: 0x03,
  gastrodonForms: 0x03,
  burmyForms: 0x07,
  wormadamForms: 0x07,
  unownForms: Array.from(
    { length: 28 },
    (_, index) => index,
  ),
  deoxysForms: [0, 1, 2, 3],
  rotomForms: 0x3f,
  shayminForms: 0x03,
  giratinaForms: 0x03,
};

describe('Platinum Pokédex', () => {
  it('maps species IDs to bitmap bits', () => {
    const bitmap = new Uint8Array(
      PLATINUM_POKEDEX_BITMAP_SIZE,
    );

    bitmap[0] = 0b00000001;
    bitmap[3] = 0b10000000;
    bitmap[4] = 0b00000001;
    bitmap[61] = 0b00010000;

    expect(
      readPlatinumSpeciesBitmap(
        bitmap,
      ),
    ).toEqual([
      1,
      32,
      33,
      493,
    ]);
  });

  it('writes and reads species bitmaps', () => {
    const bitmap = new Uint8Array(
      PLATINUM_POKEDEX_BITMAP_SIZE,
    );

    bitmap.fill(0xff);

    writePlatinumSpeciesBitmap(
      bitmap,
      [
        1,
        32,
        33,
        493,
        493,
      ],
    );

    expect(
      readPlatinumSpeciesBitmap(
        bitmap,
      ),
    ).toEqual([
      1,
      32,
      33,
      493,
    ]);

    expect(bitmap[63]).toBe(0);
  });

  it('round-trips every modeled Pokédex field', () => {
    const written =
      writePlatinumPokedex(
        makeSave(),
        pokedex,
      );

    expect(
      readPlatinumPokedex(written),
    ).toEqual(pokedex);
  });

  it('preserves recorded-language and unmodeled data', () => {
    const marked =
      writePlatinumSave(
        makeSave(),
        ({ general }) => {
          general[
            PLATINUM_POKEDEX_OFFSET +
              0x128
          ] = 0xa5;

          general[
            PLATINUM_POKEDEX_OFFSET +
              0x200
          ] = 0x5a;
        },
      );

    const written =
      writePlatinumPokedex(
        marked,
        pokedex,
      );

    const { general } =
      selectPlatinumSaveBlocks(
        written,
      );

    expect(
      written[
        general.offset +
          PLATINUM_POKEDEX_OFFSET +
          0x128
      ],
    ).toBe(0xa5);

    expect(
      written[
        general.offset +
          PLATINUM_POKEDEX_OFFSET +
          0x200
      ],
    ).toBe(0x5a);
  });

  it('stores all four Deoxys form nibbles without species corruption', () => {
    const forms = [
      15,
      14,
      13,
      12,
    ];

    const written =
      writePlatinumPokedex(
        makeSave(),
        {
          ...pokedex,
          deoxysForms: forms,
        },
      );

    const decoded =
      readPlatinumPokedex(written);

    expect(
      decoded.deoxysForms,
    ).toEqual(forms);

    expect(decoded.seen).toEqual(
      pokedex.seen,
    );
    expect(decoded.caught).toEqual(
      pokedex.caught,
    );
  });

  it('rejects inconsistent or invalid Pokédex data', () => {
    const save = makeSave();

    expect(() =>
      writePlatinumPokedex(
        save,
        {
          ...pokedex,
          caught: [
            ...pokedex.caught,
            150,
          ],
        },
      ),
    ).toThrow(/not seen/i);

    expect(() =>
      writePlatinumPokedex(
        save,
        {
          ...pokedex,
          seen: [0],
          caught: [],
        },
      ),
    ).toThrow(/species/i);

    expect(() =>
      writePlatinumPokedex(
        save,
        {
          ...pokedex,
          unownForms: [0, 1],
        },
      ),
    ).toThrow(/Unown form count/i);

    expect(() =>
      writePlatinumPokedex(
        save,
        {
          ...pokedex,
          deoxysForms: [
            0,
            1,
            2,
            16,
          ],
        },
      ),
    ).toThrow(/Deoxys form/i);
  });

  it('rejects a truncated bitmap', () => {
    expect(() =>
      readPlatinumSpeciesBitmap(
        new Uint8Array(
          PLATINUM_POKEDEX_BITMAP_SIZE -
            1,
        ),
      ),
    ).toThrow(/truncated/i);

    expect(() =>
      writePlatinumSpeciesBitmap(
        new Uint8Array(
          PLATINUM_POKEDEX_BITMAP_SIZE -
            1,
        ),
        [1],
      ),
    ).toThrow(/truncated/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum Pokédex',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const realPokedex =
        readPlatinumPokedex(save);

      expect(
        realPokedex.obtained,
      ).toBe(true);
      expect(
        realPokedex.seen.length,
      ).toBeGreaterThan(0);
      expect(
        realPokedex.caught.length,
      ).toBeGreaterThan(0);

      for (
        const species of
          realPokedex.caught
      ) {
        expect(
          realPokedex.seen,
        ).toContain(species);
      }

      console.log('pokedex:', {
        obtained:
          realPokedex.obtained,
        national:
          realPokedex.national,
        seenCount:
          realPokedex.seen.length,
        caughtCount:
          realPokedex.caught.length,
        seen: realPokedex.seen,
        caught:
          realPokedex.caught,
      });
    },
  );
});
