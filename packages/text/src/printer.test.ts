import { describe, expect, it } from 'vitest';
import { TextPrinter, toPrintOps } from './printer.ts';

describe('text-printer runtime snapshots', () => {
  it('continues with identical timing and visible text after restore', () => {
    const original = new TextPrinter(toPrintOps('deterministic text'), { speed: 4, canSpeedUp: true });
    for (let i = 0; i < 7; i++) original.subStep({ pressed: false, held: false });
    const restored = TextPrinter.fromRuntimeSnapshot(original.captureRuntimeSnapshot());
    const inputs = [
      { pressed: false, held: false },
      { pressed: true, held: true },
      { pressed: false, held: true },
      { pressed: false, held: false },
      { pressed: false, held: false },
    ];
    for (const input of inputs) {
      expect(restored.subStep(input)).toBe(original.subStep(input));
      expect(restored.text()).toBe(original.text());
      expect(restored.done).toBe(original.done);
    }
  });

  it('preserves a clear wait and its partially displayed page', () => {
    const original = new TextPrinter(toPrintOps('first page{clear}second page'), { speed: 0 });
    expect(original.text()).toBe('first page');
    const restored = TextPrinter.fromRuntimeSnapshot(original.captureRuntimeSnapshot());
    expect(restored.waiting).toBe(true);
    restored.subStep({ pressed: true, held: true });
    original.subStep({ pressed: true, held: true });
    for (let i = 0; i < 8; i++) {
      restored.subStep({ pressed: false, held: false });
      original.subStep({ pressed: false, held: false });
    }
    expect(restored.text()).toBe(original.text());
    expect(restored.done).toBe(original.done);
  });

  it('rejects callback-backed printers instead of losing their continuation', () => {
    const printer = new TextPrinter(toPrintOps('wait'), { callback: () => false });
    expect(() => printer.captureRuntimeSnapshot()).toThrow(/live callback/);
  });
});
