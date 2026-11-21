import type {
  GameState,
  SeenForm,
} from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import type {
  PlatinumPokedexData,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with {
  type: 'json',
};
import {
  Names,
  type NamesFile,
} from './names.ts';

const NAMES = new Names(
  namesFile as NamesFile,
);

const SPECIES_UNOWN = 201;
const SPECIES_DEOXYS = 386;
const SPECIES_BURMY = 412;
const SPECIES_WORMADAM = 413;
const SPECIES_SHELLOS = 422;
const SPECIES_GASTRODON = 423;
const SPECIES_ROTOM = 479;
const SPECIES_GIRATINA = 487;
const SPECIES_SHAYMIN = 492;

export function platinumPokedexSpeciesIndex(
  species: Id,
): number {
  for (
    let index = 1;
    index < NAMES.file.species.length;
    index++
  ) {
    if (NAMES.species(index) === species) {
      return index;
    }
  }

  throw new Error(
    `Cannot export unknown Platinum Pokédex species ${species}`,
  );
}

function uniqueForms(
  entries: readonly SeenForm[] | undefined,
): number[] {
  const forms: number[] = [];

  for (const entry of entries ?? []) {
    if (!forms.includes(entry.form)) {
      forms.push(entry.form);
    }
  }

  return forms;
}

function fixedForms(
  forms: readonly number[],
  length: number,
  sentinel: number,
  maximum: number,
  name: string,
): number[] {
  if (forms.length > length) {
    throw new Error(
      `Cannot export ${forms.length} Platinum ${name} forms; maximum is ${length}`,
    );
  }

  const result =
    new Array<number>(length).fill(
      sentinel,
    );

  forms.forEach((form, index) => {
    if (
      !Number.isInteger(form) ||
      form < 0 ||
      form > maximum
    ) {
      throw new Error(
        `Cannot export Platinum ${name} form ${form}`,
      );
    }

    result[index] = form;
  });

  return result;
}

function twoForms(
  forms: readonly number[],
  name: string,
): number {
  const values = fixedForms(
    forms.length === 0 ? [0] : forms,
    2,
    0,
    1,
    name,
  );

  return (
    values[0]! |
    (values[1]! << 1)
  );
}

function threeForms(
  forms: readonly number[],
  name: string,
): number {
  const values = fixedForms(
    forms.length === 0 ? [0] : forms,
    3,
    3,
    2,
    name,
  );

  return (
    values[0]! |
    (values[1]! << 2) |
    (values[2]! << 4)
  );
}

function rotomForms(
  forms: readonly number[],
): number {
  const values = fixedForms(
    forms.length === 0 ? [0] : forms,
    6,
    7,
    5,
    'Rotom',
  );

  return values.reduce(
    (packed, form, index) =>
      (
        packed |
        (form << (index * 3))
      ) >>> 0,
    0,
  );
}

function formsFor(
  forms: GameState['pokedex']['forms'],
  species: number,
): number[] {
  return uniqueForms(
    forms[NAMES.species(species)],
  );
}

function gendersForSpecies(
  entries: readonly SeenForm[] | undefined,
): {
  primaryFemale: boolean;
  secondaryFemale: boolean;
} {
  const values = entries ?? [];
  const primary = values[0]?.gender;

  const secondary = values.find(
    (entry) =>
      entry.gender !== primary,
  )?.gender;

  return {
    primaryFemale:
      primary === 'female',
    secondaryFemale:
      secondary === undefined
        ? primary === 'female'
        : secondary === 'female',
  };
}

export function convertOpenSinnohPokedex(
  pokedex: GameState['pokedex'],
  base: PlatinumPokedexData,
): PlatinumPokedexData {
  const seen = pokedex.seen.map(
    platinumPokedexSpeciesIndex,
  );

  const caught = pokedex.caught.map(
    platinumPokedexSpeciesIndex,
  );

  const seenSet = new Set(seen);

  for (const species of caught) {
    if (!seenSet.has(species)) {
      throw new Error(
        `Cannot export caught Platinum species ${species} because it is not seen`,
      );
    }
  }

  const primaryGenderBits: number[] = [];
  const secondaryGenderBits: number[] = [];

  for (const species of seen) {
    const genders = gendersForSpecies(
      pokedex.forms[
        NAMES.species(species)
      ],
    );

    if (genders.primaryFemale) {
      primaryGenderBits.push(species);
    }

    if (genders.secondaryFemale) {
      secondaryGenderBits.push(species);
    }
  }

  return {
    ...base,
    obtained: pokedex.obtained,
    national: pokedex.national,
    seen,
    caught,
    primaryGenderBits,
    secondaryGenderBits,

    shellosForms: twoForms(
      formsFor(
        pokedex.forms,
        SPECIES_SHELLOS,
      ),
      'Shellos',
    ),

    gastrodonForms: twoForms(
      formsFor(
        pokedex.forms,
        SPECIES_GASTRODON,
      ),
      'Gastrodon',
    ),

    burmyForms: threeForms(
      formsFor(
        pokedex.forms,
        SPECIES_BURMY,
      ),
      'Burmy',
    ),

    wormadamForms: threeForms(
      formsFor(
        pokedex.forms,
        SPECIES_WORMADAM,
      ),
      'Wormadam',
    ),

    unownForms: fixedForms(
      formsFor(
        pokedex.forms,
        SPECIES_UNOWN,
      ),
      28,
      0xff,
      27,
      'Unown',
    ),

    deoxysForms: fixedForms(
      formsFor(
        pokedex.forms,
        SPECIES_DEOXYS,
      ),
      4,
      0x0f,
      3,
      'Deoxys',
    ),

    rotomForms: rotomForms(
      formsFor(
        pokedex.forms,
        SPECIES_ROTOM,
      ),
    ),

    shayminForms: twoForms(
      formsFor(
        pokedex.forms,
        SPECIES_SHAYMIN,
      ),
      'Shaymin',
    ),

    giratinaForms: twoForms(
      formsFor(
        pokedex.forms,
        SPECIES_GIRATINA,
      ),
      'Giratina',
    ),
  };
}
