import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_POKETCH_OFFSET = 0x1160;
export const PLATINUM_POKETCH_APP_COUNT = 25;
export const PLATINUM_POKETCH_REGISTRY_SIZE = 32;
export const PLATINUM_POKETCH_DOT_ART_SIZE = 120;
export const PLATINUM_POKETCH_MARKER_COUNT = 6;
export const PLATINUM_POKETCH_HISTORY_COUNT = 12;

const APP_COUNT_OFFSET = 0x01;
const APP_INDEX_OFFSET = 0x02;
const APP_REGISTRY_OFFSET = 0x03;
const STEP_COUNT_OFFSET = 0x24;
const ALARM_OFFSET = 0x28;
const DOT_ART_OFFSET = 0x2a;
const CALENDAR_BITMAP_OFFSET = 0xa4;
const CALENDAR_MONTH_OFFSET = 0xa8;
const MARKERS_OFFSET = 0xa9;
const HISTORY_OFFSET = 0xb8;
const HISTORY_ENTRY_SIZE = 8;
const POKETCH_SIZE = 0x118;

export interface PlatinumPoketchMarker {
  x: number;
  y: number;
}

export interface PlatinumPoketchHistoryEntry {
  species: number;
  icon: number;
  form: number;
}

export interface PlatinumPoketchData {
  enabled: boolean;
  pedometerEnabled: boolean;
  dotArtModified: boolean;
  color: number;
  appCount: number;
  currentApp: number | null;
  registeredApps: number[];
  steps: number;
  alarm: {
    on: boolean;
    hour: number;
    minute: number;
  };
  dotArt: Uint8Array;
  calendar: {
    month: number;
    marks: number;
  };
  markers: PlatinumPoketchMarker[];
  history: PlatinumPoketchHistoryEntry[];
}

export function readPlatinumPoketch(
  save: Uint8Array,
): PlatinumPoketchData {
  const { general } = selectPlatinumSaveBlocks(save);
  const offset =
    general.offset + PLATINUM_POKETCH_OFFSET;

  if (offset + POKETCH_SIZE > save.length) {
    throw new Error(
      'Platinum Pokétch data is truncated',
    );
  }

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  const settings = view.getUint8(offset);
  const appCount = view.getInt8(
    offset + APP_COUNT_OFFSET,
  );
  const appIndex = view.getInt8(
    offset + APP_INDEX_OFFSET,
  );

  const registeredApps: number[] = [];

  for (
    let app = 0;
    app < PLATINUM_POKETCH_APP_COUNT;
    app++
  ) {
    const registered = view.getUint8(
      offset + APP_REGISTRY_OFFSET + app,
    );

    if (registered !== 0 && registered !== 1) {
      throw new Error(
        `Invalid Platinum Pokétch app ${app} registration value ${registered}`,
      );
    }

    if (registered) {
      registeredApps.push(app);
    }
  }

  if (
    appCount < 0 ||
    appCount > PLATINUM_POKETCH_APP_COUNT
  ) {
    throw new Error(
      `Invalid Platinum Pokétch app count ${appCount}`,
    );
  }

  if (appCount !== registeredApps.length) {
    throw new Error(
      `Platinum Pokétch app count ${appCount} does not match ${registeredApps.length} registered apps`,
    );
  }

  const currentApp =
    appCount === 0 || appIndex < 0
      ? null
      : appIndex;

  if (
    currentApp !== null &&
    !registeredApps.includes(currentApp)
  ) {
    throw new Error(
      `Platinum Pokétch current app ${currentApp} is not registered`,
    );
  }

  const alarmValue = view.getUint16(
    offset + ALARM_OFFSET,
    true,
  );

  const alarm = {
    on: (alarmValue & 1) !== 0,
    hour: (alarmValue >> 1) & 0x1f,
    minute: (alarmValue >> 6) & 0x3f,
  };

  if (alarm.hour > 23 || alarm.minute > 59) {
    throw new Error(
      `Invalid Platinum Pokétch alarm ${alarm.hour}:${alarm.minute}`,
    );
  }

  const dotArt = save.slice(
    offset + DOT_ART_OFFSET,
    offset +
      DOT_ART_OFFSET +
      PLATINUM_POKETCH_DOT_ART_SIZE,
  );

  const markers = Array.from(
    { length: PLATINUM_POKETCH_MARKER_COUNT },
    (_, index) => ({
      x: view.getUint8(
        offset + MARKERS_OFFSET + index * 2,
      ),
      y: view.getUint8(
        offset + MARKERS_OFFSET + index * 2 + 1,
      ),
    }),
  );

  const history = Array.from(
    { length: PLATINUM_POKETCH_HISTORY_COUNT },
    (_, index): PlatinumPoketchHistoryEntry => {
      const entryOffset =
        offset +
        HISTORY_OFFSET +
        index * HISTORY_ENTRY_SIZE;

      return {
        species: view.getUint16(entryOffset, true),
        icon: view.getUint16(entryOffset + 2, true),
        form: view.getUint32(entryOffset + 4, true),
      };
    },
  ).filter((entry) => entry.species !== 0);

  return {
    enabled: (settings & 0x01) !== 0,
    pedometerEnabled: (settings & 0x02) !== 0,
    dotArtModified: (settings & 0x04) !== 0,
    color: (settings >> 3) & 0x07,
    appCount,
    currentApp,
    registeredApps,
    steps: view.getUint32(
      offset + STEP_COUNT_OFFSET,
      true,
    ),
    alarm,
    dotArt,
    calendar: {
      month: view.getUint8(
        offset + CALENDAR_MONTH_OFFSET,
      ),
      marks: view.getUint32(
        offset + CALENDAR_BITMAP_OFFSET,
        true,
      ),
    },
    markers,
    history,
  };
}