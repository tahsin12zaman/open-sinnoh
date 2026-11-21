import { parsePlatinumBoxPokemon } from './platinum-box-pokemon-data.ts';
import {
  decodePlatinumBoxPokemon,
  type DecodedPlatinumBoxPokemon,
} from './platinum-pc-boxes.ts';
import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_DAYCARE_OFFSET = 0x1654;
export const PLATINUM_DAYCARE_SLOTS = 2;
export const PLATINUM_DAYCARE_MON_SIZE = 0xec;
export const PLATINUM_DAYCARE_STEPS_OFFSET = 0xe8;
export const PLATINUM_DAYCARE_OFFSPRING_OFFSET = 0x1d8;
export const PLATINUM_DAYCARE_STEP_COUNTER_OFFSET = 0x1dc;
export const PLATINUM_DAYCARE_SIZE = 0x1e0;

export interface PlatinumDaycareMon {
  pokemon: DecodedPlatinumBoxPokemon;
  steps: number;
}

export interface PlatinumDaycare {
  mons: (PlatinumDaycareMon | null)[];
  offspring: number;
  stepCounter: number;
}

function speciesOf(
  pokemon: DecodedPlatinumBoxPokemon,
): number {
  return parsePlatinumBoxPokemon(pokemon).species;
}

export function readPlatinumDaycare(
  save: Uint8Array,
): PlatinumDaycare {
  const { general } = selectPlatinumSaveBlocks(save);
  const base =
    general.offset + PLATINUM_DAYCARE_OFFSET;

  if (base + PLATINUM_DAYCARE_SIZE > save.length) {
    throw new Error(
      'Platinum daycare data is truncated',
    );
  }

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  const mons = Array.from(
    { length: PLATINUM_DAYCARE_SLOTS },
    (_, slot): PlatinumDaycareMon | null => {
      const monOffset =
        base + slot * PLATINUM_DAYCARE_MON_SIZE;

      const pokemon = decodePlatinumBoxPokemon(
        save,
        monOffset,
      );

      if (speciesOf(pokemon) === 0) {
        return null;
      }

      return {
        pokemon,
        steps: view.getUint32(
          monOffset +
            PLATINUM_DAYCARE_STEPS_OFFSET,
          true,
        ),
      };
    },
  );

  return {
    mons,
    offspring: view.getUint32(
      base + PLATINUM_DAYCARE_OFFSPRING_OFFSET,
      true,
    ),
    stepCounter: view.getUint8(
      base +
        PLATINUM_DAYCARE_STEP_COUNTER_OFFSET,
    ),
  };
}