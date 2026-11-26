import { expect, test, type Page } from '@playwright/test';
import { skipSetup } from './intro.ts';
import { saveGame } from './save.ts';

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

async function loadSlot(page: Page, slot: number) {
  await page.keyboard.down('PageUp');
  try {
    await page.keyboard.press(`Digit${slot}`);
  } finally {
    await page.keyboard.up('PageUp');
  }
  await expect(page.locator('.ui-toast')).toContainText(`Loaded runtime state ${slot}`);
}

test(
  'runtime slots survive a reload and restore the visible field',
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

    await saveGame(page);
    await skipSetup(page);
    await page.goto('/?packs=fixture&title&continue');
    await page.waitForFunction(() => window.openSinnohApp && !document.querySelector('.at-title'));
    await page.waitForFunction(() => window.openSinnohApp?.game.canSave());

    const room = await player(page);
    await page.keyboard.press('Alt+Digit0');
    await expect(page.locator('.ui-toast')).toContainText('Saved runtime state 0');

    await page.evaluate(() => window.openSinnohApp!.game.world.warp('fixture:TOWN', 10, 14, 'down'));
    await page.waitForFunction(() => {
      const game = window.openSinnohApp!.game;
      return game.state.player.zone === 'fixture:TOWN' && game.canSave();
    });
    const town = await player(page);
    await page.keyboard.press('Alt+Digit9');
    await expect(page.locator('.ui-toast')).toContainText('Saved runtime state 9');

    // Continue still starts from the ordinary save, independently of the numbered slots.
    await page.evaluate(() => localStorage.setItem('lantern-nds:suspend', 'off'));
    await page.reload();
    await page.waitForFunction(() => window.openSinnohApp && !document.querySelector('.at-title'));
    await expect.poll(() => player(page)).toEqual(room);

    await loadSlot(page, 9);
    await expect.poll(() => player(page)).toEqual(town);
    const canvas = page.locator('#main-canvas');
    await page.waitForFunction(() => !window.openSinnohApp!.sceneLoading());
    const townFrame = await canvas.screenshot();

    await loadSlot(page, 0);
    await expect.poll(() => player(page)).toEqual(room);
    await page.waitForFunction(() => !window.openSinnohApp!.sceneLoading());
    const roomFrame = await canvas.screenshot();
    expect(roomFrame.equals(townFrame), 'the canvas must show the restored map').toBe(false);
  },
);
