import { selectPlatinumSaveBlocks } from './platinum-save.ts';

export const PLATINUM_TRAINER_CASE_OFFSET = 0x5b88;
export const PLATINUM_BADGE_POLISH_COUNT = 8;
export const PLATINUM_SIGNATURE_SIZE = 0x600;
export const PLATINUM_TRAINER_CASE_SIZE = 0x620;

const BADGE_POLISH_SIZE =
  PLATINUM_BADGE_POLISH_COUNT * 4;

export interface PlatinumTrainerCase {
  badgePolish: number[];
  signature: Uint8Array;
}

export function decodePlatinumTrainerCase(
  bytes: Uint8Array,
): PlatinumTrainerCase {
  if (
    bytes.byteLength <
    PLATINUM_TRAINER_CASE_SIZE
  ) {
    throw new Error(
      `Truncated Platinum TrainerCaseSaveData: ${bytes.byteLength} bytes, expected ${PLATINUM_TRAINER_CASE_SIZE}`,
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const badgePolish = Array.from(
    { length: PLATINUM_BADGE_POLISH_COUNT },
    (_, index) => view.getInt32(index * 4, true),
  );

  const signature = bytes
    .subarray(
      BADGE_POLISH_SIZE,
      BADGE_POLISH_SIZE + PLATINUM_SIGNATURE_SIZE,
    )
    .slice();

  return {
    badgePolish,
    signature,
  };
}

export function readPlatinumTrainerCase(
  bytes: Uint8Array,
): PlatinumTrainerCase {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_TRAINER_CASE_OFFSET;

  return decodePlatinumTrainerCase(
    bytes.subarray(
      start,
      start + PLATINUM_TRAINER_CASE_SIZE,
    ),
  );
}
