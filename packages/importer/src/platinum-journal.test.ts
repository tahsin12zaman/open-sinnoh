import { readFileSync } from 'node:fs';
import type {
  GameState,
} from '@opensinnoh/contracts';
import type {
  PlatinumJournal,
} from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumJournal,
  convertPlatinumJournal,
} from './platinum-journal.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum Journal import', () => {
  it('maps native IDs and copies page data', () => {
    const native: PlatinumJournal = {
      pages: [
        {
          date: {
            year: 25,
            month: 7,
            day: 19,
            weekday: 6,
          },
          mapHeaderId: 7000,
          events: [
            {
              type: 10,
              value: 4,
              trainer: 123,
            },
          ],
          mon: {
            result: 'caught',
            variant: 1,
            timeOfDay: 3,
            gender: 0,
            species: 600,
          },
          trainer: {
            standard: true,
            trainer: 1000,
            mapHeaderId: 7001,
          },
        },
      ],
    };

    expect(
      convertPlatinumJournal(native),
    ).toEqual([
      {
        date: {
          year: 25,
          month: 7,
          day: 19,
          weekday: 6,
        },
        zone: 'platinum:zone/7000',
        events: [
          {
            type: 10,
            value: 4,
            trainer: 123,
          },
        ],
        mon: {
          result: 'caught',
          variant: 1,
          timeOfDay: 3,
          gender: 0,
          species: 'platinum:species/600',
        },
        trainer: {
          trainer: 'platinum:trainer/1000',
          zone: 'platinum:zone/7001',
        },
      },
    ]);
  });

  it('keeps empty Pokémon and trainer lines null', () => {
    const native: PlatinumJournal = {
      pages: [
        {
          date: {
            year: 25,
            month: 1,
            day: 1,
            weekday: 3,
          },
          mapHeaderId: 0,
          events: [],
          mon: null,
          trainer: null,
        },
      ],
    };

    const [page] =
      convertPlatinumJournal(native);

    expect(page?.mon).toBeNull();
    expect(page?.trainer).toBeNull();
  });

  it.skipIf(!savePath)(
    'applies a real Platinum Journal',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        journal: [],
      } as unknown as GameState;

      const converted =
        applyPlatinumJournal(base, save);

      console.dir(
        {
          convertedJournal:
            converted.journal,
        },
        { depth: null },
      );

      expect(converted.journal).toHaveLength(
        3,
      );

      expect(
        converted.journal[0]?.date,
      ).toEqual({
        year: 25,
        month: 7,
        day: 19,
        weekday: 6,
      });

      expect(
        converted.journal[0]?.mon?.species,
      ).toBe('platinum:SPECIES_SHINX');

      expect(
        converted.journal[1]?.mon?.species,
      ).toBe('platinum:SPECIES_BIDOOF');

      expect(
        converted.journal[2]?.mon?.species,
      ).toBe('platinum:SPECIES_FINNEON');
    },
  );
});
