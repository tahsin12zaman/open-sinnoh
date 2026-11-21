import type {
  GameState,
  SealCase,
} from '@opensinnoh/contracts';
import {
  type PlatinumSealCase,
  readPlatinumSealCase,
} from '@opensinnoh/nds';

export function convertPlatinumSealCase(
  raw: PlatinumSealCase,
): SealCase {
  return {
    counts: [...raw.counts],
    capsules: raw.capsules.map((capsule) =>
      capsule.map((seal) => ({ ...seal })),
    ),
  };
}

export function applyPlatinumSealCase(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    sealCase: convertPlatinumSealCase(
      readPlatinumSealCase(save),
    ),
  };
}
