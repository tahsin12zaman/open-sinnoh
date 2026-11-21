import fs from 'node:fs';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  decodePlatinumTv,
  PLATINUM_TV_SIZE,
  readPlatinumTv,
} from './platinum-tv.ts';

describe('Platinum TV', () => {
  it('decodes slots and pending data', () => {
    const bytes =
      new Uint8Array(PLATINUM_TV_SIZE);
    const view = new DataView(bytes.buffer);

    bytes.set([2, 7, 0, 0], 0);
    view.setInt32(4, 12, true);
    view.setUint8(8, 1);

    view.setUint8(0x0c, 14);
    view.setUint8(0x0d, 2);
    view.setUint32(0x10, 123456, true);
    view.setUint16(0x14, 244, true);

    view.setUint8(0xcc, 15);
    view.setUint8(0xcd, 1);

    view.setUint8(0x18c, 10);
    view.setUint8(0x18d, 3);

    view.setUint8(0xb4c, 1);
    view.setUint16(0xb4e, 25, true);
    view.setUint8(0xb53, 2);
    view.setUint8(0xb54, 3);
    view.setUint8(0xb55, 1);

    view.setUint8(0xb7c, 1);
    view.setUint8(0xb7d, 1);
    view.setUint16(0xb7e, 49, true);

    view.setUint8(0xb80, 1);
    view.setUint16(0xb82, 54, true);
    view.setUint8(0xb87, 6);

    view.setUint8(0xb88, 1);
    view.setUint16(0xb8a, 244, true);

    view.setUint32(0xbc0, 321, true);

    const decoded = decodePlatinumTv(bytes);

    expect(decoded).toMatchObject({
      played: [2, 7],
      slotMinutes: 12,
      finished: true,
      pending: {
        contest: {
          present: true,
          species: 25,
          rank: 2,
          type: 3,
          placement: 1,
        },
        tower: {
          present: true,
          win: true,
          streak: 49,
        },
        safari: {
          present: true,
          species: 54,
          caught: 6,
        },
        hall: {
          present: true,
          species: 244,
        },
        bp: 321,
      },
    });

    expect(decoded.interviews[0]).toMatchObject({
      id: 14,
      plays: 2,
      timestamp: 123456,
    });
    expect(decoded.interviews[0]!.data[0])
      .toBe(244);
    expect(decoded.sightings[0]!.id).toBe(15);
    expect(decoded.records[0]!.id).toBe(10);
  });

  it('rejects invalid data', () => {
    expect(() =>
      decodePlatinumTv(
        new Uint8Array(PLATINUM_TV_SIZE - 1),
      ),
    ).toThrow(/expected/);

    const bytes =
      new Uint8Array(PLATINUM_TV_SIZE);
    bytes[0x0c] = 19;

    expect(() =>
      decodePlatinumTv(bytes),
    ).toThrow(/segment/);
  });

  const savePath = process.env.OPENSINNOH_NDS_SAV;

  it.skipIf(!savePath)(
    'reads a real Platinum TV block',
    () => {
      const decoded = readPlatinumTv(
        fs.readFileSync(savePath!),
      );

      console.dir(
        {
          tv: {
            played: decoded.played,
            slotMinutes:
              decoded.slotMinutes,
            finished: decoded.finished,
            interviews:
              decoded.interviews.map(
                ({ id, plays }) => ({
                  id,
                  plays,
                }),
              ),
            sightings:
              decoded.sightings.map(
                ({ id, plays }) => ({
                  id,
                  plays,
                }),
              ),
            records:
              decoded.records.map(
                ({ id, plays }) => ({
                  id,
                  plays,
                }),
              ),
            pending: decoded.pending,
          },
        },
        { depth: null },
      );

      expect(decoded.slotMinutes)
        .toBeGreaterThanOrEqual(0);
      expect(decoded.slotMinutes)
        .toBeLessThanOrEqual(15);
    },
  );
});
