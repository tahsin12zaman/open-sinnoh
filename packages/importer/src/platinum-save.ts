import type { GameState } from '@opensinnoh/contracts';
import {
  readPlatinumTrainerData,
  type PlatinumTrainerData,
} from '@opensinnoh/nds';
import charmapFile from '../data/charmap.json' with { type: 'json' };
import { charTable, type CharmapFile } from './names.ts';

const CHARS = charTable(charmapFile as CharmapFile);

export type ImportedPlatinumTrainer = Omit<
  PlatinumTrainerData,
  'nameCodes'
> & {
  name: string;
};

export function decodePlatinumName(
  codes: readonly number[],
): string {
  const end = codes.indexOf(0xffff);
  const characters = end < 0 ? codes : codes.slice(0, end);

  return characters
    .map((code) => {
      const character = CHARS.get(code);

      if (character === undefined) {
        throw new Error(
          `Unknown Platinum trainer-name character 0x${code.toString(16)}`,
        );
      }

      return character;
    })
    .join('');
}

export function convertPlatinumTrainerData(
  data: PlatinumTrainerData,
): ImportedPlatinumTrainer {
  const { nameCodes, ...trainer } = data;

  return {
    name: decodePlatinumName(nameCodes),
    ...trainer,
  };
}

export function importPlatinumTrainer(
  save: Uint8Array,
): ImportedPlatinumTrainer {
  return convertPlatinumTrainerData(
    readPlatinumTrainerData(save),
  );
}

function platinumGender(
  gender: number,
): GameState['gender'] {
  if (gender === 0) return 'male';
  if (gender === 1) return 'female';

  throw new Error(`Unknown Platinum trainer gender ${gender}`);
}

export function applyPlatinumTrainer(
  state: GameState,
  trainer: ImportedPlatinumTrainer,
): GameState {
  const combinedTrainerId =
    (((trainer.secretId & 0xffff) << 16) |
      (trainer.trainerId & 0xffff)) >>>
    0;

  return {
    ...state,
    names: {
      ...state.names,
      player: trainer.name,
    },
    gender: platinumGender(trainer.gender),
    trainerId: combinedTrainerId,
    money: trainer.money,
    coins: trainer.coins,
    playTime: {
      ...trainer.playTime,
    },
  };
}

export function applyPlatinumSave(
  state: GameState,
  save: Uint8Array,
): GameState {
  return applyPlatinumTrainer(
    state,
    importPlatinumTrainer(save),
  );
}