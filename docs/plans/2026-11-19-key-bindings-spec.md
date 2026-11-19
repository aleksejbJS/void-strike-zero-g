# Key bindings in the profile — spec

Date: 2026-11-19 · Status: approved by owner 2026-11-19 · Branch: `feature/key-bindings`

## Why

Players should be able to change the controls to suit themselves (common in action games). No specific
complaint behind it: it is a general comfort feature.

## Goals

- A "Controls" tab in the profile where the player rebinds every movement/combat action.
- Keys and mouse buttons both allowed for any action (e.g. fire on a key for trackpad players).
- The game, the menu key legend, and nothing else needs to know about it: online play is unchanged.

## Non-goals

- Cloud sync of bindings (option B, can be added later on top of this).
- Rebinding weapon slots 1–9 / mouse wheel, Esc (pause), F3 (debug).
- Gamepads, touch controls (the twin-stick layout is not affected).
- A real jump / double jump with a forward flip: **separate next feature**, with its own spec. When it
  ships it adds a "Jump" row (default Space) and the jetpack keeps W.

## Anti-goals

- Anything that changes the network protocol or the server, or can desync online play.
- A player losing an action without noticing (an action with no key must be visibly flagged).

## Approaches (owner picked A)

- **A — bindings stored in this browser, translated on the client (picked).** The pressed physical
  key is turned into the standard code the game already understands before it enters the input state.
  Server, P2P host and validation never see the change. Downside: a new computer starts from defaults.
- B — A plus sync through the account cloud snapshot. Roams between computers, but the snapshot merge
  is "values only grow", bindings need "last change wins": a new merge rule, more tests. Guests get A anyway.
- C — action-based input end to end (game and server know actions, not keys). Cleanest, but touches the
  network protocol and server: too much risk for this feature. Dropped.

## Decided with the owner

### Actions and defaults

Each action has two slots: primary and secondary.

| Action | Primary | Secondary | Standard input it produces |
|---|---|---|---|
| Left | A | — | `KeyA` |
| Right | D | — | `KeyD` |
| Jetpack (up) | W | Space | `KeyW` |
| Down / crouch | S | — | `KeyS` |
| Prone | Z | — | `KeyZ` |
| Fire | Left mouse | — | mouse fire |
| Grapple | Right mouse | Shift | hook |

Notes:
- There is no separate jump in the game today: W and Space both fire the jetpack. The action is named
  honestly "Jetpack (up)". On the hook it reels in, "Down" lets the rope out (as today).
- Reserved, cannot be bound: Esc, F3, digits 1–9.
- Keys are matched by **physical position** (`KeyboardEvent.code`), so a Russian layout behaves the same.

### Profile UI

The right column of the profile gets tabs: **Achievements | Controls**.

```
 [ Achievements ]  [ Controls ]
 ─────────────────────────────────────
 Left              [ A ]   [ — ]
 Right             [ D ]   [ — ]
 Jetpack (up)      [ W ]   [ Space ]
 Grapple           [ RMB ] [ Shift ]
 ...
                         [ Reset all ]
```

- Click a slot → "Press a key…" → the next key or mouse button is bound. Esc cancels. The secondary
  slot can be cleared.
- **Conflict:** a key already used by another action moves to the new one; the old slot becomes empty
  and is highlighted red. An action with no input at all shows a warning.
- "Reset all" restores the defaults.

### Elsewhere

- The key legend at the bottom of the main menu shows the player's bindings, not fixed text.
- Works for guests and logged-in players alike (the profile already does).

## Constraints

- Project rules: files ≤ 200 lines, one responsibility per file, named exports, no silent catches.
- UI follows the "Hazard Bay" design tokens; ru + en strings.
- Test the UI at 1512×700 (owner's screen).

## Left to the builder (my calls, owner may override)

- Translation layer lives in the client input code (`GameCanvas` key/mouse handlers): physical input →
  action → standard input. An action is active while **any** of its bound inputs is held, so releasing
  one of two held keys does not drop it. Raw physical codes never reach the input state.
- Mouse buttons allowed: left, right, middle, back, forward. The wheel stays for weapons.
- Storage: one versioned `localStorage` entry; read through a sanitizer, anything malformed → defaults
  with a `console.warn` (never a silent catch). Unknown/reserved codes dropped on load.
- The Controls tab is hidden on touch-only devices (`pointer: coarse` without a fine pointer): there is
  no keyboard to bind.
- The test range (`#range`) and offline matches use the same input path, so they get the bindings too.
- Ships as its own 0.5.x release (one branch/PR per feature).
