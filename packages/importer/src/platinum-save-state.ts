import type {
  GameState,
  Registries,
} from '@opensinnoh/contracts';
import { applyPlatinumBag } from './platinum-bag.ts';
import { applyPlatinumBerryPatches } from './platinum-berry-patches.ts';
import { applyPlatinumDaycare } from './platinum-daycare.ts';
import { applyPlatinumEasyChatWords } from './platinum-easy-chat-words.ts';
import { applyPlatinumFieldState } from './platinum-field-state.ts';
import { applyPlatinumFashionCase } from './platinum-fashion-case.ts';
import { applyPlatinumGameRecords } from './platinum-game-records.ts';
import { applyPlatinumHallOfFame } from './platinum-hall-of-fame.ts';
import { applyPlatinumJournal } from './platinum-journal.ts';
import { applyPlatinumImageClips } from './platinum-image-clips.ts';
import { applyPlatinumMapObjects } from './platinum-map-objects.ts';
import { applyPlatinumMiscData } from './platinum-misc.ts';
import { applyPlatinumMysteryGift } from './platinum-mystery-gift.ts';
import { applyPlatinumOptions } from './platinum-options.ts';
import { applyPlatinumParty } from './platinum-party.ts';
import { applyPlatinumPcBoxes } from './platinum-pc-boxes.ts';
import { applyPlatinumPlayerState } from './platinum-player-state.ts';
import { applyPlatinumPoffins } from './platinum-poffins.ts';
import { applyPlatinumPokedex } from './platinum-pokedex.ts';
import { applyPlatinumPoketch } from './platinum-poketch.ts';
import { applyPlatinumProgress } from './platinum-progress.ts';
import { applyPlatinumRoamers } from './platinum-roamers.ts';
import { applyPlatinumSave } from './platinum-save.ts';
import { applyPlatinumSealCase } from './platinum-seal-case.ts';
import { applyPlatinumSpecialEncounters } from './platinum-special-encounters.ts';
import { applyPlatinumSystemData } from './platinum-system-data.ts';
import { applyPlatinumTrainerCase } from './platinum-trainer-case.ts';
import { applyPlatinumUnderground } from './platinum-underground.ts';
import { applyPlatinumFrontier } from './platinum-frontier.ts';

export function importPlatinumSaveState(
  state: GameState,
  save: Uint8Array,
  registries: Registries,
): GameState {
  const withTrainerAndLocation = applyPlatinumSave(
    state,
    save,
  );

  const withOptions = applyPlatinumOptions(
    withTrainerAndLocation,
    save,
  );

  const withGameRecords = applyPlatinumGameRecords(
    withOptions,
    save,
  );

  const withTrainerCase = applyPlatinumTrainerCase(
    withGameRecords,
    save,
  );

  const withEasyChatWords = applyPlatinumEasyChatWords(
    withTrainerCase,
    save,
  );

  const withPoffins = applyPlatinumPoffins(
    withEasyChatWords,
    save,
  );

  const withFashionCase = applyPlatinumFashionCase(
    withPoffins,
    save,
  );

  const withMysteryGift = applyPlatinumMysteryGift(
    withFashionCase,
    save,
  );

  const withSealCase = applyPlatinumSealCase(
    withMysteryGift,
    save,
  );

  const withJournal = applyPlatinumJournal(
    withSealCase,
    save,
  );

  const withImageClips = applyPlatinumImageClips(
    withJournal,
    save,
  );

  const withUnderground = applyPlatinumUnderground(
    withImageClips,
    save,
  );

  const withFrontier = applyPlatinumFrontier(
    withUnderground,
    save,
  );

  const withSystemData = applyPlatinumSystemData(
    withFrontier,
    save,
  );

  const withFieldState = applyPlatinumFieldState(
    withSystemData,
    save,
  );

  const withParty = applyPlatinumParty(
    withFieldState,
    save,
  );

  const withProgress = applyPlatinumProgress(
    withParty,
    save,
    registries,
  );

  const withBag = applyPlatinumBag(
    withProgress,
    save,
  );

  const withPlayerState = applyPlatinumPlayerState(
    withBag,
    save,
  );

  const withPokedex = applyPlatinumPokedex(
    withPlayerState,
    save,
    registries,
  );

  const withPoketch = applyPlatinumPoketch(
    withPokedex,
    save,
  );

  const withBoxes = applyPlatinumPcBoxes(
    withPoketch,
    save,
    registries,
  );

  const withDaycare = applyPlatinumDaycare(
    withBoxes,
    save,
    registries,
  );

  const withObjects = applyPlatinumMapObjects(
    withDaycare,
    save,
  );

  const withBerries = applyPlatinumBerryPatches(
    withObjects,
    save,
  );

  const withMiscData = applyPlatinumMiscData(
    withBerries,
    save,
  );

  const withSpecialEncounters =
    applyPlatinumSpecialEncounters(
      withMiscData,
      save,
    );

  const withRoamers = applyPlatinumRoamers(
    withSpecialEncounters,
    save,
  );

  return applyPlatinumHallOfFame(
    withRoamers,
    save,
  );
}
