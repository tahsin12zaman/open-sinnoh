import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumGameRecords,
  PLATINUM_GAME_RECORD_COUNT,
  PLATINUM_GAME_RECORDS_SIZE,
  PLATINUM_GAME_RECORD_U32_COUNT,
  readPlatinumGameRecords,
} from './platinum-game-records.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

const ENCODED_OFFSET = 0x04;
const ENCODED_SIZE = 0x1b4;
const SEED_OFFSET = 0x1b8;
const LCRNG_MULTIPLIER = 0x41c64e6d;
const LCRNG_INCREMENT = 0x6073;

function encodedFixture(
  records: readonly number[],
  modifier = 0x5353,
): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_GAME_RECORDS_SIZE,
  );

  const view = new DataView(bytes.buffer);
  view.setUint32(0, records[0] ?? 0, true);

  const decoded = new Uint8Array(ENCODED_SIZE);
  const decodedView = new DataView(decoded.buffer);

  for (
    let id = 1;
    id < PLATINUM_GAME_RECORD_U32_COUNT;
    id++
  ) {
    decodedView.setUint32(
      (id - 1) * 4,
      records[id] ?? 0,
      true,
    );
  }

  const u16Start =
    (PLATINUM_GAME_RECORD_U32_COUNT - 1) * 4;

  for (
    let id = PLATINUM_GAME_RECORD_U32_COUNT;
    id < PLATINUM_GAME_RECORD_COUNT;
    id++
  ) {
    decodedView.setUint16(
      u16Start +
        (id - PLATINUM_GAME_RECORD_U32_COUNT) *
          2,
      records[id] ?? 0,
      true,
    );
  }

  let byteSum = 0;

  for (const byte of decoded) {
    byteSum = (byteSum + byte) & 0xffff;
  }

  view.setUint16(SEED_OFFSET, byteSum, true);
  view.setUint16(
    SEED_OFFSET + 2,
    modifier,
    true,
  );

  let seed =
    (byteSum | (modifier << 16)) >>> 0;

  const encodedView = new DataView(
    bytes.buffer,
    ENCODED_OFFSET,
    ENCODED_SIZE,
  );

  for (
    let offset = 0;
    offset < ENCODED_SIZE;
    offset += 2
  ) {
    seed =
      (Math.imul(seed, LCRNG_MULTIPLIER) +
        LCRNG_INCREMENT) >>>
      0;

    encodedView.setUint16(
      offset,
      decodedView.getUint16(offset, true) ^
        (seed >>> 16),
      true,
    );
  }

  return bytes;
}

describe('Platinum GameRecords', () => {
  it('decodes all u32 and u16 records', () => {
    const expected = Array.from(
      { length: PLATINUM_GAME_RECORD_COUNT },
      (_, id) =>
        id < PLATINUM_GAME_RECORD_U32_COUNT
          ? id * 100_003
          : id * 101,
    );

    const decoded = decodePlatinumGameRecords(
      encodedFixture(expected),
    );

    expect(decoded.records).toEqual(expected);
    expect(decoded.records).toHaveLength(148);
    expect(decoded.modifier).toBe(0x5353);
  });

  it('rejects a truncated structure', () => {
    expect(() =>
      decodePlatinumGameRecords(
        new Uint8Array(
          PLATINUM_GAME_RECORDS_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it('rejects corrupted encoded data', () => {
    const fixture = encodedFixture(
      new Array(148).fill(0),
    );

    fixture[20] = fixture[20]! ^ 1;

    expect(() =>
      decodePlatinumGameRecords(fixture),
    ).toThrow(/byte sum/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const decoded =
        readPlatinumGameRecords(save);

      console.log('game records:', {
        steps: decoded.records[0],
        score: decoded.records[1],
        wildBattles: decoded.records[7],
        trainerBattles: decoded.records[8],
        caughtPokemon: decoded.records[9],
        byteSum: decoded.byteSum,
        modifier: decoded.modifier,
      });

      expect(decoded.records).toHaveLength(148);
      expect(decoded.records[0]).toBe(4586);
      expect(decoded.records[1]).toBe(168);
      expect(decoded.records[7]).toBe(43);
      expect(decoded.records[8]).toBe(24);
      expect(decoded.records[9]).toBe(3);
    },
  );
});
