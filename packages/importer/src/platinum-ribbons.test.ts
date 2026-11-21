import { describe, expect, it } from 'vitest';
import { platinumRibbons } from './platinum-party.ts';

describe('Platinum ribbon conversion', () => {
  it('maps all three native ribbon bitfields', () => {
    expect(
      platinumRibbons({
        // GBA ribbon indexes 0 and 31.
        gba: 0x80000001,

        // Bit 0 -> ribbon 32.
        // Bit 1 -> ribbon 53.
        // Bit 27 -> ribbon 79.
        // Bit 28 is unused.
        ds1: 0x18000003,

        // Bit 0 -> ribbon 33.
        // Bit 19 -> ribbon 52.
        // Bit 20 is unused.
        ds2:
          (1n << 0n) |
          (1n << 19n) |
          (1n << 20n),
      }),
    ).toEqual([
      0,
      31,
      32,
      33,
      52,
      53,
      79,
    ]);
  });

  it('returns no ribbons for empty bitfields', () => {
    expect(
      platinumRibbons({
        gba: 0,
        ds1: 0,
        ds2: 0n,
      }),
    ).toEqual([]);
  });

  it('ignores every unused padding bit', () => {
    expect(
      platinumRibbons({
        gba: 0,
        ds1: 0xf0000000,
        ds2: 0xffffffffff00000n,
      }),
    ).toEqual([]);
  });
});