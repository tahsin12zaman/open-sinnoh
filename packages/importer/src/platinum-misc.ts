import type { GameState } from '@opensinnoh/contracts';
import {
  readPlatinumMiscData,
  type PlatinumMiscData,
} from '@opensinnoh/nds';
import { decodePlatinumName } from './platinum-save.ts';

export function convertPlatinumTabletName(
  codes: readonly number[],
): string | undefined {
  const name = decodePlatinumName(codes);

  return name.length > 0 ? name : undefined;
}

export function applyPlatinumMiscDataValue(
  state: GameState,
  native: PlatinumMiscData,
): GameState {
  const tabletName = convertPlatinumTabletName(
    native.tabletNameCodes,
  );

  return {
    ...state,

    /*
     * ID 0 means the DS has no active persisted dynamic feature.
     * Other feature IDs will be decoded with their saved map
     * objects in the next checkpoint.
     */
    ...(native.mapFeatures.id === 0
      ? { mapFeatures: null }
      : {}),

    tabletName,
  };
}

export function applyPlatinumMiscData(
  state: GameState,
  save: Uint8Array,
): GameState {
  return applyPlatinumMiscDataValue(
    state,
    readPlatinumMiscData(save),
  );
}