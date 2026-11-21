import type {
  GameState,
  JournalPage,
} from '@opensinnoh/contracts';
import {
  type PlatinumJournal,
  type PlatinumJournalPage,
  readPlatinumJournal,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with {
  type: 'json',
};
import {
  Names,
  type NamesFile,
} from './names.ts';

const NAMES = new Names(
  namesFile as NamesFile,
);

export function convertPlatinumJournalPage(
  native: PlatinumJournalPage,
): JournalPage {
  return {
    date: { ...native.date },
    zone: NAMES.zone(native.mapHeaderId),
    events: native.events.map((event) => ({
      ...event,
    })),
    mon: native.mon
      ? {
          result: native.mon.result,
          variant: native.mon.variant,
          timeOfDay: native.mon.timeOfDay,
          gender: native.mon.gender,
          species: NAMES.species(
            native.mon.species,
          ),
        }
      : null,
    trainer: native.trainer
      ? {
          trainer: NAMES.trainer(
            native.trainer.trainer,
          ),
          zone: NAMES.zone(
            native.trainer.mapHeaderId,
          ),
        }
      : null,
  };
}

export function convertPlatinumJournal(
  native: PlatinumJournal,
): JournalPage[] {
  return native.pages.map(
    convertPlatinumJournalPage,
  );
}

export function applyPlatinumJournal(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    journal: convertPlatinumJournal(
      readPlatinumJournal(save),
    ),
  };
}
