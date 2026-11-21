import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import { applyPlatinumFieldState } from './platinum-field-state.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum field-state import', () => {
  it.skipIf(!savePath)(
    'converts a real Platinum field state',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const imported = applyPlatinumFieldState(
        {
          weather:
            'platinum:OVERWORLD_WEATHER_RAIN',
          previousZone: null,
          specialLocation: null,
        } as unknown as GameState,
        save,
      );

      expect(imported.weather).toBe(
        'platinum:OVERWORLD_WEATHER_CLEAR',
      );

      expect(imported.previousZone).toMatch(
        /^platinum:MAP_HEADER_/,
      );

      expect(imported.specialLocation).toBeNull();

      expect(imported.escapeLocation).toMatchObject({
        zone: expect.stringMatching(
          /^platinum:MAP_HEADER_/,
        ),
        x: 176,
        z: 667,
        facing: 'up',
      });

      expect(imported.safari).toBeUndefined();

      console.log('converted field state:', {
        weather: imported.weather,
        previousZone: imported.previousZone,
        specialLocation:
          imported.specialLocation,
        escapeLocation:
          imported.escapeLocation,
        safari: imported.safari,
      });
    },
  );
});