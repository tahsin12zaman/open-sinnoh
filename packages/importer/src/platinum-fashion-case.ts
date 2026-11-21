import type {
  FashionCase,
  GameState,
} from '@opensinnoh/contracts';
import {
  readPlatinumFashionCase,
  type PlatinumFashionCase,
} from '@opensinnoh/nds';

export function convertPlatinumFashionCase(
  native: PlatinumFashionCase,
): FashionCase {
  return {
    accessories: [...native.accessories],
    backdrops: [...native.backdrops],
  };
}

export function applyPlatinumFashionCase(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    fashionCase: convertPlatinumFashionCase(
      readPlatinumFashionCase(save),
    ),
  };
}
