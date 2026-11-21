import type { GameState } from '@opensinnoh/contracts';
import {
  PLATINUM_SIGNATURE_SIZE,
  readPlatinumTrainerCase,
} from '@opensinnoh/nds';

export function convertPlatinumSignature(
  signature: Uint8Array,
): string | null {
  if (
    signature.byteLength !==
    PLATINUM_SIGNATURE_SIZE
  ) {
    throw new Error(
      `Platinum signature has ${signature.byteLength} bytes, expected ${PLATINUM_SIGNATURE_SIZE}`,
    );
  }

  let hasDrawing = false;
  let encoded = '';

  for (const byte of signature) {
    if (byte !== 0) {
      hasDrawing = true;
    }

    encoded += byte
      .toString(16)
      .padStart(2, '0');
  }

  return hasDrawing ? encoded : null;
}

export function applyPlatinumTrainerCase(
  state: GameState,
  save: Uint8Array,
): GameState {
  const trainerCase =
    readPlatinumTrainerCase(save);

  return {
    ...state,
    signature: convertPlatinumSignature(
      trainerCase.signature,
    ),
  };
}
