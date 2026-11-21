import {
  crc16Ccitt,
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';

export const PLATINUM_MYSTERY_GIFT_OFFSET =
  0xb4c0;
export const PLATINUM_MYSTERY_GIFT_SIZE =
  0x1328;
export const PLATINUM_MYSTERY_GIFT_ENTRY_SIZE =
  0x1330;

export const PLATINUM_MYSTERY_GIFT_DELIVERY_COUNT =
  8;
export const PLATINUM_MYSTERY_GIFT_CARD_COUNT = 3;

const RECEIVED_FLAGS_SIZE = 0x100;
const UNLOCKED_FLAG_ID = 2047;

const DELIVERY_OFFSET = 0x100;
const DELIVERY_SIZE = 0x104;

const CARD_OFFSET = 0x920;
const CARD_SIZE = 0x358;

const CARD_ID_OFFSET = 0x150;
const CARD_FLAGS_OFFSET = 0x152;
const CARD_SPECIES_OFFSET = 0x34a;
const CARD_RECEIVED_DAY_OFFSET = 0x354;

const CHECKSUM_BODY_SIZE = 0x132c;
const CHECKSUM_OFFSET = 0x132c;

const MYSTERY_GIFT_TYPE_MIN = 1;
const MYSTERY_GIFT_TYPE_MAX = 14;

export interface PlatinumMysteryGiftDelivery {
  type: number;
  wondercardSlot: number;
}

export interface PlatinumMysteryGiftCard {
  type: number;
  id: number;
  saveDelivery: boolean;
  species: [number, number, number];
  receivedDay: number;
}

export interface PlatinumMysteryGift {
  unlocked: boolean;
  receivedFlags: Uint8Array;
  deliveries: (
    | PlatinumMysteryGiftDelivery
    | null
  )[];
  cards: (PlatinumMysteryGiftCard | null)[];
}

function validGiftType(type: number): boolean {
  return (
    type >= MYSTERY_GIFT_TYPE_MIN &&
    type <= MYSTERY_GIFT_TYPE_MAX
  );
}

function flag(
  receivedFlags: Uint8Array,
  id: number,
): boolean {
  return (
    (receivedFlags[id >>> 3]! &
      (1 << (id & 7))) !==
    0
  );
}

export function decodePlatinumMysteryGift(
  bytes: Uint8Array,
): PlatinumMysteryGift {
  if (
    bytes.byteLength <
    PLATINUM_MYSTERY_GIFT_ENTRY_SIZE
  ) {
    throw new Error(
      `Truncated Platinum MysteryGift entry: ${bytes.byteLength} bytes, expected ${PLATINUM_MYSTERY_GIFT_ENTRY_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const storedChecksum = view.getUint16(
    CHECKSUM_OFFSET,
    true,
  );

  const calculatedChecksum = crc16Ccitt(
    bytes,
    0,
    CHECKSUM_BODY_SIZE,
  );

  if (storedChecksum !== calculatedChecksum) {
    throw new Error(
      `Invalid Platinum MysteryGift checksum 0x${storedChecksum
        .toString(16)
        .padStart(4, '0')}; calculated 0x${calculatedChecksum
        .toString(16)
        .padStart(4, '0')}`,
    );
  }

  const receivedFlags = bytes
    .subarray(0, RECEIVED_FLAGS_SIZE)
    .slice();

  const deliveries = Array.from(
    {
      length:
        PLATINUM_MYSTERY_GIFT_DELIVERY_COUNT,
    },
    (_, slot): PlatinumMysteryGiftDelivery | null => {
      const offset =
        DELIVERY_OFFSET + slot * DELIVERY_SIZE;
      const type = view.getUint16(offset, true);

      if (!validGiftType(type)) {
        return null;
      }

      return {
        type,
        wondercardSlot:
          view.getUint16(offset + 2, true) &
          0x3,
      };
    },
  );

  const cards = Array.from(
    {
      length: PLATINUM_MYSTERY_GIFT_CARD_COUNT,
    },
    (_, slot): PlatinumMysteryGiftCard | null => {
      const offset =
        CARD_OFFSET + slot * CARD_SIZE;
      const type = view.getUint16(offset, true);

      if (!validGiftType(type)) {
        return null;
      }

      return {
        type,
        id: view.getUint16(
          offset + CARD_ID_OFFSET,
          true,
        ),
        saveDelivery:
          (view.getUint8(
            offset + CARD_FLAGS_OFFSET,
          ) &
            0x08) !==
          0,
        species: [
          view.getUint16(
            offset + CARD_SPECIES_OFFSET,
            true,
          ),
          view.getUint16(
            offset + CARD_SPECIES_OFFSET + 2,
            true,
          ),
          view.getUint16(
            offset + CARD_SPECIES_OFFSET + 4,
            true,
          ),
        ],
        receivedDay: view.getInt32(
          offset + CARD_RECEIVED_DAY_OFFSET,
          true,
        ),
      };
    },
  );

  return {
    unlocked: flag(
      receivedFlags,
      UNLOCKED_FLAG_ID,
    ),
    receivedFlags,
    deliveries,
    cards,
  };
}

export function readPlatinumMysteryGift(
  bytes: Uint8Array,
): PlatinumMysteryGift {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_MYSTERY_GIFT_OFFSET;

  return decodePlatinumMysteryGift(
    bytes.subarray(
      start,
      start +
        PLATINUM_MYSTERY_GIFT_ENTRY_SIZE,
    ),
  );
}
