import type {
  GameState,
  SavedOptions,
} from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import type {
  PlatinumFieldState,
  PlatinumLocation,
  PlatinumOptions,
  PlatinumSystemData,
  PlatinumTrainerData,
} from '@opensinnoh/nds';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  convertOpenSinnohBag,
  convertOpenSinnohFieldState,
  convertOpenSinnohLocation,
  convertOpenSinnohOptions,
  convertOpenSinnohPlayerState,
  convertOpenSinnohSystemData,
  convertOpenSinnohTrainer,
  platinumItemIndex,
  platinumZoneIndex,
} from './platinum-save-export.ts';

const id = (value: string): Id =>
  value as Id;

const options: SavedOptions = {
  sound: 1,
  battleScene: 0,
  battleStyle: 1,
  buttonMode: 2,
  frame: 17,
};

function makeState(): GameState {
  return {
    names: {
      player: 'Test',
      rival: 'Barry',
    },
    trainerId:
      ((54321 << 16) | 12345) >>> 0,
    money: 654321,
    gender: 'female',
    appearance: 6,
    badges: [
      id('platinum:BADGE_ID_COAL'),
      id('platinum:BADGE_ID_FEN'),
      id('platinum:BADGE_ID_BEACON'),
    ],
    coins: 4321,
    playTime: {
      hours: 321,
      minutes: 45,
      seconds: 56,
    },
    player: {
      zone:
        id('platinum:MAP_HEADER_EVERYWHERE'),
      x: 17,
      y: 0,
      z: 29,
      facing: 'left',
    },
    options,
    bag: {
      items: [
        {
          item: id('platinum:ITEM_POTION'),
          count: 3,
        },
      ],
      key_items: [],
      tmhms: [],
      mail: [],
      medicine: [],
      berries: [],
      balls: [
        {
          item: id('platinum:ITEM_POKE_BALL'),
          count: 12,
        },
      ],
      battle_items: [],
    },
    registeredItem:
      id('platinum:ITEM_POTION'),
    weather:
      id('platinum:OVERWORLD_WEATHER_CLEAR'),
    previousZone: null,
    specialLocation: null,
    safari: {
      balls: 23,
      steps: 456,
      caught: 2,
    },
    gameTime: {
      now: {
        date: '2025-08-20',
        hour: 14,
        minute: 35,
        second: 42,
      },
      penaltyMinutes: 120,
    },
    startDate: '2025-07-01',
    records: {
      hallOfFame: '2025-08-15',
    },
    cyclingGear: 1,
    runningShoes: true,
    playerState: 'surf',
  } as unknown as GameState;
}

const baseTrainer: PlatinumTrainerData = {
  nameCodes: new Array<number>(8).fill(
    0xffff,
  ),
  trainerId: 1,
  secretId: 2,
  money: 3000,
  gender: 0,
  language: 2,
  badges: 0,
  appearance: 3,
  gameCode: 0,
  mainStoryCleared: true,
  hasNationalDex: true,
  coins: 0,
  playTime: {
    hours: 1,
    minutes: 2,
    seconds: 3,
  },
};

describe('Platinum core save export', () => {
  it('converts trainer fields and preserves native-only data', () => {
    const converted =
      convertOpenSinnohTrainer(
        makeState(),
        baseTrainer,
      );

    expect(converted).toMatchObject({
      trainerId: 12345,
      secretId: 54321,
      money: 654321,
      gender: 1,
      language: 2,
      badges: 0b10001001,
      appearance: 6,
      gameCode: 0,
      mainStoryCleared: true,
      hasNationalDex: true,
      coins: 4321,
      playTime: {
        hours: 321,
        minutes: 45,
        seconds: 56,
      },
    });

    expect(converted.nameCodes).toEqual([
      318,
      329,
      343,
      344,
      0xffff,
      0xffff,
      0xffff,
      0xffff,
    ]);
  });

  it('preserves the base appearance when state appearance is absent', () => {
    const state = makeState();

    delete state.appearance;

    expect(
      convertOpenSinnohTrainer(
        state,
        baseTrainer,
      ).appearance,
    ).toBe(3);
  });

  it('converts the player location and preserves the warp ID', () => {
    const base: PlatinumLocation = {
      mapHeaderId: 200,
      warpId: 7,
      x: 1,
      z: 2,
      faceDirection: 0,
    };

    expect(
      convertOpenSinnohLocation(
        makeState(),
        base,
      ),
    ).toEqual({
      mapHeaderId: 0,
      warpId: 7,
      x: 17,
      z: 29,
      faceDirection: 2,
    });

    expect(
      platinumZoneIndex(
        id('platinum:MAP_HEADER_EVERYWHERE'),
      ),
    ).toBe(0);
  });

  it('rejects a zone outside the Platinum name table', () => {
    expect(() =>
      platinumZoneIndex(
        id('mod:UNKNOWN_ZONE'),
      ),
    ).toThrow(/unknown Platinum zone/i);
  });

  it('converts saved options while preserving native text speed', () => {
    const base: PlatinumOptions = {
      textSpeed: 2,
      soundMode: 0,
      battleStyle: 0,
      battleScene: 1,
      buttonMode: 0,
      frame: 0,
    };

    expect(
      convertOpenSinnohOptions(
        makeState(),
        base,
      ),
    ).toEqual({
      textSpeed: 2,
      soundMode: 1,
      battleStyle: 1,
      battleScene: 0,
      buttonMode: 2,
      frame: 17,
    });
  });

  it('converts every Bag pocket and the registered item', () => {
    const converted =
      convertOpenSinnohBag(makeState());

    expect(converted.pockets.items).toEqual([
      {
        item: platinumItemIndex(
          id('platinum:ITEM_POTION'),
        ),
        quantity: 3,
      },
    ]);

    expect(converted.pockets.pokeballs).toEqual([
      {
        item: platinumItemIndex(
          id('platinum:ITEM_POKE_BALL'),
        ),
        quantity: 12,
      },
    ]);

    expect(converted.pockets.keyItems).toEqual(
      [],
    );

    expect(converted.registeredItem).toBe(
      platinumItemIndex(
        id('platinum:ITEM_POTION'),
      ),
    );
  });

  it('exports no registered item as native item zero', () => {
    const state = makeState();

    state.registeredItem = null;

    expect(
      convertOpenSinnohBag(state)
        .registeredItem,
    ).toBe(0);
  });

  it('rejects items outside the Platinum name table', () => {
    expect(() =>
      platinumItemIndex(
        id('mod:UNKNOWN_ITEM'),
      ),
    ).toThrow(/unknown Platinum item/i);
  });

  it('converts field state and preserves native-only fields', () => {
    const base: PlatinumFieldState = {
      player: {
        mapHeaderId: 200,
        warpId: 7,
        x: 1,
        z: 2,
        faceDirection: 0,
      },
      entrance: null,
      previous: null,
      special: null,
      exit: null,
      bgm: 123,
      weather: 9,
      blackOutWarpId: 4,
      cameraType: 2,
      poisonSteps: 17,
      safariSteps: 0,
      safariBalls: 0,
    };

    const converted =
      convertOpenSinnohFieldState(
        makeState(),
        base,
      );

    expect(converted).toMatchObject({
      player: {
        mapHeaderId: 0,
        warpId: 7,
        x: 17,
        z: 29,
        faceDirection: 2,
      },
      bgm: 123,
      blackOutWarpId: 4,
      cameraType: 2,
      poisonSteps: 17,
      safariSteps: 456,
      safariBalls: 23,
    });
  });

  it('converts the game clock while preserving native-only system data', () => {
    const base: PlatinumSystemData = {
      now: {
        year: 2020,
        month: 1,
        day: 1,
        week: 3,
        hour: 0,
        minute: 0,
        second: 0,
      },
      dayNumber: 1,
      startTimestamp: 1n,
      firstCompletionTimestamp: 2n,
      penaltyMinutes: 0,
      mysteryGiftUnlocked: true,
    };

    const converted =
      convertOpenSinnohSystemData(
        makeState(),
        base,
      );

    expect(converted.now).toEqual({
      year: 2025,
      month: 8,
      day: 20,
      week: 3,
      hour: 14,
      minute: 35,
      second: 42,
    });

    expect(converted.penaltyMinutes).toBe(
      120,
    );
    expect(
      converted.startTimestamp,
    ).toBeGreaterThan(0n);
    expect(
      converted.firstCompletionTimestamp,
    ).toBeGreaterThan(
      converted.startTimestamp,
    );
    expect(
      converted.mysteryGiftUnlocked,
    ).toBe(true);
  });

  it('converts badges and movement state', () => {
    expect(
      convertOpenSinnohPlayerState(
        makeState(),
      ),
    ).toEqual({
      badgeBits: 0b10001001,
      cyclingGear: 1,
      runningShoes: true,
      playerState: 2,
    });
  });
});
