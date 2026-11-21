import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import { applyPlatinumMapObjects } from './platinum-map-objects.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum map-object import', () => {
  it.skipIf(!savePath)(
    'converts real saved map objects',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const imported = applyPlatinumMapObjects(
        {
          objects: [],
        } as unknown as GameState,
        save,
      );

      expect(imported.objects).toHaveLength(6);

      expect(
        imported.objects.some(
          (object) => object.localId === 0xff,
        ),
      ).toBe(false);

      for (const object of imported.objects) {
        expect(object.zone).toMatch(
          /^platinum:MAP_HEADER_/,
        );

        expect([
          'up',
          'down',
          'left',
          'right',
        ]).toContain(object.facing);
      }

      console.log(
        'converted map objects:',
        imported.objects,
      );
    },
  );
});