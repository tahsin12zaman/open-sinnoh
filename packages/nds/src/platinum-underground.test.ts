import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumUnderground,
  PLATINUM_UNDERGROUND_ENTRY_SIZE,
  readPlatinumUnderground,
} from './platinum-underground.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function setCoords(
  bytes: Uint8Array,
  offset: number,
  x: number,
  z: number,
): void {
  bytes[offset] = x & 0xff;
  bytes[offset + 1] =
    ((x >>> 8) & 0xf) |
    ((z >>> 4) & 0xf0);
  bytes[offset + 2] = z & 0xff;
}

function undergroundFixture(): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_UNDERGROUND_ENTRY_SIZE,
  );

  const view = new DataView(bytes.buffer);

  view.setUint32(0x98, 0x12345678, true);

  view.setUint32(0x50 + 4 * 4, 12, true);
  view.setUint32(0x50 + 5 * 4, 3, true);
  view.setUint32(0x50 + 6 * 4, 9, true);
  view.setUint32(0x50 + 8 * 4, 4, true);
  view.setUint32(0x50 + 13 * 4, 2, true);

  bytes[0x113] = 7;
  setCoords(bytes, 0x153, 300, 400);

  setCoords(bytes, 0x213, 120, 220);

  bytes[0x510] = 8;
  setCoords(bytes, 0x520, 301, 401);

  bytes[0x560] = 3;
  bytes[0x5c4] = 6;
  bytes[0x628] = 10;
  setCoords(bytes, 0x68c, 302, 402);

  view.setUint32(0x810, 0x1234, true);

  bytes[0x814] = 6;
  bytes[0x8dc] = 2;
  bytes[0x904] = 7;
  bytes[0x92c] = 23;
  bytes[0x954] = 4;
  bytes[0x97c] = 20;

  bytes[0x9b3] = 49;
  bytes[0x9b4] = 0x11;

  return bytes;
}

describe('Platinum Underground', () => {
  it('decodes inventories, coordinates, and records', () => {
    const decoded =
      decodePlatinumUnderground(
        undergroundFixture(),
      );

    expect(decoded).toMatchObject({
      seed: 0x12345678,
      respawn: true,
      mined: true,
      spheres: [
        {
          type: 4,
          size: 20,
        },
      ],
      treasures: [23],
      traps: [2],
      goods: [7],
      goodsPc: [6],
      buried: [
        {
          type: 3,
          size: 10,
          growth: 6,
          x: 302,
          z: 402,
        },
      ],
      spots: [
        {
          x: 120,
          z: 220,
        },
      ],
      plates: 0x1234,
      records: {
        spheresDug: 12,
        fossilsDug: 3,
        otherDug: 9,
        trapsTriggered: 4,
        baseMoves: 2,
      },
      steps: 49,
      placedTraps: [
        {
          trap: 8,
          x: 301,
          z: 401,
        },
      ],
      base: null,
    });

    expect(decoded.spawnedTraps[0]).toEqual({
      trap: 7,
      x: 300,
      z: 400,
    });

    expect(
      decoded.spawnedTraps.slice(1),
    ).toEqual(new Array(63).fill(null));
  });

  it('decodes an active Secret Base', () => {
    const fixture = undergroundFixture();
    const view = new DataView(fixture.buffer);

    fixture[0x95] = 1;
    view.setUint16(0x90, 200, true);
    view.setUint16(0x92, 300, true);
    fixture[0x94] = 2;

    fixture[0] = 5;
    fixture[1] = 6;
    fixture[2] = 10;
    fixture[0x9a4] = 4;

    fixture[45] = 7;
    fixture[46] = 8;

    const decoded =
      decodePlatinumUnderground(fixture);

    expect(decoded.base).toEqual({
      entrance: {
        x: 200,
        z: 300,
        direction: 2,
      },
      goods: [
        {
          good: 10,
          x: 5,
          z: 6,
          slot: 3,
        },
        ...new Array(14).fill(null),
      ],
      boulders: [
        {
          x: 7,
          z: 8,
        },
        ...new Array(15).fill(null),
      ],
    });
  });

  it('rejects an invalid sphere', () => {
    const fixture = undergroundFixture();

    fixture[0x954] = 6;

    expect(() =>
      decodePlatinumUnderground(fixture),
    ).toThrow(/sphere type 6/i);
  });

  it('rejects a truncated entry', () => {
    expect(() =>
      decodePlatinumUnderground(
        new Uint8Array(
          PLATINUM_UNDERGROUND_ENTRY_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum Underground block',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const decoded =
        readPlatinumUnderground(save);

      console.dir(
        {
          underground: decoded,
        },
        { depth: null },
      );

      expect(decoded.respawn).toBe(true);
      expect(decoded.mined).toBe(false);
      expect(decoded.spheres).toEqual([]);
      expect(decoded.buried).toEqual([]);
      expect(decoded.spots).toEqual([]);
      expect(decoded.base).toBeNull();
      expect(decoded.spawnedTraps).toEqual(
        new Array(64).fill(null),
      );
    },
  );
});
