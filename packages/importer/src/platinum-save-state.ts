import type { GameState } from '@opensinnoh/contracts';
import { applyPlatinumParty } from './platinum-party.ts';
import { applyPlatinumSave } from './platinum-save.ts';

/**
 * Applies every currently supported native Platinum save field to an
 * already valid OpenSinnoh state.
 *
 * Unsupported fields remain at the defaults provided by newGameState().
 */
export function importPlatinumSaveState(
  state: GameState,
  save: Uint8Array,
): GameState {
  const withTrainerAndLocation = applyPlatinumSave(
    state,
    save,
  );

  return applyPlatinumParty(
    withTrainerAndLocation,
    save,
  );
}