import type {
  ContestPhoto,
  DressUpPhoto,
  GameState,
} from '@opensinnoh/contracts';
import {
  type PlatinumContestPhoto,
  type PlatinumDressUpPhoto,
  type PlatinumImageClips,
  type PlatinumPhotoPokemon,
  readPlatinumImageClips,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with {
  type: 'json',
};
import {
  Names,
  type NamesFile,
} from './names.ts';
import {
  decodePlatinumName,
} from './platinum-save.ts';

const NAMES = new Names(
  namesFile as NamesFile,
);

function optionalName(
  codes: readonly number[],
): string | null {
  const name = decodePlatinumName(codes);
  return name.length === 0 ? null : name;
}

function trainerName(
  codes: readonly number[],
): string {
  return decodePlatinumName(codes);
}

function contestMon(
  mon: PlatinumPhotoPokemon,
): ContestPhoto['mon'] {
  return {
    species: NAMES.species(mon.species),
    form: mon.form,
    pid: mon.pid,
    otId: mon.otId,
    nickname: optionalName(
      mon.nicknameCodes,
    ),
  };
}

function dressUpMon(
  mon: PlatinumPhotoPokemon,
): DressUpPhoto['mon'] {
  return {
    ...contestMon(mon),
    x: mon.x,
    y: mon.y,
  };
}

export function convertPlatinumContestPhoto(
  native: PlatinumContestPhoto,
): ContestPhoto {
  return {
    mon: contestMon(native.mon),
    trainerName: trainerName(
      native.mon.trainerNameCodes,
    ),
    rank: native.rank,
    dressUp: {
      accessories: native.accessories.map(
        (accessory) => ({ ...accessory }),
      ),
      monPriority: native.mon.priority,
      backdrop: native.backdrop,
    },
  };
}

export function convertPlatinumDressUpPhoto(
  native: PlatinumDressUpPhoto,
): DressUpPhoto {
  return {
    mon: dressUpMon(native.mon),
    trainerName: trainerName(
      native.mon.trainerNameCodes,
    ),
    trainerGender:
      native.mon.trainerGender === 0
        ? 'male'
        : 'female',
    dressUp: {
      accessories: native.accessories.map(
        (accessory) => ({ ...accessory }),
      ),
      monPriority: native.mon.priority,
      backdrop: native.backdrop,
    },
    title: native.title,
  };
}

export function convertPlatinumImageClips(
  native: PlatinumImageClips,
): Pick<
  GameState,
  'contestPhotos' | 'dressUpPhotos'
> {
  return {
    contestPhotos:
      native.contestPhotos.map((photo) =>
        photo
          ? convertPlatinumContestPhoto(photo)
          : null,
      ),
    dressUpPhotos:
      native.dressUpPhotos.map((photo) =>
        photo
          ? convertPlatinumDressUpPhoto(photo)
          : null,
      ),
  };
}

export function applyPlatinumImageClips(
  state: GameState,
  save: Uint8Array,
): GameState {
  return {
    ...state,
    ...convertPlatinumImageClips(
      readPlatinumImageClips(save),
    ),
  };
}
