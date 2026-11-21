import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parsePlatinumRoamers,
  PLATINUM_RECENT_ROUTES_OFFSET,
  PLATINUM_ROAMERS_OFFSET,
  PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET,
  PLATINUM_SPECIAL_ENCOUNTER_SIZE,
  readPlatinumRoamers,
} from './platinum-roamers.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum roamers', () => {
  it('parses an active synthetic roamer', () => {
    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );

    const view = new DataView(bytes.buffer);

    view.setInt32(
      PLATINUM_RECENT_ROUTES_OFFSET,
      200,
      true,
    );

    view.setInt32(
      PLATINUM_RECENT_ROUTES_OFFSET + 4,
      428,
      true,
    );

    const roamerOffset =
      PLATINUM_ROAMERS_OFFSET;

    view.setInt32(roamerOffset, 200, true);
    view.setUint32(
      roamerOffset + 4,
      0x2d6b59f1,
      true,
    );
    view.setUint32(
      roamerOffset + 8,
      0x12345678,
      true,
    );
    view.setUint16(
      roamerOffset + 0x0c,
      481,
      true,
    );
    view.setUint16(
      roamerOffset + 0x0e,
      73,
      true,
    );
    view.setUint8(roamerOffset + 0x10, 50);
    view.setUint8(roamerOffset + 0x11, 0x40);
    view.setUint8(roamerOffset + 0x12, 1);

    view.setUint8(
      PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET,
      27,
    );

    const state = parsePlatinumRoamers(bytes);

    expect(state.currentMapId).toBe(200);
    expect(state.previousMapId).toBe(428);
    expect(state.routeIndexes).toEqual([
      27, 0, 0, 0, 0, 0,
    ]);

    expect(state.roamers[0]).toEqual({
      currentMapId: 200,
      ivs: 0x2d6b59f1,
      personality: 0x12345678,
      species: 481,
      currentHp: 73,
      level: 50,
      status: 0x40,
      active: true,
    });

    expect(
      state.roamers.slice(1).every(
        (roamer) => !roamer.active,
      ),
    ).toBe(true);
  });

  it('rejects a truncated encounter block', () => {
    expect(() =>
      parsePlatinumRoamers(
        new Uint8Array(
          PLATINUM_SPECIAL_ENCOUNTER_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it('rejects an invalid route index', () => {
    const bytes = new Uint8Array(
      PLATINUM_SPECIAL_ENCOUNTER_SIZE,
    );

    bytes[
      PLATINUM_ROAMER_ROUTE_INDEXES_OFFSET
    ] = 29;

    expect(() =>
      parsePlatinumRoamers(bytes),
    ).toThrow(/route index 29/i);
  });

  it.skipIf(!savePath)(
    'reads the roamers from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const state = readPlatinumRoamers(save);

      console.log('roamers:', state);

      expect(state.roamers).toHaveLength(6);
      expect(state.routeIndexes).toHaveLength(6);

      for (const route of state.routeIndexes) {
        expect(route).toBeGreaterThanOrEqual(0);
        expect(route).toBeLessThan(29);
      }

      expect(
        state.roamers.every(
          (roamer) => !roamer.active,
        ),
      ).toBe(true);
    },
  );
});
