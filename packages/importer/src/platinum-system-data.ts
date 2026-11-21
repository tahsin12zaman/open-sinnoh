import type { GameState } from '@opensinnoh/contracts';
import {
  readPlatinumSystemData,
  type PlatinumRtcDateTime,
  type PlatinumSystemData,
} from '@opensinnoh/nds';

const RTC_EPOCH_MILLISECONDS =
  Date.UTC(2000, 0, 1);

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function platinumDate(
  value: Pick<
    PlatinumRtcDateTime,
    'year' | 'month' | 'day'
  >,
): string {
  return [
    value.year.toString().padStart(4, '0'),
    pad2(value.month),
    pad2(value.day),
  ].join('-');
}

/**
 * Nintendo RTC timestamps count seconds from 2000-01-01 00:00:00.
 */
export function platinumRtcTimestampDate(
  seconds: bigint,
): string | null {
  if (seconds <= 0n) {
    return null;
  }

  const numericSeconds = Number(seconds);

  if (!Number.isSafeInteger(numericSeconds)) {
    throw new Error(
      `Platinum RTC timestamp ${seconds} is outside the safe integer range`,
    );
  }

  const date = new Date(
    RTC_EPOCH_MILLISECONDS +
      numericSeconds * 1000,
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `Invalid Platinum RTC timestamp ${seconds}`,
    );
  }

  return date.toISOString().slice(0, 10);
}

export function applyPlatinumSystemDataValue(
  state: GameState,
  native: PlatinumSystemData,
): GameState {
  return {
    ...state,

    gameTime: {
      ...state.gameTime,
      now: {
        date: platinumDate(native.now),
        hour: native.now.hour,
        minute: native.now.minute,
        second: native.now.second,
      },
      penaltyMinutes: native.penaltyMinutes,
    },

    startDate: platinumRtcTimestampDate(
      native.startTimestamp,
    ),
  };
}

export function applyPlatinumSystemData(
  state: GameState,
  save: Uint8Array,
): GameState {
  return applyPlatinumSystemDataValue(
    state,
    readPlatinumSystemData(save),
  );
}