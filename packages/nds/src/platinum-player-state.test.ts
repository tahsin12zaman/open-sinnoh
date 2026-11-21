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
  PLATINUM_BADGES_OFFSET,
  PLATINUM_PLAYER_DATA_OFFSET,
  readPlatinumPlayerState,
} from './platinum-player-state.ts';

function makeBlock(
  size: number,
  blockId: number,
  saveCounter: number,
  blockCounter: number,
): Uint8Array {
  const bytes = new Uint8Array(size);
  const footerOffset = size - PLATINUM_SAVE_FOOTER_SIZE;
  const view = new DataView(bytes.buffer);

  view.setUint32(footerOffset, saveCounter, true);
  view.setUint32(footerOffset + 4, blockCounter, true);
  view.setUint32(footerOffset + 8, size, true);
  view.setUint32(
    footerOffset + 12,
    PLATINUM_SAVE_SIGNATURE,
    true,
  );
  view.setUint8(footerOffset + 16, blockId);
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

function refreshChecksum(
  save: Uint8Array,
  offset: number,
  size: number,
): void {
  const footerOffset =
    offset + size - PLATINUM_SAVE_FOOTER_SIZE;

  const view = new DataView(save.buffer);

  view.setUint16(
    footerOffset + 18,
    crc16Ccitt(save, offset, footerOffset),
    true,
  );
}

describe('Platinum player state', () => {
  it('reads badges, shoes, bike gear and movement state', () => {
    const save = new Uint8Array(PLATINUM_SAVE_SIZE);
    const [primary, backup] = PLATINUM_SAVE_COPY_OFFSETS;

    writeBlock(save, primary, PLATINUM_GENERAL_BLOCK, 20, 1);
    writeBlock(save, backup, PLATINUM_GENERAL_BLOCK, 20, 2);
    writeBlock(save, primary, PLATINUM_STORAGE_BLOCK, 20, 1);
    writeBlock(save, backup, PLATINUM_STORAGE_BLOCK, 20, 2);

    const view = new DataView(save.buffer);
    const base = backup + PLATINUM_GENERAL_BLOCK.offset;

    view.setUint8(base + PLATINUM_BADGES_OFFSET, 0b10100101);

    view.setUint16(
      base + PLATINUM_PLAYER_DATA_OFFSET,
      1,
      true,
    );

    view.setUint16(
      base + PLATINUM_PLAYER_DATA_OFFSET + 2,
      1,
      true,
    );

    view.setUint32(
      base + PLATINUM_PLAYER_DATA_OFFSET + 4,
      2,
      true,
    );

    refreshChecksum(
      save,
      base,
      PLATINUM_GENERAL_BLOCK.size,
    );

    expect(readPlatinumPlayerState(save)).toEqual({
      badgeBits: 0b10100101,
      cyclingGear: 1,
      runningShoes: true,
      playerState: 2,
    });
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'reads a real Platinum player state',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const player = readPlatinumPlayerState(bytes);

      console.log('player state:', player);

      expect(player.badgeBits).toBeGreaterThanOrEqual(0);
      expect(player.badgeBits).toBeLessThanOrEqual(0xff);
      expect([0, 1]).toContain(player.cyclingGear);
      expect([0, 1, 2]).toContain(player.playerState);
    },
  );
});