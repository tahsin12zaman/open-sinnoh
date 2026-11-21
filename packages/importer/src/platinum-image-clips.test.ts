import { readFileSync } from 'node:fs';
import type {
  GameState,
} from '@opensinnoh/contracts';
import type {
  PlatinumImageClips,
  PlatinumPhotoPokemon,
} from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumImageClips,
  convertPlatinumImageClips,
} from './platinum-image-clips.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

const TEST_NAME_CODES = [
  318,
  329,
  343,
  344,
  0xffff,
  0,
  0,
  0,
];

function photoMon(): PlatinumPhotoPokemon {
  return {
    pid: 0x12345678,
    otId: 0x87654321,
    species: 403,
    nicknameCodes: [
      ...TEST_NAME_CODES,
      0,
      0,
      0,
    ],
    trainerNameCodes: TEST_NAME_CODES,
    priority: -2,
    x: 190,
    y: 70,
    form: 1,
    trainerGender: 1,
  };
}

describe('Platinum ImageClips import', () => {
  it('converts Contest and Dress Up photos', () => {
    const native: PlatinumImageClips = {
      contestPhotos: [
        {
          mon: photoMon(),
          rank: 3,
          accessories: [
            {
              accessory: 7,
              x: 60,
              y: 90,
              priority: -3,
            },
          ],
          backdrop: 4,
        },
        null,
        null,
        null,
        null,
      ],
      dressUpPhotos: [
        {
          mon: photoMon(),
          accessories: [
            {
              accessory: 5,
              x: 20,
              y: 30,
              priority: -1,
            },
          ],
          backdrop: 3,
          title: 1234,
          language: 2,
        },
        ...new Array(10).fill(null),
      ],
    };

    const converted =
      convertPlatinumImageClips(native);

    expect(
      converted.contestPhotos[0],
    ).toEqual({
      mon: {
        species: 'platinum:SPECIES_SHINX',
        form: 1,
        pid: 0x12345678,
        otId: 0x87654321,
        nickname: 'Test',
      },
      trainerName: 'Test',
      rank: 3,
      dressUp: {
        accessories: [
          {
            accessory: 7,
            x: 60,
            y: 90,
            priority: -3,
          },
        ],
        monPriority: -2,
        backdrop: 4,
      },
    });

    expect(
      converted.dressUpPhotos[0],
    ).toEqual({
      mon: {
        species: 'platinum:SPECIES_SHINX',
        form: 1,
        pid: 0x12345678,
        otId: 0x87654321,
        nickname: 'Test',
        x: 190,
        y: 70,
      },
      trainerName: 'Test',
      trainerGender: 'female',
      dressUp: {
        accessories: [
          {
            accessory: 5,
            x: 20,
            y: 30,
            priority: -1,
          },
        ],
        monPriority: -2,
        backdrop: 3,
      },
      title: 1234,
    });
  });

  it('keeps empty slots null', () => {
    const native: PlatinumImageClips = {
      contestPhotos:
        new Array(5).fill(null),
      dressUpPhotos:
        new Array(11).fill(null),
    };

    expect(
      convertPlatinumImageClips(native),
    ).toEqual({
      contestPhotos:
        new Array(5).fill(null),
      dressUpPhotos:
        new Array(11).fill(null),
    });
  });

  it.skipIf(!savePath)(
    'applies real Platinum ImageClips photos',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const base = {
        contestPhotos: [
          {} as never,
          null,
          null,
          null,
          null,
        ],
        dressUpPhotos: [
          {} as never,
          ...new Array(10).fill(null),
        ],
      } as unknown as GameState;

      const converted =
        applyPlatinumImageClips(base, save);

      console.log(
        'converted image clips photos:',
        {
          contestPhotos:
            converted.contestPhotos,
          dressUpPhotos:
            converted.dressUpPhotos,
        },
      );

      expect(
        converted.contestPhotos,
      ).toEqual(new Array(5).fill(null));

      expect(
        converted.dressUpPhotos,
      ).toEqual(new Array(11).fill(null));
    },
  );
});
