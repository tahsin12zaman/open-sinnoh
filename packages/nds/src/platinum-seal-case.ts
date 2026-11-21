import {
  selectPlatinumSaveBlocks,
} from './platinum-save.ts';

export const PLATINUM_SEAL_CASE_OFFSET =
  0x6374;
export const PLATINUM_SEAL_CASE_SIZE = 0x170;
export const PLATINUM_SEAL_CASE_ENTRY_SIZE =
  0x178;

export const PLATINUM_SEAL_COUNT = 80;
export const PLATINUM_CAPSULE_COUNT = 12;
export const PLATINUM_SEALS_PER_CAPSULE = 8;
export const PLATINUM_MAX_SEALS_PER_TYPE = 99;

const BALL_SEAL_SIZE = 3;
const CAPSULES_SIZE =
  PLATINUM_CAPSULE_COUNT *
  PLATINUM_SEALS_PER_CAPSULE *
  BALL_SEAL_SIZE;

export interface PlatinumBallSeal {
  seal: number;
  x: number;
  y: number;
}

export interface PlatinumSealCase {
  counts: number[];
  capsules: PlatinumBallSeal[][];
}

export function decodePlatinumSealCase(
  bytes: Uint8Array,
): PlatinumSealCase {
  if (
    bytes.byteLength <
    PLATINUM_SEAL_CASE_ENTRY_SIZE
  ) {
    throw new Error(
      `Truncated Platinum SealCase entry: ${bytes.byteLength} bytes, expected ${PLATINUM_SEAL_CASE_ENTRY_SIZE}`,
    );
  }

  const capsules = Array.from(
    { length: PLATINUM_CAPSULE_COUNT },
    (_, capsule) => {
      const seals: PlatinumBallSeal[] = [];

      for (
        let slot = 0;
        slot < PLATINUM_SEALS_PER_CAPSULE;
        slot++
      ) {
        const offset =
          (capsule *
            PLATINUM_SEALS_PER_CAPSULE +
            slot) *
          BALL_SEAL_SIZE;

        const seal = bytes[offset]!;

        if (seal === 0) {
          continue;
        }

        if (seal > PLATINUM_SEAL_COUNT) {
          throw new Error(
            `Invalid Platinum seal id ${seal} in capsule ${capsule}, slot ${slot}`,
          );
        }

        seals.push({
          seal,
          x: bytes[offset + 1]!,
          y: bytes[offset + 2]!,
        });
      }

      return seals;
    },
  );

  const counts = Array.from(
    { length: PLATINUM_SEAL_COUNT },
    (_, id) => {
      const count =
        bytes[CAPSULES_SIZE + id]!;

      if (
        count >
        PLATINUM_MAX_SEALS_PER_TYPE
      ) {
        throw new Error(
          `Invalid Platinum loose seal count ${count} for seal ${id + 1}`,
        );
      }

      return count;
    },
  );

  return {
    counts,
    capsules,
  };
}

export function readPlatinumSealCase(
  bytes: Uint8Array,
): PlatinumSealCase {
  const { general } =
    selectPlatinumSaveBlocks(bytes);

  const start =
    general.offset +
    PLATINUM_SEAL_CASE_OFFSET;

  return decodePlatinumSealCase(
    bytes.subarray(
      start,
      start + PLATINUM_SEAL_CASE_ENTRY_SIZE,
    ),
  );
}
