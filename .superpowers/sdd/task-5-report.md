# Task 5 — FX.flash Coverage Audit

## Method

- Listed every `window.GAME_*` registration referenced in `app.js`'s `const REG = [...]` (app.js:6-32) and located each game's definition file.
- Grepped `FX.flash(` across `games/*.js` and `app.js`.
- Confirmed `app.js`'s `api` object (app.js:444-469: `onTimeUp`, `elapsedSec`, `finish`) has no hidden `flash`/judgment wrapper — every game must call `FX.flash(ok)` directly at its own answer-judgment point. No shared "api.hit()"-style helper exists in this codebase.
- Read every game file in full and traced each answer-judgment branch (button onclick / tile onclick / renderChoices callback) to verify it reaches `FX.flash`.

REG contains 26 game entries (task brief said "25" — actual count in app.js is 26; audited all of them).

## Coverage Table

| Game ID | File | Covered? | Evidence |
|---|---|---|---|
| GAME_CALC | calc.js | Covered (direct) | Shared internal `judge()` (calc.js:39-43) calls `FX.flash(good)`; both 4-choice and ink-input paths route through it. |
| GAME_MEMORY | memory.js | Covered (direct) | memory.js:69 `FX.flash(true)`, memory.js:76 `FX.flash(false)` in tile onclick. |
| GAME_STROOP | stroop.js | Covered (direct) | stroop.js:56 `FX.flash(good)` in choice-button onclick. |
| GAME_TRAIL | trail.js | Covered (direct) | trail.js:46 `FX.flash(true)`, trail.js:53 `FX.flash(false)` in tile onclick. |
| GAME_RPS | pack-speed.js | Covered (direct) | pack-speed.js:50 `FX.flash(good)` in `pick()`. |
| GAME_FLAGS | pack-speed.js | Covered (direct) | pack-speed.js:97 `FX.flash(good)` in flag button onclick. |
| GAME_CALC25 | pack-speed.js (`calcMarathon` factory) | Covered (direct) | pack-speed.js:152 `FX.flash(good)` inside shared `calcMarathon()` factory used by this game. |
| GAME_SIGN | pack-speed.js | Covered (direct) | pack-speed.js:214 `FX.flash(good)` in op-choice onclick. |
| GAME_CALC100 | pack-speed.js (`calcMarathon` factory) | Covered (direct) | Same factory as GAME_CALC25 (pack-speed.js:152). |
| GAME_SERIAL | pack-speed.js | Covered (direct) | pack-speed.js:260 `FX.flash(good)` in `renderChoices` callback. |
| GAME_HIGHEST | pack-speed.js | Covered (direct) | pack-speed.js:324 `FX.flash(good)` in tile onclick. |
| GAME_SPEEDCOUNT | pack-speed.js | **GAP → FIXED** | Original handler (pack-speed.js:353-362) never called `FX.flash` on either branch — zero occurrences in the whole game function. Added `FX.flash(false)` on the out-of-turn branch and `FX.flash(true)` on the correct-tap branch. |
| GAME_PHOTO | pack-memory.js | Covered (direct) | pack-memory.js:54 `FX.flash(good)` in `renderChoices` callback. |
| GAME_GRID55 | pack-memory.js | Covered (direct) | pack-memory.js:110 `FX.flash(true)`, :114 `FX.flash(false)` in cell onclick. |
| GAME_SIMON | pack-memory.js | Covered (direct) | pack-memory.js:173 `FX.flash(true)`, :187 `FX.flash(false)` in cell onclick. |
| GAME_PEOPLE | pack-memory.js | Covered (direct) | pack-memory.js:283 `FX.flash(good)` in `renderChoices` callback. |
| GAME_BIRDS | pack-memory.js | Covered (direct) | pack-memory.js:350 `FX.flash(good)` in `renderChoices` callback. |
| GAME_BOXES | pack-memory.js | Covered (direct) | pack-memory.js:435 `FX.flash(good)` in `renderChoices` callback. |
| GAME_DUAL | pack-memory.js | **Partial GAP → FIXED** | Real-time equation judgment covered (pack-memory.js:472 `FX.flash(good)`). But the end-of-round "how many stars?" follow-up question (a genuine second correct/incorrect judgment feeding 30% of the score) went straight from `renderChoices` callback to `api.finish()` with no `FX.flash` call at all — completely silent judgment. Added `FX.flash(v === stars)` right before the score calc, without touching the scoring formula. |
| GAME_SUDOKU | sudoku.js | Covered (direct) | sudoku.js:124 `FX.flash(true)`, :131 `FX.flash(false)` in number-pad onclick. |
| GAME_CHANGE | pack-extra.js | Covered (direct) | pack-extra.js:49 `FX.flash(good)` in choice-button onclick. |
| GAME_PAIRS | pack-extra.js | Covered (direct) | pack-extra.js:96 `FX.flash(true)`, :107 `FX.flash(false)` in card onclick. |
| GAME_COMPARE | pack-extra.js | Covered (direct) | pack-extra.js:156 `FX.flash(good)` in `pick()`. |
| GAME_RECALL | pack-memory.js | Covered (direct) | pack-memory.js:586 `FX.flash(correct)` in probe-choice callback. |
| GAME_FLOW | flow.js | Covered (by design, no wrong state) | flow.js:148 `FX.flash(true)` fires when a drag completes a connection. This is a drag-connect puzzle (Numberlink-style): an invalid drag extension is simply rejected (no state change, no judgment recorded) rather than being a scored "wrong answer" — same no-penalty-for-invalid-input pattern as Sudoku's "cell already filled" case. No incorrect-answer judgment exists to flash for. Not a gap. |
| GAME_ARROWS | arrows.js | Covered (direct) | arrows.js:107 `FX.flash(true)` (cleared), arrows.js:127 `FX.flash(false)` (blocked) in `tap()`. |

**Result: 26/26 games covered after fix (24 were already covered, 2 had gaps — one full, one partial — both fixed).**

## What was fixed

1. **`games/pack-speed.js` — `GAME_SPEEDCOUNT`** (around line 353): the alternating left/right tap game had no `FX.flash` call anywhere — every tap (right or wrong) was silent (no ⭕/✕ overlay, spark, vibrate, or sound). Added `FX.flash(false)` on the out-of-turn branch and `FX.flash(true)` on the correct-tap branch, right at the existing judgment point.

2. **`games/pack-memory.js` — `GAME_DUAL`** (around line 503): the end-of-round "⭐ 몇 번 나왔나요?" follow-up question is a real correct/incorrect judgment (right/±1/wrong feeds 30% of the score) but never called `FX.flash`, unlike every other answer pick in the codebase. Added `FX.flash(v === stars)` immediately before the existing score computation. Scoring logic (`starPart`, `score`) is untouched.

No other games, styling, or scoring logic were changed.

## Verify

```
node -c app.js               → OK
node -c games/pack-speed.js  → OK
node -c games/pack-memory.js → OK
```

No dev server was started (not required for a syntax-level JS coverage fix).

## Commit

Committed `games/` and `app.js` (working tree had no other pending changes in those paths).

Commit message:
```
fix: 미니게임 손맛 FX.flash 커버리지 — 누락 게임 판정 피드백 연결
```
