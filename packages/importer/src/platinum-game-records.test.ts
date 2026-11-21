import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import type { PlatinumGameRecords } from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumGameRecords,
  convertPlatinumGameRecords,
} from './platinum-game-records.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function nativeRecords(): PlatinumGameRecords {
  const records = new Array<number>(148).fill(0);

  records[0] = 123;
  records[1] = 456;
  records[7] = 43;
  records[19] = 2;
  records[20] = 3;
  records[21] = 4;
  records[22] = 5;
  records[24] = 6;
  records[25] = 7;
  records[26] = 8;
  records[27] = 9;
  records[32] = 10;
  records[91] = 11;

  return {
    records,
    byteSum: 0,
    modifier: 0,
  };
}

describe('Platinum GameRecords import', () => {
  it('converts counts and Trainer Card totals', () => {
    const converted = convertPlatinumGameRecords(
      nativeRecords(),
      '2026-11-20',
    );

    expect(converted).toMatchObject({
      score: 456,
      hallOfFame: '2026-11-20',
      timesLinked: 39,
      linkBattleWins: 12,
      linkBattleLosses: 14,
      linkTrades: 8,
    });

    expect(converted.counts).toEqual({
      0: 123,
      7: 43,
      19: 2,
      20: 3,
      21: 4,
      22: 5,
      24: 6,
      25: 7,
      26: 8,
      27: 9,
      32: 10,
      91: 11,
    });

    expect(converted.counts).not.toHaveProperty(
      '1',
    );
  });

  it('rejects an incomplete record array', () => {
    const native = nativeRecords();
    native.records.pop();

    expect(() =>
      convertPlatinumGameRecords(native, null),
    ).toThrow(/147 records, expected 148/i);
  });

  it.skipIf(!savePath)(
    'applies records from a real Platinum save',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        records: {
          score: 999,
          hallOfFame: '2025-01-02',
          timesLinked: 999,
          linkBattleWins: 999,
          linkBattleLosses: 999,
          linkTrades: 999,
          counts: {
            100: 999,
          },
        },
      } as unknown as GameState;

      const converted =
        applyPlatinumGameRecords(base, save);

      console.log('converted game records:', {
        score: converted.records.score,
        hallOfFame:
          converted.records.hallOfFame,
        timesLinked:
          converted.records.timesLinked,
        linkBattleWins:
          converted.records.linkBattleWins,
        linkBattleLosses:
          converted.records.linkBattleLosses,
        linkTrades:
          converted.records.linkTrades,
        nonzeroCounts: Object.keys(
          converted.records.counts,
        ).length,
        steps: converted.records.counts[0],
        wildBattles:
          converted.records.counts[7],
        trainerBattles:
          converted.records.counts[8],
      });

      expect(converted.records.score).toBe(168);
      expect(
        converted.records.hallOfFame,
      ).toBe('2025-01-02');
      expect(converted.records.counts[0]).toBe(
        4586,
      );
      expect(converted.records.counts[7]).toBe(
        43,
      );
      expect(converted.records.counts[8]).toBe(
        24,
      );
      expect(converted.records.counts).not
        .toHaveProperty('1');

      expect(base.records.score).toBe(999);
      expect(base.records.counts).toEqual({
        100: 999,
      });
    },
  );
});
