import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumMiscData,
  convertPlatinumTabletName,
} from './platinum-misc.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum miscellaneous save import', () => {
  it('converts an unset tablet name', () => {
    expect(
      convertPlatinumTabletName([
        0xffff,
        0xffff,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ]),
    ).toBeUndefined();
  });

  it('converts a written tablet name', () => {
    expect(
      convertPlatinumTabletName([
        318, // T
        336, // l
        325, // a
        338, // n
        335, // k
        343, // s
        0xffff,
        0,
        0,
        0,
        0,
      ]),
    ).toBe('Tlanks');
  });

  it.skipIf(!savePath)(
    'applies a real Platinum MiscSaveBlock',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const state = {
        mapFeatures: {
          kind: 'villa',
        },
        tabletName: 'Old',
      } as unknown as GameState;

      const converted =
        applyPlatinumMiscData(state, save);

      expect(converted.mapFeatures).toBeNull();
      expect(converted.tabletName).toBeUndefined();

      console.log('converted misc data:', {
        mapFeatures: converted.mapFeatures,
        tabletName: converted.tabletName,
      });
    },
  );
});