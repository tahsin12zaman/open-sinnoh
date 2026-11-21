import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumPlayerState,
  convertPlatinumPlayerState,
} from './platinum-player-state.ts';

describe('Platinum player-state import', () => {
  it('maps badges, shoes, cycling gear and surfing', () => {
    expect(
      convertPlatinumPlayerState({
        badgeBits: 0b10100101,
        cyclingGear: 1,
        runningShoes: true,
        playerState: 2,
      }),
    ).toEqual({
      badges: [
        'platinum:BADGE_ID_COAL',
        'platinum:BADGE_ID_COBBLE',
        'platinum:BADGE_ID_MINE',
        'platinum:BADGE_ID_BEACON',
      ],
      cyclingGear: 1,
      runningShoes: true,
      playerState: 'surf',
    });
  });

  it.each([
    [0, 'walk'],
    [1, 'cycle'],
    [2, 'surf'],
  ] as const)(
    'maps native player state %i to %s',
    (native, expected) => {
      expect(
        convertPlatinumPlayerState({
          badgeBits: 0,
          cyclingGear: 0,
          runningShoes: false,
          playerState: native,
        }).playerState,
      ).toBe(expected);
    },
  );

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'applies a real Platinum player state',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const imported = applyPlatinumPlayerState(
        {
          badges: [],
          cyclingGear: 0,
          runningShoes: false,
          playerState: 'walk',
        } as never,
        bytes,
      );

      console.log('converted player state:', {
        badges: imported.badges,
        cyclingGear: imported.cyclingGear,
        runningShoes: imported.runningShoes,
        playerState: imported.playerState,
      });

      expect(imported.badges).toEqual([
        'platinum:BADGE_ID_COAL',
      ]);
      expect(imported.cyclingGear).toBe(1);
      expect(imported.runningShoes).toBe(true);
      expect(imported.playerState).toBe('walk');
    },
  );
});