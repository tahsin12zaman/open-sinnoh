import { parsePlatinumBoxPokemon } from './platinum-box-pokemon-data.ts';
import {
  decodePlatinumBoxPokemon,
  encodeEmptyPlatinumBoxPokemon,
  encodePlatinumBoxPokemon,
  type DecodedPlatinumBoxPokemon,
} from './platinum-pc-boxes.ts';
import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

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
  mons: (
    PlatinumDaycareMon |
    null
  )[];
  offspring: number;
  stepCounter: number;
}

function validateInteger(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Invalid Platinum daycare ${name} ${value}`,
    );
  }
}

function speciesOf(
  pokemon: DecodedPlatinumBoxPokemon,
): number {
  return parsePlatinumBoxPokemon(
    pokemon,
  ).species;
}

export function readPlatinumDaycare(
  save: Uint8Array,
): PlatinumDaycare {
  const { general } =
    selectPlatinumSaveBlocks(save);
  const base =
    general.offset +
    PLATINUM_DAYCARE_OFFSET;

  if (
    base + PLATINUM_DAYCARE_SIZE >
    save.length
  ) {
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
    {
      length:
        PLATINUM_DAYCARE_SLOTS,
    },
    (
      _,
      slot,
    ): PlatinumDaycareMon | null => {
      const monOffset =
        base +
        slot *
          PLATINUM_DAYCARE_MON_SIZE;

      const pokemon =
        decodePlatinumBoxPokemon(
          save,
          monOffset,
        );

      if (
        speciesOf(pokemon) === 0
      ) {
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
      base +
        PLATINUM_DAYCARE_OFFSPRING_OFFSET,
      true,
    ),
    stepCounter: view.getUint8(
      base +
        PLATINUM_DAYCARE_STEP_COUNTER_OFFSET,
    ),
  };
}

export function writePlatinumDaycare(
  save: Uint8Array,
  daycare: PlatinumDaycare,
): Uint8Array {
  if (
    daycare.mons.length !==
    PLATINUM_DAYCARE_SLOTS
  ) {
    throw new Error(
      `Invalid Platinum daycare slot count ${daycare.mons.length}`,
    );
  }

  validateInteger(
    'offspring value',
    daycare.offspring,
    0,
    0xffffffff,
  );
  validateInteger(
    'step counter',
    daycare.stepCounter,
    0,
    0xff,
  );

  const encoded = daycare.mons.map(
    (entry, slot) => {
      if (entry === null) {
        return {
          record:
            encodeEmptyPlatinumBoxPokemon(),
          steps: 0,
        };
      }

      validateInteger(
        `steps in slot ${slot}`,
        entry.steps,
        0,
        0xffffffff,
      );

      return {
        record:
          encodePlatinumBoxPokemon(
            entry.pokemon,
          ),
        steps: entry.steps,
      };
    },
  );

  return writePlatinumSave(
    save,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      encoded.forEach(
        (entry, slot) => {
          const monOffset =
            PLATINUM_DAYCARE_OFFSET +
            slot *
              PLATINUM_DAYCARE_MON_SIZE;

          general.set(
            entry.record,
            monOffset,
          );

          view.setUint32(
            monOffset +
              PLATINUM_DAYCARE_STEPS_OFFSET,
            entry.steps,
            true,
          );
        },
      );

      view.setUint32(
        PLATINUM_DAYCARE_OFFSET +
          PLATINUM_DAYCARE_OFFSPRING_OFFSET,
        daycare.offspring,
        true,
      );

      view.setUint8(
        PLATINUM_DAYCARE_OFFSET +
          PLATINUM_DAYCARE_STEP_COUNTER_OFFSET,
        daycare.stepCounter,
      );
    },
  );
}
