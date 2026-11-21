import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPlatinumPoketch } from './platinum-poketch.ts';

const savePath = process.env.OPENSINNOH_NDS_SAV;

describe('Platinum Pokétch', () => {
  it.skipIf(!savePath)(
    'reads a real Platinum Pokétch',
    () => {
      const save = new Uint8Array(
        readFileSync(savePath!),
      );

      const poketch = readPlatinumPoketch(save);

      expect(poketch.appCount).toBe(
        poketch.registeredApps.length,
      );

      if (poketch.currentApp !== null) {
        expect(poketch.registeredApps).toContain(
          poketch.currentApp,
        );
      }

      expect(poketch.color).toBeGreaterThanOrEqual(0);
      expect(poketch.color).toBeLessThanOrEqual(7);
      expect(poketch.markers).toHaveLength(6);
      expect(poketch.dotArt).toHaveLength(120);

      console.log('poketch:', {
        enabled: poketch.enabled,
        pedometerEnabled:
          poketch.pedometerEnabled,
        color: poketch.color,
        appCount: poketch.appCount,
        currentApp: poketch.currentApp,
        registeredApps: poketch.registeredApps,
        steps: poketch.steps,
        alarm: poketch.alarm,
        calendar: poketch.calendar,
        markers: poketch.markers,
        history: poketch.history,
        dotArtModified:
          poketch.dotArtModified,
      });
    },
  );
});