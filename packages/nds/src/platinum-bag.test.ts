import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parsePlatinumBag,
  PLATINUM_BAG_POCKETS,
  PLATINUM_REGISTERED_ITEM_OFFSET,
  readPlatinumBag,
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
  view.setUint16(offset + 2, quantity, true);
}

describe('Platinum Bag', () => {
  it('parses every pocket and the registered item', () => {
    const bytes = new Uint8Array(
      PLATINUM_REGISTERED_ITEM_OFFSET + 4,
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

  it('rejects a half-empty slot', () => {
    const bytes = new Uint8Array(
      PLATINUM_REGISTERED_ITEM_OFFSET + 4,
    );

    writeSlot(
      bytes,
      PLATINUM_BAG_POCKETS.items.offset,
      0,
      1,
      0,
    );

    expect(() => parsePlatinumBag(bytes)).toThrow(
      /item 1, quantity 0/i,
    );
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'reads every pocket from a real Platinum save',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const bag = readPlatinumBag(bytes);

      console.log('bag:', {
        pocketCounts: Object.fromEntries(
          Object.entries(bag.pockets).map(
            ([name, slots]) => [name, slots.length],
          ),
        ),
        firstSlots: Object.fromEntries(
          Object.entries(bag.pockets).map(
            ([name, slots]) => [name, slots.slice(0, 8)],
          ),
        ),
        registeredItem: bag.registeredItem,
      });

      for (const slots of Object.values(bag.pockets)) {
        for (const slot of slots) {
          expect(slot.item).toBeGreaterThan(0);
          expect(slot.quantity).toBeGreaterThan(0);
          expect(slot.quantity).toBeLessThanOrEqual(999);
        }
      }
    },
  );
});