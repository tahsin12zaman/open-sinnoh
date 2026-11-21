import {
  PLATINUM_FIELD_STATE_OFFSET,
  selectPlatinumSaveBlocks,
  writePlatinumSave,
} from './platinum-save.ts';

export const PLATINUM_BADGES_OFFSET = 0x82;
export const PLATINUM_PLAYER_DATA_OFFSET =
  PLATINUM_FIELD_STATE_OFFSET + 0x8c;

export interface PlatinumPlayerState {
  badgeBits: number;
  cyclingGear: number;
  runningShoes: boolean;
  playerState: number;
}

export function readPlatinumPlayerState(
  bytes: Uint8Array,
): PlatinumPlayerState {
  const { general } = selectPlatinumSaveBlocks(bytes);
  const base = general.offset;

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const cyclingGear = view.getUint16(
    base + PLATINUM_PLAYER_DATA_OFFSET,
    true,
  );

  const runningShoes = view.getUint16(
    base + PLATINUM_PLAYER_DATA_OFFSET + 2,
    true,
  );

  const playerState = view.getUint32(
    base + PLATINUM_PLAYER_DATA_OFFSET + 4,
    true,
  );

  if (cyclingGear !== 0 && cyclingGear !== 1) {
    throw new Error(
      `Invalid Platinum cycling gear ${cyclingGear}`,
    );
  }

  if (runningShoes !== 0 && runningShoes !== 1) {
    throw new Error(
      `Invalid Platinum running-shoes value ${runningShoes}`,
    );
  }

  if (
    playerState !== 0 &&
    playerState !== 1 &&
    playerState !== 2
  ) {
    throw new Error(
      `Unsupported saved Platinum player state ${playerState}`,
    );
  }

  return {
    badgeBits: view.getUint8(
      base + PLATINUM_BADGES_OFFSET,
    ),
    cyclingGear,
    runningShoes: runningShoes === 1,
    playerState,
  };
}

export function writePlatinumPlayerState(
  bytes: Uint8Array,
  player: PlatinumPlayerState,
): Uint8Array {
  if (
    !Number.isInteger(player.badgeBits) ||
    player.badgeBits < 0 ||
    player.badgeBits > 0xff
  ) {
    throw new Error(
      `Invalid Platinum badge bits ${player.badgeBits}`,
    );
  }

  if (
    player.cyclingGear !== 0 &&
    player.cyclingGear !== 1
  ) {
    throw new Error(
      `Invalid Platinum cycling gear ${player.cyclingGear}`,
    );
  }

  if (typeof player.runningShoes !== 'boolean') {
    throw new Error(
      'Invalid Platinum running-shoes value',
    );
  }

  if (
    player.playerState !== 0 &&
    player.playerState !== 1 &&
    player.playerState !== 2
  ) {
    throw new Error(
      `Invalid Platinum player state ${player.playerState}`,
    );
  }

  return writePlatinumSave(
    bytes,
    ({ general }) => {
      const view = new DataView(
        general.buffer,
        general.byteOffset,
        general.byteLength,
      );

      view.setUint8(
        PLATINUM_BADGES_OFFSET,
        player.badgeBits,
      );
      view.setUint16(
        PLATINUM_PLAYER_DATA_OFFSET,
        player.cyclingGear,
        true,
      );
      view.setUint16(
        PLATINUM_PLAYER_DATA_OFFSET + 2,
        player.runningShoes ? 1 : 0,
        true,
      );
      view.setUint32(
        PLATINUM_PLAYER_DATA_OFFSET + 4,
        player.playerState,
        true,
      );
    },
  );
}
