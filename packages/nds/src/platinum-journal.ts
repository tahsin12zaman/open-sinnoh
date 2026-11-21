import {
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';

export const PLATINUM_JOURNAL_OFFSET = 0x5720;
export const PLATINUM_JOURNAL_PAGE_SIZE = 0x70;
export const PLATINUM_JOURNAL_PAGE_COUNT = 10;
export const PLATINUM_JOURNAL_SIZE = 0x460;
export const PLATINUM_JOURNAL_ENTRY_SIZE =
  0x468;

const LOCATION_EVENT_COUNT = 4;
const LOCATION_EVENTS_OFFSET = 0x04;
const MON_OFFSET = 0x14;
const TRAINER_OFFSET = 0x18;
const MAX_LOCATION_EVENT_TYPE = 40;

export interface PlatinumJournalDate {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

export interface PlatinumJournalEvent {
  type: number;
  value: number;
  trainer: number;
}

export interface PlatinumJournalMon {
  result: 'caught' | 'defeated';
  variant: number;
  timeOfDay: number;
  gender: number;
  species: number;
}

export interface PlatinumJournalTrainer {
  standard: boolean;
  trainer: number;
  mapHeaderId: number;
}

export interface PlatinumJournalPage {
  date: PlatinumJournalDate;
  mapHeaderId: number;
  events: PlatinumJournalEvent[];
  mon: PlatinumJournalMon | null;
  trainer: PlatinumJournalTrainer | null;
}

export interface PlatinumJournal {
  pages: PlatinumJournalPage[];
}

function decodeDate(
  title: number,
  page: number,
): PlatinumJournalDate {
  const date = {
    year: title & 0x7f,
    month: (title >>> 7) & 0xf,
    weekday: (title >>> 11) & 0x7,
    day: (title >>> 14) & 0x1f,
  };

  if (
    date.month < 1 ||
    date.month > 12 ||
    date.day < 1 ||
    date.day > 31 ||
    date.weekday > 6
  ) {
    throw new Error(
      `Invalid Platinum Journal date on page ${page}: year ${date.year}, month ${date.month}, day ${date.day}, weekday ${date.weekday}`,
    );
  }

  return date;
}

export function decodePlatinumJournal(
  bytes: Uint8Array,
): PlatinumJournal {
  if (
    bytes.byteLength <
    PLATINUM_JOURNAL_ENTRY_SIZE
  ) {
    throw new Error(
      `Truncated Platinum Journal entry: ${bytes.byteLength} bytes, expected ${PLATINUM_JOURNAL_ENTRY_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const pages: PlatinumJournalPage[] = [];

  for (
    let page = 0;
    page < PLATINUM_JOURNAL_PAGE_COUNT;
    page++
  ) {
    const offset =
      page * PLATINUM_JOURNAL_PAGE_SIZE;
    const title = view.getUint32(offset, true);

    if (title === 0) {
      continue;
    }

    const events: PlatinumJournalEvent[] = [];

    for (
      let event = 0;
      event < LOCATION_EVENT_COUNT;
      event++
    ) {
      const packed = view.getUint32(
        offset +
          LOCATION_EVENTS_OFFSET +
          event * 4,
        true,
      );

      const type = packed & 0x3f;

      if (type === 0) {
        continue;
      }

      if (type > MAX_LOCATION_EVENT_TYPE) {
        throw new Error(
          `Invalid Platinum Journal event type ${type} on page ${page}, slot ${event}`,
        );
      }

      events.push({
        type,
        trainer: (packed >>> 6) & 0x3ff,
        value: packed >>> 16,
      });
    }

    const battleResult = view.getUint8(
      offset + MON_OFFSET,
    );

    let mon: PlatinumJournalMon | null = null;

    if (battleResult !== 0) {
      if (
        battleResult !== 1 &&
        battleResult !== 2
      ) {
        throw new Error(
          `Invalid Platinum Journal Pokémon result ${battleResult} on page ${page}`,
        );
      }

      const attributes = view.getUint8(
        offset + MON_OFFSET + 1,
      );

      const variant = attributes & 0x3;
      const gender = (attributes >>> 6) & 0x3;

      if (variant > 2) {
        throw new Error(
          `Invalid Platinum Journal Pokémon variant ${variant} on page ${page}`,
        );
      }

      if (gender > 2) {
        throw new Error(
          `Invalid Platinum Journal Pokémon gender ${gender} on page ${page}`,
        );
      }

      mon = {
        result:
          battleResult === 1
            ? 'caught'
            : 'defeated',
        variant,
        timeOfDay:
          (attributes >>> 2) & 0xf,
        gender,
        species: view.getUint16(
          offset + MON_OFFSET + 2,
          true,
        ),
      };
    }

    const packedTrainer = view.getUint16(
      offset + TRAINER_OFFSET,
      true,
    );

    const standard =
      (packedTrainer & 1) !== 0;

    const trainer = standard
      ? {
          standard,
          trainer: packedTrainer >>> 1,
          mapHeaderId: view.getUint16(
            offset + TRAINER_OFFSET + 2,
            true,
          ),
        }
      : null;

    pages.push({
      date: decodeDate(title, page),
      mapHeaderId: title >>> 19,
      events,
      mon,
      trainer,
    });
  }

  return { pages };
}

export function readPlatinumJournal(
  bytes: Uint8Array,
): PlatinumJournal {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset + PLATINUM_JOURNAL_OFFSET;

  return decodePlatinumJournal(
    bytes.subarray(
      start,
      start + PLATINUM_JOURNAL_ENTRY_SIZE,
    ),
  );
}
