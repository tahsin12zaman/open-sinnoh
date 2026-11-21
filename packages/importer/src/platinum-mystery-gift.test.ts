import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  PlatinumMysteryGift,
} from '@opensinnoh/nds';
import {
  convertPlatinumMysteryGift,
} from './platinum-mystery-gift.ts';

function raw(): PlatinumMysteryGift {
  const receivedFlags =
    new Uint8Array(0x100);

  // Wonder Card ID 123 was received.
  receivedFlags[123 >>> 3] |=
    1 << (123 & 7);

  return {
    unlocked: true,
    receivedFlags,
    deliveries: [
      {
        type: 8,
        wondercardSlot: 1,
      },
      {
        type: 1,
        wondercardSlot: 0,
      },
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    cards: [
      {
        type: 1,
        id: 123,
        saveDelivery: true,
        species: [486, 0, 0],
        receivedDay: 2,
      },
      {
        type: 8,
        id: 124,
        saveDelivery: true,
        species: [0, 0, 0],
        receivedDay: 3,
      },
      null,
    ],
  };
}

describe('Platinum Mystery Gift import', () => {
  it('maps supported cards and deliveries', () => {
    expect(
      convertPlatinumMysteryGift(raw()),
    ).toEqual({
      unlocked: true,
      received: [
        'regigigas',
        'darkrai',
      ],
      cards: [
        {
          gift: 'regigigas',
          received: '2000-01-03',
        },
        {
          gift: 'darkrai',
          received: '2000-01-04',
        },
        null,
      ],
      deliveries: [
        {
          gift: 'darkrai',
          card: 1,
        },
        {
          gift: 'regigigas',
          card: 0,
        },
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    });
  });

  it('omits a locked empty state', () => {
    const empty = raw();
    empty.unlocked = false;
    empty.receivedFlags.fill(0);
    empty.deliveries.fill(null);
    empty.cards.fill(null);

    expect(
      convertPlatinumMysteryGift(
        empty,
        false,
      ),
    ).toBeUndefined();

    expect(
      convertPlatinumMysteryGift(
        empty,
        true,
      ),
    ).toEqual({
      unlocked: true,
      received: [],
      cards: [null, null, null],
      deliveries: [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    });
  });

  it('rejects invalid received dates', () => {
    const value = raw();
    value.cards[0]!.receivedDay = -1;

    expect(() =>
      convertPlatinumMysteryGift(value),
    ).toThrow(/received day/);
  });
});
