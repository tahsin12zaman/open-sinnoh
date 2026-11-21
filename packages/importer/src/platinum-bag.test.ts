import { readFileSync } from 'node:fs';
import type { PlatinumBag } from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  convertPlatinumBag,
  importPlatinumBag,
} from './platinum-bag.ts';

function makeNativeBag(): PlatinumBag {
  return {
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
    registeredItem: 1,
  };
}

describe('Platinum Bag import', () => {
  it('maps all native pockets to OpenSinnoh pocket names', () => {
    const converted = convertPlatinumBag(
      makeNativeBag(),
    );

    expect(Object.keys(converted.bag)).toEqual([
      'items',
      'key_items',
      'tmhms',
      'mail',
      'medicine',
      'berries',
      'balls',
      'battle_items',
    ]);

    expect(converted.bag.items).toEqual([
      {
        item: 'platinum:ITEM_MASTER_BALL',
        count: 3,
      },
    ]);

    expect(converted.bag.balls).toEqual([
      {
        item: 'platinum:ITEM_POKE_BALL',
        count: 20,
      },
    ]);

    expect(converted.bag.key_items).toHaveLength(1);
    expect(converted.bag.tmhms).toHaveLength(1);
    expect(converted.bag.mail).toHaveLength(1);
    expect(converted.bag.medicine).toHaveLength(1);
    expect(converted.bag.berries).toHaveLength(1);
    expect(converted.bag.battle_items).toHaveLength(1);

    expect(converted.registeredItem).toBe(
      'platinum:ITEM_MASTER_BALL',
    );
  });

  it('maps native registered item zero to null', () => {
    const native = makeNativeBag();
    native.registeredItem = 0;

    expect(
      convertPlatinumBag(native).registeredItem,
    ).toBeNull();
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'converts a real Platinum Bag',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const converted = importPlatinumBag(bytes);

      console.log('converted bag:', {
        pocketCounts: Object.fromEntries(
          Object.entries(converted.bag).map(
            ([name, slots]) => [name, slots.length],
          ),
        ),
        firstItems: Object.fromEntries(
          Object.entries(converted.bag).map(
            ([name, slots]) => [
              name,
              slots.slice(0, 5),
            ],
          ),
        ),
        registeredItem: converted.registeredItem,
      });

      expect(Object.keys(converted.bag)).toHaveLength(8);

      for (const slots of Object.values(converted.bag)) {
        for (const slot of slots) {
          expect(slot.item).toMatch(
            /^platinum:ITEM_/,
          );
          expect(slot.count).toBeGreaterThan(0);
        }
      }
    },
  );
});