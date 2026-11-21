import type { GameState } from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import {
  readPlatinumPlayerState,
  type PlatinumPlayerState,
} from '@opensinnoh/nds';

const BADGE_IDS: readonly Id[] = [
  'platinum:BADGE_ID_COAL',
  'platinum:BADGE_ID_FOREST',
  'platinum:BADGE_ID_COBBLE',
  'platinum:BADGE_ID_FEN',
  'platinum:BADGE_ID_RELIC',
  'platinum:BADGE_ID_MINE',
  'platinum:BADGE_ID_ICICLE',
  'platinum:BADGE_ID_BEACON',
];

function convertMovementState(
  state: number,
): GameState['playerState'] {
  switch (state) {
    case 0:
      return 'walk';
    case 1:
      return 'cycle';
    case 2:
      return 'surf';
    default:
      throw new Error(
        `Unsupported Platinum player state ${state}`,
      );
  }
}

export function convertPlatinumPlayerState(
  native: PlatinumPlayerState,
): Pick<
  GameState,
  | 'badges'
  | 'cyclingGear'
  | 'runningShoes'
  | 'playerState'
> {
  return {
    badges: BADGE_IDS.filter(
      (_, index) => native.badgeBits & (1 << index),
    ),
    cyclingGear: native.cyclingGear as 0 | 1,
    runningShoes: native.runningShoes,
    playerState: convertMovementState(native.playerState),
  };
}

export function applyPlatinumPlayerState(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    ...convertPlatinumPlayerState(
      readPlatinumPlayerState(save),
    ),
  };
}