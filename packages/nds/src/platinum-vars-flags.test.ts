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
  encodePlatinumVarsFlags,
  parsePlatinumVarsFlags,
  PLATINUM_FLAGS_COUNT,
  PLATINUM_FLAGS_SIZE,
  PLATINUM_VARS_COUNT,
  PLATINUM_VARS_START,
  readPlatinumVarsFlags,
  writePlatinumVarsFlags,
} from './platinum-vars-flags.ts';

function varsFlagsSave(): Uint8Array {
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

      view.setUint32(footer, 70, true);
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

describe('Platinum variables and flags', () => {
  it('parses native variables and flag bits', () => {
    const bytes = new Uint8Array(
      PLATINUM_VARS_COUNT * 2 +
        PLATINUM_FLAGS_SIZE,
    );

    const view = new DataView(bytes.buffer);

    view.setUint16(0, 123, true);
    view.setUint16(2, 456, true);
    view.setUint16(
      (PLATINUM_VARS_COUNT - 1) * 2,
      789,
      true,
    );

    const flagsOffset = PLATINUM_VARS_COUNT * 2;
    const setFlags = [1, 7, 8, 100, 2911];

    for (const flagId of setFlags) {
      bytes[
        flagsOffset + Math.floor(flagId / 8)
      ]! |= 1 << (flagId % 8);
    }

    const parsed = parsePlatinumVarsFlags(bytes);

    expect(parsed.vars[0]).toBe(123);
    expect(parsed.vars[1]).toBe(456);
    expect(parsed.vars.at(-1)).toBe(789);
    expect(parsed.flags).toEqual(setFlags);
  });

  it('rejects truncated variable/flag data', () => {
    expect(() =>
      parsePlatinumVarsFlags(new Uint8Array(10)),
    ).toThrow(/outside/i);
  });

  it.skipIf(!process.env.OPENSINNOH_NDS_SAV)(
    'reads variables and flags from a real Platinum save',
    () => {
      const bytes = new Uint8Array(
        readFileSync(process.env.OPENSINNOH_NDS_SAV!),
      );

      const parsed = readPlatinumVarsFlags(bytes);

      const nonzeroVars = parsed.vars
        .map((value, index) => ({
          id: PLATINUM_VARS_START + index,
          value,
        }))
        .filter(({ value }) => value !== 0);

      console.log('vars/flags:', {
        nonzeroVariableCount: nonzeroVars.length,
        firstNonzeroVariables: nonzeroVars.slice(0, 20),
        setFlagCount: parsed.flags.length,
        firstSetFlags: parsed.flags.slice(0, 30),
      });

      expect(parsed.vars).toHaveLength(
        PLATINUM_VARS_COUNT,
      );

      expect(parsed.flags.length).toBeGreaterThan(0);

      for (const flagId of parsed.flags) {
        expect(flagId).toBeGreaterThan(0);
        expect(flagId).toBeLessThan(
          PLATINUM_FLAGS_COUNT,
        );
      }
    },
  );

  it('encodes and round-trips all variables and flags', () => {
    const vars = Array<number>(
      PLATINUM_VARS_COUNT,
    ).fill(0);

    vars[0] = 123;
    vars[1] = 456;
    vars[PLATINUM_VARS_COUNT - 1] =
      0xffff;

    const data = {
      vars,
      flags: [
        1,
        7,
        8,
        100,
        2911,
        100,
      ],
    };

    const raw = new Uint8Array(
      PLATINUM_VARS_COUNT * 2 +
        PLATINUM_FLAGS_SIZE,
    );

    raw[PLATINUM_VARS_COUNT * 2] = 1;

    encodePlatinumVarsFlags(raw, data);

    expect(
      parsePlatinumVarsFlags(raw),
    ).toEqual({
      vars,
      flags: [1, 7, 8, 100, 2911],
    });

    expect(
      raw[PLATINUM_VARS_COUNT * 2]! & 1,
    ).toBe(1);

    const save = varsFlagsSave();
    const original = save.slice();

    const written =
      writePlatinumVarsFlags(
        save,
        data,
      );

    expect(save).toEqual(original);
    expect(
      readPlatinumVarsFlags(written),
    ).toEqual({
      vars,
      flags: [1, 7, 8, 100, 2911],
    });
  });

  it('rejects invalid variables and flags', () => {
    const vars = Array<number>(
      PLATINUM_VARS_COUNT,
    ).fill(0);

    expect(() =>
      writePlatinumVarsFlags(
        varsFlagsSave(),
        {
          vars: vars.slice(1),
          flags: [],
        },
      ),
    ).toThrow(/variable count/i);

    expect(() =>
      writePlatinumVarsFlags(
        varsFlagsSave(),
        {
          vars,
          flags: [PLATINUM_FLAGS_COUNT],
        },
      ),
    ).toThrow(/flag ID/i);
  });

});