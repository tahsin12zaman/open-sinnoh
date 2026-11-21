import {
  POKETCH_APPS,
  poketchAppId,
  type GameState,
} from '@opensinnoh/contracts';
import {
  readPlatinumPoketch,
  type PlatinumPoketchData,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';

const NAMES = new Names(namesFile as NamesFile);

function appId(index: number) {
  const name = POKETCH_APPS[index];

  if (name === undefined) {
    throw new Error(
      `Unknown Platinum Pokétch app ${index}`,
    );
  }

  return poketchAppId('platinum', name);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(
    bytes,
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function convertPlatinumPoketch(
  native: PlatinumPoketchData,
): GameState['poketch'] {
  const apps = native.registeredApps.map(appId);

  const current =
    native.currentApp === null
      ? null
      : appId(native.currentApp);

  if (
    native.pedometerEnabled !==
    native.registeredApps.includes(3)
  ) {
    throw new Error(
      'Platinum Pokétch pedometer state disagrees with its registered apps',
    );
  }

  return {
    enabled: native.enabled,
    apps,
    current,
    color: native.color,
    steps: native.steps,
    alarm: {
      ...native.alarm,
    },
    calendar: {
      ...native.calendar,
    },
    markers: native.markers.map((marker) => ({
      ...marker,
    })),
    dotArt: native.dotArtModified
      ? bytesToHex(native.dotArt)
      : null,
    history: native.history.map((entry) => ({
      species: NAMES.species(entry.species),
      form: entry.form,
    })),
  };
}

export function applyPlatinumPoketch(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    poketch: convertPlatinumPoketch(
      readPlatinumPoketch(save),
    ),
  };
}