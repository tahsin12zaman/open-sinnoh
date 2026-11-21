import {
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

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
      `Invalid Platinum Pokétch ${name} ${value}`,
    );
  }
}

function validateBoolean(
  name: string,
  value: boolean,
): void {
  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Platinum Pokétch ${name}`,
    );
  }
}

export function readPlatinumPoketch(
  save: Uint8Array,
): PlatinumPoketchData {
  const { general } =
    selectPlatinumSaveBlocks(save);
  const offset =
    general.offset +
    PLATINUM_POKETCH_OFFSET;

  if (
    offset + POKETCH_SIZE >
    save.length
  ) {
    throw new Error(
      'Platinum Pokétch data is truncated',
    );
  }

  const view = new DataView(
    save.buffer,
    save.byteOffset,
    save.byteLength,
  );

  const settings =
    view.getUint8(offset);

  const appCount =
    view.getInt8(
      offset + APP_COUNT_OFFSET,
    );

  const appIndex =
    view.getInt8(
      offset + APP_INDEX_OFFSET,
    );

  const registeredApps: number[] = [];

  for (
    let app = 0;
    app <
    PLATINUM_POKETCH_APP_COUNT;
    app++
  ) {
    const registered =
      view.getUint8(
        offset +
          APP_REGISTRY_OFFSET +
          app,
      );

    if (
      registered !== 0 &&
      registered !== 1
    ) {
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
    appCount >
      PLATINUM_POKETCH_APP_COUNT
  ) {
    throw new Error(
      `Invalid Platinum Pokétch app count ${appCount}`,
    );
  }

  if (
    appCount !==
    registeredApps.length
  ) {
    throw new Error(
      `Platinum Pokétch app count ${appCount} does not match ${registeredApps.length} registered apps`,
    );
  }

  const currentApp =
    appCount === 0 ||
    appIndex < 0
      ? null
      : appIndex;

  if (
    currentApp !== null &&
    !registeredApps.includes(
      currentApp,
    )
  ) {
    throw new Error(
      `Platinum Pokétch current app ${currentApp} is not registered`,
    );
  }

  const alarmValue =
    view.getUint16(
      offset + ALARM_OFFSET,
      true,
    );

  const alarm = {
    on:
      (alarmValue & 1) !== 0,
    hour:
      (alarmValue >> 1) &
      0x1f,
    minute:
      (alarmValue >> 6) &
      0x3f,
  };

  if (
    alarm.hour > 23 ||
    alarm.minute > 59
  ) {
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
    {
      length:
        PLATINUM_POKETCH_MARKER_COUNT,
    },
    (_, index) => ({
      x: view.getUint8(
        offset +
          MARKERS_OFFSET +
          index * 2,
      ),
      y: view.getUint8(
        offset +
          MARKERS_OFFSET +
          index * 2 +
          1,
      ),
    }),
  );

  const history = Array.from(
    {
      length:
        PLATINUM_POKETCH_HISTORY_COUNT,
    },
    (
      _,
      index,
    ): PlatinumPoketchHistoryEntry => {
      const entryOffset =
        offset +
        HISTORY_OFFSET +
        index *
          HISTORY_ENTRY_SIZE;

      return {
        species:
          view.getUint16(
            entryOffset,
            true,
          ),
        icon:
          view.getUint16(
            entryOffset + 2,
            true,
          ),
        form:
          view.getUint32(
            entryOffset + 4,
            true,
          ),
      };
    },
  ).filter(
    (entry) =>
      entry.species !== 0,
  );

  return {
    enabled:
      (settings & 0x01) !== 0,
    pedometerEnabled:
      (settings & 0x02) !== 0,
    dotArtModified:
      (settings & 0x04) !== 0,
    color:
      (settings >> 3) & 0x07,
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
      month:
        view.getUint8(
          offset +
            CALENDAR_MONTH_OFFSET,
        ),
      marks:
        view.getUint32(
          offset +
            CALENDAR_BITMAP_OFFSET,
          true,
        ),
    },
    markers,
    history,
  };
}

export function writePlatinumPoketch(
  save: Uint8Array,
  poketch: PlatinumPoketchData,
): Uint8Array {
  validateBoolean(
    'enabled flag',
    poketch.enabled,
  );
  validateBoolean(
    'pedometer flag',
    poketch.pedometerEnabled,
  );
  validateBoolean(
    'dot-art flag',
    poketch.dotArtModified,
  );
  validateInteger(
    'color',
    poketch.color,
    0,
    7,
  );

  if (
    poketch.registeredApps.length >
    PLATINUM_POKETCH_APP_COUNT
  ) {
    throw new Error(
      `Invalid Platinum Pokétch registered-app count ${poketch.registeredApps.length}`,
    );
  }

  const registeredApps =
    new Set<number>();

  for (
    const app of
      poketch.registeredApps
  ) {
    validateInteger(
      'registered app',
      app,
      0,
      PLATINUM_POKETCH_APP_COUNT - 1,
    );

    if (
      registeredApps.has(app)
    ) {
      throw new Error(
        `Duplicate Platinum Pokétch registered app ${app}`,
      );
    }

    registeredApps.add(app);
  }

  if (
    poketch.appCount !==
    registeredApps.size
  ) {
    throw new Error(
      `Platinum Pokétch app count ${poketch.appCount} does not match ${registeredApps.size} registered apps`,
    );
  }

  if (
    poketch.currentApp === null
  ) {
    if (poketch.appCount !== 0) {
      throw new Error(
        'Invalid Platinum Pokétch current app: null with registered apps',
      );
    }
  } else {
    validateInteger(
      'current app',
      poketch.currentApp,
      0,
      PLATINUM_POKETCH_APP_COUNT - 1,
    );

    if (
      !registeredApps.has(
        poketch.currentApp,
      )
    ) {
      throw new Error(
        `Platinum Pokétch current app ${poketch.currentApp} is not registered`,
      );
    }
  }

  validateInteger(
    'steps',
    poketch.steps,
    0,
    0xffffffff,
  );
  validateBoolean(
    'alarm flag',
    poketch.alarm.on,
  );
  validateInteger(
    'alarm hour',
    poketch.alarm.hour,
    0,
    23,
  );
  validateInteger(
    'alarm minute',
    poketch.alarm.minute,
    0,
    59,
  );

  if (
    !(
      poketch.dotArt
      instanceof Uint8Array
    ) ||
    poketch.dotArt.length !==
      PLATINUM_POKETCH_DOT_ART_SIZE
  ) {
    throw new Error(
      `Invalid Platinum Pokétch dot-art size ${poketch.dotArt.length}`,
    );
  }

  validateInteger(
    'calendar month',
    poketch.calendar.month,
    0,
    12,
  );
  validateInteger(
    'calendar marks',
    poketch.calendar.marks,
    0,
    0xffffffff,
  );

  if (
    poketch.markers.length !==
    PLATINUM_POKETCH_MARKER_COUNT
  ) {
    throw new Error(
      `Invalid Platinum Pokétch marker count ${poketch.markers.length}`,
    );
  }

  poketch.markers.forEach(
    (marker, index) => {
      validateInteger(
        `marker ${index} X`,
        marker.x,
        0,
        0xff,
      );
      validateInteger(
        `marker ${index} Y`,
        marker.y,
        0,
        0xff,
      );
    },
  );

  if (
    poketch.history.length >
    PLATINUM_POKETCH_HISTORY_COUNT
  ) {
    throw new Error(
      `Invalid Platinum Pokétch history count ${poketch.history.length}`,
    );
  }

  poketch.history.forEach(
    (entry, index) => {
      validateInteger(
        `history ${index} species`,
        entry.species,
        1,
        493,
      );
      validateInteger(
        `history ${index} icon`,
        entry.icon,
        0,
        0xffff,
      );
      validateInteger(
        `history ${index} form`,
        entry.form,
        0,
        0xffffffff,
      );
    },
  );

  return writePlatinumSave(
    save,
    ({ general }) => {
      const offset =
        PLATINUM_POKETCH_OFFSET;

      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      const oldSettings =
        view.getUint8(offset);

      const settings =
        (oldSettings & 0xc0) |
        (poketch.enabled
          ? 0x01
          : 0) |
        (poketch.pedometerEnabled
          ? 0x02
          : 0) |
        (poketch.dotArtModified
          ? 0x04
          : 0) |
        (poketch.color << 3);

      view.setUint8(
        offset,
        settings,
      );
      view.setInt8(
        offset +
          APP_COUNT_OFFSET,
        poketch.appCount,
      );
      view.setInt8(
        offset +
          APP_INDEX_OFFSET,
        poketch.currentApp ?? -1,
      );

      for (
        let app = 0;
        app <
        PLATINUM_POKETCH_APP_COUNT;
        app++
      ) {
        view.setUint8(
          offset +
            APP_REGISTRY_OFFSET +
            app,
          registeredApps.has(app)
            ? 1
            : 0,
        );
      }

      view.setUint32(
        offset +
          STEP_COUNT_OFFSET,
        poketch.steps,
        true,
      );

      const oldAlarm =
        view.getUint16(
          offset + ALARM_OFFSET,
          true,
        );

      const alarm =
        (oldAlarm & 0xf000) |
        (poketch.alarm.on
          ? 1
          : 0) |
        (poketch.alarm.hour << 1) |
        (poketch.alarm.minute << 6);

      view.setUint16(
        offset + ALARM_OFFSET,
        alarm,
        true,
      );

      general.set(
        poketch.dotArt,
        offset + DOT_ART_OFFSET,
      );

      view.setUint32(
        offset +
          CALENDAR_BITMAP_OFFSET,
        poketch.calendar.marks,
        true,
      );
      view.setUint8(
        offset +
          CALENDAR_MONTH_OFFSET,
        poketch.calendar.month,
      );

      poketch.markers.forEach(
        (marker, index) => {
          view.setUint8(
            offset +
              MARKERS_OFFSET +
              index * 2,
            marker.x,
          );
          view.setUint8(
            offset +
              MARKERS_OFFSET +
              index * 2 +
              1,
            marker.y,
          );
        },
      );

      general.fill(
        0,
        offset + HISTORY_OFFSET,
        offset +
          HISTORY_OFFSET +
          PLATINUM_POKETCH_HISTORY_COUNT *
            HISTORY_ENTRY_SIZE,
      );

      poketch.history.forEach(
        (entry, index) => {
          const entryOffset =
            offset +
            HISTORY_OFFSET +
            index *
              HISTORY_ENTRY_SIZE;

          view.setUint16(
            entryOffset,
            entry.species,
            true,
          );
          view.setUint16(
            entryOffset + 2,
            entry.icon,
            true,
          );
          view.setUint32(
            entryOffset + 4,
            entry.form,
            true,
          );
        },
      );
    },
  );
}
