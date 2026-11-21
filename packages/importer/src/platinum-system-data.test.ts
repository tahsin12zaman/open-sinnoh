import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumSystemData,
  platinumRtcTimestampDate,
} from './platinum-system-data.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum SystemData import', () => {
  it('converts Nintendo RTC timestamps', () => {
    expect(
      platinumRtcTimestampDate(805690550n),
    ).toBe('2025-07-13');

    expect(
      platinumRtcTimestampDate(0n),
    ).toBeNull();
  });

  it.skipIf(!savePath)(
    'applies a real Platinum clock',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const state = {
        gameTime: {
          now: {
            date: '2000-01-01',
            hour: 0,
            minute: 0,
            second: 0,
          },
          penaltyMinutes: 0,
          dailyRandom: 123,
        },
        startDate: null,
      } as unknown as GameState;

      const converted =
        applyPlatinumSystemData(state, save);

      expect(converted.gameTime).toEqual({
        now: {
          date: '2025-08-20',
          hour: 1,
          minute: 48,
          second: 31,
        },
        penaltyMinutes: 1311,
        dailyRandom: 123,
      });

      expect(converted.startDate).toBe(
        '2025-07-13',
      );

      console.log('converted system data:', {
        gameTime: converted.gameTime,
        startDate: converted.startDate,
      });
    },
  );
});