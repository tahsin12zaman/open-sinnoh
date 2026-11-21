import fs from 'node:fs';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  crc16Ccitt,
} from './platinum-save.ts';
import {
  decodePlatinumMysteryGift,
  PLATINUM_MYSTERY_GIFT_ENTRY_SIZE,
  readPlatinumMysteryGift,
} from './platinum-mystery-gift.ts';

function fixture(): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_MYSTERY_GIFT_ENTRY_SIZE,
  );
  const view = new DataView(bytes.buffer);

  // Mystery Gift unlocked flag 2047.
  bytes[255] = 0x80;

  // Delivery 0: Darkrai, Wonder Card slot 2.
  view.setUint16(0x100, 8, true);
  view.setUint16(0x102, 2, true);

  // Card 0: Regigigas Pokémon gift.
  const card = 0x920;
  view.setUint16(card, 1, true);
  view.setUint16(card + 0x150, 123, true);
  view.setUint8(card + 0x152, 0x08);
  view.setUint16(
    card + 0x34a,
    486,
    true,
  );
  view.setInt32(card + 0x354, 2, true);

  view.setUint16(
    0x132c,
    crc16Ccitt(bytes, 0, 0x132c),
    true,
  );

  return bytes;
}

describe('Platinum Mystery Gift', () => {
  it('decodes flags, deliveries and cards', () => {
    const decoded =
      decodePlatinumMysteryGift(fixture());

    expect(decoded.unlocked).toBe(true);
    expect(decoded.deliveries[0]).toEqual({
      type: 8,
      wondercardSlot: 2,
    });
    expect(decoded.cards[0]).toEqual({
      type: 1,
      id: 123,
      saveDelivery: true,
      species: [486, 0, 0],
      receivedDay: 2,
    });
  });

  it('rejects truncation and bad checksums', () => {
    expect(() =>
      decodePlatinumMysteryGift(
        new Uint8Array(
          PLATINUM_MYSTERY_GIFT_ENTRY_SIZE - 1,
        ),
      ),
    ).toThrow(/Truncated/);

    const bytes = fixture();
    bytes[0x100] ^= 1;

    expect(() =>
      decodePlatinumMysteryGift(bytes),
    ).toThrow(/checksum/);
  });

  const savePath = process.env.OPENSINNOH_NDS_SAV;

  it.skipIf(!savePath)(
    'reads a real Platinum Rev 1 save',
    () => {
      const decoded =
        readPlatinumMysteryGift(
          fs.readFileSync(savePath!),
        );

      expect(decoded.receivedFlags)
        .toHaveLength(0x100);
      expect(decoded.deliveries)
        .toHaveLength(8);
      expect(decoded.cards)
        .toHaveLength(3);
    },
  );
});
