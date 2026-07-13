# Task 2 Report — 첫 부팅 온보딩 재배치

status: DONE
commit: `71339a9` — feat: 첫 부팅 온보딩 재배치 — 교수 브리핑→뇌나이 측정 직행, 투어는 측정 후

## 사전 확인
- `git status`: master, origin 대비 5 commit ahead, untracked `.superpowers/`만 존재 (수정 대상 파일 clean 상태에서 시작).
- `PROF` 상수(line 620) 확인: `name`, `intro`, `checkBrief`, `homeGreet`, `revealDrum` 필드 존재. `intro`/`checkBrief` 텍스트 확인 완료.
- `history()`(line 100), `ageChecks()`(line 101), `store.get/set`은 모두 IIFE 최상위 스코프에 이미 정의되어 있어 삽입 지점에서 참조 가능.

## Edit A — `isNewUser` 헬퍼 추가
- 위치: `function startCheck()` 정의(원래 line 944) 바로 위, "진입점" 섹션 내부(`dailyLineup()` 정의 이후, `$("#btn-daily").onclick` 다음 줄).
- 발견: 해당 섹션은 이미 `$("#btn-daily").onclick`, `startCheck`, `$("#btn-check").onclick` 등 진입점 바인딩이 모여 있는 곳이라 자연스러운 삽입 지점.
- 변경: `let onboarding = false;` 와 `function isNewUser() { return !store.get("bw_onboard", 0) && history().length === 0 && ageChecks().length === 0; }` 를 스펙 그대로 삽입.

## Edit B — 부트스트랩에서 신규 유저 분기
- 위치: 파일 최종 `renderHome();` — grep으로 `renderHome();` 호출 6곳(line 126, 168, 276, 376, 733, 1288)을 모두 확인. 126/276/376/733은 각각 다른 함수 내부(콜백, 이벤트 핸들러) 안에 있고, line 1288만 `})();`  직전, 어떤 함수에도 속하지 않은 최상위 문장 — 앱 부트스트랩으로 명확히 식별.
- 변경: `renderHome();` 다음 줄에 `if (isNewUser()) { onboarding = true; store.set("bw_onboard", 1); startCheck(); }` 추가.

## Edit C — check 모드 브리핑 분기
- 위치: `session.mode === "check"` 브리핑 블록, `session.briefed = true;` 바로 다음. 스펙에 명시된 3줄(`#intro-title`/`#intro-desc`/`#intro-best`)을 정확히 매칭.
- 변경: `onboarding` true일 때 교수 페르소나 브리핑(`PROF.name`, `PROF.intro + "\n\n" + PROF.checkBrief`)을 보여주고 `onboarding = false`로 리셋, false일 때는 기존 "🧠 뇌 나이 체크" 문구 그대로 유지 (if/else 분기, 원래 3줄은 else 블록으로 보존).

## Edit D — 투어 첫 스텝 카피 교체
- 위치: `const TOUR = [` 배열의 첫 원소(`btn: "#btn-daily"`), 기존 msg는 `player() ? "먼저 '오늘의 훈련'..." : "처음 오셨네요! 이름 정하고..."` 3항 연산자였음.
- 변경: 스펙 그대로 단일 메시지 `"뇌 나이를 쟀으니, 이제 매일 훈련해 젊게 유지해요 — '오늘의 훈련'부터! 🐾"` 로 교체 (더 이상 `player()` 분기 없음 — 이 시점엔 이미 측정을 마친 뒤이므로 "처음 오셨네요" 문구가 맞지 않기 때문).

## Edit E — `tourStep()` 그랜드파더링 로직 수정
- 위치: `function tourStep()` 본문, `s === null` 분기.
- 발견: 기존 로직은 "기록이 하나라도 있으면(veteran) 투어 스킵"이었는데, 이제 신규 유저는 부팅 즉시 `startCheck()`가 실행되어 `ageChecks()` 기록이 먼저 생기므로 온보딩을 마친 신규 유저도 "veteran"으로 오분류되어 투어가 스킵될 위험이 있었음.
- 변경: `veteran` 판정에 `!store.get("bw_onboard", 0)` 조건을 추가 — 즉 "`bw_onboard` 플래그가 없고(=한 번도 온보딩을 거치지 않았고) 기록이 있는" 경우만 진짜 베테랑으로 취급해 투어를 스킵. Edit B에서 신규 유저는 `bw_onboard`를 1로 세팅하므로, 온보딩을 마친 신규 유저는 이 조건에서 제외되어 정상적으로 투어를 보게 됨.

## Verify
```
$ node -c app.js
(no output — syntax OK)
```
`git diff -- app.js` 확인 결과 정확히 5개 hunk(A~E 각 1개)만 존재, 의도치 않은 변경 없음.

## Commit
```
git add app.js
git commit -m "feat: 첫 부팅 온보딩 재배치 — 교수 브리핑→뇌나이 측정 직행, 투어는 측정 후"
```
결과: `71339a9`, 1 file changed, 19 insertions(+), 5 deletions(-).

## 후속 수정 (컨트롤러 브라우저 E2E 버그) — commit `e97b005`
- 증상: 콜드 부팅 시 신규 유저 자동 `startCheck()` → `startSession()`(app.js:383)이 교수 브리핑 표시 전에 `askPlayer(false)`(블로킹 `window.prompt`)를 먼저 호출. 이름 prompt가 측정보다 앞서 뜨고, 헤드리스 프리뷰가 hang됨.
- 근본 원인: `startSession`의 무조건 `askPlayer(false)` 호출이 온보딩 첫 측정 경로에도 걸림. `startSession`은 daily/check/campaign 등 모든 진입점의 공유 함수라, 여기 한 곳만 가드하면 모든 caller가 함께 커버됨(개별 caller 패치 불필요).
- 수정(1줄): `askPlayer(false);` → `if (!onboarding) askPlayer(false);`. 부팅 시 `startSession` 실행 시점엔 `onboarding`이 아직 true(브리핑 오버라이드에서 false로 바뀌기 전)이라 첫 온보딩 측정만 prompt 스킵. 일반 게임 시작(onboarding=false)은 기존대로 prompt 유지.
- 스코프 확인: `onboarding`은 edit (A)에서 추가한 IIFE 모듈 변수. `startSession`(line 381)은 선언보다 위에 있지만, 실제 호출은 부팅 끝(line ~1300, `let onboarding` 초기화 이후)에 일어나므로 클로저 참조로 정상 접근 (TDZ 영향 없음).
- 검증: `node -c app.js` 통과, diff는 1줄 변경만.

## 비고
- 서버 기동/브라우저 E2E는 지시에 따라 수행하지 않음 (컨트롤러가 별도로 담당).
- CLAUDE.md의 옵시디언 저장 규약은 이 저장소(`brain-walk`)가 아닌 별도 vault(`AI-Wiki`) 대상이라 이 작업에는 적용하지 않음.
