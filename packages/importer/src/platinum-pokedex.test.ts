import { readFileSync } from 'node:fs';
import type {
  GameState,
  Registries,
} from '@opensinnoh/contracts';
import type {
  Id,
  PackData,
} from '@opensinnoh/core';
import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { importPlatinum } from './platinum.ts';
import { applyPlatinumPokedex } from './platinum-pokedex.ts';

const romPath = process.env.OPENSINNOH_NDS_ROM;
const savePath = process.env.OPENSINNOH_NDS_SAV;

function registriesOf(
  pack: PackData,
): Registries {
  return Object.fromEntries(
    Object.entries(pack.registries).map(
      ([name, records]) => [
        name,
        new Map(
          (
            records as unknown as {
              id: Id;
            }[]
          ).map((record) => [
            record.id,
            record,
          ]),
        ),
      ],
    ),
  ) as unknown as Registries;
}

describe.skipIf(!romPath || !savePath)(
  'Platinum Pokédex import',
  () => {
    let registries: Registries;

    beforeAll(async () => {
      const rom = new Uint8Array(
        readFileSync(romPath!),
      );

      const { pack } = await importPlatinum(rom);
      registries = registriesOf(pack);
    });

    it('maps a real Platinum Pokédex to OpenSinnoh IDs', () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const state = {
        pokedex: {
          obtained: false,
          national: false,
          seen: [],
          caught: [],
          forms: {},
        },
      } as unknown as GameState;

      const converted = applyPlatinumPokedex(
        state,
        save,
        registries,
      );

      expect(converted.pokedex.obtained).toBe(true);
      expect(converted.pokedex.national).toBe(false);
      expect(converted.pokedex.seen).toHaveLength(26);
      expect(converted.pokedex.caught).toHaveLength(7);

      expect(converted.pokedex.seen).toContain(
        'platinum:SPECIES_TURTWIG',
      );

      expect(converted.pokedex.caught).toContain(
        'platinum:SPECIES_TURTWIG',
      );

      expect(converted.pokedex.seen).toContain(
        'platinum:SPECIES_ZUBAT',
      );

      for (const species of converted.pokedex.seen) {
        const forms =
          converted.pokedex.forms[species];

        expect(forms).toBeDefined();
        expect(forms!.length).toBeGreaterThan(0);

        for (const form of forms!) {
          expect(form.form).toBeGreaterThanOrEqual(0);
          expect([
            'male',
            'female',
            'none',
          ]).toContain(form.gender);
        }
      }

      console.log('converted pokedex:', {
        obtained: converted.pokedex.obtained,
        national: converted.pokedex.national,
        seenCount: converted.pokedex.seen.length,
        caughtCount:
          converted.pokedex.caught.length,
        formRecords: Object.keys(
          converted.pokedex.forms,
        ).length,
        caught: converted.pokedex.caught,
      });
    });
  },
);