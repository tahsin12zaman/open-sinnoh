import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
} from './platinum-save.ts';
import {
  encodePlatinumBag,
  parsePlatinumBag,
  PLATINUM_BAG_POCKETS,
  PLATINUM_BAG_SIZE,
  PLATINUM_REGISTERED_ITEM_OFFSET,
  readPlatinumBag,
  writePlatinumBag,
  type PlatinumBag,
} from './platinum-bag.ts';

function writeSlot(
  bytes: Uint8Array,
  pocketOffset: number,
  slot: number,
  item: number,
  quantity: number,
): void {
  const view = new DataView(bytes.buffer);
  const offset = pocketOffset + slot * 4;

  view.setUint16(offset, item, true);
  view.setUint16(
    offset + 2,
    quantity,
    true,
  );
}

function makeBlock(
  size: number,
  blockId: number,
  saveCounter: number,
  blockCounter: number,
): Uint8Array {
  const bytes = new Uint8Array(size);
  const footerOffset =
    size - PLATINUM_SAVE_FOOTER_SIZE;
  const view = new DataView(bytes.buffer);

  view.setUint32(
    footerOffset,
    saveCounter,
    true,
  );
  view.setUint32(
    footerOffset + 4,
    blockCounter,
    true,
  );
  view.setUint32(
    footerOffset + 8,
    size,
    true,
  );
  view.setUint32(
    footerOffset + 12,
    PLATINUM_SAVE_SIGNATURE,
    true,
  );
  view.setUint8(
    footerOffset + 16,
    blockId,
  );
  view.setUint16(
    footerOffset + 18,
    crc16Ccitt(bytes, 0, footerOffset),
    true,
  );

  return bytes;
}

function writeBlock(
  save: Uint8Array,
  copyOffset: number,
  specification: {
    offset: number;
    size: number;
    blockId: number;
  },
  saveCounter: number,
  blockCounter: number,
): void {
  save.set(
    makeBlock(
      specification.size,
      specification.blockId,
      saveCounter,
      blockCounter,
    ),
    copyOffset + specification.offset,
  );
}

function makeSave(): Uint8Array {
  const save = new Uint8Array(
    PLATINUM_SAVE_SIZE,
  );
  const [primary, backup] =
    PLATINUM_SAVE_COPY_OFFSETS;

  writeBlock(
    save,
    primary,
    PLATINUM_GENERAL_BLOCK,
    50,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_GENERAL_BLOCK,
    50,
    2,
  );
  writeBlock(
    save,
    primary,
    PLATINUM_STORAGE_BLOCK,
    50,
    1,
  );
  writeBlock(
    save,
    backup,
    PLATINUM_STORAGE_BLOCK,
    50,
    2,
  );

  return save;
}

const bag: PlatinumBag = {
  pockets: {
    items: [
      { item: 1, quantity: 3 },
      { item: 2, quantity: 999 },
    ],
    keyItems: [
      { item: 428, quantity: 1 },
    ],
    tmHms: [
      { item: 328, quantity: 5 },
    ],
    mail: [
      { item: 137, quantity: 1 },
    ],
    medicine: [
      { item: 17, quantity: 12 },
    ],
    berries: [
      { item: 149, quantity: 8 },
    ],
    pokeballs: [
      { item: 4, quantity: 20 },
    ],
    battleItems: [
      { item: 55, quantity: 2 },
    ],
  },
  registeredItem: 428,
};

describe('Platinum Bag', () => {
  it('parses every pocket and the registered item', () => {
    const bytes = new Uint8Array(
      PLATINUM_BAG_SIZE,
    );

    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.items.offset,
      0,
      1,
      3,
    );
    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.keyItems.offset,
      2,
      428,
      1,
    );
    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.tmHms.offset,
      0,
      328,
      5,
    );
    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.mail.offset,
      0,
      137,
      1,
    );
    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.medicine.offset,
      0,
      17,
      12,
    );
    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.berries.offset,
      0,
      149,
      8,
    );
    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.pokeballs.offset,
      0,
      4,
      20,
    );
    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.battleItems.offset,
      0,
      55,
      2,
    );

    const view = new DataView(bytes.buffer);

    view.setUint32(
      PLATINUM_REGISTERED_ITEM_OFFSET,
      428,
      true,
    );

    expect(parsePlatinumBag(bytes)).toEqual({
      pockets: {
        items: [{ item: 1, quantity: 3 }],
        keyItems: [{ item: 428, quantity: 1 }],
        tmHms: [{ item: 328, quantity: 5 }],
        mail: [{ item: 137, quantity: 1 }],
        medicine: [{ item: 17, quantity: 12 }],
        berries: [{ item: 149, quantity: 8 }],
        pokeballs: [{ item: 4, quantity: 20 }],
        battleItems: [{ item: 55, quantity: 2 }],
      },
      registeredItem: 428,
    });
  });

  it('encodes and parses every pocket', () => {
    const bytes = new Uint8Array(
      PLATINUM_BAG_SIZE,
    );

    encodePlatinumBag(bytes, bag);

    expect(parsePlatinumBag(bytes)).toEqual(
      bag,
    );
  });

  it('round-trips the Bag through a complete save', () => {
    const written =
      writePlatinumBag(makeSave(), bag);

    expect(
      readPlatinumBag(written),
    ).toEqual(bag);
  });

  it('clears unused slots when replacing a pocket', () => {
    const bytes = new Uint8Array(
      PLATINUM_BAG_SIZE,
    );

    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.items.offset,
      20,
      99,
      10,
    );

    encodePlatinumBag(bytes, bag);

    expect(parsePlatinumBag(bytes)).toEqual(
      bag,
    );
  });

  it('rejects invalid and overflowing slots', () => {
    const bytes = new Uint8Array(
      PLATINUM_BAG_SIZE,
    );

    expect(() =>
      encodePlatinumBag(bytes, {
        ...bag,
        pockets: {
          ...bag.pockets,
          items: [
            { item: 1, quantity: 0 },
          ],
        },
      }),
    ).toThrow(/quantity/i);

    expect(() =>
      encodePlatinumBag(bytes, {
        ...bag,
        pockets: {
          ...bag.pockets,
          pokeballs: Array.from(
            {
              length:
                PLATINUM_BAG_POCKETS
                  .pokeballs.size + 1,
            },
            () => ({
              item: 4,
              quantity: 1,
            }),
          ),
        },
      }),
    ).toThrow(/maximum/i);
  });

  it('rejects a half-empty slot', () => {
    const bytes = new Uint8Array(
      PLATINUM_BAG_SIZE,
    );

    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.items.offset,
      0,
      1,
      0,
    );

    expect(() =>
      parsePlatinumBag(bytes),
    ).toThrow(/item 1, quantity 0/i);
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'reads every pocket from a real Platinum save',
    () => {
      const bytes = new Uint8Array(
        readFileSync(
          process.env.OPENSINNOH_NDS_SAV!,
        ),
      );

      const realBag =
        readPlatinumBag(bytes);

      console.log('bag:', {
        pocketCounts: Object.fromEntries(
          Object.entries(
            realBag.pockets,
          ).map(
            ([name, slots]) => [
              name,
              slots.length,
            ],
          ),
        ),
        firstSlots: Object.fromEntries(
          Object.entries(
            realBag.pockets,
          ).map(
            ([name, slots]) => [
              name,
              slots.slice(0, 8),
            ],
          ),
        ),
        registeredItem:
          realBag.registeredItem,
      });

      for (
        const slots of Object.values(
          realBag.pockets,
        )
      ) {
        for (const slot of slots) {
          expect(slot.item).toBeGreaterThan(0);
          expect(
            slot.quantity,
          ).toBeGreaterThan(0);
          expect(
            slot.quantity,
          ).toBeLessThanOrEqual(999);
        }
      }
    },
  );
});
