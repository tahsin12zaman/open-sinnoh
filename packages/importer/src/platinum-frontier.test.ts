import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  readPlatinumFrontier,
  type PlatinumFrontier,
} from '@opensinnoh/nds';
import {
  convertPlatinumFrontier,
} from './platinum-frontier.ts';

function nativeFrontier(): PlatinumFrontier {
  return {
    soloAndActiveStats: Array<number>(112).fill(0),
    tower: {
      bp: 0,
      rng: 0,
      flags: 0,
      rooms: [0, 0, 0, 0, 0, 0],
      save: {
        inProgress: false,
        reserved: false,
        mode: 0,
        nextOpponent: 0,
        slots: [0, 0, 0, 0],
        trainers: Array<number>(14).fill(0),
        seed: 0,
        partner: 0,
        partnerParty: {
          otId: 0,
          sets: [0, 0],
          pids: [0, 0],
        },
      },
    },
    factory: {
      activeFlags: 0,
      save: {
        saved: false,
        challengeType: 0,
        openLevel: false,
        battle: 0,
        trainers: Array<number>(14).fill(0),
        player: Array.from(
          { length: 4 },
          () => ({ set: 0, ivs: 0, pid: 0 }),
        ),
        opponent: Array.from(
          { length: 4 },
          () => ({ set: 0, ivs: 0, pid: 0 }),
        ),
      },
    },
    hall: {
      activeFlags: 0,
      save: {
        saved: false,
        challengeType: 0,
        battle: 0,
        slots: [0, 0],
        trainers: Array<number>(20).fill(0),
        opponents: Array<number>(20).fill(0),
      },
    },
    castle: {
      activeFlags: 0,
      heardIntro: false,
      save: {
        saved: false,
        challengeType: 0,
        battle: 0,
        slots: [0, 0, 0],
        trainers: Array<number>(14).fill(0),
        hp: [0, 0, 0, 0],
        pp: Array.from(
          { length: 4 },
          () => [0, 0, 0, 0],
        ),
        status: [0, 0, 0, 0],
        items: [0, 0, 0, 0],
        sets: Array<number>(14).fill(0),
      },
    },
    arcade: {
      activeFlags: 0,
      save: {
        saved: false,
        challengeType: 0,
        battle: 0,
        speed: 0,
        randomCursor: false,
        slots: [0, 0, 0],
        items: [0, 0, 0, 0],
        trainers: Array<number>(14).fill(0),
        sets: Array<number>(14).fill(0),
      },
    },
  };
}

describe('Platinum Battle Frontier import', () => {
  it('maps Tower state and optional partner data', () => {
    const native = nativeFrontier();

    native.soloAndActiveStats[0] = 49;
    native.soloAndActiveStats[1] = 21;
    native.tower.bp = 321;
    native.tower.rng = 0x55fb838e;
    native.tower.flags = 0x2103;
    native.tower.rooms = [1, 2, 3, 4, 5, 6];
    native.tower.save = {
      inProgress: true,
      reserved: true,
      mode: 2,
      nextOpponent: 6,
      slots: [0, 2, 4, 5],
      trainers: [
        101, 102, 103, 104, 105, 106, 107,
        108, 109, 110, 111, 112, 113, 114,
      ],
      seed: 0x12345678,
      partner: 4,
      partnerParty: {
        otId: 0x89abcdef,
        sets: [301, 302],
        pids: [0x11111111, 0x22222222],
      },
    };

    const converted =
      convertPlatinumFrontier(native);

    expect(converted).toMatchObject({
      bp: 321,
      towerRng: 0x55fb838e,
      towerFlags: 0x2103,
      towerRooms: [1, 2, 3, 4, 5, 6],
      towerSave: {
        inProgress: true,
        mode: 2,
        nextOpponent: 6,
        seed: 0x12345678,
        partner: 4,
        partnerParty: {
          otId: 0x89abcdef,
          sets: [301, 302],
          pids: [0x11111111, 0x22222222],
          reserved: true,
        },
      },
    });
  });

  it('maps Factory, Hall, Castle, and Arcade records', () => {
    const native = nativeFrontier();
    const stats = native.soloAndActiveStats;

    native.factory.activeFlags = 1;
    stats.splice(
      10,
      8,
      49, 28, 7, 4,
      35, 21, 5, 3,
    );

    native.hall.activeFlags = 1;
    stats[34] = 30;
    stats[35] = 20;
    stats[36] = 403;
    stats[37] = 0x21;

    native.castle.activeFlags = 1;
    native.castle.heardIntro = true;
    stats.splice(
      70,
      8,
      49, 28, 12, 5, 15, 2, 3, 1,
    );
    native.castle.save.items[0] = 1;
    native.castle.save.status[0] = 0x40;

    native.arcade.activeFlags = 1;
    stats[94] = 49;
    stats[95] = 28;

    const converted =
      convertPlatinumFrontier(native);

    expect(converted.factory?.active).toEqual([
      true, false, false, false,
      false, false, false, false,
    ]);
    expect(converted.factory?.streaks[0]).toEqual({
      record: 49,
      latest: 28,
      recordTrades: 7,
      latestTrades: 4,
    });

    expect(converted.factory?.streaks[4]).toEqual({
      record: 35,
      latest: 21,
      recordTrades: 5,
      latestTrades: 3,
    });

    expect(converted.hall?.active).toEqual([
      true, false, false,
    ]);
    expect(converted.hall?.streaks[0]).toEqual({
      current: 30,
      latest: 20,
      species: 'platinum:SPECIES_SHINX',
    });
    expect(converted.hall?.ranks[0]?.slice(0, 2))
      .toEqual([1, 2]);

    expect(converted.castle?.active).toEqual([
      true, false, false,
    ]);
    expect(converted.castle?.heardIntro).toBe(true);
    expect(converted.castle?.streaks[0]).toEqual({
      record: 49,
      latest: 28,
      cp: 12,
      spentCp: 5,
      recordCp: 15,
    });
    expect(converted.castle?.ranks[0])
      .toEqual([2, 3, 1]);
    expect(converted.castle?.save.items[0])
      .toBe('platinum:ITEM_MASTER_BALL');
    expect(converted.castle?.save.status[0])
      .toBe('paralysis');

    expect(converted.arcade?.active).toEqual([
      true, false, false,
    ]);
    expect(converted.arcade?.streaks[0]).toEqual({
      record: 49,
      latest: 28,
    });
  });

  const savePath = process.env.OPENSINNOH_NDS_SAV;

  it.skipIf(!savePath)(
    'converts a real Platinum Battle Frontier block',
    () => {
      const converted = convertPlatinumFrontier(
        readPlatinumFrontier(
          readFileSync(savePath!),
        ),
      );

      console.dir(
        { convertedFrontier: converted },
        { depth: null },
      );

      expect(converted.bp)
        .toBeLessThanOrEqual(9999);
      expect(converted.towerRng)
        .toBeGreaterThan(0);
      expect(converted.towerRooms)
        .toHaveLength(6);
      expect(converted.towerStreaks)
        .toHaveLength(5);
    },
  );
});
