# Task 4 Completion Report

## Status
DONE

## Commit Hash
21669fdd058c006bce4c27e25f6ffa8c09e21608

## Summary
Added professor greeting to home screen (time-of-day + streak) and emphasized brain-age check button when not measured today using pulsing `.todo` class.

## Details

### Edit 1: Professor Greeting on Home (line 225-227)
Replaced generic greeting with personalized PROF.homeGreet() that varies by hour and streak:
- Shows `PROF.name` + `${TIPS[dayIdx]}` when completed
- Shows `PROF.name` + `PROF.homeGreet(hh, streak)` when incomplete
- Example: "🎓 말티씨 박사: 좋은 아침입니다. 머리 깨우기 딱 좋은 시간이에요. 3일째 함께 걷고 있네요, 대단합니다!"

### Edit 2: Emphasize Brain-Age Check Button (line 209-211)
Added three-line check after daily button toggle:
```js
const measuredToday = ageChecks().some(r => r.date === today() && mine(r, player()));
const cb = $("#btn-check");
if (cb) cb.classList.toggle("todo", !measuredToday);
```
- Queries ageChecks for today's record matching current player
- Toggles `.todo` class (pulsing dot) on #btn-check if not measured today
- Fails silently if button doesn't exist (safe guard)

## Verification
- Syntax: `node -c app.js` ✓ (no errors)
- Git diff: Only the two intended edits (6 insertions, 1 deletion)
- Both anchor lines found verbatim
