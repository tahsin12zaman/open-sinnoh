import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumFashionCase,
  PLATINUM_FASHION_CASE_SIZE,
  readPlatinumFashionCase,
} from './platinum-fashion-case.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function emptyCase(): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_FASHION_CASE_SIZE,
  );

  bytes.fill(18, 0x28, 0x28 + 18);

  return bytes;
}

describe('Platinum Fashion Case', () => {
  it('decodes accessories and backdrop order', () => {
    const bytes = emptyCase();
    const view = new DataView(bytes.buffer);

    // Non-unique IDs 2 and 3: counts 7 and 9.
    view.setUint32(
      0,
      (7 << (2 * 4)) | (9 << (3 * 4)),
      true,
    );

    // Unique accessory IDs 61 and 99.
    view.setUint32(0x20, 1, true);
    view.setUint32(
      0x24,
      1 << (38 - 32),
      true,
    );

    // Backdrop acquisition order: 3, 1, 7.
    bytes[0x28 + 3] = 0;
    bytes[0x28 + 1] = 1;
    bytes[0x28 + 7] = 2;

    const decoded =
      decodePlatinumFashionCase(bytes);

    expect(decoded.accessories).toHaveLength(
      100,
    );
    expect(decoded.accessories[2]).toBe(7);
    expect(decoded.accessories[3]).toBe(9);
    expect(decoded.accessories[61]).toBe(1);
    expect(decoded.accessories[99]).toBe(1);
    expect(decoded.backdrops).toEqual([
      3, 1, 7,
    ]);
  });

  it('caps corrupt non-unique counts at nine', () => {
    const bytes = emptyCase();
    bytes[0] = 0x0f;

    expect(
      decodePlatinumFashionCase(bytes)
        .accessories[0],
    ).toBe(9);
  });

  it('rejects a truncated case', () => {
    expect(() =>
      decodePlatinumFashionCase(
        new Uint8Array(
          PLATINUM_FASHION_CASE_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it('rejects an invalid backdrop position', () => {
    const bytes = emptyCase();
    bytes[0x28] = 19;

    expect(() =>
      decodePlatinumFashionCase(bytes),
    ).toThrow(/position 19/i);
  });

  it('rejects duplicate backdrop positions', () => {
    const bytes = emptyCase();
    bytes[0x28] = 0;
    bytes[0x29] = 0;

    expect(() =>
      decodePlatinumFashionCase(bytes),
    ).toThrow(/duplicate/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum Fashion Case',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const fashion =
        readPlatinumFashionCase(save);

      const occupied = fashion.accessories
        .map((count, id) => ({
          id,
          count,
        }))
        .filter(
          ({ count }) => count !== 0,
        );

      console.log('fashion case:', {
        occupied,
        backdrops: fashion.backdrops,
      });

      expect(fashion.accessories).toHaveLength(
        100,
      );

      expect(occupied).toEqual([
        { id: 2, count: 2 },
        { id: 3, count: 1 },
        { id: 4, count: 1 },
        { id: 5, count: 1 },
        { id: 18, count: 2 },
        { id: 20, count: 1 },
        { id: 22, count: 1 },
        { id: 23, count: 1 },
      ]);

      expect(fashion.backdrops).toEqual([
        0, 3, 1,
      ]);
    },
  );
});
