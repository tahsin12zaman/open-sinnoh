import type {
  GameRecords,
  GameState,
} from '@opensinnoh/contracts';
import {
  PLATINUM_GAME_RECORD_COUNT,
  readPlatinumGameRecords,
  type PlatinumGameRecords,
} from '@opensinnoh/nds';

const RECORD_STEPS = 0;
const RECORD_TRAINER_SCORE = 1;
const RECORD_LOCAL_LINK_TRADES = 19;
const RECORD_OTHER_LOCAL_LINK_ACTIVITY = 20;
const RECORD_LOCAL_LINK_BATTLE_WINS = 21;
const RECORD_LOCAL_LINK_BATTLE_LOSSES = 22;
const RECORD_WIFI_TRADES = 24;
const RECORD_OTHER_WIFI_LINK_ACTIVITY = 25;
const RECORD_WIFI_BATTLE_WINS = 26;
const RECORD_WIFI_BATTLE_LOSSES = 27;
const RECORD_OTHER_LINK_ACTIVITY = 32;
const RECORD_LINK_CONTEST_PARTICIPATIONS = 91;

function record(
  records: readonly number[],
  id: number,
): number {
  return records[id] ?? 0;
}

/**
 * Convert native GameRecords into OpenSinnoh's record model.
 *
 * The Hall of Fame debut date is stored outside GameRecords, so the
 * existing imported value is preserved.
 */
export function convertPlatinumGameRecords(
  native: PlatinumGameRecords,
  hallOfFame: string | null,
): GameRecords {
  if (
    native.records.length !==
    PLATINUM_GAME_RECORD_COUNT
  ) {
    throw new Error(
      `Platinum GameRecords has ${native.records.length} records, expected ${PLATINUM_GAME_RECORD_COUNT}`,
    );
  }

  const counts: Record<string, number> = {};

  for (
    let id = 0;
    id < native.records.length;
    id++
  ) {
    if (id === RECORD_TRAINER_SCORE) {
      continue;
    }

    const value = native.records[id] ?? 0;

    if (value !== 0) {
      counts[id] = value;
    }
  }

  const timesLinked =
    record(
      native.records,
      RECORD_LINK_CONTEST_PARTICIPATIONS,
    ) +
    record(
      native.records,
      RECORD_LOCAL_LINK_TRADES,
    ) +
    record(
      native.records,
      RECORD_WIFI_TRADES,
    ) +
    record(
      native.records,
      RECORD_OTHER_LOCAL_LINK_ACTIVITY,
    ) +
    record(
      native.records,
      RECORD_OTHER_WIFI_LINK_ACTIVITY,
    ) +
    record(
      native.records,
      RECORD_OTHER_LINK_ACTIVITY,
    );

  return {
    score: record(
      native.records,
      RECORD_TRAINER_SCORE,
    ),
    hallOfFame,
    timesLinked,
    linkBattleWins:
      record(
        native.records,
        RECORD_LOCAL_LINK_BATTLE_WINS,
      ) +
      record(
        native.records,
        RECORD_WIFI_BATTLE_WINS,
      ),
    linkBattleLosses:
      record(
        native.records,
        RECORD_LOCAL_LINK_BATTLE_LOSSES,
      ) +
      record(
        native.records,
        RECORD_WIFI_BATTLE_LOSSES,
      ),
    linkTrades:
      record(
        native.records,
        RECORD_LOCAL_LINK_TRADES,
      ) +
      record(
        native.records,
        RECORD_WIFI_TRADES,
      ),
    counts,
  };
}

export function applyPlatinumGameRecords(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    records: convertPlatinumGameRecords(
      readPlatinumGameRecords(save),
      state.records?.hallOfFame ?? null,
    ),
  };
}

export { RECORD_STEPS };
