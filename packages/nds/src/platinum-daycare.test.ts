import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePlatinumBoxPokemon } from './platinum-box-pokemon-data.ts';
import {
  PLATINUM_DAYCARE_MON_SIZE,
  PLATINUM_DAYCARE_OFFSET,
  PLATINUM_DAYCARE_SLOTS,
  PLATINUM_DAYCARE_STEPS_OFFSET,
  readPlatinumDaycare,
  writePlatinumDaycare,
  type PlatinumDaycare,
} from './platinum-daycare.ts';
import {
  PLATINUM_BOX_DATA_SIZE,
  PLATINUM_DATA_BLOCK_SIZE,
} from './platinum-pokemon.ts';
import {
  type DecodedPlatinumBoxPokemon,
} from './platinum-pc-boxes.ts';
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

function makeSequence(
  size: number,
  start: number,
): Uint8Array {
  return Uint8Array.from(
    { length: size },
    (_, index) =>
      (start + index * 7) & 0xff,
  );
}

function makePokemon(
  personality: number,
  species: number,
  start: number,
): DecodedPlatinumBoxPokemon {
  const blockA = makeSequence(
    PLATINUM_DATA_BLOCK_SIZE,
    start,
  );

  new DataView(
    blockA.buffer,
    blockA.byteOffset,
    blockA.byteLength,
  ).setUint16(
    0,
    species,
    true,
  );

  return {
    personality,
    sanity: 0x3456,
    checksum: 0,
    blocks: [
      blockA,
      makeSequence(
        PLATINUM_DATA_BLOCK_SIZE,
        start + 0x20,
      ),
      makeSequence(
        PLATINUM_DATA_BLOCK_SIZE,
        start + 0x40,
      ),
      makeSequence(
        PLATINUM_DATA_BLOCK_SIZE,
        start + 0x60,
      ),
    ],
  };
}

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
    120,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    120,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    120,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    120,
    2,
  );

  return save;
}

function makeDaycare(): PlatinumDaycare {
  return {
    mons: [
      {
        pokemon:
          makePokemon(
            3 << 13,
            25,
            0x10,
          ),
        steps: 123456,
      },
      {
        pokemon:
          makePokemon(
            17 << 13,
            133,
            0x20,
          ),
        steps: 987654,
      },
    ],
    offspring: 0x12345678,
    stepCounter: 200,
  };
}

describe('Platinum daycare', () => {
  it('round-trips both deposited Pokémon and counters', () => {
    const daycare =
      makeDaycare();

    const written =
      writePlatinumDaycare(
        makeSave(),
        daycare,
      );

    const decoded =
      readPlatinumDaycare(
        written,
      );

    expect(decoded).toEqual(
      expect.objectContaining({
        offspring:
          daycare.offspring,
        stepCounter:
          daycare.stepCounter,
      }),
    );

    expect(decoded.mons).toHaveLength(
      PLATINUM_DAYCARE_SLOTS,
    );

    decoded.mons.forEach(
      (entry, index) => {
        const expected =
          daycare.mons[index]!;

        expect(entry).not.toBeNull();
        expect(entry!.steps).toBe(
          expected!.steps,
        );
        expect(
          entry!.pokemon.personality,
        ).toBe(
          expected!.pokemon
            .personality,
        );
        expect(
          entry!.pokemon.blocks,
        ).toEqual(
          expected!.pokemon.blocks,
        );
      },
    );
  });

  it('writes valid empty Day Care slots', () => {
    const written =
      writePlatinumDaycare(
        makeSave(),
        {
          mons: [null, null],
          offspring: 0,
          stepCounter: 0,
        },
      );

    expect(
      readPlatinumDaycare(written),
    ).toEqual({
      mons: [null, null],
      offspring: 0,
      stepCounter: 0,
    });
  });

  it('preserves unmodeled bytes inside each Day Care record', () => {
    const marked =
      writePlatinumSave(
        makeSave(),
        ({ general }) => {
          for (
            let slot = 0;
            slot <
            PLATINUM_DAYCARE_SLOTS;
            slot++
          ) {
            const start =
              PLATINUM_DAYCARE_OFFSET +
              slot *
                PLATINUM_DAYCARE_MON_SIZE +
              PLATINUM_BOX_DATA_SIZE +
              8;

            const end =
              PLATINUM_DAYCARE_OFFSET +
              slot *
                PLATINUM_DAYCARE_MON_SIZE +
              PLATINUM_DAYCARE_STEPS_OFFSET;

            general.fill(
              0x5a + slot,
              start,
              end,
            );
          }
        },
      );

    const written =
      writePlatinumDaycare(
        marked,
        makeDaycare(),
      );

    const { general } =
      selectPlatinumSaveBlocks(
        written,
      );

    for (
      let slot = 0;
      slot <
      PLATINUM_DAYCARE_SLOTS;
      slot++
    ) {
      const start =
        general.offset +
        PLATINUM_DAYCARE_OFFSET +
        slot *
          PLATINUM_DAYCARE_MON_SIZE +
        PLATINUM_BOX_DATA_SIZE +
        8;

      const end =
        general.offset +
        PLATINUM_DAYCARE_OFFSET +
        slot *
          PLATINUM_DAYCARE_MON_SIZE +
        PLATINUM_DAYCARE_STEPS_OFFSET;

      expect(
        written.slice(
          start,
          end,
        ),
      ).toEqual(
        new Uint8Array(
          end - start,
        ).fill(0x5a + slot),
      );
    }
  });

  it('rejects invalid Day Care data', () => {
    const daycare =
      makeDaycare();

    expect(() =>
      writePlatinumDaycare(
        makeSave(),
        {
          ...daycare,
          mons: [
            daycare.mons[0]!,
          ],
        },
      ),
    ).toThrow(/slot count/i);

    expect(() =>
      writePlatinumDaycare(
        makeSave(),
        {
          ...daycare,
          stepCounter: 256,
        },
      ),
    ).toThrow(/step counter/i);

    expect(() =>
      writePlatinumDaycare(
        makeSave(),
        {
          ...daycare,
          mons: [
            {
              ...daycare.mons[0]!,
              steps: -1,
            },
            daycare.mons[1]!,
          ],
        },
      ),
    ).toThrow(/steps/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum daycare',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const daycare =
        readPlatinumDaycare(save);

      expect(daycare.mons).toHaveLength(2);
      expect(
        daycare.stepCounter,
      ).toBeGreaterThanOrEqual(0);
      expect(
        daycare.stepCounter,
      ).toBeLessThanOrEqual(0xff);

      console.log('daycare:', {
        offspring:
          daycare.offspring,
        stepCounter:
          daycare.stepCounter,
        mons: daycare.mons.map(
          (entry) =>
            entry === null
              ? null
              : {
                  species:
                    parsePlatinumBoxPokemon(
                      entry.pokemon,
                    ).species,
                  steps:
                    entry.steps,
                },
        ),
      });
    },
  );
});
