import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

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
  RECORDED_LANGUAGES_OFFSET +
  RECORDED_LANGUAGES_SIZE;

const CAN_DETECT_LANGUAGES_OFFSET =
  CAN_DETECT_FORMS_OFFSET + 1;

const POKEDEX_OBTAINED_OFFSET =
  CAN_DETECT_LANGUAGES_OFFSET + 1;

const NATIONAL_DEX_OBTAINED_OFFSET =
  POKEDEX_OBTAINED_OFFSET + 1;

const ROTOM_FORMS_OFFSET = 0x31c;
const SHAYMIN_FORMS_OFFSET = 0x320;
const GIRATINA_FORMS_OFFSET = 0x321;

export const PLATINUM_POKEDEX_SIZE =
  GIRATINA_FORMS_OFFSET + 1;

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
      `Invalid Platinum Pokédex ${name} ${value}`,
    );
  }
}

function validateBoolean(
  name: string,
  value: boolean,
): void {
  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Platinum Pokédex ${name}`,
    );
  }
}

function validateSpecies(
  name: string,
  species: number[],
): void {
  for (const id of species) {
    validateInteger(
      `${name} species`,
      id,
      1,
      PLATINUM_SPECIES_COUNT,
    );
  }
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
    offset +
      PLATINUM_POKEDEX_BITMAP_SIZE >
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
      bytes[
        offset + (bitIndex >> 3)
      ]!;
    const mask =
      1 << (bitIndex & 7);

    if (byte & mask) {
      species.push(id);
    }
  }

  return species;
}

export function writePlatinumSpeciesBitmap(
  bytes: Uint8Array,
  species: number[],
  offset = 0,
): void {
  if (
    offset < 0 ||
    offset +
      PLATINUM_POKEDEX_BITMAP_SIZE >
      bytes.length
  ) {
    throw new Error(
      'Platinum Pokédex species bitmap is truncated',
    );
  }

  validateSpecies('bitmap', species);

  bytes.fill(
    0,
    offset,
    offset +
      PLATINUM_POKEDEX_BITMAP_SIZE,
  );

  for (const id of new Set(species)) {
    const bitIndex = id - 1;
    const byteOffset =
      offset + (bitIndex >> 3);

    bytes[byteOffset] =
      bytes[byteOffset]! |
      (1 << (bitIndex & 7));
  }
}

function deoxysForms(
  view: DataView,
  pokedexOffset: number,
): number[] {
  const caughtWord =
    view.getUint32(
      pokedexOffset +
        CAUGHT_OFFSET +
        DEOXYS_FORM_WORD_OFFSET,
      true,
    );

  const seenWord =
    view.getUint32(
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

function writeDeoxysForms(
  view: DataView,
  pokedexOffset: number,
  forms: number[],
): void {
  if (forms.length !== 4) {
    throw new Error(
      `Invalid Platinum Pokédex Deoxys form count ${forms.length}`,
    );
  }

  forms.forEach(
    (form, index) => {
      validateInteger(
        `Deoxys form ${index}`,
        form,
        0,
        0x0f,
      );
    },
  );

  const caughtOffset =
    pokedexOffset +
    CAUGHT_OFFSET +
    DEOXYS_FORM_WORD_OFFSET;

  const seenOffset =
    pokedexOffset +
    SEEN_OFFSET +
    DEOXYS_FORM_WORD_OFFSET;

  const caughtWord =
    view.getUint32(
      caughtOffset,
      true,
    );

  const seenWord =
    view.getUint32(
      seenOffset,
      true,
    );

  view.setUint32(
    caughtOffset,
    (
      (caughtWord & 0x00ffffff) |
      (forms[0]! << 24) |
      (forms[1]! << 28)
    ) >>> 0,
    true,
  );

  view.setUint32(
    seenOffset,
    (
      (seenWord & 0x00ffffff) |
      (forms[2]! << 24) |
      (forms[3]! << 28)
    ) >>> 0,
    true,
  );
}

export function readPlatinumPokedex(
  save: Uint8Array,
): PlatinumPokedexData {
  const { general } =
    selectPlatinumSaveBlocks(save);

  const offset =
    general.offset +
    PLATINUM_POKEDEX_OFFSET;

  const minimumEnd =
    offset + PLATINUM_POKEDEX_SIZE;

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

  const magic =
    view.getUint32(offset, true);

  if (
    magic !==
    PLATINUM_POKEDEX_MAGIC
  ) {
    throw new Error(
      `Invalid Platinum Pokédex magic 0x${magic.toString(16)}`,
    );
  }

  const caught =
    readPlatinumSpeciesBitmap(
      save,
      offset + CAUGHT_OFFSET,
    );

  const seen =
    readPlatinumSpeciesBitmap(
      save,
      offset + SEEN_OFFSET,
    );

  const primaryGenderBits =
    readPlatinumSpeciesBitmap(
      save,
      offset +
        PRIMARY_GENDER_OFFSET,
    );

  const secondaryGenderBits =
    readPlatinumSpeciesBitmap(
      save,
      offset +
        SECONDARY_GENDER_OFFSET,
    );

  return {
    obtained: flag(
      view,
      offset +
        POKEDEX_OBTAINED_OFFSET,
    ),
    national: flag(
      view,
      offset +
        NATIONAL_DEX_OBTAINED_OFFSET,
    ),
    canDetectForms: flag(
      view,
      offset +
        CAN_DETECT_FORMS_OFFSET,
    ),
    canDetectLanguages: flag(
      view,
      offset +
        CAN_DETECT_LANGUAGES_OFFSET,
    ),
    seen,
    caught,
    primaryGenderBits,
    secondaryGenderBits,
    spindaPersonality:
      view.getUint32(
        offset +
          SPINDA_FORM_OFFSET,
        true,
      ),
    shellosForms:
      view.getUint8(
        offset +
          SHELLOS_FORMS_OFFSET,
      ),
    gastrodonForms:
      view.getUint8(
        offset +
          GASTRODON_FORMS_OFFSET,
      ),
    burmyForms:
      view.getUint8(
        offset +
          BURMY_FORMS_OFFSET,
      ),
    wormadamForms:
      view.getUint8(
        offset +
          WORMADAM_FORMS_OFFSET,
      ),
    unownForms: Array.from(
      {
        length:
          UNOWN_FORM_COUNT,
      },
      (_, index) =>
        view.getUint8(
          offset +
            UNOWN_FORMS_OFFSET +
            index,
        ),
    ),
    deoxysForms:
      deoxysForms(view, offset),
    rotomForms: view.getUint32(
      offset +
        ROTOM_FORMS_OFFSET,
      true,
    ),
    shayminForms:
      view.getUint8(
        offset +
          SHAYMIN_FORMS_OFFSET,
      ),
    giratinaForms:
      view.getUint8(
        offset +
          GIRATINA_FORMS_OFFSET,
      ),
  };
}

export function writePlatinumPokedex(
  save: Uint8Array,
  pokedex: PlatinumPokedexData,
): Uint8Array {
  validateBoolean(
    'obtained flag',
    pokedex.obtained,
  );
  validateBoolean(
    'National Dex flag',
    pokedex.national,
  );
  validateBoolean(
    'form-detection flag',
    pokedex.canDetectForms,
  );
  validateBoolean(
    'language-detection flag',
    pokedex.canDetectLanguages,
  );

  validateSpecies(
    'seen',
    pokedex.seen,
  );
  validateSpecies(
    'caught',
    pokedex.caught,
  );
  validateSpecies(
    'primary-gender',
    pokedex.primaryGenderBits,
  );
  validateSpecies(
    'secondary-gender',
    pokedex.secondaryGenderBits,
  );

  const seen =
    new Set(pokedex.seen);

  for (
    const species of pokedex.caught
  ) {
    if (!seen.has(species)) {
      throw new Error(
        `Invalid Platinum Pokédex caught species ${species} is not seen`,
      );
    }
  }

  validateInteger(
    'Spinda personality',
    pokedex.spindaPersonality,
    0,
    0xffffffff,
  );
  validateInteger(
    'Shellos forms',
    pokedex.shellosForms,
    0,
    0xff,
  );
  validateInteger(
    'Gastrodon forms',
    pokedex.gastrodonForms,
    0,
    0xff,
  );
  validateInteger(
    'Burmy forms',
    pokedex.burmyForms,
    0,
    0xff,
  );
  validateInteger(
    'Wormadam forms',
    pokedex.wormadamForms,
    0,
    0xff,
  );

  if (
    pokedex.unownForms.length !==
    UNOWN_FORM_COUNT
  ) {
    throw new Error(
      `Invalid Platinum Pokédex Unown form count ${pokedex.unownForms.length}`,
    );
  }

  pokedex.unownForms.forEach(
    (form, index) => {
      validateInteger(
        `Unown form ${index}`,
        form,
        0,
        0xff,
      );
    },
  );

  if (
    pokedex.deoxysForms.length !== 4
  ) {
    throw new Error(
      `Invalid Platinum Pokédex Deoxys form count ${pokedex.deoxysForms.length}`,
    );
  }

  pokedex.deoxysForms.forEach(
    (form, index) => {
      validateInteger(
        `Deoxys form ${index}`,
        form,
        0,
        0x0f,
      );
    },
  );

  validateInteger(
    'Rotom forms',
    pokedex.rotomForms,
    0,
    0xffffffff,
  );
  validateInteger(
    'Shaymin forms',
    pokedex.shayminForms,
    0,
    0xff,
  );
  validateInteger(
    'Giratina forms',
    pokedex.giratinaForms,
    0,
    0xff,
  );

  return writePlatinumSave(
    save,
    ({ general }) => {
      const offset =
        PLATINUM_POKEDEX_OFFSET;

      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      view.setUint32(
        offset,
        PLATINUM_POKEDEX_MAGIC,
        true,
      );

      writePlatinumSpeciesBitmap(
        general,
        pokedex.caught,
        offset + CAUGHT_OFFSET,
      );
      writePlatinumSpeciesBitmap(
        general,
        pokedex.seen,
        offset + SEEN_OFFSET,
      );
      writePlatinumSpeciesBitmap(
        general,
        pokedex.primaryGenderBits,
        offset +
          PRIMARY_GENDER_OFFSET,
      );
      writePlatinumSpeciesBitmap(
        general,
        pokedex.secondaryGenderBits,
        offset +
          SECONDARY_GENDER_OFFSET,
      );

      view.setUint32(
        offset +
          SPINDA_FORM_OFFSET,
        pokedex.spindaPersonality,
        true,
      );
      view.setUint8(
        offset +
          SHELLOS_FORMS_OFFSET,
        pokedex.shellosForms,
      );
      view.setUint8(
        offset +
          GASTRODON_FORMS_OFFSET,
        pokedex.gastrodonForms,
      );
      view.setUint8(
        offset +
          BURMY_FORMS_OFFSET,
        pokedex.burmyForms,
      );
      view.setUint8(
        offset +
          WORMADAM_FORMS_OFFSET,
        pokedex.wormadamForms,
      );

      pokedex.unownForms.forEach(
        (form, index) => {
          view.setUint8(
            offset +
              UNOWN_FORMS_OFFSET +
              index,
            form,
          );
        },
      );

      view.setUint8(
        offset +
          CAN_DETECT_FORMS_OFFSET,
        pokedex.canDetectForms
          ? 1
          : 0,
      );
      view.setUint8(
        offset +
          CAN_DETECT_LANGUAGES_OFFSET,
        pokedex.canDetectLanguages
          ? 1
          : 0,
      );
      view.setUint8(
        offset +
          POKEDEX_OBTAINED_OFFSET,
        pokedex.obtained
          ? 1
          : 0,
      );
      view.setUint8(
        offset +
          NATIONAL_DEX_OBTAINED_OFFSET,
        pokedex.national
          ? 1
          : 0,
      );

      view.setUint32(
        offset +
          ROTOM_FORMS_OFFSET,
        pokedex.rotomForms,
        true,
      );
      view.setUint8(
        offset +
          SHAYMIN_FORMS_OFFSET,
        pokedex.shayminForms,
      );
      view.setUint8(
        offset +
          GIRATINA_FORMS_OFFSET,
        pokedex.giratinaForms,
      );

      writeDeoxysForms(
        view,
        offset,
        pokedex.deoxysForms,
      );
    },
  );
}
