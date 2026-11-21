import type {
  GameState,
} from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import type {
  PlatinumPokedexData,
} from '@opensinnoh/nds';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  convertOpenSinnohPokedex,
  platinumPokedexSpeciesIndex,
} from './platinum-pokedex-export.ts';

const id = (value: string): Id =>
  value as Id;

const base: PlatinumPokedexData = {
  obtained: false,
  national: false,
  canDetectForms: true,
  canDetectLanguages: true,
  seen: [],
  caught: [],
  primaryGenderBits: [],
  secondaryGenderBits: [],
  spindaPersonality: 0x12345678,
  shellosForms: 0,
  gastrodonForms: 0,
  burmyForms: 0,
  wormadamForms: 0,
  unownForms:
    new Array<number>(28).fill(0xff),
  deoxysForms: [15, 15, 15, 15],
  rotomForms: 0,
  shayminForms: 0,
  giratinaForms: 0,
};

describe('Platinum Pokédex export', () => {
  it('packs species, genders and special forms', () => {
    const unown =
      id('platinum:SPECIES_UNOWN');
    const deoxys =
      id('platinum:SPECIES_DEOXYS');
    const shellos =
      id('platinum:SPECIES_SHELLOS');
    const rotom =
      id('platinum:SPECIES_ROTOM');

    const pokedex: GameState['pokedex'] = {
      obtained: true,
      national: true,
      seen: [
        unown,
        deoxys,
        shellos,
        rotom,
      ],
      caught: [
        unown,
        shellos,
      ],
      forms: {
        [unown]: [
          {
            form: 2,
            gender: 'none',
          },
          {
            form: 5,
            gender: 'none',
          },
        ],
        [deoxys]: [
          {
            form: 0,
            gender: 'none',
          },
          {
            form: 3,
            gender: 'none',
          },
        ],
        [shellos]: [
          {
            form: 0,
            gender: 'male',
          },
          {
            form: 1,
            gender: 'female',
          },
        ],
        [rotom]: [
          {
            form: 0,
            gender: 'none',
          },
          {
            form: 4,
            gender: 'none',
          },
        ],
      },
    };

    const converted =
      convertOpenSinnohPokedex(
        pokedex,
        base,
      );

    expect(converted.obtained).toBe(true);
    expect(converted.national).toBe(true);

    expect(converted.seen).toEqual([
      platinumPokedexSpeciesIndex(unown),
      platinumPokedexSpeciesIndex(deoxys),
      platinumPokedexSpeciesIndex(shellos),
      platinumPokedexSpeciesIndex(rotom),
    ]);

    expect(
      converted.secondaryGenderBits,
    ).toEqual([
      platinumPokedexSpeciesIndex(shellos),
    ]);

    expect(
      converted.primaryGenderBits,
    ).toEqual([]);

    expect(
      converted.unownForms.slice(0, 4),
    ).toEqual([2, 5, 0xff, 0xff]);

    expect(converted.deoxysForms).toEqual([
      0,
      3,
      15,
      15,
    ]);

    expect(converted.shellosForms).toBe(
      2,
    );

    expect(converted.rotomForms).toBe(
      0x3ffe0,
    );

    expect(
      converted.spindaPersonality,
    ).toBe(0x12345678);
    expect(converted.canDetectForms).toBe(
      true,
    );
  });

  it('rejects caught species not marked seen', () => {
    const species =
      id('platinum:SPECIES_TURTWIG');

    expect(() =>
      convertOpenSinnohPokedex(
        {
          obtained: true,
          national: false,
          seen: [],
          caught: [species],
          forms: {},
        },
        base,
      ),
    ).toThrow(/not seen/i);
  });

  it('rejects unsupported species and form values', () => {
    expect(() =>
      platinumPokedexSpeciesIndex(
        id('mod:UNKNOWN_SPECIES'),
      ),
    ).toThrow(/unknown Platinum Pokédex species/i);

    const unown =
      id('platinum:SPECIES_UNOWN');

    expect(() =>
      convertOpenSinnohPokedex(
        {
          obtained: true,
          national: false,
          seen: [unown],
          caught: [],
          forms: {
            [unown]: [
              {
                form: 28,
                gender: 'none',
              },
            ],
          },
        },
        base,
      ),
    ).toThrow(/Unown form 28/i);
  });
});
