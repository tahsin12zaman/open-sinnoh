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
import { applyPlatinumPcBoxes } from './platinum-pc-boxes.ts';

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
  'Platinum PC box import with ROM registries',
  () => {
    let registries: Registries;

    beforeAll(async () => {
      const rom = new Uint8Array(
        readFileSync(romPath!),
      );

      const { pack } = await importPlatinum(rom);
      registries = registriesOf(pack);
    });

    it('converts every occupied boxed Pokémon', () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const imported = applyPlatinumPcBoxes(
        {} as GameState,
        save,
        registries,
      );

      expect(imported.boxes).toHaveLength(18);
      expect(imported.currentBox).toBe(0);

      for (const box of imported.boxes) {
        expect(box.slots).toHaveLength(30);
      }

      const occupied = imported.boxes.flatMap(
        (box, boxIndex) =>
          box.slots.flatMap((pokemon, slot) =>
            pokemon === null
              ? []
              : [
                  {
                    box: boxIndex,
                    slot,
                    species: pokemon.species,
                    level: pokemon.level,
                    exp: pokemon.exp,
                    hp: `${pokemon.hp}/${pokemon.stats.hp}`,
                    moves: pokemon.moves,
                  },
                ],
          ),
      );

      expect(occupied).toHaveLength(5);

      expect(
        occupied.map((entry) => entry.species),
      ).toEqual([
        'platinum:SPECIES_TURTWIG',
        'platinum:SPECIES_PIPLUP',
        'platinum:SPECIES_CHIMCHAR',
        'platinum:SPECIES_BIDOOF',
        'platinum:SPECIES_FINNEON',
      ]);

      for (const entry of occupied) {
        expect(entry.level).toBeGreaterThan(0);
        expect(entry.level).toBeLessThanOrEqual(100);
      }

      console.log('converted pc boxes:', {
        currentBox: imported.currentBox,
        wallpapersUnlocked:
          imported.wallpapersUnlocked,
        names: imported.boxes.map(
          (box) => box.name,
        ),
        occupied,
      });
    });
  },
);