import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPlatinumFieldState } from './platinum-field-state.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum field state', () => {
  it.skipIf(!savePath)(
    'reads a real Platinum field state',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const field = readPlatinumFieldState(save);

      expect(field.player.mapHeaderId).toBe(200);
      expect(field.player.x).toBe(232);
      expect(field.player.z).toBe(656);

      console.log('field state:', field);
    },
  );
});