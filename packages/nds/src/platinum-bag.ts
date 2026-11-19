import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_BAG_OFFSET = 0x630;

export const PLATINUM_BAG_POCKETS = {
  items: {
    offset: 0x000,
    size: 165,
  },
  keyItems: {
    offset: 0x294,
    size: 50,
  },
  tmHms: {
    offset: 0x35c,
    size: 100,
  },
  mail: {
    offset: 0x4ec,
    size: 12,
  },
  medicine: {
    offset: 0x51c,
    size: 40,
  },
  berries: {
    offset: 0x5bc,
    size: 64,
  },
  pokeballs: {
    offset: 0x6bc,
    size: 15,
  },
  battleItems: {
    offset: 0x6f8,
    size: 30,
  },
} as const;

export const PLATINUM_REGISTERED_ITEM_OFFSET = 0x770;

export interface PlatinumBagSlot {
  item: number;
  quantity: number;
}

export interface PlatinumBag {
  pockets: {
    items: PlatinumBagSlot[];
    keyItems: PlatinumBagSlot[];
    tmHms: PlatinumBagSlot[];
    mail: PlatinumBagSlot[];
    medicine: PlatinumBagSlot[];
    berries: PlatinumBagSlot[];
    pokeballs: PlatinumBagSlot[];
    battleItems: PlatinumBagSlot[];
  };
  registeredItem: number;
}

function readPocket(
  bytes: Uint8Array,
  offset: number,
  size: number,
): PlatinumBagSlot[] {
  if (offset < 0 || offset + size * 4 > bytes.length) {
    throw new Error('Platinum Bag pocket is outside the file');
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const slots: PlatinumBagSlot[] = [];

  for (let index = 0; index < size; index++) {
    const slotOffset = offset + index * 4;
    const item = view.getUint16(slotOffset, true);
    const quantity = view.getUint16(slotOffset + 2, true);

    if (item === 0 && quantity === 0) {
      continue;
    }

    if (item === 0 || quantity === 0) {
      throw new Error(
        `Invalid Platinum Bag slot ${index}: item ${item}, quantity ${quantity}`,
      );
    }

    slots.push({
      item,
      quantity,
    });
  }

  return slots;
}

export function parsePlatinumBag(
  bytes: Uint8Array,
  offset = 0,
): PlatinumBag {
  const requiredSize =
    PLATINUM_REGISTERED_ITEM_OFFSET + 4;

  if (
    offset < 0 ||
    offset + requiredSize > bytes.length
  ) {
    throw new Error('Platinum Bag is outside the file');
  }

  const pockets = {
    items: readPocket(
      bytes,
      offset + PLATINUM_BAG_POCKETS.items.offset,
      PLATINUM_BAG_POCKETS.items.size,
    ),

    keyItems: readPocket(
      bytes,
      offset + PLATINUM_BAG_POCKETS.keyItems.offset,
      PLATINUM_BAG_POCKETS.keyItems.size,
    ),

    tmHms: readPocket(
      bytes,
      offset + PLATINUM_BAG_POCKETS.tmHms.offset,
      PLATINUM_BAG_POCKETS.tmHms.size,
    ),

    mail: readPocket(
      bytes,
      offset + PLATINUM_BAG_POCKETS.mail.offset,
      PLATINUM_BAG_POCKETS.mail.size,
    ),

    medicine: readPocket(
      bytes,
      offset + PLATINUM_BAG_POCKETS.medicine.offset,
      PLATINUM_BAG_POCKETS.medicine.size,
    ),

    berries: readPocket(
      bytes,
      offset + PLATINUM_BAG_POCKETS.berries.offset,
      PLATINUM_BAG_POCKETS.berries.size,
    ),

    pokeballs: readPocket(
      bytes,
      offset + PLATINUM_BAG_POCKETS.pokeballs.offset,
      PLATINUM_BAG_POCKETS.pokeballs.size,
    ),

    battleItems: readPocket(
      bytes,
      offset + PLATINUM_BAG_POCKETS.battleItems.offset,
      PLATINUM_BAG_POCKETS.battleItems.size,
    ),
  };

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  return {
    pockets,
    registeredItem: view.getUint32(
      offset + PLATINUM_REGISTERED_ITEM_OFFSET,
      true,
    ),
  };
}

export function readPlatinumBag(
  bytes: Uint8Array,
): PlatinumBag {
  const { general } = selectPlatinumSaveBlocks(bytes);

  return parsePlatinumBag(
    bytes,
    general.offset + PLATINUM_BAG_OFFSET,
  );
}