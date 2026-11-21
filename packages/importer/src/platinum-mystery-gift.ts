import type {
  GameState,
  MysteryGiftId,
  MysteryGiftState,
} from '@opensinnoh/contracts';
import {
  type PlatinumMysteryGift,
  type PlatinumMysteryGiftCard,
  type PlatinumMysteryGiftDelivery,
  readPlatinumMysteryGift,
  readPlatinumSystemData,
} from '@opensinnoh/nds';

const REGIGIGAS_SPECIES = 486;
const NITRO_RTC_EPOCH = Date.UTC(2000, 0, 1);
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function giftForType(
  type: number,
): MysteryGiftId | null {
  switch (type) {
    case 8:
      return 'darkrai';
    case 9:
      return 'shaymin';
    case 10:
      return 'arceus';
    case 12:
      return 'rotom';
    default:
      return null;
  }
}

function giftForCard(
  card: PlatinumMysteryGiftCard,
): MysteryGiftId | null {
  const typed = giftForType(card.type);

  if (typed) {
    return typed;
  }

  if (
    card.type === 1 &&
    card.species.includes(REGIGIGAS_SPECIES)
  ) {
    return 'regigigas';
  }

  return null;
}

function giftForDelivery(
  delivery: PlatinumMysteryGiftDelivery,
  cards: readonly (
    | PlatinumMysteryGiftCard
    | null
  )[],
): MysteryGiftId | null {
  const typed = giftForType(delivery.type);

  if (typed) {
    return typed;
  }

  if (delivery.type !== 1) {
    return null;
  }

  const card =
    cards[delivery.wondercardSlot] ?? null;

  return card ? giftForCard(card) : null;
}

function receivedFlag(
  raw: PlatinumMysteryGift,
  id: number,
): boolean {
  return (
    (raw.receivedFlags[id >>> 3]! &
      (1 << (id & 7))) !==
    0
  );
}

function receivedDate(day: number): string {
  if (!Number.isInteger(day) || day < 0) {
    throw new Error(
      `Invalid Platinum Wonder Card received day ${day}`,
    );
  }

  const date = new Date(
    NITRO_RTC_EPOCH + day * DAY_MILLISECONDS,
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `Invalid Platinum Wonder Card received day ${day}`,
    );
  }

  return date.toISOString().slice(0, 10);
}

export function convertPlatinumMysteryGift(
  raw: PlatinumMysteryGift,
  systemUnlocked = false,
): MysteryGiftState | undefined {
  const cards = raw.cards.map((card) => {
    if (!card) {
      return null;
    }

    const gift = giftForCard(card);

    if (!gift) {
      return null;
    }

    return {
      gift,
      received: receivedDate(card.receivedDay),
    };
  });

  const deliveries = raw.deliveries.map(
    (delivery) => {
      if (!delivery) {
        return null;
      }

      const gift = giftForDelivery(
        delivery,
        raw.cards,
      );

      if (!gift) {
        return null;
      }

      return {
        gift,
        card: delivery.wondercardSlot,
      };
    },
  );

  const received = new Set<MysteryGiftId>();

  raw.cards.forEach((card) => {
    if (!card || !receivedFlag(raw, card.id)) {
      return;
    }

    const gift = giftForCard(card);

    if (gift) {
      received.add(gift);
    }
  });

  deliveries.forEach((delivery) => {
    if (delivery) {
      received.add(delivery.gift);
    }
  });

  const unlocked =
    systemUnlocked ||
    raw.unlocked ||
    cards.some((card) => card !== null) ||
    deliveries.some(
      (delivery) => delivery !== null,
    );

  if (!unlocked && received.size === 0) {
    return undefined;
  }

  return {
    unlocked,
    received: [...received],
    cards,
    deliveries,
  };
}

export function applyPlatinumMysteryGift(
  state: GameState,
  save: Uint8Array,
): GameState {
  const raw = readPlatinumMysteryGift(save);
  const system =
    readPlatinumSystemData(save);

  const mysteryGift =
    convertPlatinumMysteryGift(
      raw,
      system.mysteryGiftUnlocked,
    );

  if (!mysteryGift) {
    const withoutMysteryGift = { ...state };
    delete withoutMysteryGift.mysteryGift;
    return withoutMysteryGift;
  }

  return {
    ...state,
    mysteryGift,
  };
}
