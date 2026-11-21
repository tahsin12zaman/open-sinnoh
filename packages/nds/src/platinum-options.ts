import { selectPlatinumSaveBlocks } from './platinum-save.ts';

/**
 * SAVE_TABLE_ENTRY_PLAYER begins at 0x64 in the general block.
 * Options is the first u16 in PlayerSave.
 */
export const PLATINUM_OPTIONS_OFFSET = 0x64;

export interface PlatinumOptions {
  textSpeed: number;
  soundMode: number;
  battleStyle: number;
  battleScene: number;
  buttonMode: number;
  frame: number;
}

export function decodePlatinumOptions(
  value: number,
): PlatinumOptions {
  const textSpeed = value & 0xf;
  const soundMode = (value >>> 4) & 0x3;
  const battleStyle = (value >>> 6) & 0x1;
  const battleScene = (value >>> 7) & 0x1;
  const buttonMode = (value >>> 8) & 0x3;
  const frame = (value >>> 10) & 0x1f;

  if (textSpeed > 2) {
    throw new Error(
      `Invalid Platinum text speed ${textSpeed}`,
    );
  }

  if (soundMode > 1) {
    throw new Error(
      `Invalid Platinum sound mode ${soundMode}`,
    );
  }

  if (buttonMode > 2) {
    throw new Error(
      `Invalid Platinum button mode ${buttonMode}`,
    );
  }

  if (frame > 19) {
    throw new Error(
      `Invalid Platinum message frame ${frame}`,
    );
  }

  return {
    textSpeed,
    soundMode,
    battleStyle,
    battleScene,
    buttonMode,
    frame,
  };
}

export function readPlatinumOptions(
  bytes: Uint8Array,
): PlatinumOptions {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const value = view.getUint16(
    general.offset + PLATINUM_OPTIONS_OFFSET,
    true,
  );

  return decodePlatinumOptions(value);
}
