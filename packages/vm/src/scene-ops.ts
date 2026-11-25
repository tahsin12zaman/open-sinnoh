import { newGameRecord } from '@opensinnoh/contracts';
import { SpearPillarApplication } from './spear-app.ts';
/**
 * Story scene commands (docs/research/story-scenes.md): `scr_cmd_29f`, the explosion's camera shake (decomp
 * ScrCmd_29F → ov6_0223E384 / ov6_0223E4EC, overlay006 ov6_0223E140.c). A nested field task: the script waits.
 */
import type { Id } from '@opensinnoh/core';
import type { Handler, Runner } from './runner.ts';

/** SEQ_SE_DP_CLIMAX09 (the shake's start) and SEQ_SE_DP_FW089 (the explosion; stopped as 1628 by number). */
const SEQ_CLIMAX09 = 1749;
const SEQ_FW089 = 1628;
const FX = 4096;
/** The delays around the nonzero mode's shake, in callbacks. */

export function sceneHandlers(r: Runner): Record<string, Handler> {
  const seq = (n: number): Id | null => {
    const id = r.source('sequences', n, false);
    if (!id) r.log.stub('audio:sequence-missing', `no sequence with sourceIndex ${n} in the packs: not played`);
    return id ?? null;
  };
  const se = (n: number) => {
    const id = seq(n);
    if (id) r.audio.playSe(id);
  };
  const data = () => {
    const d = newGameRecord(r.registries).spearPillar;
    if (!d) throw new Error('Spear Pillar scene assets missing');
    return d;
  };
  return {
    scr_cmd_20d: (t, _c, a) => {
      const mode = r.int(a[0]);
      let result = 0;
      if (mode === 1 || mode === 6) {
        if (!r.spearField) {
          throw new Error(
            'Spear Pillar: poll without a live effect',
          );
        }

        if (r.spearField.done()) {
          result = 1;
          r.disposeSpearField();
        }
      } else if (mode === 0 || mode === 4) {
        r.startSpearField(data(), mode);
      } else if (mode === 5) {
        if (
          !r.spearField ||
          r.spearField.mode !== 4
        ) {
          throw new Error(
            'Spear Pillar: guardian finish without its controller',
          );
        }

        r.spearField.finishGuardians();
      } else {
        r.log.stub(`spear-field:mode-${mode}`, 'non-story camera/ring selector is not implemented');
      }
      r.setVar(t, r.ref(a[1], 'var'), result);
      return 'yield';
    },
    scr_cmd_2fb: (t, c) => {
      const app = new SpearPillarApplication(r, t, data());
      return r.pause(c, () => app.step());
    },
    scr_cmd_18c: (t, _c, a) => {
      const facing = (['up', 'down', 'left', 'right'] as const)[r.val(t, a[1])];
      if (!facing) throw new Error('scr_cmd_18c: invalid direction');
      r.field.faceObject(r.val(t, a[0]), facing);
      return 'continue';
    },
    // SDAT resources are resident/lazy in-engine; selecting this sound scene starts no sequence.
    set_sub_scene63: () => 'yield',

    init_lake_guardian_containment_units: () => {
      const flag = [...r.registries.flags.values()].find(f => f.id.endsWith(':FLAG_FREED_GALACTIC_HQ_POKEMON'));
      if (!flag) throw new Error('containment: freed flag missing');
      r.field.initContainmentUnits(r.getFlag(flag.id));
      return 'continue';
    },
    deactivate_lake_guardian_containment_units: (_t, c) => {
      r.field.deactivateContainmentUnits();
      return r.pause(c, () => r.field.containmentUnitsDone(), { kind: 'containment' });
    },
    /**
     * ScrCmd_29F (a var): 0 shakes 2 units for 16 cycles; otherwise the BGM fades out (1), 16 callbacks pass,
     * FW089 plays, the camera shakes 4 units for 24 cycles losing an eighth (FX_Div) after each, FW089 stops,
     * 16 callbacks pass and the BGM fades back in (16). The shake's setup plays CLIMAX09.
     */
    scr_cmd_29f: (t, c, a) => {
      const mode = r.val(t, a[0]);
      const explosion =
        mode === 0 ? null : seq(SEQ_FW089);

      se(SEQ_CLIMAX09);

      return r.pause(
        c,
        () => false,
        {
          kind: 'scene-shake',
          phase:
            mode === 0
              ? 'shake'
              : 'fade-out-start',
          shakeState: 0,
          count: 0,
          delta:
            mode === 0
              ? 2 * FX
              : 4 * FX,
          cycles: mode === 0 ? 16 : 24,
          previousCycles:
            mode === 0 ? 16 : 24,
          delay: 0,
          explosion,
        },
      );
    },
  };
}
