import { expect, test, type Page } from '@playwright/test';

const player = (page: Page) =>
  page.evaluate(() => ({
    state: structuredClone(
      window.openSinnohApp!.game.state.player,
    ),
    world: structuredClone(
      window.openSinnohApp!.game.world.player(),
    ),
    zone: window.openSinnohApp!.game.world.view().zone,
  }));

const shortcut = (
  page: Page,
  type: 'save' | 'load',
  slot: number,
) =>
  page.evaluate(
    ({ type, slot }) => {
      const digit = new KeyboardEvent('keydown', {
        key: String(slot),
        code: `Digit${slot}`,
        altKey: type === 'save',
        bubbles: true,
        cancelable: true,
      });

      if (type === 'save') {
        window.dispatchEvent(digit);
        return;
      }

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'PageUp',
          code: 'PageUp',
          bubbles: true,
          cancelable: true,
        }),
      );
      window.dispatchEvent(digit);
      window.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: 'PageUp',
          code: 'PageUp',
          bubbles: true,
        }),
      );
    },
    { type, slot },
  );

test(
  'runtime slot restores world state and the visible field',
  async ({ page }, info) => {
    test.skip(
      info.project.name !== 'desktop',
      'desktop runtime-state shortcuts',
    );

    await page.goto('/?packs=fixture');
    await page.waitForFunction(
      () =>
        window.openSinnohApp?.game.scripts.view()
          .message?.waitingForInput === true,
      undefined,
      { timeout: 20_000 },
    );

    await page.keyboard.press('KeyZ');
    await page.waitForFunction(
      () =>
        window.openSinnohApp!.game.canSave() &&
        !window.openSinnohApp!.game.scripts.running(),
    );

    const saved = await player(page);
    await shortcut(page, 'save', 1);
    await expect(page.locator('.ui-toast')).toContainText(
      'Saved runtime state 1',
    );

    const canvas = page.locator('#main-canvas');
    const savedFrame = await canvas.screenshot();

    await page.keyboard.down('ArrowRight');
    await expect
      .poll(
        async () => {
          const now = await player(page);
          return (
            now.state.x !== saved.state.x ||
            now.state.z !== saved.state.z
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    await page.keyboard.up('ArrowRight');

    const moved = await player(page);
    expect(moved).not.toEqual(saved);

    const movedFrame = await canvas.screenshot();
    expect(movedFrame.equals(savedFrame)).toBe(false);

    await shortcut(page, 'load', 1);
    await expect(page.locator('.ui-toast')).toContainText(
      'Loaded runtime state 1',
      { timeout: 20_000 },
    );

    await expect.poll(() => player(page)).toEqual(saved);

    const restoredFrame = await canvas.screenshot();
    expect(
      restoredFrame.equals(movedFrame),
      'the canvas must visibly leave the moved position',
    ).toBe(false);
  },
);
