import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLATINUM_MAP_OBJECT_PASS_THROUGH,
  readPlatinumMapObjects,
} from './platinum-map-objects.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum saved map objects', () => {
  it.skipIf(!savePath)(
    'reads active objects from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const objects =
        readPlatinumMapObjects(save);

      expect(objects.length).toBeLessThanOrEqual(64);

      for (const object of objects) {
        expect(
          object.facingDirection,
        ).toBeGreaterThanOrEqual(0);

        expect(
          object.facingDirection,
        ).toBeLessThanOrEqual(3);
      }

      console.log(
        'saved map objects:',
        objects.map((object) => ({
          mapHeaderId: object.mapHeaderId,
          localId: object.localId,
          graphicsId: object.graphicsId,
          movementType: object.movementType,
          initial: object.initial,
          position: object.position,
          facingDirection:
            object.facingDirection,
          passThrough: Boolean(
            object.status &
              PLATINUM_MAP_OBJECT_PASS_THROUGH,
          ),
          flag: object.flag,
          script: object.script,
          data: object.data,
        })),
      );
    },
  );
});