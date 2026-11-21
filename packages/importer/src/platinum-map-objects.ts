import type { GameState } from '@opensinnoh/contracts';
import {
  PLATINUM_MAP_OBJECT_PASS_THROUGH,
  readPlatinumMapObjects,
  type PlatinumMapObject,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';

const NAMES = new Names(namesFile as NamesFile);
const PLAYER_OBJECT_LOCAL_ID = 0xff;

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
        `Unknown Platinum map-object facing direction ${direction}`,
      );
  }
}

function convertObject(
  object: PlatinumMapObject,
): GameState['objects'][number] {
  if (
    object.mapHeaderId < 0 ||
    object.mapHeaderId >= NAMES.file.zones.length
  ) {
    throw new Error(
      `Unknown Platinum map-object map header ${object.mapHeaderId}`,
    );
  }

  return {
    zone: NAMES.zone(object.mapHeaderId),
    localId: object.localId,
    x: object.position.x,
    y: object.position.y,
    z: object.position.z,
    facing: facing(object.facingDirection),
    movementType: object.movementType,
    ...(object.status &
    PLATINUM_MAP_OBJECT_PASS_THROUGH
      ? { passThrough: true }
      : {}),
  };
}

export function applyPlatinumMapObjects(
  state: GameState,
  save: Uint8Array,
): GameState {
  const objects = readPlatinumMapObjects(save)
    .filter(
      (object) =>
        object.localId !== PLAYER_OBJECT_LOCAL_ID,
    )
    .map(convertObject);

  return {
    ...state,
    objects,
  };
}