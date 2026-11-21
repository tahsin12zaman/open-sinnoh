import type { GameState } from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import {
  readPlatinumFieldState,
  type PlatinumLocation,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';

const NAMES = new Names(namesFile as NamesFile);

function zone(mapHeaderId: number): Id {
  if (
    mapHeaderId < 0 ||
    mapHeaderId >= NAMES.file.zones.length
  ) {
    throw new Error(
      `Unknown Platinum field-state map header ${mapHeaderId}`,
    );
  }

  return NAMES.zone(mapHeaderId);
}

function facing(
  direction: number,
): GameState['player']['facing'] {
  switch (direction) {
    case 0:
      return 'up';
    case 1:
      return 'down';
    case 2:
      return 'left';
    case 3:
      return 'right';
    default:
      throw new Error(
        `Unknown Platinum field-state facing direction ${direction}`,
      );
  }
}

function specialLocation(
  location: PlatinumLocation | null,
): GameState['specialLocation'] {
  if (location === null) return null;

  return {
    zone: zone(location.mapHeaderId),
    warp: location.warpId,
    x: location.x,
    z: location.z,
    facing: facing(location.faceDirection),
  };
}

export function applyPlatinumFieldState(
  state: GameState,
  save: Uint8Array,
): GameState {
  const native = readPlatinumFieldState(save);

  /*
   * Remove optional fields first so applying an unset native field
   * does not accidentally retain a value from the base state.
   */
  const base = { ...state };
  delete base.escapeLocation;
  delete base.safari;

  return {
    ...base,
    weather: NAMES.weather(native.weather),

    previousZone:
      native.previous === null
        ? null
        : zone(native.previous.mapHeaderId),

    specialLocation: specialLocation(
      native.special,
    ),

    ...(native.exit === null
      ? {}
      : {
          escapeLocation: {
            zone: zone(native.exit.mapHeaderId),
            x: native.exit.x,
            z: native.exit.z,
            facing: facing(
              native.exit.faceDirection,
            ),
          },
        }),

    /*
     * Zero balls and zero steps is the cleared/default state.
     * The native format does not record the last caught count here.
     */
    ...(native.safariBalls !== 0 ||
    native.safariSteps !== 0
      ? {
          safari: {
            balls: native.safariBalls,
            steps: native.safariSteps,
            caught: 0,
          },
        }
      : {}),
  };
}