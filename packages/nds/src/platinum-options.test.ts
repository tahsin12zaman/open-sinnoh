import { readFileSync } from 'node:fs';
import {
  crc16Ccitt,
  PLATINUM_GENERAL_BLOCK,
  PLATINUM_SAVE_COPY_OFFSETS,
  PLATINUM_SAVE_FOOTER_SIZE,
  PLATINUM_SAVE_SIGNATURE,
  PLATINUM_SAVE_SIZE,
  PLATINUM_STORAGE_BLOCK,
} from './platinum-save.ts';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumOptions,
  encodePlatinumOptions,
  readPlatinumOptions,
  writePlatinumOptions,
} from './platinum-options.ts';

function optionsSave(): Uint8Array {
  const save = new Uint8Array(
    PLATINUM_SAVE_SIZE,
  );
  const [primary, backup] =
    PLATINUM_SAVE_COPY_OFFSETS;

  for (const copy of [primary, backup]) {
    const counter =
      copy === primary ? 1 : 2;

    for (const specification of [
      PLATINUM_GENERAL_BLOCK,
      PLATINUM_STORAGE_BLOCK,
    ]) {
      const block = new Uint8Array(
        specification.size,
      );
      const footer =
        specification.size -
        PLATINUM_SAVE_FOOTER_SIZE;
      const view = new DataView(
        block.buffer,
      );

      view.setUint32(footer, 60, true);
      view.setUint32(
        footer + 4,
        counter,
        true,
      );
      view.setUint32(
        footer + 8,
        specification.size,
        true,
      );
      view.setUint32(
        footer + 12,
        PLATINUM_SAVE_SIGNATURE,
        true,
      );
      view.setUint8(
        footer + 16,
        specification.blockId,
      );
      view.setUint16(
        footer + 18,
        crc16Ccitt(block, 0, footer),
        true,
      );

      save.set(
        block,
        copy + specification.offset,
      );
    }
  }

  return save;
}

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum options', () => {
  it('decodes every Options bitfield', () => {
    const value =
      2 |
      (1 << 4) |
      (1 << 6) |
      (0 << 7) |
      (2 << 8) |
      (19 << 10);

    expect(decodePlatinumOptions(value)).toEqual({
      textSpeed: 2,
      soundMode: 1,
      battleStyle: 1,
      battleScene: 0,
      buttonMode: 2,
      frame: 19,
    });
  });

  it('rejects reserved option values', () => {
    expect(() =>
      decodePlatinumOptions(3),
    ).toThrow(/text speed/i);

    expect(() =>
      decodePlatinumOptions(2 << 4),
    ).toThrow(/sound mode/i);

    expect(() =>
      decodePlatinumOptions(3 << 8),
    ).toThrow(/button mode/i);

    expect(() =>
      decodePlatinumOptions(20 << 10),
    ).toThrow(/message frame/i);
  });

  it.skipIf(!savePath)(
    'reads options from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const options = readPlatinumOptions(save);

      console.log('options:', options);

      expect(options.textSpeed).toBeGreaterThanOrEqual(0);
      expect(options.textSpeed).toBeLessThanOrEqual(2);
      expect(options.soundMode).toBeGreaterThanOrEqual(0);
      expect(options.soundMode).toBeLessThanOrEqual(1);
      expect(options.battleStyle).toBeGreaterThanOrEqual(0);
      expect(options.battleStyle).toBeLessThanOrEqual(1);
      expect(options.battleScene).toBeGreaterThanOrEqual(0);
      expect(options.battleScene).toBeLessThanOrEqual(1);
      expect(options.buttonMode).toBeGreaterThanOrEqual(0);
      expect(options.buttonMode).toBeLessThanOrEqual(2);
      expect(options.frame).toBeGreaterThanOrEqual(0);
      expect(options.frame).toBeLessThanOrEqual(19);
    },
  );

  it('encodes and round-trips options', () => {
    const options = {
      textSpeed: 2,
      soundMode: 1,
      battleStyle: 1,
      battleScene: 0,
      buttonMode: 2,
      frame: 19,
    };

    expect(
      decodePlatinumOptions(
        encodePlatinumOptions(options),
      ),
    ).toEqual(options);

    const save = optionsSave();
    const original = save.slice();
    const written = writePlatinumOptions(
      save,
      options,
    );

    expect(save).toEqual(original);
    expect(
      readPlatinumOptions(written),
    ).toEqual(options);
  });

});
