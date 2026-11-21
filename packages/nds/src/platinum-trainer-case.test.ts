import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumTrainerCase,
  PLATINUM_SIGNATURE_SIZE,
  PLATINUM_TRAINER_CASE_SIZE,
  readPlatinumTrainerCase,
} from './platinum-trainer-case.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum TrainerCaseSaveData', () => {
  it('decodes badge polish and signature bytes', () => {
    const bytes = new Uint8Array(
      PLATINUM_TRAINER_CASE_SIZE,
    );

    const view = new DataView(bytes.buffer);

    for (let index = 0; index < 8; index++) {
      view.setInt32(
        index * 4,
        100 + index * 25,
        true,
      );
    }

    for (
      let index = 0;
      index < PLATINUM_SIGNATURE_SIZE;
      index++
    ) {
      bytes[0x20 + index] =
        (index * 17 + 3) & 0xff;
    }

    const decoded =
      decodePlatinumTrainerCase(bytes);

    expect(decoded.badgePolish).toEqual([
      100, 125, 150, 175,
      200, 225, 250, 275,
    ]);

    expect(decoded.signature).toHaveLength(
      PLATINUM_SIGNATURE_SIZE,
    );

    expect(decoded.signature[0]).toBe(3);
    expect(decoded.signature[1]).toBe(20);
    expect(decoded.signature[1535]).toBe(
      (1535 * 17 + 3) & 0xff,
    );
  });

  it('rejects a truncated structure', () => {
    expect(() =>
      decodePlatinumTrainerCase(
        new Uint8Array(
          PLATINUM_TRAINER_CASE_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum Trainer Case',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const trainerCase =
        readPlatinumTrainerCase(save);

      const drawnBytes =
        trainerCase.signature.filter(
          (byte) => byte !== 0,
        ).length;

      console.log('trainer case:', {
        badgePolish:
          trainerCase.badgePolish,
        signatureBytes:
          trainerCase.signature.length,
        drawnBytes,
      });

      expect(
        trainerCase.badgePolish,
      ).toHaveLength(8);

      expect(
        trainerCase.signature,
      ).toHaveLength(1536);

      expect(drawnBytes).toBeGreaterThanOrEqual(
        0,
      );
    },
  );
});
