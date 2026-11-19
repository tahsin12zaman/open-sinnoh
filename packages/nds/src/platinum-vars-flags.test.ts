import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parsePlatinumVarsFlags,
  PLATINUM_FLAGS_COUNT,
  PLATINUM_FLAGS_SIZE,
  PLATINUM_VARS_COUNT,
  PLATINUM_VARS_START,
  readPlatinumVarsFlags,
} from './platinum-vars-flags.ts';

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
});