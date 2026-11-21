import {
  BERRY_STAGES,
  type BerryPatch,
  type GameState,
} from '@opensinnoh/contracts';
import {
  readPlatinumBerryPatches,
  type PlatinumBerryPatch,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';

const NAMES = new Names(namesFile as NamesFile);

const FIRST_BERRY_ITEM = 149;
const FIRST_MULCH_ITEM = 95;

export function convertPlatinumBerryPatch(
  native: PlatinumBerryPatch,
): BerryPatch {
  const stage = BERRY_STAGES[native.growthStage];

  if (stage === undefined) {
    throw new Error(
      `Unknown Platinum berry stage ${native.growthStage}`,
    );
  }

  return {
    berry:
      native.berryId === 0
        ? null
        : NAMES.item(
            FIRST_BERRY_ITEM +
              native.berryId -
              1,
          ),
    stage,
    stageMinutes:
      native.stageMinutesRemaining,
    moistureMinutes:
      native.moistureMinutesRemaining,
    replants: native.replantCount,
    yield: native.yield,
    moisture: native.moistureRating,
    yieldRating: native.yieldRating,
    mulch:
      native.mulchType === 0
        ? null
        : NAMES.item(
            FIRST_MULCH_ITEM +
              native.mulchType -
              1,
          ),
    growing: native.isGrowing,
  };
}

export function applyPlatinumBerryPatches(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    berryPatches: readPlatinumBerryPatches(
      save,
    ).map(convertPlatinumBerryPatch),
  };
}