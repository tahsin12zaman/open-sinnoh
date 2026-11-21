import type {
  GameState,
  Registries,
  SeenForm,
} from '@opensinnoh/contracts';
import type {
  Gender,
  Id,
} from '@opensinnoh/core';
import {
  readPlatinumPokedex,
  type PlatinumPokedexData,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';

const NAMES = new Names(namesFile as NamesFile);

const SPECIES_UNOWN = 201;
const SPECIES_SPINDA = 327;
const SPECIES_DEOXYS = 386;
const SPECIES_BURMY = 412;
const SPECIES_WORMADAM = 413;
const SPECIES_SHELLOS = 422;
const SPECIES_GASTRODON = 423;
const SPECIES_ROTOM = 479;
const SPECIES_GIRATINA = 487;
const SPECIES_SHAYMIN = 492;

const GENDER_RATIO_NONE = 255;

function orderedValues(
  values: readonly number[],
  sentinel: number,
): number[] {
  const end = values.indexOf(sentinel);

  return end < 0
    ? [...values]
    : values.slice(0, end);
}

function twoForms(value: number): number[] {
  const first = value & 1;
  const second = (value >>> 1) & 1;

  return first === second
    ? [first]
    : [first, second];
}

function threeForms(value: number): number[] {
  return orderedValues(
    [
      value & 3,
      (value >>> 2) & 3,
      (value >>> 4) & 3,
    ],
    3,
  );
}

function rotomForms(value: number): number[] {
  return orderedValues(
    Array.from(
      { length: 6 },
      (_, index) =>
        (value >>> (index * 3)) & 7,
    ),
    7,
  );
}

function formsForSpecies(
  native: PlatinumPokedexData,
  species: number,
): number[] {
  switch (species) {
    case SPECIES_UNOWN:
      return orderedValues(
        native.unownForms,
        0xff,
      );

    case SPECIES_DEOXYS:
      return orderedValues(
        native.deoxysForms,
        0x0f,
      );

    case SPECIES_BURMY:
      return threeForms(native.burmyForms);

    case SPECIES_WORMADAM:
      return threeForms(native.wormadamForms);

    case SPECIES_SHELLOS:
      return twoForms(native.shellosForms);

    case SPECIES_GASTRODON:
      return twoForms(native.gastrodonForms);

    case SPECIES_ROTOM:
      return rotomForms(native.rotomForms);

    case SPECIES_GIRATINA:
      return twoForms(native.giratinaForms);

    case SPECIES_SHAYMIN:
      return twoForms(native.shayminForms);

    /*
     * Platinum stores Spinda's spot pattern as a personality value.
     * OpenSinnoh's Pokédex form record has no place for that PID, so
     * retain its ordinary form number.
     */
    case SPECIES_SPINDA:
      return [0];

    default:
      return [0];
  }
}

function recordedGender(
  species: number,
  femaleSpecies: ReadonlySet<number>,
  registries: Registries,
): Gender {
  const id = NAMES.species(species);
  const record = registries.species.get(id);

  if (!record) {
    throw new Error(
      `Missing species registry record ${id}`,
    );
  }

  if (record.genderRatio === GENDER_RATIO_NONE) {
    return 'none';
  }

  return femaleSpecies.has(species)
    ? 'female'
    : 'male';
}

function seenForms(
  native: PlatinumPokedexData,
  species: number,
  primaryFemale: ReadonlySet<number>,
  secondaryFemale: ReadonlySet<number>,
  registries: Registries,
): SeenForm[] {
  const nativeForms = formsForSpecies(
    native,
    species,
  );

  const forms =
    nativeForms.length > 0 ? nativeForms : [0];

  const primary = recordedGender(
    species,
    primaryFemale,
    registries,
  );

  const secondary = recordedGender(
    species,
    secondaryFemale,
    registries,
  );

  const result: SeenForm[] = forms.map((form) => ({
    form,
    gender: primary,
  }));

  /*
   * Platinum stores form order and gender order independently, so it
   * cannot tell us which secondary gender was paired with which form.
   * Attach the secondary gender to the first displayed form. This
   * preserves both native orders without inventing every possible
   * form/gender combination.
   */
  if (secondary !== primary) {
    result.push({
      form: forms[0]!,
      gender: secondary,
    });
  }

  return result;
}

export function convertPlatinumPokedex(
  native: PlatinumPokedexData,
  registries: Registries,
): GameState['pokedex'] {
  const seen = native.seen.map((species) =>
    NAMES.species(species),
  );

  const caught = native.caught.map((species) =>
    NAMES.species(species),
  );

  const seenSet = new Set(seen);

  for (const species of caught) {
    if (!seenSet.has(species)) {
      throw new Error(
        `Platinum Pokédex caught species ${species} is not marked seen`,
      );
    }
  }

  const primaryFemale = new Set(
    native.primaryGenderBits,
  );

  const secondaryFemale = new Set(
    native.secondaryGenderBits,
  );

  const forms = {} as Record<Id, SeenForm[]>;

  for (const species of native.seen) {
    const id = NAMES.species(species);

    forms[id] = seenForms(
      native,
      species,
      primaryFemale,
      secondaryFemale,
      registries,
    );
  }

  return {
    obtained: native.obtained,
    national: native.national,
    seen,
    caught,
    forms,
  };
}

export function applyPlatinumPokedex(
  state: GameState,
  save: Uint8Array,
  registries: Registries,
): GameState {
  return {
    ...state,
    pokedex: convertPlatinumPokedex(
      readPlatinumPokedex(save),
      registries,
    ),
  };
}