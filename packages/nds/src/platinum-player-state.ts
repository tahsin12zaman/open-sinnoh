import {
  PLATINUM_FIELD_STATE_OFFSET,
  selectPlatinumSaveBlocks,
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