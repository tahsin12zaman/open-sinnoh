import {
  dexOf,
  type GameState,
  type Registries,
} from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import {
  parsePlatinumBoxPokemon,
  parsePlatinumPartyPokemon,
  PLATINUM_PARTY_CAPACITY,
  readPlatinumFieldState,
  readPlatinumOptions,
  readPlatinumParty,
  readPlatinumPcBoxes,
  readPlatinumPlayerLocation,
  readPlatinumPokedex,
  readPlatinumSystemData,
  readPlatinumTrainerData,
  type PlatinumBag,
  type PlatinumFieldState,
  type PlatinumLocation,
  type PlatinumOptions,
  type PlatinumPlayerState,
  type PlatinumSystemData,
  type PlatinumTrainerData,
  writePlatinumBag,
  writePlatinumBoxPokemonData,
  writePlatinumFieldState,
  writePlatinumOptions,
  writePlatinumParty,
  writePlatinumPartyPokemonData,
  writePlatinumPcBoxes,
  writePlatinumPlayerLocation,
  writePlatinumPlayerState,
  writePlatinumPokedex,
  writePlatinumRivalData,
  writePlatinumSystemData,
  writePlatinumTrainerData,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with {
  type: 'json',
};
import {
  Names,
  type NamesFile,
} from './names.ts';
import {
  encodePlatinumName,
} from './platinum-save.ts';
import {
  exportPlatinumProgress,
} from './platinum-progress.ts';
import {
  convertOpenSinnohPokemon,
} from './platinum-pokemon-export.ts';
import {
  convertOpenSinnohPokedex,
} from './platinum-pokedex-export.ts';

const NAMES = new Names(
  namesFile as NamesFile,
);

const BADGE_IDS: readonly Id[] = [
  'platinum:BADGE_ID_COAL',
  'platinum:BADGE_ID_FOREST',
  'platinum:BADGE_ID_COBBLE',
  'platinum:BADGE_ID_FEN',
  'platinum:BADGE_ID_RELIC',
  'platinum:BADGE_ID_MINE',
  'platinum:BADGE_ID_ICICLE',
  'platinum:BADGE_ID_BEACON',
];

function badgeBits(
  badges: readonly Id[],
): number {
  const obtained = new Set(badges);

  return BADGE_IDS.reduce(
    (bits, badge, index) =>
      obtained.has(badge)
        ? bits | (1 << index)
        : bits,
    0,
  );
}

function nativeGender(
  gender: GameState['gender'],
): number {
  switch (gender) {
    case 'male':
      return 0;
    case 'female':
      return 1;
  }
}

function nativeFacing(
  facing: GameState['player']['facing'],
): number {
  switch (facing) {
    case 'up':
      return 0;
    case 'down':
      return 1;
    case 'left':
      return 2;
    case 'right':
      return 3;
  }
}

function nativePlayerState(
  state: GameState['playerState'],
): number {
  switch (state) {
    case 'walk':
      return 0;
    case 'cycle':
      return 1;
    case 'surf':
      return 2;
  }
}

export function platinumItemIndex(
  item: Id,
): number {
  for (
    let index = 0;
    index < NAMES.file.items.length;
    index++
  ) {
    if (NAMES.item(index) === item) {
      return index;
    }
  }

  throw new Error(
    `Cannot export unknown Platinum item ${item}`,
  );
}

export function platinumZoneIndex(
  zone: Id,
): number {
  for (
    let index = 0;
    index < NAMES.file.zones.length;
    index++
  ) {
    if (NAMES.zone(index) === zone) {
      return index;
    }
  }

  throw new Error(
    `Cannot export unknown Platinum zone ${zone}`,
  );
}

export function convertOpenSinnohTrainer(
  state: GameState,
  base: PlatinumTrainerData,
): PlatinumTrainerData {
  return {
    ...base,
    nameCodes: encodePlatinumName(
      state.names.player,
      8,
    ),
    trainerId: state.trainerId & 0xffff,
    secretId: state.trainerId >>> 16,
    money: state.money,
    gender: nativeGender(state.gender),
    badges: badgeBits(state.badges),
    appearance:
      state.appearance ?? base.appearance,
    coins: Math.min(state.coins, 9999),
    playTime: {
      ...state.playTime,
    },
  };
}

export function convertOpenSinnohLocation(
  state: GameState,
  base: PlatinumLocation,
): PlatinumLocation {
  return {
    mapHeaderId: platinumZoneIndex(
      state.player.zone,
    ),
    warpId: base.warpId,
    x: state.player.x,
    z: state.player.z,
    faceDirection: nativeFacing(
      state.player.facing,
    ),
  };
}

export function convertOpenSinnohOptions(
  state: GameState,
  base: PlatinumOptions,
): PlatinumOptions {
  return {
    textSpeed: base.textSpeed,
    soundMode: state.options.sound,
    battleStyle: state.options.battleStyle,
    battleScene: state.options.battleScene,
    buttonMode: state.options.buttonMode,
    frame: state.options.frame,
  };
}

const BAG_POCKET_MAPPING = {
  items: 'items',
  keyItems: 'key_items',
  tmHms: 'tmhms',
  mail: 'mail',
  medicine: 'medicine',
  berries: 'berries',
  pokeballs: 'balls',
  battleItems: 'battle_items',
} as const;

export function convertOpenSinnohBag(
  state: Pick<
    GameState,
    'bag' | 'registeredItem'
  >,
): PlatinumBag {
  const pockets =
    {} as PlatinumBag['pockets'];

  for (
    const [
      nativeName,
      openSinnohName,
    ] of Object.entries(
      BAG_POCKET_MAPPING,
    )
  ) {
    pockets[
      nativeName as keyof PlatinumBag['pockets']
    ] = (
      state.bag[openSinnohName] ?? []
    ).map((slot) => ({
      item: platinumItemIndex(slot.item),
      quantity: slot.count,
    }));
  }

  return {
    pockets,
    registeredItem:
      state.registeredItem === null
        ? 0
        : platinumItemIndex(
            state.registeredItem,
          ),
  };
}

export function convertOpenSinnohPlayerState(
  state: GameState,
): PlatinumPlayerState {
  return {
    badgeBits: badgeBits(state.badges),
    cyclingGear: state.cyclingGear,
    runningShoes: state.runningShoes,
    playerState: nativePlayerState(
      state.playerState,
    ),
  };
}

function platinumWeatherIndex(
  weather: Id,
): number {
  for (let index = 0; index <= 0xff; index++) {
    if (NAMES.weather(index) === weather) {
      return index;
    }
  }

  throw new Error(
    `Cannot export unknown Platinum weather ${weather}`,
  );
}

function locationFromState(
  location: {
    zone: Id;
    x: number;
    z: number;
    facing: GameState['player']['facing'];
    warp?: number;
  },
): PlatinumLocation {
  return {
    mapHeaderId: platinumZoneIndex(
      location.zone,
    ),
    warpId: location.warp ?? -1,
    x: location.x,
    z: location.z,
    faceDirection: nativeFacing(
      location.facing,
    ),
  };
}

export function convertOpenSinnohFieldState(
  state: GameState,
  base: PlatinumFieldState,
): PlatinumFieldState {
  const previous =
    state.previousZone === null
      ? null
      : {
          ...(base.previous ?? base.player),
          mapHeaderId: platinumZoneIndex(
            state.previousZone,
          ),
        };

  const special =
    state.specialLocation === null
      ? null
      : locationFromState({
          zone:
            state.specialLocation.zone,
          warp:
            state.specialLocation.warp,
          x: state.specialLocation.x,
          z: state.specialLocation.z,
          facing:
            state.specialLocation.facing,
        });

  const exit =
    state.escapeLocation === undefined
      ? null
      : locationFromState({
          ...state.escapeLocation,
          warp: -1,
        });

  return {
    ...base,
    player: locationFromState({
      ...state.player,
      warp: base.player.warpId,
    }),
    previous,
    special,
    exit,
    weather: platinumWeatherIndex(
      state.weather,
    ),
    safariSteps:
      state.safari?.steps ?? 0,
    safariBalls:
      state.safari?.balls ?? 0,
  };
}

const RTC_EPOCH =
  Date.UTC(2000, 0, 1);

function parseDate(
  value: string,
  name: string,
): Date {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (match === null) {
    throw new Error(
      `Cannot export invalid Platinum ${name} ${value}`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    year < 2000 ||
    year > 2099 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      `Cannot export invalid Platinum ${name} ${value}`,
    );
  }

  return date;
}

function rtcTimestamp(
  value: string,
  name: string,
): bigint {
  const milliseconds =
    parseDate(value, name).getTime() -
    RTC_EPOCH;

  return BigInt(
    Math.floor(milliseconds / 1000),
  );
}

export function convertOpenSinnohSystemData(
  state: GameState,
  base: PlatinumSystemData,
): PlatinumSystemData {
  const date = parseDate(
    state.gameTime.now.date,
    'game date',
  );

  return {
    ...base,
    now: {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      week: date.getUTCDay(),
      hour: state.gameTime.now.hour,
      minute: state.gameTime.now.minute,
      second: state.gameTime.now.second,
    },
    dayNumber: Math.floor(
      (date.getTime() - RTC_EPOCH) /
        86_400_000,
    ),
    startTimestamp:
      state.startDate === null
        ? base.startTimestamp
        : rtcTimestamp(
            state.startDate,
            'start date',
          ),
    firstCompletionTimestamp:
      state.records.hallOfFame === null
        ? base.firstCompletionTimestamp
        : rtcTimestamp(
            state.records.hallOfFame,
            'Hall of Fame date',
          ),
    penaltyMinutes:
      state.gameTime.penaltyMinutes,
  };
}

export function exportPlatinumParty(
  state: GameState,
  save: Uint8Array,
  registries: Registries,
): Uint8Array {
  if (
    state.party.length >
    PLATINUM_PARTY_CAPACITY
  ) {
    throw new Error(
      `Cannot export Platinum party with ${state.party.length} Pokémon`,
    );
  }

  const native = readPlatinumParty(save);
  const dex = dexOf(registries);

  const pokemon = state.party.map(
    (current, index) => {
      const existing =
        native.pokemon[index];

      const existingData =
        existing === undefined
          ? undefined
          : parsePlatinumPartyPokemon(
              existing,
            );

      const species = dex.form(
        current.species,
        current.form,
      );

      return writePlatinumPartyPokemonData(
        convertOpenSinnohPokemon(
          current,
          species.genderRatio,
          existingData,
        ),
        existing,
      );
    },
  );

  return writePlatinumParty(
    save,
    {
      capacity:
        PLATINUM_PARTY_CAPACITY,
      count: pokemon.length,
      pokemon,
    },
  );
}

export function exportPlatinumPcBoxes(
  state: GameState,
  save: Uint8Array,
  registries: Registries,
): Uint8Array {
  const native = readPlatinumPcBoxes(save);
  const dex = dexOf(registries);

  if (
    state.boxes.length !==
    native.boxes.length
  ) {
    throw new Error(
      `Cannot export ${state.boxes.length} OpenSinnoh boxes into ${native.boxes.length} Platinum boxes`,
    );
  }

  const boxes = state.boxes.map(
    (box, boxIndex) => {
      const nativeBox =
        native.boxes[boxIndex]!;

      if (
        box.slots.length !==
        nativeBox.slots.length
      ) {
        throw new Error(
          `Cannot export Platinum box ${boxIndex} with ${box.slots.length} slots; expected ${nativeBox.slots.length}`,
        );
      }

      return {
        nameCodes: encodePlatinumName(
          box.name,
          20,
        ),
        wallpaper: box.wallpaper,
        slots: box.slots.map(
          (current, slotIndex) => {
            if (current === null) {
              return null;
            }

            const existing =
              nativeBox.slots[
                slotIndex
              ];

            const existingData =
              existing == null
                ? undefined
                : parsePlatinumBoxPokemon(
                    existing,
                  );

            const species = dex.form(
              current.species,
              current.form,
            );

            return writePlatinumBoxPokemonData(
              convertOpenSinnohPokemon(
                current,
                species.genderRatio,
                existingData,
              ),
              existing ?? undefined,
            );
          },
        ),
      };
    },
  );

  return writePlatinumPcBoxes(
    save,
    {
      currentBox: state.currentBox,
      unlockedWallpapers:
        state.wallpapersUnlocked,
      boxes,
    },
  );
}

/**
 * Patches the core OpenSinnoh state back into an original Platinum
 * save. Unknown and not-yet-modeled native fields remain from the
 * supplied base save.
 */
export function exportPlatinumSaveState(
  state: GameState,
  baseSave: Uint8Array,
  registries: Registries,
): Uint8Array {
  let output = writePlatinumTrainerData(
    baseSave,
    convertOpenSinnohTrainer(
      state,
      readPlatinumTrainerData(baseSave),
    ),
  );

  output = writePlatinumRivalData(
    output,
    {
      nameCodes: encodePlatinumName(
        state.names.rival,
        8,
      ),
    },
  );

  output = writePlatinumPlayerLocation(
    output,
    convertOpenSinnohLocation(
      state,
      readPlatinumPlayerLocation(output),
    ),
  );

  output = writePlatinumOptions(
    output,
    convertOpenSinnohOptions(
      state,
      readPlatinumOptions(output),
    ),
  );

  output = writePlatinumPlayerState(
    output,
    convertOpenSinnohPlayerState(state),
  );

  output = writePlatinumBag(
    output,
    convertOpenSinnohBag(state),
  );

  output = writePlatinumFieldState(
    output,
    convertOpenSinnohFieldState(
      state,
      readPlatinumFieldState(output),
    ),
  );

  output = writePlatinumSystemData(
    output,
    convertOpenSinnohSystemData(
      state,
      readPlatinumSystemData(output),
    ),
  );

  output = writePlatinumPokedex(
    output,
    convertOpenSinnohPokedex(
      state.pokedex,
      readPlatinumPokedex(output),
    ),
  );

  output = exportPlatinumParty(
    state,
    output,
    registries,
  );

  output = exportPlatinumPcBoxes(
    state,
    output,
    registries,
  );

  return exportPlatinumProgress(
    state,
    output,
    registries,
  );
}
