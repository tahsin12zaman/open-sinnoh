/** The facilities' pre-battle wipes (wipes.ts). */
import { describe, expect, it } from 'vitest';
import { BlockWipe, LineWipe } from './wipes.ts';

/** Runs a block wipe to its end: the frames it took and how much of the 256 × 192 screen its rects cover. */
function run(kind: 'rows' | 'columns') {
  const w = new BlockWipe(kind);
  let frames = 0;
  const halfway: number[] = [];
  while (!w.step()) {
    frames++;
    if (frames === 12) halfway.push(covered(w));
    if (frames > 100) throw new Error('the wipe does not end');
  }
  return { frames: frames + 1, halfway: halfway[0]!, covered: covered(w) };
}
function covered(w: BlockWipe): number {
  const v = w.view();
  if (v.kind !== 'blocks') throw new Error('not blocks');
  const px = new Uint8Array(256 * 192);
  for (const r of v.rects) for (let y = r.y; y < Math.min(192, r.y + r.h); y++) px.fill(1, y * 256 + r.x, y * 256 + r.x + r.w);
  return px.reduce((a, b) => a + b, 0) / px.length;
}

describe('pre-battle wipes', () => {
  it('the Hall and Arcade block wipes start four blocks a frame for 24 frames and end with the screen covered', () => {
    for (const kind of ['rows', 'columns'] as const) {
      const r = run(kind);
      // 24 frames to start 96 blocks, one more for the last to finish its slide.
      expect(r.frames, kind).toBe(25);
      expect(r.halfway, kind).toBeGreaterThan(0.3);
      expect(r.halfway, kind).toBeLessThan(0.7);
      expect(r.covered, kind).toBe(1);
    }
  });

  it("the rows wipe's first frame fills a 32 × 16 strip in rows 0, 5, 6 and 11, the inner pair from the right", () => {
    const w = new BlockWipe('rows');
    w.step();
    const v = w.view();
    expect(v.kind === 'blocks' && v.rects).toEqual([
      { x: 0, y: 0, w: 16, h: 16 },
      { x: 208, y: 80, w: 32, h: 16 },
      { x: 0, y: 96, w: 16, h: 16 },
      { x: 208, y: 176, w: 32, h: 16 },
    ]);
  });

  it('the Factory line wipe moves each pair by its speed, x wrapped into the layer and y mirrored', () => {
    const w = new LineWipe(1, { bg: { origin: { x: 0, y: 0 }, offset: 0 }, fg: { origin: { x: 16, y: 8 }, offset: 3 } });
    for (let i = 0; i < 10; i++) w.step();
    const v = w.view();
    if (v.kind !== 'lines') throw new Error('not lines');
    // Pair 0: speeds (49 % 8, 49 / 4) = (1, 12); pair 49: (0, 0); pair 95: (-46 % 8 = -6, -46 / 4 = -11) → wrapped and mirrored.
    expect([v.bg[0], v.bg[49], v.bg[95]]).toEqual([
      { x: 10, y: 120 },
      { x: 0, y: 0 },
      { x: 196, y: 110 },
    ]);
    // BG2 at its own offset (read for both axes) from its tilemap's origin.
    expect(v.fg[49]).toEqual({ x: 19, y: 11 });
    expect(v.bgHidden).toBe(false);
  });

  it('restores block wipes at the exact frame', () => {
    for (const kind of ['rows', 'columns'] as const) {
      const original = new BlockWipe(kind);

      for (let frame = 0; frame < 11; frame++) {
        original.step();
      }

      const snapshot =
        original.captureRuntimeSnapshot();
      const restored =
        BlockWipe.restoreRuntimeSnapshot(snapshot);

      expect(
        restored.captureRuntimeSnapshot(),
      ).toEqual(snapshot);
      expect(restored.view()).toEqual(original.view());

      for (let frame = 0; frame < 20; frame++) {
        const originalDone = original.step();
        const restoredDone = restored.step();

        expect(restoredDone).toBe(originalDone);
        expect(restored.view()).toEqual(
          original.view(),
        );

        if (originalDone) break;
      }
    }
  });

  it('restores line wipes without retaining snapshot references', () => {
    const original = new LineWipe(2, {
      bg: {
        origin: { x: 8, y: 16 },
        offset: 3,
      },
      fg: {
        origin: { x: 24, y: 32 },
        offset: 5,
      },
    });

    for (let frame = 0; frame < 17; frame++) {
      original.step();
    }

    original.bgHidden = true;

    const snapshot =
      original.captureRuntimeSnapshot();
    const restored =
      LineWipe.restoreRuntimeSnapshot(snapshot);

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(snapshot);
    expect(restored.view()).toEqual(original.view());

    snapshot.moved[0]!.x = 99999;
    snapshot.layers.bg.origin.x = 99999;

    expect(restored.view()).toEqual(original.view());

    original.step();
    restored.step();

    expect(restored.view()).toEqual(original.view());
  });

  it('rejects malformed wipe snapshots', () => {
    expect(() =>
      BlockWipe.restoreRuntimeSnapshot({
        kind: 'block-wipe',
        direction: 'rows',
        frames: 1,
        interval: 1,
        elapsed: -1,
      }),
    ).toThrow(
      'Invalid Frontier block-wipe runtime snapshot.',
    );

    expect(() =>
      LineWipe.restoreRuntimeSnapshot({
        kind: 'line-wipe',
        mode: 2,
        layers: {},
        moved: [],
        bgHidden: false,
      }),
    ).toThrow(
      'Invalid Frontier line-wipe runtime snapshot.',
    );
  });

  it('the Castle line wipe alternates directions and keeps negative points off the layer', () => {
    const w = new LineWipe(2, { bg: { origin: { x: 0, y: 0 }, offset: 0 }, fg: { origin: { x: 0, y: 0 }, offset: 0 } });
    w.step();
    const v = w.view();
    if (v.kind !== 'lines') throw new Error('not lines');
    // Pair 0: (48 / 8 + 1, 0) = (7, 0); pair 1: (-(47 / 8 + 1), 1) = (-6, 1); pair 95: (-(-47 / 8 + 1), 1) = (4, 1).
    expect([v.bg[0], v.bg[1], v.bg[48], v.bg[95]]).toEqual([
      { x: 7, y: 0 },
      { x: -6, y: 1 },
      { x: 1, y: 48 },
      { x: 4, y: 1 },
    ]);
  });
});
