import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumRivalName,
  importPlatinumRivalName,
} from './platinum-save.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum rival import', () => {
  it('applies a rival name without changing the player name', () => {
    const state = {
      names: {
        player: 'Player',
        rival: 'Rival',
      },
    } as GameState;

    const converted = applyPlatinumRivalName(
      state,
      'Barry',
    );

    expect(converted.names).toEqual({
      player: 'Player',
      rival: 'Barry',
    });

    expect(state.names.rival).toBe('Rival');
  });

  it.skipIf(!savePath)(
    'decodes the rival name from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      expect(importPlatinumRivalName(save)).toBe(
        'Barry',
      );
    },
  );
});