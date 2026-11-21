import type {
  GameState,
  SavedOptions,
} from '@opensinnoh/contracts';
import {
  readPlatinumOptions,
  type PlatinumOptions,
} from '@opensinnoh/nds';

/**
 * Convert DS save options to OpenSinnoh saved options.
 *
 * Platinum text speed is intentionally not included because OpenSinnoh
 * treats it as a device option rather than part of GameState.
 */
export function convertPlatinumOptions(
  native: PlatinumOptions,
): SavedOptions {
  return {
    sound: native.soundMode,
    battleScene: native.battleScene,
    battleStyle: native.battleStyle,
    buttonMode: native.buttonMode,
    frame: native.frame,
  };
}

export function applyPlatinumOptions(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    options: convertPlatinumOptions(
      readPlatinumOptions(save),
    ),
  };
}
