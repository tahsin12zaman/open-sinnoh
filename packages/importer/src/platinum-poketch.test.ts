import { readFileSync } from 'node:fs';
import type { GameState } from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import { applyPlatinumPoketch } from './platinum-poketch.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum Pokétch import', () => {
  it.skipIf(!savePath)(
    'converts a real Platinum Pokétch',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const converted = applyPlatinumPoketch(
        {} as GameState,
        save,
      ).poketch;

      expect(converted).toMatchObject({
        enabled: true,
        apps: [
          'platinum:POKETCH_APPID_DIGITALWATCH',
          'platinum:POKETCH_APPID_CALCULATOR',
          'platinum:POKETCH_APPID_PEDOMETER',
          'platinum:POKETCH_APPID_PARTYSTATUS',
        ],
        current:
          'platinum:POKETCH_APPID_DIGITALWATCH',
        color: 0,
        steps: 3334,
        alarm: {
          on: false,
          hour: 0,
          minute: 0,
        },
        calendar: {
          month: 1,
          marks: 0,
        },
        dotArt: null,
      });

      expect(converted.markers).toHaveLength(6);

      expect(converted.history).toEqual([
        {
          species: 'platinum:SPECIES_CHIMCHAR',
          form: 0,
        },
        {
          species: 'platinum:SPECIES_FINNEON',
          form: 0,
        },
        {
          species: 'platinum:SPECIES_BIDOOF',
          form: 0,
        },
        {
          species: 'platinum:SPECIES_SHINX',
          form: 0,
        },
      ]);

      console.log(
        'converted poketch:',
        converted,
      );
    },
  );
});