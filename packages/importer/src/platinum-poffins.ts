import type {
  GameState,
  Poffin,
} from '@opensinnoh/contracts';
import {
  readPlatinumPoffinCase,
  type PlatinumPoffin,
} from '@opensinnoh/nds';

export function convertPlatinumPoffin(
  native: PlatinumPoffin,
): Poffin {
  return {
    type: native.type,
    flavors: [...native.flavors],
    smoothness: native.smoothness,
  };
}

export function applyPlatinumPoffins(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    poffins: readPlatinumPoffinCase(
      save,
    ).map(convertPlatinumPoffin),
  };
}
