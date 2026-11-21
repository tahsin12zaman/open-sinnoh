import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_SYSTEM_DATA_OFFSET = 0x00;
export const PLATINUM_SYSTEM_DATA_SIZE = 0x5c;

const GAME_TIME_CANARY_OFFSET = 0x10;
const RTC_YEAR_OFFSET = 0x14;
const RTC_MONTH_OFFSET = 0x18;
const RTC_DAY_OFFSET = 0x1c;
const RTC_WEEK_OFFSET = 0x20;
const RTC_HOUR_OFFSET = 0x24;
const RTC_MINUTE_OFFSET = 0x28;
const RTC_SECOND_OFFSET = 0x2c;
const RTC_DAY_NUMBER_OFFSET = 0x30;
const START_TIMESTAMP_OFFSET = 0x34;
const FIRST_COMPLETION_TIMESTAMP_OFFSET = 0x3c;
const PENALTY_MINUTES_OFFSET = 0x44;
const MYSTERY_GIFT_UNLOCKED_OFFSET = 0x48;

export interface PlatinumRtcDateTime {
  /** Full year, converted from the RTC's years-since-2000 value. */
  year: number;
  /** Calendar month, 1–12. */
  month: number;
  day: number;
  week: number;
  hour: number;
  minute: number;
  second: number;
}

export interface PlatinumSystemData {
  now: PlatinumRtcDateTime;
  dayNumber: number;
  startTimestamp: bigint;
  firstCompletionTimestamp: bigint;
  penaltyMinutes: number;
  mysteryGiftUnlocked: boolean;
}

function validateDateTime(
  now: PlatinumRtcDateTime,
): void {
  if (now.year < 2000 || now.year > 2099) {
    throw new Error(
      `Invalid Platinum RTC year ${now.year}`,
    );
  }

  if (now.month < 1 || now.month > 12) {
    throw new Error(
      `Invalid Platinum RTC month ${now.month}`,
    );
  }

  if (now.day < 1 || now.day > 31) {
    throw new Error(
      `Invalid Platinum RTC day ${now.day}`,
    );
  }

  if (now.week < 0 || now.week > 6) {
    throw new Error(
      `Invalid Platinum RTC weekday ${now.week}`,
    );
  }

  if (now.hour < 0 || now.hour > 23) {
    throw new Error(
      `Invalid Platinum RTC hour ${now.hour}`,
    );
  }

  if (now.minute < 0 || now.minute > 59) {
    throw new Error(
      `Invalid Platinum RTC minute ${now.minute}`,
    );
  }

  if (now.second < 0 || now.second > 59) {
    throw new Error(
      `Invalid Platinum RTC second ${now.second}`,
    );
  }
}

export function readPlatinumSystemData(
  save: Uint8Array,
): PlatinumSystemData {
  const { general } = selectPlatinumSaveBlocks(save);

  const offset =
    general.offset + PLATINUM_SYSTEM_DATA_OFFSET;

  if (
    offset < 0 ||
    offset + PLATINUM_SYSTEM_DATA_SIZE >
      save.length
  ) {
    throw new Error(
      'Platinum SystemData is outside the file',
    );
  }

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  const canary = view.getUint32(
    offset + GAME_TIME_CANARY_OFFSET,
    true,
  );

  if (canary !== 1) {
    throw new Error(
      `Invalid Platinum GameTime canary ${canary}`,
    );
  }

  const now: PlatinumRtcDateTime = {
    year:
      2000 +
      view.getInt32(
        offset + RTC_YEAR_OFFSET,
        true,
      ),
    month:
      1 +
      view.getInt32(
        offset + RTC_MONTH_OFFSET,
        true,
      ),
    day: view.getInt32(
      offset + RTC_DAY_OFFSET,
      true,
    ),
    week: view.getInt32(
      offset + RTC_WEEK_OFFSET,
      true,
    ),
    hour: view.getInt32(
      offset + RTC_HOUR_OFFSET,
      true,
    ),
    minute: view.getInt32(
      offset + RTC_MINUTE_OFFSET,
      true,
    ),
    second: view.getInt32(
      offset + RTC_SECOND_OFFSET,
      true,
    ),
  };

  validateDateTime(now);

  const penaltyMinutes = view.getUint32(
    offset + PENALTY_MINUTES_OFFSET,
    true,
  );

  if (penaltyMinutes > 1440) {
    throw new Error(
      `Invalid Platinum clock penalty ${penaltyMinutes}`,
    );
  }

  return {
    now,
    dayNumber: view.getUint32(
      offset + RTC_DAY_NUMBER_OFFSET,
      true,
    ),
    startTimestamp: view.getBigInt64(
      offset + START_TIMESTAMP_OFFSET,
      true,
    ),
    firstCompletionTimestamp:
      view.getBigInt64(
        offset +
          FIRST_COMPLETION_TIMESTAMP_OFFSET,
        true,
      ),
    penaltyMinutes,
    mysteryGiftUnlocked:
      view.getUint8(
        offset + MYSTERY_GIFT_UNLOCKED_OFFSET,
      ) !== 0,
  };
}