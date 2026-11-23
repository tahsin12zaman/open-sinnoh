import { describe, expect, it } from 'vitest';
import { parseIR, type Id } from '@opensinnoh/core';
import { hitChoice, choiceRects } from '@opensinnoh/text';
import { Driver, loadFixture, newState, testMon } from './test-support.ts';
import { coverage, implementedOps } from './coverage.ts';
import { COMMAND_BY_NAME } from './commands.ts';
import { Runner } from './runner.ts';

const fixture = loadFixture();
const driver = () => new Driver(fixture.registries, fixture.labels, newState());

describe('VM on the fixture scripts', () => {
  it('runs the whole guide scene: movement, messages, starter choice by d-pad and touch, yes/no loop', () => {
    const d = driver();
    d.vm.start({ label: 'fixture:Town_GuideScene', zone: 'fixture:TOWN', source: 'coord' });
    expect(d.vm.running()).toBe(true);
    d.readMessage('Wait! You should not walk into\nthe tall grass alone.');
    expect(d.field.calls.slice(0, 3)).toEqual(['lockAll', 'applyMovement 0 fixture:MV_GUIDE_APPROACH', 'applyMovement 255 fixture:MV_PLAYER_FACE_EAST']);
    d.readMessage('Take one of these companions.\nWhich one will you pick?');

    // Starter choice on the panel: move the cursor with the d-pad and confirm with A.
    d.until(() => d.vm.view().panel.kind === 'choice');
    const panel = d.vm.view().panel;
    expect(panel.kind === 'choice' && panel.options.map((o) => o.label)).toEqual(['Mosslet', 'Emberkit', 'Dripling']);
    d.press('down');
    expect(d.vm.view().panel).toMatchObject({ cursor: 1 });
    d.press('a');
    expect(d.vm.view().panel.kind).toBe('idle');

    // "Is this the one?" → No: back to the choice.
    d.until(() => d.vm.view().yesNo !== null);
    expect(d.vm.view().message?.text).toBe('Is this the one you want?');
    expect((d.vm as Runner).thread?.contexts[0]?.waitState).toMatchObject({ kind: 'yes-no' });
    d.press('down');
    expect(d.vm.view().yesNo).toEqual({ yes: 'YES', no: 'NO', cursor: 1 });
    d.press('a');
    d.until(() => d.vm.view().panel.kind === 'choice');

    // This time pick by touch: a tap on the third option (touch must be new this tick).
    const r = choiceRects(3)[2]!;
    expect(hitChoice(3, { x: r.x + 1, y: r.y + 1 })).toBe(2);
    d.tick({ touch: { x: r.x + 1, y: r.y + 1 } });
    expect(d.vm.view().panel.kind).toBe('idle');
    d.until(() => d.vm.view().yesNo !== null);
    d.press('a'); // yes

    d.readMessage('Take good care of it, Ari!');
    d.until(() => !d.vm.running());
    expect(d.state.party.map((m) => [m.species, m.level, m.otName, m.met.zone])).toEqual([['fixture:SPECIES_DRIPLING', 5, 'Ari', 'fixture:TOWN']]);
    expect(d.state.pokedex.caught).toEqual(['fixture:SPECIES_DRIPLING']);
    expect(d.state.vars).toEqual({ 'fixture:VAR_PLAYER_STARTER': 3, 'fixture:VAR_SCENE': 1 });
    expect(d.field.calls).toContain('applyMovement 0 fixture:MV_GUIDE_LEAVE');
    expect(d.field.calls.at(-1)).toBe('releaseAll');
    expect(d.vm.view()).toEqual({ message: null, yesNo: null, menu: null, panel: { kind: 'idle', title: '' }, app: null });
  });

  it('Room_Helper branches on its flag', () => {
    const d = driver();
    d.vm.start({ label: 'fixture:Room_Helper', zone: 'fixture:ROOM', lastTalked: 0, source: 'object' });
    d.readMessage('Good morning, Ari!\nThe guide is waiting outside.');
    d.until(() => !d.vm.running());
    expect(d.state.flags).toEqual({ 'fixture:FLAG_TALKED_TO_HELPER': true });
    expect(d.field.calls).toContain('facePlayer 0');
    d.vm.start({ label: 'fixture:Room_Helper', zone: 'fixture:ROOM', lastTalked: 0, source: 'object' });
    d.readMessage('Go on, the guide is east of here.');
    d.until(() => !d.vm.running());
  });

  it('onFrame intro sets its var so it does not fire again', () => {
    const d = driver();
    d.vm.start({ label: 'fixture:Room_OnFrame_Intro', zone: 'fixture:ROOM', source: 'frame' });
    d.readMessage('Morning light fills the room.');
    d.until(() => !d.vm.running());
    expect(d.state.vars['fixture:VAR_ROOM_INTRO']).toBe(1);
  });

  it('runImmediate runs a map script to completion now', () => {
    const d = driver();
    d.vm.runImmediate({ label: 'fixture:Town_OnTransition', zone: 'fixture:TOWN', source: 'transition' });
    expect(d.state.vars).toEqual({ 'fixture:VAR_OBJ_GFX_ID_0': 3, 'fixture:VAR_MAP_LOCAL_0': 1 });
    expect(d.vm.running()).toBe(false);
  });

  it('{clear} waits for a button and starts a new page', () => {
    const d = driver();
    d.vm.start({ label: 'fixture:Room_TV', zone: 'fixture:ROOM', source: 'bg' });
    d.readMessage('A show about lanterns is on.');
    // The press clears the box (and, being a fresh press, arms speed-up); the next tick prints on. As on the DS
    // the cleared window reaches the screen with that next char (render_text.c: VRAM copies on RENDER_PRINT).
    expect(d.vm.view().message?.text).toBe('A show about lanterns is on.');
    d.tick();
    expect(d.vm.view().message?.text).toBe('I');
    d.readMessage('It is very calm.');
  });

  it('prints at the DS normal speed and resumes one tick after a wait ends', () => {
    const d = driver();
    d.vm.start({ label: 'fixture:Room_OnFrame_Intro', zone: 'fixture:ROOM', source: 'frame' });
    d.tick(); // lock_all yields
    d.tick(); // set var, message starts; 2 render calls: first char
    expect(d.vm.view().message?.text).toBe('M');
    d.tick();
    d.tick();
    expect(d.vm.view().message?.text).toBe('Mo'); // 1 char per 4 render calls = per 2 ticks
    // Holding A after a fresh press speeds printing up to one char per render call.
    d.tick({ pressed: ['a'], held: ['a'] });
    const before = d.vm.view().message!.text.length;
    d.tick({ held: ['a'] });
    expect(d.vm.view().message!.text.length).toBe(before + 2);
    d.until(() => d.vm.view().message?.waitingForInput === true);
    expect((d.vm as Runner).thread?.contexts[0]?.waitState).toEqual({ kind: 'button' });
    // wait_button is waiting; the press is seen on this tick, close_message runs on the next one.
    d.press('a');
    expect(d.vm.view().message).not.toBeNull();
    d.tick();
    expect(d.vm.view().message).toBeNull();
  });
});

describe('VM semantics', () => {
  it('wait_button: a d-pad press turns the player and ends the wait', () => {
    const d = driver();
    d.vm.start({ label: 'fixture:Room_OnFrame_Intro', zone: 'fixture:ROOM', source: 'frame' });
    d.until(() => d.vm.view().message?.waitingForInput === true);
    expect((d.vm as Runner).thread?.contexts[0]?.waitState).toEqual({ kind: 'button' });
    d.press('left');
    expect(d.field.calls).toContain('turnPlayer left');
    expect(d.vm.view().message?.waitingForInput).toBe(false);
  });

  const run = (ir: string, setup?: (d: Driver) => void) => {
    const labels = new Map([...fixture.labels, ...Object.entries(parseIR(ir).labels).map(([id, commands]) => [id as Id, { pack: 'test', commands }] as const)]);
    const d = new Driver(fixture.registries, labels, newState());
    setup?.(d);
    return d;
  };

  it('script parameters start in VAR_0x8000.. (decomp FieldSystem_SetScriptParameters)', () => {
    const d = run(`
test:Params::
  set_var_from_var var(fixture:VAR_SCENE), var(fixture:VAR_MSG_PRE)
  set_var_from_var var(fixture:VAR_ROOM_INTRO), var(fixture:VAR_MSG_POST)
  end
`);
    d.vm.start({ label: 'test:Params', zone: 'fixture:TOWN', source: 'field-move', params: [3, 9] });
    d.until(() => !d.vm.running());
    expect(d.state.vars).toEqual({ 'fixture:VAR_SCENE': 3, 'fixture:VAR_ROOM_INTRO': 9 });
  });

  it('call stack, conditions, common scripts as a concurrent sub-context', () => {
    const d = run(`
test:Main::
  set_var_from_value var(fixture:VAR_SCENE), 5
  compare_var_to_value var(fixture:VAR_SCENE), 3
  call_if "gt", label(test:Sub)
  call_common_script label(test:Common)
  check_flag flag(fixture:FLAG_HIDE_GUIDE)
  go_to_if "eq", label(test:Flagged)
  end

test:Sub::
  add_var var(fixture:VAR_SCENE), 10
  return

test:Common::
  set_flag flag(fixture:FLAG_HIDE_GUIDE)
  return_common_script
  wait_time 3, var(fixture:VAR_RESULT)
  set_var_from_value var(fixture:VAR_ROOM_INTRO), 7
  end

test:Flagged::
  set_var_from_value var(fixture:VAR_ROOM_INTRO), 9
  end
`);
    d.vm.start({ label: 'test:Main', zone: 'fixture:TOWN', source: 'test' });
    d.tick();
    // Main waits on the sub context, which ran in the same tick until its wait_time.
    expect(d.state.vars['fixture:VAR_SCENE']).toBe(15);
    expect(d.state.flags['fixture:FLAG_HIDE_GUIDE']).toBe(true);
    d.tick(); // main sees return_common_script (resume tick, no command)
    d.tick(); // main runs on: Flagged sets 9
    expect(d.state.vars['fixture:VAR_ROOM_INTRO']).toBe(9);
    expect(d.vm.running()).toBe(true); // sub is still in wait_time
    d.until(() => !d.vm.running());
    expect(d.state.vars['fixture:VAR_ROOM_INTRO']).toBe(7);
  });

  it('a push onto a full call stack is dropped', () => {
    const d = run(`
test:Deep::
  add_var var(fixture:VAR_SCENE), 1
  compare_var_to_value var(fixture:VAR_SCENE), 25
  call_if "lt", label(test:Deep)
  add_var var(fixture:VAR_ROOM_INTRO), 1
  return
`);
    d.vm.start({ label: 'test:Deep', zone: 'fixture:TOWN', source: 'test' });
    d.tick();
    // 19 frames return normally, then the empty-stack return stops the script.
    expect(d.state.vars['fixture:VAR_ROOM_INTRO']).toBe(20);
    expect(d.vm.running()).toBe(false);
  });

  it('logs a dropped call-stack push', () => {
    const d = run(`
test:Deep::
  add_var var(fixture:VAR_SCENE), 1
  compare_var_to_value var(fixture:VAR_SCENE), 25
  call_if "lt", label(test:Deep)
  return
`);
    d.vm.start({ label: 'test:Deep', zone: 'fixture:TOWN', source: 'test' });
    d.tick();
    expect(d.log.keys.get('vm:call-stack-overflow')).toBeGreaterThan(0);
  });

  it('show_start_menu and X in a button wait request the start menu once the script ends', () => {
    const d = run(`
test:Menu::