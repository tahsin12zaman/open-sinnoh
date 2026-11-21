import type { GameState } from '@opensinnoh/contracts';
import type { BagSlot } from '@opensinnoh/core';
import {
  readPlatinumBag,
  type PlatinumBag,
  type PlatinumBagSlot,
} from '@opensinnoh/nds';
import namesFile from '../data/names.json' with { type: 'json' };
import {
  Names,
  type NamesFile,
} from './names.ts';

const NAMES = new Names(namesFile as NamesFile);

const POCKET_MAPPING = {
  items: 'items',
  keyItems: 'key_items',
  tmHms: 'tmhms',
  mail: 'mail',
  medicine: 'medicine',
  berries: 'berries',
  pokeballs: 'balls',
  battleItems: 'battle_items',
} as const;

function convertSlots(
  slots: readonly PlatinumBagSlot[],
): BagSlot[] {
  return slots.map(({ item, quantity }) => ({
    item: NAMES.item(item),
    count: quantity,
  }));
}

export function convertPlatinumBag(
  native: PlatinumBag,
): {
  bag: GameState['bag'];
  registeredItem: GameState['registeredItem'];
} {
  const bag: GameState['bag'] = {};

  for (
    const [nativeName, openSinnohName] of Object.entries(
      POCKET_MAPPING,
    )
  ) {
    const slots =
      native.pockets[
        nativeName as keyof PlatinumBag['pockets']
      ];

    bag[openSinnohName] = convertSlots(slots);
  }

  return {
    bag,
    registeredItem:
      native.registeredItem === 0
        ? null
        : NAMES.item(native.registeredItem),
  };
}

export function importPlatinumBag(
  save: Uint8Array,
): {
  bag: GameState['bag'];
  registeredItem: GameState['registeredItem'];
} {
  return convertPlatinumBag(readPlatinumBag(save));
}

export function applyPlatinumBag(
  state: GameState,
  save: Uint8Array,
): GameState {
  const imported = importPlatinumBag(save);

  return {
    ...state,
    bag: imported.bag,
    registeredItem: imported.registeredItem,
  };
}