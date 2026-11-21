import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPlatinumSystemData } from './platinum-system-data.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum SystemData', () => {
  it.skipIf(!savePath)(
    'reads the saved clock from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const system =
        readPlatinumSystemData(save);

      expect(system.now).toEqual({
        year: 2025,
        month: 8,
        day: 20,
        week: 0,
        hour: 1,
        minute: 48,
        second: 31,
      });

      expect(system.dayNumber).toBe(9332);
      expect(system.startTimestamp).toBe(
        805690550n,
      );
      expect(
        system.firstCompletionTimestamp,
      ).toBe(0n);
      expect(system.penaltyMinutes).toBe(1311);

      console.log('system data:', system);
    },
  );
});