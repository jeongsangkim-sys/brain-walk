# Task 3 Report — 뇌 나이 납득성 (교수 진단 내러티브 + 속도/정확도 분해 카드)

## Edit 1 — professor drum roll
- Found verbatim: `$("#coach-bubble").textContent = "두구두구두구…";` (was line 890 pre-edit).
- Changed to: `$("#coach-bubble").textContent = PROF.revealDrum;`
- Verified `PROF.revealDrum` exists at app.js:640 (`revealDrum: "자, 결과를 볼까요… 두구두구두구…"`).

## Edit 2 — narrative generator
- Anchor `function finishCheck(` found verbatim (was line 852 pre-edit).
- Inserted `ageNarrative(queue, metas, speedAge, errAdd)` function immediately above it, exactly as specified (picks fastest/slowest task by `ratio`, worst by `err`, composes professor-tone sentence).

## Edit 3 — breakdown card insertion point
- Anchor found verbatim: the `$("#result-detail").innerHTML = ...` assignment ending with the disclaimer `<span class="disclaimer">...</span>\`;` line (was line 915/927 pre/post Edit 2, inside the `FX.reveal(...)` reveal callback).
- Inserted the `narrative` / `spPct` / `erPct` computation + `$("#result-detail").insertAdjacentHTML("beforeend", ...)` block **immediately after** that assignment's `;` and **immediately before** `$("#coach-bubble").textContent = ...` (the next statement in the same callback).
- Confirmed via diff: insertion sits inside the `FX.reveal($("#result-score"), age, "세", () => { ... })` callback body, well before the callback's closing `});` (which is followed later by `courseAdvance("check");` etc. outside the callback). Uses `insertAdjacentHTML` (append), correctly placed after the `innerHTML =` assignment as required.

## Edit 4 — CSS
- Anchor found verbatim: `.tease { margin-top: var(--sp-3); font-size: 15px; color: var(--fg-secondary); }` in style.css.
- Inserted `.age-why`, `.why-line`, `.why-bar`, `.why-bar .bar`, `.why-bar .bar i`, `.why-bar .bar.err i`, `.why-note` rules directly above it, exactly as specified.

## Verify
- `node -c app.js` → passed (no syntax errors).
- `git diff app.js style.css` reviewed → confirmed only the 4 intended edits present, no stray changes. Edit 3's block correctly lands inside the reveal callback per above.
- Did not start a dev/preview server (per task instruction — controller runs browser E2E separately).

## Commit
```
916ce2015bcdd09a2514132a59a70bf0a841ae44
feat: 뇌 나이 납득성 — 교수 진단 내러티브 + 속도/정확도 분해 카드
```
2 files changed, 32 insertions(+), 1 deletion(-)
