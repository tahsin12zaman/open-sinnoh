import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumSealCase,
  PLATINUM_CAPSULE_COUNT,
  PLATINUM_SEAL_CASE_ENTRY_SIZE,
  PLATINUM_SEAL_COUNT,
  readPlatinumSealCase,
} from './platinum-seal-case.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;
const CAPSULES_SIZE = 12 * 8 * 3;

function sealCaseFixture(): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_SEAL_CASE_ENTRY_SIZE,
  );

  // Capsule 0, slot 0.
  bytes[0] = 1;
  bytes[1] = 190;
  bytes[2] = 70;

  // Capsule 0, slot 2, leaving slot 1 empty.
  bytes[6] = 80;
  bytes[7] = 150;
  bytes[8] = 90;

  // Capsule 11, slot 7.
  const last = (11 * 8 + 7) * 3;
  bytes[last] = 42;
  bytes[last + 1] = 200;
  bytes[last + 2] = 40;

  // Loose counts for seals 1, 42 and 80.
  bytes[CAPSULES_SIZE] = 3;
  bytes[CAPSULES_SIZE + 41] = 7;
  bytes[CAPSULES_SIZE + 79] = 99;

  return bytes;
}

describe('Platinum Seal Case', () => {
  it('decodes loose seals and Ball Capsules', () => {
    const decoded = decodePlatinumSealCase(
      sealCaseFixture(),
    );

    expect(decoded.counts).toHaveLength(
      PLATINUM_SEAL_COUNT,
    );

    expect(decoded.counts[0]).toBe(3);
    expect(decoded.counts[41]).toBe(7);
    expect(decoded.counts[79]).toBe(99);

    expect(decoded.capsules).toHaveLength(
      PLATINUM_CAPSULE_COUNT,
    );

    expect(decoded.capsules[0]).toEqual([
      {
        seal: 1,
        x: 190,
        y: 70,
      },
      {
        seal: 80,
        x: 150,
        y: 90,
      },
    ]);

    expect(decoded.capsules[11]).toEqual([
      {
        seal: 42,
        x: 200,
        y: 40,
      },
    ]);
  });

  it('rejects an invalid seal id', () => {
    const fixture = sealCaseFixture();

    fixture[0] = 81;

    expect(() =>
      decodePlatinumSealCase(fixture),
    ).toThrow(/seal id 81/i);
  });

  it('rejects an invalid loose count', () => {
    const fixture = sealCaseFixture();

    fixture[CAPSULES_SIZE] = 100;

    expect(() =>
      decodePlatinumSealCase(fixture),
    ).toThrow(/loose seal count 100/i);
  });

  it('rejects a truncated entry', () => {
    expect(() =>
      decodePlatinumSealCase(
        new Uint8Array(
          PLATINUM_SEAL_CASE_ENTRY_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum Seal Case',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const decoded =
        readPlatinumSealCase(save);

      console.log('seal case:', {
        loose: decoded.counts
          .map((count, id) => ({
            id: id + 1,
            count,
          }))
          .filter(({ count }) => count !== 0),
        capsules: decoded.capsules,
      });

      expect(decoded.counts).toHaveLength(80);
      expect(decoded.capsules).toHaveLength(12);
    },
  );
});
