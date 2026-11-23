import { describe, expect, it } from 'vitest';
import { ScriptMenu } from './menu.ts';

describe('scripted-menu runtime snapshots', () => {
  it('preserves entries, geometry, cursor, scrolling and input delay', () => {
    const menu = new ScriptMenu({ x: 12, y: 8 }, 0, true, 204);
    for (let i = 0; i < 12; i++) menu.add({ text: `Entry ${i}`, index: i });
    menu.show('list', (text) => text.length * 8);
    const input = { held: [], pressed: ['down'], touch: null } as const;
    menu.step(input, null);
    menu.step(input, null);
    menu.step(input, null);
    menu.step(input, null);
    const restored = ScriptMenu.fromRuntimeSnapshot(menu.captureRuntimeSnapshot());
    expect(restored.view()).toEqual(menu.view());
    expect(restored.listPosition()).toEqual(menu.listPosition());
    expect(restored.step({ held: [], pressed: ['down'], touch: null }, null)).toBe(menu.step({ held: [], pressed: ['down'], touch: null }, null));
    expect(restored.view()).toEqual(menu.view());
  });

  it('preserves an unshown menu while entries are being assembled', () => {
    const menu = new ScriptMenu({ x: 2, y: 3 }, 0, false, 10);
    menu.add({ text: 'Yes', index: 1 });
    const restored = ScriptMenu.fromRuntimeSnapshot(menu.captureRuntimeSnapshot());
    expect(restored.shown).toBe(false);
    expect(() => restored.show('single', (text) => text.length * 8)).not.toThrow();
    expect(restored.view().entries).toEqual(['Yes']);
  });
});
