import type {
  ArcadeState,
  CastleState,
  FactoryState,
  FrontierState,
  GameState,
  HallState,
} from '@opensinnoh/contracts';
import {
  readPlatinumFrontier,
  readPlatinumHallWinRecords,
  type PlatinumFrontier,
  type PlatinumHallWinRecords,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';
import { platinumStatus } from './platinum-party.ts';

const NAMES = new Names(namesFile as NamesFile);

const FACTORY_STATS = 10;
const HALL_STATS = 34;
const CASTLE_STATS = 70;
const ARCADE_STATS = 94;

function flag(byte: number, bit: number): boolean {
  return ((byte >> bit) & 1) !== 0;
}

function anyNonzero(
  values: readonly number[],
): boolean {
  return values.some((value) => value !== 0);
}

type SharedSaveOwner =
  | 'hall'
  | 'castle'
  | 'arcade'
  | null;

function sharedSaveOwner(
  native: PlatinumFrontier,
): SharedSaveOwner {
  if (!native.hall.save.saved) return null;

  const challengeType =
    native.hall.save.challengeType;

  if (challengeType >= 3) return null;

  const candidates: Exclude<
    SharedSaveOwner,
    null
  >[] = [];

  if (
    flag(
      native.hall.activeFlags,
      challengeType,
    )
  ) {
    candidates.push('hall');
  }

  const castlePlausible =
    native.castle.save.pp
      .flat()
      .every((pp) => pp <= 64);

  if (
    castlePlausible &&
    flag(
      native.castle.activeFlags,
      challengeType,
    )
  ) {
    candidates.push('castle');
  }

  const arcadePlausible =
    native.arcade.save.speed <= 3;

  if (
    arcadePlausible &&
    flag(
      native.arcade.activeFlags,
      challengeType,
    )
  ) {
    candidates.push('arcade');
  }

  return candidates.length === 1
    ? candidates[0]!
    : null;
}

function convertFactory(
  native: PlatinumFrontier,
): FactoryState | undefined {
  const stats = native.soloAndActiveStats;
  const active = Array.from(
    { length: 8 },
    (_, index) =>
      flag(native.factory.activeFlags, index),
  );

  const streaks: FactoryState['streaks'] =
    Array.from({ length: 8 }, () => ({
      record: 0,
      latest: 0,
      recordTrades: 0,
      latestTrades: 0,
    }));

  for (let challengeType = 0; challengeType < 3; challengeType++) {
    const base =
      FACTORY_STATS + challengeType * 8;

    streaks[challengeType] = {
      record: stats[base]!,
      latest: stats[base + 1]!,
      recordTrades: stats[base + 2]!,
      latestTrades: stats[base + 3]!,
    };

    streaks[4 + challengeType] = {
      record: stats[base + 4]!,
      latest: stats[base + 5]!,
      recordTrades: stats[base + 6]!,
      latestTrades: stats[base + 7]!,
    };
  }

  const save = native.factory.save;
  const saveActive =
    save.challengeType < 4 &&
    flag(
      native.factory.activeFlags,
      (save.openLevel ? 4 : 0) +
        save.challengeType,
    );

  const used =
    anyNonzero(stats.slice(10, 34)) ||
    native.factory.activeFlags !== 0 ||
    save.saved;

  if (!used) return undefined;

  return {
    active,
    streaks,
    save: {
      saved: save.saved && saveActive,
      challengeType: save.challengeType,
      openLevel: save.openLevel,
      battle: save.battle,
      trainers: [...save.trainers],
      player: save.player.map((pokemon) => ({
        ...pokemon,
      })),
      opponent: save.opponent.map((pokemon) => ({
        ...pokemon,
      })),
    },
  };
}

function hallRanks(
  stats: readonly number[],
  base: number,
): number[] {
  return Array.from(
    { length: 18 },
    (_, type) => {
      const packed =
        stats[base + Math.floor(type / 2)]!;

      return (
        packed >>
        (4 * (type % 2))
      ) & 0x0f;
    },
  );
}

function convertHallRecords(
  native:
    | PlatinumHallWinRecords
    | undefined,
): HallState['records'] {
  return Array.from(
    { length: 3 },
    (_, challengeType) => {
      const converted:
        HallState['records'][number] = {};
      const records =
        native?.records[challengeType];

      if (!records) return converted;

      // 1–493 are actual Pokémon. Index 0 is none;
      // 494 is the Egg entry.
      for (
        let species = 1;
        species <= 493;
        species++
      ) {
        const streak = records[species] ?? 0;

        if (streak !== 0) {
          converted[NAMES.species(species)] =
            streak;
        }
      }

      return converted;
    },
  );
}

function convertHall(
  native: PlatinumFrontier,
  winRecords:
    | PlatinumHallWinRecords
    | undefined,
  owner: SharedSaveOwner,
): HallState | undefined {
  const stats = native.soloAndActiveStats;
  const active = Array.from(
    { length: 3 },
    (_, index) =>
      flag(native.hall.activeFlags, index),
  );

  const streaks: HallState['streaks'] = [];
  const ranks: number[][] = [];

  for (let challengeType = 0; challengeType < 3; challengeType++) {
    const base =
      HALL_STATS + challengeType * 12;
    const species = stats[base + 2]!;

    streaks.push({
      current: stats[base]!,
      latest: stats[base + 1]!,
      species:
        species === 0
          ? null
          : NAMES.species(species),
    });

    ranks.push(
      hallRanks(stats, base + 3),
    );
  }

  const save = native.hall.save;
  const saveActive = flag(
    native.hall.activeFlags,
    save.challengeType,
  );

  const used =
    anyNonzero(stats.slice(34, 70)) ||
    native.hall.activeFlags !== 0 ||
    (save.saved && saveActive);

  if (!used) return undefined;

  return {
    active,
    streaks,
    ranks,
    save: {
      saved:
        save.saved &&
        saveActive &&
        owner === 'hall',
      challengeType: save.challengeType,
      battle: save.battle,
      slots: [...save.slots],
      trainers: [...save.trainers],
      opponents: [...save.opponents],
    },
    records: convertHallRecords(winRecords),
  };
}

function convertCastle(
  native: PlatinumFrontier,
  owner: SharedSaveOwner,
): CastleState | undefined {
  const stats = native.soloAndActiveStats;
  const active = Array.from(
    { length: 3 },
    (_, index) =>
      flag(native.castle.activeFlags, index),
  );

  const streaks: CastleState['streaks'] = [];
  const ranks: number[][] = [];

  for (let challengeType = 0; challengeType < 3; challengeType++) {
    const base =
      CASTLE_STATS + challengeType * 8;

    streaks.push({
      record: stats[base]!,
      latest: stats[base + 1]!,
      cp: stats[base + 2]!,
      spentCp: stats[base + 3]!,
      recordCp: stats[base + 4]!,
    });

    ranks.push([
      stats[base + 5]!,
      stats[base + 6]!,
      stats[base + 7]!,
    ]);
  }

  const save = native.castle.save;
  const saveActive = flag(
    native.castle.activeFlags,
    save.challengeType,
  );

  const used =
    anyNonzero(stats.slice(70, 94)) ||
    native.castle.activeFlags !== 0 ||
    native.castle.heardIntro ||
    (save.saved && saveActive);

  if (!used) return undefined;

  return {
    active,
    heardIntro: native.castle.heardIntro,
    streaks,
    ranks,
    save: {
      saved:
        save.saved &&
        saveActive &&
        owner === 'castle',
      challengeType: save.challengeType,
      battle: save.battle,
      slots: [...save.slots],
      trainers: [...save.trainers],
      hp: [...save.hp],
      pp: save.pp.map((moves) => [...moves]),
      status: save.status.map(platinumStatus),
      items: save.items.map((item) =>
        item === 0 ? null : NAMES.item(item),
      ),
      sets: [...save.sets],
    },
  };
}

function convertArcade(
  native: PlatinumFrontier,
  owner: SharedSaveOwner,
): ArcadeState | undefined {
  const stats = native.soloAndActiveStats;
  const active = Array.from(
    { length: 3 },
    (_, index) =>
      flag(native.arcade.activeFlags, index),
  );

  const streaks: ArcadeState['streaks'] =
    Array.from(
      { length: 3 },
      (_, challengeType) => {
        const base =
          ARCADE_STATS + challengeType * 2;

        return {
          record: stats[base]!,
          latest: stats[base + 1]!,
        };
      },
    );

  const save = native.arcade.save;
  const saveActive = flag(
    native.arcade.activeFlags,
    save.challengeType,
  );

  const used =
    anyNonzero(stats.slice(94, 100)) ||
    native.arcade.activeFlags !== 0 ||
    (save.saved && saveActive);

  if (!used) return undefined;

  return {
    active,
    streaks,
    save: {
      saved:
        save.saved &&
        saveActive &&
        owner === 'arcade',
      challengeType: save.challengeType,
      battle: save.battle,
      speed: save.speed,
      randomCursor: save.randomCursor,
      slots: [...save.slots],
      items: save.items.map((item) =>
        item === 0 ? null : NAMES.item(item),
      ),
      trainers: [...save.trainers],
      sets: [...save.sets],
    },
  };
}

export function convertPlatinumFrontier(
  native: PlatinumFrontier,
  hallWinRecords?:
    PlatinumHallWinRecords,
): FrontierState {
  const stats = native.soloAndActiveStats;
  const partner = native.tower.save.partnerParty;

  const hasPartnerParty =
    native.tower.save.inProgress &&
    (native.tower.save.reserved ||
    partner.otId !== 0 ||
    anyNonzero(partner.sets) ||
    anyNonzero(partner.pids));

  const frontier: FrontierState = {
    bp: native.tower.bp,
    towerRng: native.tower.rng,
    towerFlags: native.tower.flags,
    towerRooms: [...native.tower.rooms],
    towerStreaks: Array.from(
      { length: 5 },
      (_, mode) => ({
        record: stats[mode * 2]!,
        latest: stats[mode * 2 + 1]!,
      }),
    ),
    towerSave: {
      inProgress:
        native.tower.save.inProgress,
      mode: native.tower.save.mode,
      nextOpponent:
        native.tower.save.nextOpponent,
      slots: [...native.tower.save.slots],
      trainers: [
        ...native.tower.save.trainers,
      ],
      seed: native.tower.save.seed,
      partner: native.tower.save.partner,
      ...(hasPartnerParty
        ? {
            partnerParty: {
              otId: partner.otId,
              sets: [...partner.sets],
              pids: [...partner.pids],
              reserved:
                native.tower.save.reserved,
            },
          }
        : {}),
    },
  };

  const owner = sharedSaveOwner(native);
  const factory = convertFactory(native);
  const hall = convertHall(
    native,
    hallWinRecords,
    owner,
  );
  const castle = convertCastle(
    native,
    owner,
  );
  const arcade = convertArcade(
    native,
    owner,
  );

  if (factory) frontier.factory = factory;
  if (hall) frontier.hall = hall;
  if (castle) frontier.castle = castle;
  if (arcade) frontier.arcade = arcade;

  return frontier;
}

export function applyPlatinumFrontier(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    frontier: convertPlatinumFrontier(
      readPlatinumFrontier(save),
      readPlatinumHallWinRecords(save),
    ),
  };
}
