import { readPlatinumTrainerData, type PlatinumTrainerData } from '@opensinnoh/nds';
import charmapFile from '../data/charmap.json' with { type: 'json' };
import { charTable, type CharmapFile } from './names.ts';

const CHARS = charTable(charmapFile as CharmapFile);

export type ImportedPlatinumTrainer = Omit<
  PlatinumTrainerData,
  'nameCodes'
> & {
  name: string;
};

export function decodePlatinumName(codes: readonly number[]): string {
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