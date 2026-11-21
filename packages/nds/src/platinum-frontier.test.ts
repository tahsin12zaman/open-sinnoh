import { readFileSync } from 'node:fs';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  crc16Ccitt,
} from './platinum-save.ts';
import {
  decodePlatinumFrontier,
  PLATINUM_FRONTIER_SIZE,
  PLATINUM_HALL_RECORDS_BACKUP_OFFSET,
  PLATINUM_HALL_RECORDS_ENTRY_SIZE,
  PLATINUM_HALL_RECORDS_PRIMARY_OFFSET,
  PLATINUM_HALL_RECORDS_SIZE,
  readPlatinumFrontier,
  readPlatinumHallWinRecords,
} from './platinum-frontier.ts';

const UNION = 0x8e0;
const WIFI = 0x954;

function entry(): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_FRONTIER_SIZE,
  );

  // WifiBattleTowerRecord_Init.
  bytes[WIFI + 3] = 1;

  return bytes;
}

function view(bytes: Uint8Array): DataView {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
}

describe('Platinum Battle Frontier', () => {
  it('decodes Tower stats and its saved challenge', () => {
    const bytes = entry();
    const data = view(bytes);

    data.setUint16(0, 49, true);
    data.setUint16(2, 21, true);

    bytes[UNION] =
      0x01 |
      0x02 |
      (2 << 2) |
      (4 << 5);
    bytes[UNION + 2] = 6;
    bytes.set([0, 2, 4, 5], UNION + 8);

    data.setUint16(UNION + 12, 101, true);
    data.setUint16(UNION + 14, 102, true);
    data.setUint32(UNION + 40, 0x12345678, true);
    data.setUint32(UNION + 44, 0x89abcdef, true);
    data.setUint16(UNION + 48, 301, true);
    data.setUint16(UNION + 50, 302, true);
    data.setUint32(UNION + 52, 0x11111111, true);
    data.setUint32(UNION + 56, 0x22222222, true);

    data.setUint16(WIFI, 321, true);
    data.setUint32(WIFI + 4, 0x55fb838e, true);
    data.setUint16(WIFI + 8, 0x2103, true);

    for (let index = 0; index < 6; index++) {
      data.setUint16(
        WIFI + 10 + index * 2,
        index + 1,
        true,
      );
    }

    const decoded = decodePlatinumFrontier(bytes);

    expect(decoded.soloAndActiveStats.slice(0, 2))
      .toEqual([49, 21]);
    expect(decoded.tower).toMatchObject({
      bp: 321,
      rng: 0x55fb838e,
      flags: 0x2103,
      rooms: [1, 2, 3, 4, 5, 6],
      save: {
        reserved: true,
        inProgress: true,
        mode: 2,
        partner: 4,
        nextOpponent: 6,
        slots: [0, 2, 4, 5],
        seed: 0x12345678,
        partnerParty: {
          otId: 0x89abcdef,
          sets: [301, 302],
          pids: [0x11111111, 0x22222222],
        },
      },
    });

    expect(decoded.tower.save.trainers.slice(0, 2))
      .toEqual([101, 102]);
  });

  it('decodes the Factory challenge union', () => {
    const bytes = entry();
    const data = view(bytes);

    bytes[UNION] = 0x01 | (2 << 1) | 0x10;
    bytes[UNION + 1] = 5;

    data.setUint16(UNION + 4, 77, true);
    data.setUint16(UNION + 32, 401, true);
    bytes[UNION + 40] = 25;
    data.setUint32(UNION + 44, 0x10203040, true);

    data.setUint16(UNION + 60, 501, true);
    bytes[UNION + 68] = 30;
    data.setUint32(UNION + 72, 0x50607080, true);

    bytes[0x1618] = 0xa5;

    const decoded = decodePlatinumFrontier(bytes);

    expect(decoded.factory.activeFlags).toBe(0xa5);
    expect(decoded.factory.save).toMatchObject({
      saved: true,
      challengeType: 2,
      openLevel: true,
      battle: 5,
    });
    expect(decoded.factory.save.trainers[0]).toBe(77);
    expect(decoded.factory.save.player[0]).toEqual({
      set: 401,
      ivs: 25,
      pid: 0x10203040,
    });
    expect(decoded.factory.save.opponent[0]).toEqual({
      set: 501,
      ivs: 30,
      pid: 0x50607080,
    });
  });

  it('decodes Hall, Castle, and Arcade layouts', () => {
    const hallBytes = entry();
    const hallView = view(hallBytes);

    hallBytes[UNION] = 0x08 | 2;
    hallBytes[UNION + 1] = 9;
    hallBytes.set([1, 4], UNION + 2);
    hallView.setUint16(UNION + 4, 201, true);
    hallView.setUint16(UNION + 44, 601, true);
    hallBytes[0x161c] = 0x07;

    const hall = decodePlatinumFrontier(hallBytes);

    expect(hall.hall.activeFlags).toBe(7);
    expect(hall.hall.save).toMatchObject({
      saved: true,
      challengeType: 2,
      battle: 9,
      slots: [1, 4],
    });
    expect(hall.hall.save.trainers[0]).toBe(201);
    expect(hall.hall.save.opponents[0]).toBe(601);

    const castleBytes = entry();
    const castleView = view(castleBytes);

    castleBytes[UNION] = 0x08 | 1;
    castleBytes[UNION + 1] = 4;
    castleBytes.set([0, 2, 5], UNION + 3);
    castleView.setUint16(UNION + 6, 301, true);
    castleView.setUint16(UNION + 34, 123, true);
    castleBytes.set([10, 11, 12, 13], UNION + 42);
    castleView.setUint32(UNION + 60, 0x40, true);
    castleView.setUint16(UNION + 76, 17, true);
    castleView.setUint16(UNION + 84, 701, true);
    castleBytes[0x1620] = 0x05;
    castleBytes[0x1621] = 1;

    const castle =
      decodePlatinumFrontier(castleBytes);

    expect(castle.castle).toMatchObject({
      activeFlags: 5,
      heardIntro: true,
      save: {
        saved: true,
        challengeType: 1,
        battle: 4,
        slots: [0, 2, 5],
      },
    });
    expect(castle.castle.save.trainers[0]).toBe(301);
    expect(castle.castle.save.hp[0]).toBe(123);
    expect(castle.castle.save.pp[0]).toEqual([
      10, 11, 12, 13,
    ]);
    expect(castle.castle.save.status[0]).toBe(0x40);
    expect(castle.castle.save.items[0]).toBe(17);
    expect(castle.castle.save.sets[0]).toBe(701);

    const arcadeBytes = entry();
    const arcadeView = view(arcadeBytes);

    arcadeBytes[UNION] = 0x08 | 0x10 | 2;
    arcadeBytes[UNION + 1] = 6;
    arcadeBytes[UNION + 2] = 3;
    arcadeBytes.set([1, 3, 5], UNION + 3);
    arcadeView.setUint16(UNION + 6, 18, true);
    arcadeView.setUint16(UNION + 14, 401, true);
    arcadeView.setUint16(UNION + 42, 801, true);
    arcadeBytes[0x1624] = 0x06;

    const arcade =
      decodePlatinumFrontier(arcadeBytes);

    expect(arcade.arcade).toMatchObject({
      activeFlags: 6,
      save: {
        saved: true,
        challengeType: 2,
        battle: 6,
        speed: 3,
        randomCursor: true,
        slots: [1, 3, 5],
      },
    });
    expect(arcade.arcade.save.items[0]).toBe(18);
    expect(arcade.arcade.save.trainers[0]).toBe(401);
    expect(arcade.arcade.save.sets[0]).toBe(801);
  });

  it('selects the newer valid Hall-record mirror', () => {
    const save = new Uint8Array(0x80000);

    function writeCopy(
      offset: number,
      counter: number,
      streak: number,
    ): void {
      const copy = save.subarray(
        offset,
        offset +
          PLATINUM_HALL_RECORDS_ENTRY_SIZE,
      );
      const data = new DataView(
        copy.buffer,
        copy.byteOffset,
        copy.byteLength,
      );

      data.setUint32(0, 0xffffffff, true);

      // Single-challenge record for Entei (species 244).
      data.setUint16(
        4 + 244 * 2,
        streak,
        true,
      );

      const footer =
        PLATINUM_HALL_RECORDS_SIZE;

      data.setUint32(
        footer,
        0x20060623,
        true,
      );
      data.setUint32(
        footer + 4,
        counter,
        true,
      );
      data.setUint32(
        footer + 8,
        PLATINUM_HALL_RECORDS_SIZE,
        true,
      );
      data.setUint16(
        footer + 12,
        1,
        true,
      );

      data.setUint16(
        footer + 14,
        crc16Ccitt(
          copy,
          0,
          PLATINUM_HALL_RECORDS_ENTRY_SIZE - 2,
        ),
        true,
      );
    }

    writeCopy(
      PLATINUM_HALL_RECORDS_PRIMARY_OFFSET,
      5,
      100,
    );
    writeCopy(
      PLATINUM_HALL_RECORDS_BACKUP_OFFSET,
      6,
      171,
    );

    const decoded =
      readPlatinumHallWinRecords(save);

    expect(decoded.saveCounter).toBe(6);
    expect(decoded.records[0]?.[244]).toBe(171);
  });

  it('rejects truncated and invalid entries', () => {
    expect(() =>
      decodePlatinumFrontier(new Uint8Array(20)),
    ).toThrow(/Truncated/);

    const invalidStat = entry();
    view(invalidStat).setUint16(0, 10_000, true);

    expect(() =>
      decodePlatinumFrontier(invalidStat),
    ).toThrow(/stat 0/);

    const invalidBp = entry();
    view(invalidBp).setUint16(WIFI, 10_000, true);

    expect(() =>
      decodePlatinumFrontier(invalidBp),
    ).toThrow(/BP/);
  });

  const savePath = process.env.OPENSINNOH_NDS_SAV;

  it.skipIf(!savePath)(
    'reads a real Platinum Battle Frontier block',
    () => {
      const decoded = readPlatinumFrontier(
        readFileSync(savePath!),
      );

      console.dir(
        {
          frontier: {
            bp: decoded.tower.bp,
            rng: `0x${decoded.tower.rng
              .toString(16)
              .padStart(8, '0')}`,
            flags: decoded.tower.flags,
            rooms: decoded.tower.rooms,
            nonzeroStats:
              decoded.soloAndActiveStats
                .map((value, index) => ({
                  index,
                  value,
                }))
                .filter(({ value }) => value !== 0),
            facilityFlags: {
              factory: decoded.factory.activeFlags,
              hall: decoded.hall.activeFlags,
              castle: decoded.castle.activeFlags,
              arcade: decoded.arcade.activeFlags,
            },
          },
        },
        { depth: null },
      );

      expect(decoded.tower.bp)
        .toBeLessThanOrEqual(9999);
      expect(decoded.tower.rng)
        .toBeGreaterThan(0);
      expect(decoded.tower.rooms)
        .toHaveLength(6);
      expect(decoded.soloAndActiveStats)
        .toHaveLength(112);
    },
  );

  it.skipIf(!savePath)(
    'reads real mirrored Battle Hall win records',
    () => {
      const records =
        readPlatinumHallWinRecords(
          readFileSync(savePath!),
        );

      const nonzero = records.records.flatMap(
        (challengeRecords, challengeType) =>
          challengeRecords
            .map((streak, species) => ({
              challengeType,
              species,
              streak,
            }))
            .filter(({ streak }) => streak !== 0),
      );

      console.dir(
        {
          hallWinRecords: {
            saveCounter: records.saveCounter,
            nonzero,
          },
        },
        { depth: null },
      );

      expect(records.records).toHaveLength(3);
      expect(
        records.records.every(
          (challengeRecords) =>
            challengeRecords.length === 495,
        ),
      ).toBe(true);
      expect(
        nonzero.every(
          ({ streak }) =>
            streak > 0 && streak <= 9999,
        ),
      ).toBe(true);
    },
  );

});
