import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import type { PlatinumOptions } from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumOptions,
  convertPlatinumOptions,
} from './platinum-options.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function nativeOptions(): PlatinumOptions {
  return {
    textSpeed: 2,
    soundMode: 1,
    battleStyle: 1,
    battleScene: 0,
    buttonMode: 2,
    frame: 19,
  };
}

describe('Platinum options import', () => {
  it('converts all modeled saved options', () => {
    expect(
      convertPlatinumOptions(nativeOptions()),
    ).toEqual({
      sound: 1,
      battleScene: 0,
      battleStyle: 1,
      buttonMode: 2,
      frame: 19,
    });
  });

  it('does not expose DS text speed in saved options', () => {
    const slow = convertPlatinumOptions({
      ...nativeOptions(),
      textSpeed: 0,
    });

    const fast = convertPlatinumOptions({
      ...nativeOptions(),
      textSpeed: 2,
    });

    expect(slow).toEqual(fast);
    expect(slow).not.toHaveProperty('textSpeed');
  });

  it.skipIf(!savePath)(
    'applies options from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        options: {
          sound: 1,
          battleScene: 1,
          battleStyle: 1,
          buttonMode: 2,
          frame: 19,
        },
      } as unknown as GameState;

      const converted = applyPlatinumOptions(
        base,
        save,
      );

      console.log(
        'converted options:',
        converted.options,
      );

      expect(converted.options).toEqual({
        sound: 0,
        battleScene: 0,
        battleStyle: 0,
        buttonMode: 0,
        frame: 0,
      });

      expect(base.options).toEqual({
        sound: 1,
        battleScene: 1,
        battleStyle: 1,
        buttonMode: 2,
        frame: 19,
      });
    },
  );
});
