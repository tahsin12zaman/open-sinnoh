import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumOptions,
  readPlatinumOptions,
} from './platinum-options.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum options', () => {
  it('decodes every Options bitfield', () => {
    const value =
      2 |
      (1 << 4) |
      (1 << 6) |
      (0 << 7) |
      (2 << 8) |
      (19 << 10);

    expect(decodePlatinumOptions(value)).toEqual({
      textSpeed: 2,
      soundMode: 1,
      battleStyle: 1,
      battleScene: 0,
      buttonMode: 2,
      frame: 19,
    });
  });

  it('rejects reserved option values', () => {
    expect(() =>
      decodePlatinumOptions(3),
    ).toThrow(/text speed/i);

    expect(() =>
      decodePlatinumOptions(2 << 4),
    ).toThrow(/sound mode/i);

    expect(() =>
      decodePlatinumOptions(3 << 8),
    ).toThrow(/button mode/i);

    expect(() =>
      decodePlatinumOptions(20 << 10),
    ).toThrow(/message frame/i);
  });

  it.skipIf(!savePath)(
    'reads options from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const options = readPlatinumOptions(save);

      console.log('options:', options);

      expect(options.textSpeed).toBeGreaterThanOrEqual(0);
      expect(options.textSpeed).toBeLessThanOrEqual(2);
      expect(options.soundMode).toBeGreaterThanOrEqual(0);
      expect(options.soundMode).toBeLessThanOrEqual(1);
      expect(options.battleStyle).toBeGreaterThanOrEqual(0);
      expect(options.battleStyle).toBeLessThanOrEqual(1);
      expect(options.battleScene).toBeGreaterThanOrEqual(0);
      expect(options.battleScene).toBeLessThanOrEqual(1);
      expect(options.buttonMode).toBeGreaterThanOrEqual(0);
      expect(options.buttonMode).toBeLessThanOrEqual(2);
      expect(options.frame).toBeGreaterThanOrEqual(0);
      expect(options.frame).toBeLessThanOrEqual(19);
    },
  );
});
