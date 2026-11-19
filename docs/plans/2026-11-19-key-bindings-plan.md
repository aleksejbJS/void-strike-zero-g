# Key Bindings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players rebind movement/combat actions in a new "Controls" tab of the profile; the game and the menu legend use those bindings.

**Architecture:** Bindings live in `localStorage`. During a match a translator turns each physical input (keyboard `e.code` or mouse button) into the *standard* input the game already understands (`KeyA`, `KeyD`, `KeyW`, `KeyS`, `KeyZ`, fire, hook). Raw physical codes never reach `keys.current`, so prediction, the network message, server validation and the simulation stay unchanged.

**Tech Stack:** React 18 + TypeScript, Tailwind ("Hazard Bay" tokens `bay-*`), Vitest + Testing Library (jsdom).

**Spec:** `docs/plans/2026-11-19-key-bindings-spec.md`

Work in the worktree `/Users/AleksejB/Documents/void-strike-keys` (branch `feature/key-bindings`). Run `npm ci` there first (shared `node_modules` lacks Supabase, see memory "local-browser-check").

## Global Constraints

- Every file ≤ 200 lines, one responsibility, named exports only.
- No silent catches: storage failures go through `readStored`/`writeStored` (`src/store/playerStorage.ts`), malformed data → `console.warn` + defaults.
- Keys matched by physical position (`KeyboardEvent.code`), never `e.key`.
- Reserved, never bindable: `Escape`, `F3`, `Digit1`–`Digit9`, `Numpad1`–`Numpad9` (they pick weapons via `e.key`), `Meta` (Cmd: browser shortcuts).
- Network protocol, `src/game/net/validation.ts`, `playerControl.ts`, server: **not touched**.
- All UI copy in en + ru. Test UI at 1512×700.

## Review Focus

1. **Window loses focus while a bound key is held** (alt-tab, Cmd+Tab) → nothing stays "held" after return. Pinned in Task 3 (`reset`) and wired in Task 4 (`onBlur`).
2. **Two inputs on one action, one released** (W + Space held, W released) → jetpack keeps firing until Space is released too. Pinned in Task 3.
3. **Mouse back/forward buttons** (Mouse3/Mouse4) bound or pressed during capture → the browser must not navigate away. Pinned in Task 4 (match) and Task 6 (capture).
4. **Stored data from another build** (unknown action like a future `jump`, missing action, duplicates, reserved codes, garbage JSON) → loads without crashing; a missing action gets its defaults minus codes the player already uses elsewhere. Pinned in Task 2.
5. **Right-hand modifiers**: binding "Shift" must work with both Shift keys (today both grapple). Pinned in Task 1 (`normalizeCode`) and Task 3.

---

### Task 1: Binding model and edit rules

**Files:**
- Create: `src/game/input/bindings.ts`, `src/game/input/bindingEdit.ts`
- Test: `src/game/input/bindings.test.ts`, `src/game/input/bindingEdit.test.ts`

**Interfaces:**
- Produces (`bindings.ts`):
  - `type BindAction = 'left' | 'right' | 'jetpack' | 'down' | 'prone' | 'fire' | 'grapple'`
  - `BIND_ACTIONS: readonly BindAction[]` — display order exactly as listed above
  - `type InputCode = string` — a normalized keyboard code (`'KeyE'`, `'Space'`, `'Shift'`) or `'Mouse0'`…`'Mouse4'`
  - `type Slot = 0 | 1` (0 = primary, 1 = secondary)
  - `type Bindings = Record<BindAction, readonly [InputCode | null, InputCode | null]>`
  - `type ActionTarget = 'KeyA' | 'KeyD' | 'KeyW' | 'KeyS' | 'KeyZ' | 'fire' | 'hook'`
  - `ACTION_TARGET: Record<BindAction, ActionTarget>` — left→KeyA, right→KeyD, jetpack→KeyW, down→KeyS, prone→KeyZ, fire→fire, grapple→hook
  - `DEFAULT_BINDINGS: Bindings` — left `['KeyA', null]`, right `['KeyD', null]`, jetpack `['KeyW', 'Space']`, down `['KeyS', null]`, prone `['KeyZ', null]`, fire `['Mouse0', null]`, grapple `['Mouse2', 'Shift']`
  - `normalizeCode(code: string): InputCode` — `ShiftLeft|ShiftRight→'Shift'`, same for `Control`, `Alt`, `Meta`; anything else unchanged
  - `mouseCode(button: number): InputCode | null` — 0…4 → `'Mouse0'`…`'Mouse4'`, else null
  - `isReserved(code: InputCode): boolean` — per Global Constraints (input already normalized)
- Produces (`bindingEdit.ts`):
  - `interface FreedSlot { action: BindAction; slot: Slot }`
  - `assignBinding(b: Bindings, action: BindAction, slot: Slot, code: InputCode): { bindings: Bindings; freed: FreedSlot | null }` — pure; removes `code` from wherever else it sits (another action → that slot becomes null and is returned as `freed`; the same action's other slot → just cleared, `freed: null`)
  - `clearBinding(b: Bindings, action: BindAction, slot: Slot): Bindings`
  - `unboundActions(b: Bindings): BindAction[]` — actions with both slots null, in `BIND_ACTIONS` order

- [ ] **Step 1: Write failing tests**
  - `bindings.test.ts`: `normalizeCode('ShiftRight') === 'Shift'`, `normalizeCode('ControlLeft') === 'Control'`, `normalizeCode('KeyE') === 'KeyE'`; `mouseCode(2) === 'Mouse2'`, `mouseCode(5) === null`; `isReserved` true for `Escape`, `F3`, `Digit1`, `Digit9`, `Numpad5`, `Meta`, false for `Digit0`, `KeyE`, `Shift`, `Mouse0`; `DEFAULT_BINDINGS.jetpack` equals `['KeyW', 'Space']`; no code appears twice across `DEFAULT_BINDINGS`.
  - `bindingEdit.test.ts`:
    - `assignBinding(DEFAULT_BINDINGS, 'jetpack', 0, 'KeyE')` → jetpack `['KeyE','Space']`, `freed === null`, input object unchanged.
    - `assignBinding(DEFAULT_BINDINGS, 'right', 0, 'KeyA')` → right `['KeyA', null]`, left `[null, null]`, `freed` `{ action: 'left', slot: 0 }`; `unboundActions(result)` equals `['left']`.
    - `assignBinding(DEFAULT_BINDINGS, 'jetpack', 1, 'KeyW')` → jetpack `[null, 'KeyW']`, `freed === null`.
    - `clearBinding(DEFAULT_BINDINGS, 'grapple', 1)` → grapple `['Mouse2', null]`.
- [ ] **Step 2:** `npx vitest run src/game/input/binding` → FAIL (modules missing).
- [ ] **Step 3:** Implement both files per Interfaces.
- [ ] **Step 4:** `npx vitest run src/game/input/binding` → PASS.
- [ ] **Step 5:** Commit `feat(input): key binding model and edit rules`.

### Task 2: Binding storage

**Files:**
- Create: `src/game/input/bindingStorage.ts`
- Test: `src/game/input/bindingStorage.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `DEFAULT_BINDINGS`, `BIND_ACTIONS`, `isReserved`, `normalizeCode`; `readStored`/`writeStored` from `src/store/playerStorage.ts`.
- Produces:
  - `BINDINGS_STORAGE_KEY = 'controls.v1'`; stored value `JSON.stringify({ v: 1, bindings })`
  - `sanitizeBindings(raw: unknown): Bindings`
  - `loadBindings(): Bindings` — nothing stored → `DEFAULT_BINDINGS`; unparsable JSON or `v !== 1` → `console.warn` + `DEFAULT_BINDINGS`
  - `saveBindings(b: Bindings): void`

`sanitizeBindings` rules, in `BIND_ACTIONS` order: a slot keeps a value only if it is a string matching `/^[A-Za-z0-9]{1,24}$/`, normalized, not reserved, and not already used by an earlier slot (first wins). Unknown actions are ignored. An action **missing** from the stored object gets its default slots, each dropped if that code is already used by a stored action (this is how a future "Jump" row arrives without breaking a custom layout). An action present but with a malformed value → `[null, null]`.

- [ ] **Step 1: Write failing tests** (clear `localStorage` in `beforeEach`; spy on `console.warn`)
  - Round trip: `saveBindings(x)` then `loadBindings()` deep-equals `x` for a custom `x` (jetpack `['KeyE', null]`, rest default).
  - Empty storage → `DEFAULT_BINDINGS`, no warning.
  - `localStorage.setItem('controls.v1', '{oops')` → defaults and `console.warn` called once.
  - `sanitizeBindings({ v: 1 } ...)` cases via `sanitizeBindings(bindingsObject)`: reserved `'Digit1'` and `'Escape'` → null; `'ShiftRight'` → `'Shift'`; duplicate `'KeyE'` on jetpack and fire → kept on jetpack (earlier), null on fire; unknown key `jump: ['Space', null]` ignored; `'<script>'` → null.
  - Missing action: stored object without `prone`, with `fire: ['KeyZ', null]` → `prone` is `[null, null]` (its default `KeyZ` is taken), `fire` keeps `KeyZ`.
- [ ] **Step 2:** `npx vitest run src/game/input/bindingStorage` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(input): store key bindings in this browser`.

### Task 3: Input translator

**Files:**
- Create: `src/game/input/bindingInput.ts`
- Test: `src/game/input/bindingInput.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Bindings`, `InputCode`, `ActionTarget`, `ACTION_TARGET`).
- Produces:
  - `interface ActionChange { target: ActionTarget; active: boolean }`
  - `interface BindingInput { press(code: InputCode): ActionChange | null; release(code: InputCode): ActionChange | null; reset(): void }`
  - `createBindingInput(bindings: Bindings): BindingInput` — keeps the set of held inputs; an action is active while **any** of its bound inputs is held; returns a change only when an action flips; unbound inputs and repeats return null
  - `interface InputSink { setKey(code: 'KeyA' | 'KeyD' | 'KeyW' | 'KeyS' | 'KeyZ', down: boolean): void; setFire(down: boolean): void; setHook(down: boolean): void }`
  - `applyActionChange(change: ActionChange | null, sink: InputSink): void`

- [ ] **Step 1: Write failing tests**
  - Defaults: `press('KeyA')` → `{ target: 'KeyA', active: true }`; `release('KeyA')` → `{ target: 'KeyA', active: false }`; second `press('KeyA')` while held → null.
  - Remap jetpack to `['KeyE', null]` and left to `['KeyW', null]`: `press('KeyE')` → `{ target: 'KeyW', active: true }`; `press('KeyW')` → `{ target: 'KeyA', active: true }`.
  - Two inputs: defaults, `press('KeyW')`, `press('Space')` → second returns null; `release('KeyW')` → null; `release('Space')` → `{ target: 'KeyW', active: false }`.
  - `press('Mouse0')` → fire active; `press('Shift')` → hook active (caller normalizes `ShiftRight` first: assert `press(normalizeCode('ShiftRight'))` → hook).
  - `press('KeyQ')` (unbound) → null.
  - `reset()` after holding W: next `press('KeyW')` → active change again (not null).
  - `applyActionChange` calls `setKey('KeyD', true)` / `setFire(false)` / `setHook(true)` for matching changes, nothing for null.
- [ ] **Step 2:** `npx vitest run src/game/input/bindingInput` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(input): translate bound inputs into standard game input`.

### Task 4: Use the translator in the match

**Files:**
- Modify: `src/components/GameCanvas.tsx` (input block, today ~lines 875–915 on `origin/main` 301ee8a: `onKeyDown`, `onKeyUp`, `onMouseDown`, `onMouseUp`, `onBlur`)

**Interfaces:**
- Consumes: `loadBindings` (Task 2), `createBindingInput`, `applyActionChange`, `InputSink` (Task 3), `normalizeCode`, `mouseCode` (Task 1).

Changes, nothing else in the file:
- Where the handlers are set up, create once: `const bound = createBindingInput(loadBindings())` and a sink writing `keys.current[code]`, `mousePressed.current`, `hookPressed.current` (read the refs at call time: `onBlur` replaces `keys.current`).
- `onKeyDown`: replace `keys.current[e.code] = true` and the Shift→hook line with `applyActionChange(bound.press(normalizeCode(e.code)), sink)`. Keep `rangeLoop.key(e.code, …)`, weapon slots via `e.key`, F3, Escape exactly as they are.
- `onKeyUp`: same with `release`; remove the Shift line.
- `onMouseDown` / `onMouseUp`: `const code = mouseCode(e.button); if (code) applyActionChange(bound.press|release(code), sink)`; for `e.button === 3 || e.button === 4` call `e.preventDefault()` on both (no browser back/forward mid-match). Keep `initAudio` in mousedown.
- `onBlur`: add `bound.reset()` to the existing clearing.
- Touch sticks path untouched.

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** `npx tsc --noEmit` and `npm test` → all green (no test asserted raw codes in `keys.current`; if one does, it is wrong now — report it, do not weaken the translator).
- [ ] **Step 3: Browser check** (Playwright script per memory "local-browser-check", `npm run dev` in the worktree, viewport 1512×700): set `localStorage['controls.v1'] = JSON.stringify({ v: 1, bindings: { ...defaults, jetpack: ['KeyE', null] } })`, start "Play vs bots", hold `E` 1 s → the local player's `pos.y` decreases (rises); hold `W` 1 s → it does not rise. Clear the key, reload, hold `W` → rises again.
- [ ] **Step 4:** Commit `feat(input): matches use the player's key bindings`.

### Task 5: Labels, strings and the menu legend

**Files:**
- Create: `src/i18n/bindingStrings.ts` (`BindingKeys` interface + `bindingStrings: Record<Language, BindingKeys>`), `src/components/controls/inputLabel.ts`, `src/components/controls/legendItems.ts`
- Modify: `src/i18n/locales.ts` (extend `TranslationKeys` with `BindingKeys`, spread `bindingStrings.en/.ru` like the others), `src/components/menu/ControlsLegend.tsx`
- Test: `src/components/controls/inputLabel.test.ts`, `src/components/controls/legendItems.test.ts`

**Interfaces:**
- Produces:
  - Strings (en / ru): `kb.tabs` "Profile sections" / "Разделы профиля"; `kb.tab.achievements` "Achievements" / "Достижения"; `kb.tab.controls` "Controls" / "Управление"; `kb.action.left` "Left" / "Влево"; `kb.action.right` "Right" / "Вправо"; `kb.action.jetpack` "Jetpack (up)" / "Джетпак (вверх)"; `kb.action.down` "Down / crouch" / "Вниз / присесть"; `kb.action.prone` "Lie down" / "Лечь"; `kb.action.fire` "Fire" / "Огонь"; `kb.action.grapple` "Grapple" / "Крюк"; `kb.press` "Press a key…" / "Нажмите клавишу…"; `kb.empty` "—"; `kb.clear` "Clear" / "Очистить"; `kb.reset` "Reset all" / "Сбросить всё"; `kb.unbound` "No key for: {0}" / "Нет кнопки: {0}"; `kb.freed` "Key moved to another action" / "Клавиша перешла к другому действию"; `kb.hint` "Click a slot, then press a key or mouse button. Esc cancels. Esc, F3 and 1–9 belong to the game." / "Нажмите на слот, затем клавишу или кнопку мыши. Esc — отмена. Esc, F3 и 1–9 заняты игрой."; `kb.slot` "{0}, slot {1}: {2}" / "{0}, слот {1}: {2}" (button aria-label); `kb.key.space` "Space" / "Пробел"; `kb.mouse.0`…`kb.mouse.4` "LMB", "RMB", "MMB", "Mouse 4", "Mouse 5" / "ЛКМ", "ПКМ", "СКМ", "Мышь 4", "Мышь 5".
  - `inputLabel(code: InputCode, t: Translate): string` — `KeyX`→`X`, `DigitN`→`N`, `NumpadN`→`Num N`, `Space`→`kb.key.space`, `MouseN`→`kb.mouse.N`, `Shift|Control|Alt`→`Shift|Ctrl|Alt`, `ArrowLeft/Up/Right/Down`→`←/↑/→/↓`, anything else → the code itself.
  - `interface LegendItem { inputs: string[]; label: 'ctl.move' | 'ctl.jetpack' | 'ctl.fire' | 'ctl.grapple' | 'ctl.crouch' | 'ctl.prone' }`
  - `legendItems(b: Bindings, t: Translate): LegendItem[]` — order: move, jetpack, fire, grapple, crouch, prone. When the primaries of left/right/jetpack/down are exactly `KeyA/KeyD/KeyW/KeyS`, move shows `['WASD']` and jetpack lists its slots **except** `KeyW`; otherwise move lists left + right inputs and jetpack all its inputs. Items with no inputs are left out. Inputs are labelled with `inputLabel`, except `Mouse0`/`Mouse2`, which use the legend's existing `ctl.leftClick`/`ctl.rightClick` ("Left click"/"ЛКМ") so the default legend stays word for word as today.
- `ControlsLegend` reads `loadBindings()` once (`useState(loadBindings)`), renders `legendItems` with the existing `Key` look, inputs joined by `t('ctl.or')`; the fixed weapons item (`1–9` or wheel) stays last.

- [ ] **Step 1: Write failing tests**
  - `inputLabel`: `KeyE`→`E`, `Digit0`→`0`, `Space`→`Space` (en t), `Mouse1`→`RMB`, `Shift`→`Shift`, `ArrowUp`→`↑`, `F5`→`F5`.
  - `legendItems(DEFAULT_BINDINGS, t)` (en) equals: move `['WASD']`, jetpack `['Space']`, fire `['Left click']`… — use the existing `ctl.leftClick`/`ctl.rightClick` strings for Mouse0/Mouse2 in the legend so the default legend reads exactly as today: `WASD` Move, `Space` Jetpack, `Left click` Fire, `Right click` or `Shift` Grapple, `S` Crouch, `Z` Lie down (hold).
  - Jetpack moved to `['KeyE', null]` → move `['A', 'D']`, jetpack `['E']`.
  - Prone unbound → no prone item.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; update `ControlsLegend`.
- [ ] **Step 4:** `npx vitest run src/components/controls src/components/menu` → PASS (existing menu tests must still pass unchanged).
- [ ] **Step 5:** Commit `feat(menu): the key legend shows the player's bindings`.

### Task 6: Capturing the next key or mouse button

**Files:**
- Create: `src/components/controls/useCaptureInput.ts`
- Test: `src/components/controls/useCaptureInput.test.tsx`

**Interfaces:**
- Consumes: `normalizeCode`, `mouseCode`, `isReserved` (Task 1).
- Produces: `useCaptureInput(active: boolean, onCapture: (code: InputCode) => void, onCancel: () => void): void`

While `active`: listen on `window` in the **capture phase** for `keydown`, `mousedown`, `mouseup`, `contextmenu`. `keydown`: `Escape` → `onCancel`; reserved → ignored (stays active); otherwise `onCapture(normalizeCode(e.code))`. `mousedown` with a `mouseCode` → `onCapture`. For every handled event `preventDefault()` + `stopPropagation()` (keeps Escape from reaching other screen handlers and Mouse3/4 from navigating; `mouseup` and `contextmenu` are only prevented). Listeners removed when `active` turns false or on unmount.

- [ ] **Step 1: Write failing tests** (`renderHook` from Testing Library)
  - Active: `keyDown(window, { code: 'KeyE' })` → `onCapture('KeyE')`; `{ code: 'ShiftRight' }` → `'Shift'`; `{ code: 'Digit3' }` → nothing called; `{ code: 'Escape', key: 'Escape' }` → `onCancel`, not `onCapture`.
  - `mouseDown(window, { button: 1 })` → `onCapture('Mouse1')`; a `mouseup` with `button: 3` dispatched via `new MouseEvent('mouseup', { button: 3, cancelable: true })` has `defaultPrevented === true`.
  - Inactive (and after unmount): `keyDown KeyE` → nothing called.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(profile): capture the next key or mouse button`.

### Task 7: The Controls tab in the profile

**Files:**
- Create: `src/components/controls/ControlsPanel.tsx`, `src/components/controls/BindingRow.tsx`, `src/components/profile/ProfileTabs.tsx`, `src/components/pointer.ts`
- Modify: `src/components/profile/ProfileBody.tsx` (right column renders `ProfileTabs` instead of `AchievementGrid` directly)
- Test: `src/components/profile/ProfileScreen.controls.test.tsx` (uses `mountProfile` from `src/test/profileKit.tsx`)

**Interfaces:**
- Consumes: Tasks 1, 2, 5, 6.
- Produces:
  - `hasFinePointer(): boolean` in `pointer.ts` — `window.matchMedia?.('(any-pointer: fine)').matches ?? true` (jsdom has no `matchMedia` → true).
  - `ProfileTabs: React.FC<{ achievements: readonly Achievement[] }>` — `role="tablist"` labelled `kb.tabs`, tabs `kb.tab.achievements` (default) and `kb.tab.controls`; the Controls tab is not rendered when `!hasFinePointer()`. Tab chips reuse the `chip` look of `AchievementGrid`.
  - `ControlsPanel: React.FC` — state: `bindings` (`useState(loadBindings)`), `capturing: { action; slot } | null`, `freed: FreedSlot | null`. Every change → `saveBindings`. A new capture or reset clears `freed`. Renders a row per `BIND_ACTIONS`, the `kb.hint` line, a `role="alert"` line `kb.unbound` with the comma-joined action names when `unboundActions` is non-empty, and the `kb.reset` button (`DEFAULT_BINDINGS`).
  - `BindingRow: React.FC<{ action; slots; capturingSlot: Slot | null; freedSlot: Slot | null; onPick(slot): void; onClear(): void; t }>` — two slot buttons (aria-label `kb.slot`, text `inputLabel` or `kb.empty`, `kb.press` while capturing); the freed slot gets `aria-invalid="true"`, a red `bay-*` danger border and `title={t('kb.freed')}`; a `kb.clear` button only when slot 1 is set.

- [ ] **Step 1: Write failing tests** (clear `localStorage` in `beforeEach`)
  - Opening the profile shows the Achievements tab selected; clicking "Controls" shows the row "Jetpack (up)" with slots `W` and `Space`.
  - Click "Jetpack (up), slot 1: W", the button reads "Press a key…"; `keyDown(window, { code: 'KeyE' })` → reads `E`; `JSON.parse(localStorage['controls.v1']).bindings.jetpack` equals `['KeyE', 'Space']`.
  - Conflict: Right slot 1 ← `KeyA` → Left slot 1 shows `—` with `aria-invalid="true"`; alert reads "No key for: Left".
  - Escape while capturing → slot keeps `W`, profile still open (`onBack` not called).
  - `Digit1` while capturing → still "Press a key…".
  - Mouse: Fire slot 2 ← `mouseDown(window, { button: 1 })` → `MMB`.
  - "Reset all" → Jetpack shows `W` / `Space` again, alert gone.
  - With `window.matchMedia` stubbed to `matches: false` → no "Controls" tab.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npx vitest run src/components/profile src/components/controls` → PASS (existing profile tests unchanged and green).
- [ ] **Step 5: Browser check** at 1512×700: profile → Controls tab fits without page scroll on lg (right column scrolls on its own like achievements); screenshot for the owner; also a phone-landscape viewport (844×390) render.
- [ ] **Step 6:** Commit `feat(profile): Controls tab to rebind keys`.

### Task 8: Release prep

**Files:**
- Modify: `src/components/menu/patchNotes.ts`, `CHANGELOG.md`

- [ ] **Step 1:** `git fetch` and check the newest version on `origin/main`; take the next `0.5.x`. Merge `origin/main` into the branch if it moved.
- [ ] **Step 2:** Add a short flat note (2–3 points, en + ru as the file does): keys and mouse buttons can be changed in Profile → Controls; the menu hint shows your keys. Full detail in `CHANGELOG.md`. Date is stamped only when it lands in `main`.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm test`, `npm run build` → all green.
- [ ] **Step 4:** Commit `chore(release): key bindings become 0.5.x`. Push and open the PR only after the owner says so; merging needs the owner's explicit go-ahead.
