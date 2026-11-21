import type { GameState } from '@opensinnoh/contracts';
import { readPlatinumEasyChatWords } from '@opensinnoh/nds';

export function applyPlatinumEasyChatWords(
  state: GameState,
  save: Uint8Array,
): GameState {
  const words =
    readPlatinumEasyChatWords(save);

  return {
    ...state,
    unlockedToughWords:
      words.unlockedToughWordBits,
  };
}
