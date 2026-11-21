import type {
  GameState,
  HallOfFameEntry,
  HallOfFameMon,
} from '@opensinnoh/contracts';
import {
  readPlatinumHallOfFame,
  type PlatinumHallOfFame,
  type PlatinumHallOfFameEntry,
  type PlatinumHallOfFamePokemon,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';
import { decodePlatinumName } from './platinum-save.ts';

const NAMES = new Names(namesFile as NamesFile);

function hallOfFameDate(
  year: number,
  month: number,
  day: number,
): string {
  return [
    (2000 + year).toString().padStart(4, '0'),
    month.toString().padStart(2, '0'),
    day.toString().padStart(2, '0'),
  ].join('-');
}

export function convertPlatinumHallOfFamePokemon(
  native: PlatinumHallOfFamePokemon,
): HallOfFameMon {
  const storedName = decodePlatinumName(
    native.nicknameCodes,
  );

  return {
    species: NAMES.species(native.species),
    form: native.form,
    level: native.level,
    pid: native.personality,
    otId: native.otId,
    nickname:
      storedName.length === 0
        ? null
        : storedName,
    otName: decodePlatinumName(
      native.otNameCodes,
    ),
    moves: native.moves.map((move) =>
      NAMES.move(move),
    ),
  };
}

export function convertPlatinumHallOfFameEntry(
  native: PlatinumHallOfFameEntry,
): HallOfFameEntry {
  return {
    date: hallOfFameDate(
      native.year,
      native.month,
      native.day,
    ),
    party: native.pokemon.map(
      convertPlatinumHallOfFamePokemon,
    ),
  };
}

export function convertPlatinumHallOfFame(
  native: PlatinumHallOfFame,
): GameState['hallOfFame'] {
  return {
    total: native.total,
    entries: native.entries.map(
      convertPlatinumHallOfFameEntry,
    ),
  };
}

export function applyPlatinumHallOfFame(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    hallOfFame: convertPlatinumHallOfFame(
      readPlatinumHallOfFame(save),
    ),
  };
}
