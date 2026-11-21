import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

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

const MIN_INT64 = -(1n << 63n);
const MAX_INT64 = (1n << 63n) - 1n;

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

function validateInteger(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Invalid Platinum ${name} ${value}`,
    );
  }
}

function validateDateTime(
  now: PlatinumRtcDateTime,
): void {
  validateInteger(
    'RTC year',
    now.year,
    2000,
    2099,
  );
  validateInteger(
    'RTC month',
    now.month,
    1,
    12,
  );
  validateInteger(
    'RTC day',
    now.day,
    1,
    31,
  );
  validateInteger(
    'RTC weekday',
    now.week,
    0,
    6,
  );
  validateInteger(
    'RTC hour',
    now.hour,
    0,
    23,
  );
  validateInteger(
    'RTC minute',
    now.minute,
    0,
    59,
  );
  validateInteger(
    'RTC second',
    now.second,
    0,
    59,
  );
}

function validateTimestamp(
  name: string,
  value: bigint,
): void {
  if (
    typeof value !== 'bigint' ||
    value < MIN_INT64 ||
    value > MAX_INT64
  ) {
    throw new Error(
      `Invalid Platinum ${name} ${String(value)}`,
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

export function writePlatinumSystemData(
  save: Uint8Array,
  system: PlatinumSystemData,
): Uint8Array {
  validateDateTime(system.now);
  validateInteger(
    'day number',
    system.dayNumber,
    0,
    0xffffffff,
  );
  validateTimestamp(
    'start timestamp',
    system.startTimestamp,
  );
  validateTimestamp(
    'first-completion timestamp',
    system.firstCompletionTimestamp,
  );
  validateInteger(
    'clock penalty',
    system.penaltyMinutes,
    0,
    1440,
  );

  if (
    typeof system.mysteryGiftUnlocked !==
    'boolean'
  ) {
    throw new Error(
      'Invalid Platinum Mystery Gift unlock value',
    );
  }

  return writePlatinumSave(
    save,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );
      const base = PLATINUM_SYSTEM_DATA_OFFSET;

      view.setUint32(
        base + GAME_TIME_CANARY_OFFSET,
        1,
        true,
      );
      view.setInt32(
        base + RTC_YEAR_OFFSET,
        system.now.year - 2000,
        true,
      );
      view.setInt32(
        base + RTC_MONTH_OFFSET,
        system.now.month - 1,
        true,
      );
      view.setInt32(
        base + RTC_DAY_OFFSET,
        system.now.day,
        true,
      );
      view.setInt32(
        base + RTC_WEEK_OFFSET,
        system.now.week,
        true,
      );
      view.setInt32(
        base + RTC_HOUR_OFFSET,
        system.now.hour,
        true,
      );
      view.setInt32(
        base + RTC_MINUTE_OFFSET,
        system.now.minute,
        true,
      );
      view.setInt32(
        base + RTC_SECOND_OFFSET,
        system.now.second,
        true,
      );
      view.setUint32(
        base + RTC_DAY_NUMBER_OFFSET,
        system.dayNumber,
        true,
      );
      view.setBigInt64(
        base + START_TIMESTAMP_OFFSET,
        system.startTimestamp,
        true,
      );
      view.setBigInt64(
        base +
          FIRST_COMPLETION_TIMESTAMP_OFFSET,
        system.firstCompletionTimestamp,
        true,
      );
      view.setUint32(
        base + PENALTY_MINUTES_OFFSET,
        system.penaltyMinutes,
        true,
      );
      view.setUint8(
        base + MYSTERY_GIFT_UNLOCKED_OFFSET,
        system.mysteryGiftUnlocked ? 1 : 0,
      );
    },
  );
}
