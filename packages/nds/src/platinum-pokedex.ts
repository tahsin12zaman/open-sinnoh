import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_POKEDEX_OFFSET = 0x1328;
export const PLATINUM_POKEDEX_MAGIC = 0xbeefcafe;
export const PLATINUM_SPECIES_COUNT = 493;
export const PLATINUM_POKEDEX_BITMAP_SIZE = 0x40;

const CAUGHT_OFFSET = 0x04;
const SEEN_OFFSET = 0x44;
const PRIMARY_GENDER_OFFSET = 0x84;
const SECONDARY_GENDER_OFFSET = 0xc4;
const SPINDA_FORM_OFFSET = 0x104;
const SHELLOS_FORMS_OFFSET = 0x108;
const GASTRODON_FORMS_OFFSET = 0x109;
const BURMY_FORMS_OFFSET = 0x10a;
const WORMADAM_FORMS_OFFSET = 0x10b;
const UNOWN_FORMS_OFFSET = 0x10c;
const UNOWN_FORM_COUNT = 28;
const RECORDED_LANGUAGES_OFFSET = 0x128;

/**
 * MAX_SPECIES + 1 entries: the 493 National Pokédex species,
 * the unused species slot, Egg, and Bad Egg.
 */
const RECORDED_LANGUAGES_SIZE = 496;

const CAN_DETECT_FORMS_OFFSET =
  RECORDED_LANGUAGES_OFFSET + RECORDED_LANGUAGES_SIZE;

const CAN_DETECT_LANGUAGES_OFFSET =
  CAN_DETECT_FORMS_OFFSET + 1;

const POKEDEX_OBTAINED_OFFSET =
  CAN_DETECT_LANGUAGES_OFFSET + 1;

const NATIONAL_DEX_OBTAINED_OFFSET =
  POKEDEX_OBTAINED_OFFSET + 1;

const ROTOM_FORMS_OFFSET = 0x31c;
const SHAYMIN_FORMS_OFFSET = 0x320;
const GIRATINA_FORMS_OFFSET = 0x321;

/**
 * Deoxys stores four ordered form nibbles in otherwise-unused bits:
 *
 * caught bitmap's final u32:
 *   bits 24–27 and 28–31
 *
 * seen bitmap's final u32:
 *   bits 24–27 and 28–31
 */
const DEOXYS_FORM_WORD_OFFSET =
  PLATINUM_POKEDEX_BITMAP_SIZE - 4;

export interface PlatinumPokedexData {
  obtained: boolean;
  national: boolean;
  canDetectForms: boolean;
  canDetectLanguages: boolean;
  seen: number[];
  caught: number[];
  primaryGenderBits: number[];
  secondaryGenderBits: number[];
  spindaPersonality: number;
  shellosForms: number;
  gastrodonForms: number;
  burmyForms: number;
  wormadamForms: number;
  unownForms: number[];
  deoxysForms: number[];
  rotomForms: number;
  shayminForms: number;
  giratinaForms: number;
}

function flag(
  view: DataView,
  offset: number,
): boolean {
  return view.getUint8(offset) !== 0;
}

/**
 * Platinum stores species n in bit n - 1.
 */
export function readPlatinumSpeciesBitmap(
  bytes: Uint8Array,
  offset = 0,
): number[] {
  if (
    offset < 0 ||
    offset + PLATINUM_POKEDEX_BITMAP_SIZE >
      bytes.length
  ) {
    throw new Error(
      'Platinum Pokédex species bitmap is truncated',
    );
  }

  const species: number[] = [];

  for (
    let id = 1;
    id <= PLATINUM_SPECIES_COUNT;
    id++
  ) {
    const bitIndex = id - 1;
    const byte =
      bytes[offset + (bitIndex >> 3)]!;
    const mask = 1 << (bitIndex & 7);

    if (byte & mask) {
      species.push(id);
    }
  }

  return species;
}

function deoxysForms(
  view: DataView,
  pokedexOffset: number,
): number[] {
  const caughtWord = view.getUint32(
    pokedexOffset +
      CAUGHT_OFFSET +
      DEOXYS_FORM_WORD_OFFSET,
    true,
  );

  const seenWord = view.getUint32(
    pokedexOffset +
      SEEN_OFFSET +
      DEOXYS_FORM_WORD_OFFSET,
    true,
  );

  return [
    (caughtWord >>> 24) & 0x0f,
    (caughtWord >>> 28) & 0x0f,
    (seenWord >>> 24) & 0x0f,
    (seenWord >>> 28) & 0x0f,
  ];
}

export function readPlatinumPokedex(
  save: Uint8Array,
): PlatinumPokedexData {
  const { general } = selectPlatinumSaveBlocks(save);

  const offset =
    general.offset + PLATINUM_POKEDEX_OFFSET;

  const minimumEnd =
    offset + GIRATINA_FORMS_OFFSET + 1;

  if (minimumEnd > save.length) {
    throw new Error(
      'Platinum Pokédex data is truncated',
    );
  }

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  const magic = view.getUint32(offset, true);

  if (magic !== PLATINUM_POKEDEX_MAGIC) {
    throw new Error(
      `Invalid Platinum Pokédex magic 0x${magic.toString(16)}`,
    );
  }

  const caught = readPlatinumSpeciesBitmap(
    save,
    offset + CAUGHT_OFFSET,
  );

  const seen = readPlatinumSpeciesBitmap(
    save,
    offset + SEEN_OFFSET,
  );

  const primaryGenderBits =
    readPlatinumSpeciesBitmap(
      save,
      offset + PRIMARY_GENDER_OFFSET,
    );

  const secondaryGenderBits =
    readPlatinumSpeciesBitmap(
      save,
      offset + SECONDARY_GENDER_OFFSET,
    );

  return {
    obtained: flag(
      view,
      offset + POKEDEX_OBTAINED_OFFSET,
    ),

    national: flag(
      view,
      offset + NATIONAL_DEX_OBTAINED_OFFSET,
    ),

    canDetectForms: flag(
      view,
      offset + CAN_DETECT_FORMS_OFFSET,
    ),

    canDetectLanguages: flag(
      view,
      offset + CAN_DETECT_LANGUAGES_OFFSET,
    ),

    seen,
    caught,
    primaryGenderBits,
    secondaryGenderBits,

    spindaPersonality: view.getUint32(
      offset + SPINDA_FORM_OFFSET,
      true,
    ),

    shellosForms: view.getUint8(
      offset + SHELLOS_FORMS_OFFSET,
    ),

    gastrodonForms: view.getUint8(
      offset + GASTRODON_FORMS_OFFSET,
    ),

    burmyForms: view.getUint8(
      offset + BURMY_FORMS_OFFSET,
    ),

    wormadamForms: view.getUint8(
      offset + WORMADAM_FORMS_OFFSET,
    ),

    unownForms: Array.from(
      { length: UNOWN_FORM_COUNT },
      (_, index) =>
        view.getUint8(
          offset + UNOWN_FORMS_OFFSET + index,
        ),
    ),

    deoxysForms: deoxysForms(view, offset),

    rotomForms: view.getUint32(
      offset + ROTOM_FORMS_OFFSET,
      true,
    ),

    shayminForms: view.getUint8(
      offset + SHAYMIN_FORMS_OFFSET,
    ),

    giratinaForms: view.getUint8(
      offset + GIRATINA_FORMS_OFFSET,
    ),
  };
}