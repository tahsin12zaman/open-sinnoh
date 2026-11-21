import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePlatinumName } from '../../importer/src/platinum-save.ts';
import {
  PLATINUM_PC_BOX_COUNT,
  PLATINUM_PC_BOX_SLOTS,
  readPlatinumPcBoxes,
} from './platinum-pc-boxes.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function speciesOf(
  pokemon: NonNullable<
    ReturnType<
      typeof readPlatinumPcBoxes
    >['boxes'][number]['slots'][number]
  >,
): number {
  const block = pokemon.blocks[0];

  return new DataView(
    block.buffer,
    block.byteOffset,
    block.byteLength,
  ).getUint16(0, true);
}

describe('Platinum PC boxes', () => {
  it.skipIf(!savePath)(
    'reads every box from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const pc = readPlatinumPcBoxes(save);

      expect(pc.boxes).toHaveLength(
        PLATINUM_PC_BOX_COUNT,
      );

      for (const box of pc.boxes) {
        expect(box.slots).toHaveLength(
          PLATINUM_PC_BOX_SLOTS,
        );
      }

      const occupied = pc.boxes.flatMap(
        (box, boxIndex) =>
          box.slots.flatMap((pokemon, slot) =>
            pokemon === null
              ? []
              : [
                  {
                    box: boxIndex,
                    slot,
                    species: speciesOf(pokemon),
                  },
                ],
          ),
      );

      console.log('pc boxes:', {
        currentBox: pc.currentBox,
        unlockedWallpapers:
          pc.unlockedWallpapers,
        occupiedCount: occupied.length,
        names: pc.boxes.map((box) =>
          decodePlatinumName(box.nameCodes),
        ),
        wallpapers: pc.boxes.map(
          (box) => box.wallpaper,
        ),
        occupied,
      });
    },
  );
});