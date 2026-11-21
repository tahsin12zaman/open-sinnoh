import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePlatinumBoxPokemon } from './platinum-box-pokemon-data.ts';
import { readPlatinumPcBoxes } from './platinum-pc-boxes.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum boxed Pokémon fields', () => {
  it.skipIf(!savePath)(
    'parses every occupied slot in a real save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const pc = readPlatinumPcBoxes(save);

      const pokemon = pc.boxes.flatMap(
        (box, boxIndex) =>
          box.slots.flatMap((slot, slotIndex) =>
            slot === null
              ? []
              : [
                  {
                    box: boxIndex,
                    slot: slotIndex,
                    data:
                      parsePlatinumBoxPokemon(
                        slot,
                      ),
                  },
                ],
          ),
      );

      expect(pokemon).toHaveLength(5);

      expect(
        pokemon.map((entry) => entry.data.species),
      ).toEqual([387, 393, 390, 399, 456]);

      for (const entry of pokemon) {
        expect(entry.data.exp).toBeGreaterThan(0);
        expect(entry.data.moves.length).toBeGreaterThan(
          0,
        );
      }

      console.log(
        'boxed pokemon:',
        pokemon.map(({ box, slot, data }) => ({
          box,
          slot,
          species: data.species,
          exp: data.exp,
          moves: data.moves,
          form: data.form,
          isEgg: data.isEgg,
        })),
      );
    },
  );
});