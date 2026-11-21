import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodePlatinumJournal,
  PLATINUM_JOURNAL_ENTRY_SIZE,
  PLATINUM_JOURNAL_PAGE_SIZE,
  readPlatinumJournal,
} from './platinum-journal.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

function title(
  year: number,
  month: number,
  weekday: number,
  day: number,
  mapHeaderId: number,
): number {
  return (
    year |
    (month << 7) |
    (weekday << 11) |
    (day << 14) |
    (mapHeaderId << 19)
  ) >>> 0;
}

function event(
  type: number,
  value: number,
  trainer: number,
): number {
  return (
    (value << 16) |
    ((trainer & 0x3ff) << 6) |
    (type & 0x3f)
  ) >>> 0;
}

function journalFixture(): Uint8Array {
  const bytes = new Uint8Array(
    PLATINUM_JOURNAL_ENTRY_SIZE,
  );

  const view = new DataView(bytes.buffer);

  view.setUint32(
    0,
    title(25, 7, 6, 19, 200),
    true,
  );

  view.setUint32(
    4,
    event(3, 0, 0),
    true,
  );

  view.setUint32(
    8,
    event(10, 4, 123),
    true,
  );

  view.setUint8(0x14, 1);
  view.setUint8(
    0x15,
    1 | (3 << 2) | (1 << 6),
  );
  view.setUint16(0x16, 403, true);

  view.setUint16(
    0x18,
    (414 << 1) | 1,
    true,
  );
  view.setUint16(0x1a, 200, true);

  const second = PLATINUM_JOURNAL_PAGE_SIZE;

  view.setUint32(
    second,
    title(25, 7, 1, 14, 344),
    true,
  );

  return bytes;
}

describe('Platinum Journal', () => {
  it('decodes pages, events, Pokémon, and trainers', () => {
    const decoded = decodePlatinumJournal(
      journalFixture(),
    );

    expect(decoded.pages).toHaveLength(2);

    expect(decoded.pages[0]).toEqual({
      date: {
        year: 25,
        month: 7,
        day: 19,
        weekday: 6,
      },
      mapHeaderId: 200,
      events: [
        {
          type: 3,
          value: 0,
          trainer: 0,
        },
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
        gender: 1,
        species: 403,
      },
      trainer: {
        standard: true,
        trainer: 414,
        mapHeaderId: 200,
      },
    });

    expect(decoded.pages[1]).toEqual({
      date: {
        year: 25,
        month: 7,
        day: 14,
        weekday: 1,
      },
      mapHeaderId: 344,
      events: [],
      mon: null,
      trainer: null,
    });
  });

  it('decodes a defeated Pokémon line', () => {
    const fixture = journalFixture();

    fixture[0x14] = 2;

    expect(
      decodePlatinumJournal(fixture)
        .pages[0]!.mon?.result,
    ).toBe('defeated');
  });

  it('rejects an invalid page date', () => {
    const fixture = journalFixture();
    const view = new DataView(fixture.buffer);

    view.setUint32(
      0,
      title(25, 0, 0, 19, 200),
      true,
    );

    expect(() =>
      decodePlatinumJournal(fixture),
    ).toThrow(/invalid.*date/i);
  });

  it('rejects an invalid event type', () => {
    const fixture = journalFixture();
    const view = new DataView(fixture.buffer);

    view.setUint32(
      4,
      event(41, 0, 0),
      true,
    );

    expect(() =>
      decodePlatinumJournal(fixture),
    ).toThrow(/event type 41/i);
  });

  it('rejects a truncated entry', () => {
    expect(() =>
      decodePlatinumJournal(
        new Uint8Array(
          PLATINUM_JOURNAL_ENTRY_SIZE - 1,
        ),
      ),
    ).toThrow(/truncated/i);
  });

  it.skipIf(!savePath)(
    'reads a real Platinum Journal',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const decoded =
        readPlatinumJournal(save);

      console.dir(
        {
          journalPages: decoded.pages,
        },
        { depth: null },
      );

      expect(decoded.pages).toHaveLength(3);
      expect(decoded.pages[0]?.date).toEqual({
        year: 25,
        month: 7,
        day: 19,
        weekday: 6,
      });
      expect(
        decoded.pages[0]?.mapHeaderId,
      ).toBe(200);
    },
  );
});
