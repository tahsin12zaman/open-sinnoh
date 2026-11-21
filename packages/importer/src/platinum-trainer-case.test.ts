import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import {
  PLATINUM_SIGNATURE_SIZE,
} from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumTrainerCase,
  convertPlatinumSignature,
} from './platinum-trainer-case.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum Trainer Case import', () => {
  it('maps an empty signature to null', () => {
    expect(
      convertPlatinumSignature(
        new Uint8Array(
          PLATINUM_SIGNATURE_SIZE,
        ),
      ),
    ).toBeNull();
  });

  it('encodes a drawn signature as lowercase hex', () => {
    const signature = new Uint8Array(
      PLATINUM_SIGNATURE_SIZE,
    );

    signature[0] = 0x01;
    signature[1] = 0xab;
    signature[1535] = 0xff;

    const converted =
      convertPlatinumSignature(signature);

    expect(converted).not.toBeNull();
    expect(converted).toHaveLength(3072);
    expect(converted?.slice(0, 6)).toBe(
      '01ab00',
    );
    expect(converted?.slice(-2)).toBe('ff');
    expect(converted).toMatch(
      /^[0-9a-f]{3072}$/,
    );
  });

  it('rejects an incorrectly sized signature', () => {
    expect(() =>
      convertPlatinumSignature(
        new Uint8Array(
          PLATINUM_SIGNATURE_SIZE - 1,
        ),
      ),
    ).toThrow(/1535 bytes, expected 1536/i);
  });

  it.skipIf(!savePath)(
    'applies a real Platinum Trainer Case',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        signature: 'ff'.repeat(1536),
      } as unknown as GameState;

      const converted =
        applyPlatinumTrainerCase(base, save);

      console.log(
        'converted trainer signature:',
        converted.signature === null
          ? null
          : {
              characters:
                converted.signature.length,
              prefix:
                converted.signature.slice(0, 32),
            },
      );

      expect(converted.signature).toBeNull();
      expect(base.signature).toBe(
        'ff'.repeat(1536),
      );
    },
  );
});
