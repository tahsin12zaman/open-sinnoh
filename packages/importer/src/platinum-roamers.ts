import type { GameState } from '@opensinnoh/contracts';
import type { Stats } from '@opensinnoh/core';
import {
  readPlatinumRoamers,
  type PlatinumRoamer,
  type PlatinumRoamerState,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';
import { platinumStatus } from './platinum-party.ts';

const NAMES = new Names(namesFile as NamesFile);

function platinumRoamerIvs(word: number): Stats {
  return {
    hp: word & 0x1f,
    attack: (word >>> 5) & 0x1f,
    defense: (word >>> 10) & 0x1f,
    speed: (word >>> 15) & 0x1f,
    spAttack: (word >>> 20) & 0x1f,
    spDefense: (word >>> 25) & 0x1f,
  };
}

function platinumRecentRoute(
  mapHeaderId: number,
): GameState['roamers']['current'] {
  if (mapHeaderId === 0) {
    return null;
  }

  return NAMES.zone(mapHeaderId);
}

export function convertPlatinumRoamer(
  native: PlatinumRoamer,
): GameState['roamers']['slots'][number] {
  if (!native.active) {
    return null;
  }

  return {
    species: NAMES.species(native.species),
    level: native.level,
    pid: native.personality,
    ivs: platinumRoamerIvs(native.ivs),
    hp: native.currentHp,
    status: platinumStatus(native.status),
  };
}

export function convertPlatinumRoamers(
  native: PlatinumRoamerState,
): GameState['roamers'] {
  return {
    slots: native.roamers.map(
      convertPlatinumRoamer,
    ),
    routes: [...native.routeIndexes],
    current: platinumRecentRoute(
      native.currentMapId,
    ),
    previous: platinumRecentRoute(
      native.previousMapId,
    ),
  };
}

export function applyPlatinumRoamers(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    roamers: convertPlatinumRoamers(
      readPlatinumRoamers(save),
    ),
  };
}
