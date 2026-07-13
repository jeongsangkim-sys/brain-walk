# 닌텐도급 교수 개입·온보딩·납득성·손맛 맞춤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 닌텐도 DS 두뇌 트레이닝 구조에 맞춰 말티씨 박사(교수)가 온보딩·측정·훈련 전 구간에 개입하고, 뇌 나이 결과가 내러티브로 납득되며, 미니게임 손맛이 원조급으로 일관되게 한다.

**Architecture:** 바닐라 HTML/CSS/JS 단일 앱(빌드 없음). 기존 함수(`startCheck`/`finishCheck`/`renderHome`/`renderTour`/`show`)와 손맛 레이어(`FX.flash`)에 훅을 얹는다. 신규는 교수 대사 상수(`PROF`)·온보딩 재배치·납득성 내러티브. ④(허브)·⑥(손맛)은 대부분 기존 구현이라 정렬·튜닝만.

**Tech Stack:** Vanilla JS, localStorage, PWA. 테스트 프레임워크 없음 — QA는 `sim/autoplay.js` 하네스 + 로컬 서버(launch.json "brain-walk", PowerShell HttpListener) 브라우저 E2E. **이 PC엔 Node/Python 없음** → 모든 검증은 브라우저에서.

## Global Constraints

- 용도 내부용. 단 "재미로 보는 뇌 나이" 의료 면책·"치매 위험 판정 금지" 가드레일 유지(spec §법적 가드레일)
- 교수 이름 = **말티씨 박사** (verbatim)
- 뇌 나이 범위 20~85세, EMA 절반 블렌딩 유지 (회귀 금지)
- 다크모드: 배경 고정색 금지, 테마 변수(`--surface`/`--fg-*`)만
- 데일리 라인업 랜덤 유지(날짜시드 복원 금지)
- 캐시버스트 `?v=` 범프는 **모든 편집 끝난 커밋 직전 마지막에** (범프 후 파일 수정 금지)
- prompt/confirm/alert 목킹 후 클린 리로드
- push = 자동배포 → **사용자 승인 후에만** push
- 커밋 컨벤션: `feat:`/`fix:`/`docs:`/`test:` + 한국어 요약

---

### Task 1: 말티씨 박사 페르소나 상수 + 헬퍼

이후 모든 축이 이 대사·헬퍼를 사용한다. 행동 변화 없음(순수 추가).

**Files:**
- Modify: `app.js` — `COACH`/`coachSay` 근처(app.js:620-635)에 `PROF` 상수·`profSay` 헬퍼 추가

**Interfaces:**
- Produces:
  - `const PROF = { intro, homeGreet(hh, streak), checkBrief, revealDrum, byAge(age) }` — 장면별 대사(문자열 또는 함수)
  - `function profSay(bubbleSel, text)` — 지정 말풍선 요소에 교수 대사 세팅(+ 표정은 호출측이 setCoachFace로)

- [ ] **Step 1: `PROF` 상수 추가** (app.js, `const COACH = {` 바로 위에 삽입)

```js
  // 🎓 말티씨 박사 — 교수 페르소나 대사 (정중·따뜻한 교수체 + 강아지 유머 소량)
  const PROF = {
    name: "말티씨 박사",
    intro: "안녕하세요, 말티씨 박사입니다. 🎓\n두뇌는 쓸수록 젊어지죠. 먼저 당신의 뇌 나이부터 재볼까요?",
    checkBrief: "긴장은 금물이에요. 빠르고 정확하게, 그거면 충분합니다. 준비되면 시작하죠!",
    homeGreet(hh, streak) {
      const t = hh < 5 ? "늦은 밤까지 두뇌 산책이라니, 멋져요."
        : hh < 11 ? "좋은 아침입니다. 머리 깨우기 딱 좋은 시간이에요."
        : hh < 17 ? "오후엔 두뇌 회전이 살짝 느려지죠. 한 판으로 깨워봅시다."
        : hh < 22 ? "하루 마무리 산책, 제가 함께하겠습니다." : "자기 전 가벼운 한 판, 킁킁 좋은 습관 냄새.";
      const s = streak >= 3 ? ` ${streak}일째 함께 걷고 있네요, 대단합니다!` : "";
      return t + s;
    },
    revealDrum: "자, 결과를 볼까요… 두구두구두구…"
  };
```

- [ ] **Step 2: `profSay` 헬퍼 추가** (같은 위치, `PROF` 아래)

```js
  function profSay(bubbleSel, text) {
    const el = $(bubbleSel);
    if (el) el.textContent = text;
  }
```

- [ ] **Step 3: 로컬 서버로 로드 검증(문법)**

launch.json "brain-walk" 서버 실행 → 브라우저 콘솔에서:
Run(콘솔): `PROF.name` / `PROF.homeGreet(9, 3)`
Expected: `"말티씨 박사"` / "좋은 아침입니다… 3일째 함께 걷고 있네요…" — 콘솔 에러 0

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: 말티씨 박사 교수 페르소나 대사 상수·헬퍼 추가"
```

---

### Task 2: 온보딩 재배치 — 교수 인트로 → 첫 측정 직행 → 투어 측정 후로 (①②)

신규 유저 첫 부팅을 닌텐도식(교수 인트로 → 뇌 나이 측정부터)으로. 기존 유저는 스킵.

**중요(실코드 확인됨)**: 별도 온보딩 화면 없음. 뇌 나이 체크는 `startCheck`→`startSession("check")` 진입 시 `#screen-game` 안 `#game-intro` 브리핑 1장(app.js:505-512)을 먼저 띄우고 `#btn-go`("시작")로 배터리를 시작한다. **이 브리핑 화면을 신규 유저에겐 말티씨 박사 대사로 오버라이드**하면 온보딩 인트로가 된다. 새 화면·새 버튼 불필요.

**Files:**
- Modify: `app.js` — 앱 진입부(app.js:1268 `renderHome()`), 체크 브리핑 블록(505-512), `TOUR`(282), `tourStep`(288-295). 모듈 변수 `onboarding` 1개 추가
- index.html·CSS 변경 없음

**Interfaces:**
- Consumes: `PROF.intro`, `PROF.checkBrief` (Task 1); 기존 `startCheck`(924), `ageChecks()`, `history()`
- Produces: localStorage `bw_onboard`(1=온보딩 진입함), 모듈 변수 `let onboarding`(이번 세션 첫 측정이 온보딩인지). 신규 유저 = `!bw_onboard && history().length===0 && ageChecks().length===0`

- [ ] **Step 1: 신규 유저 판별 + 온보딩 플래그** (app.js, `startCheck` 근처에 추가)

```js
  // 🎓 첫 부팅 온보딩: 교수 브리핑 → 첫 뇌 나이 측정 직행 (닌텐도식)
  let onboarding = false;
  function isNewUser() {
    return !store.get("bw_onboard", 0) && history().length === 0 && ageChecks().length === 0;
  }
```

- [ ] **Step 2: 앱 진입부에서 신규 유저 분기** (app.js:1268 `renderHome();` 를 아래로 교체)

```js
  renderHome();
  if (isNewUser()) { onboarding = true; store.set("bw_onboard", 1); startCheck(); }
```

(renderHome 먼저 호출해 홈을 준비하고, 곧바로 체크 브리핑을 띄운다 — 측정 종료 후 홈은 이미 렌더된 상태)

- [ ] **Step 3: 체크 브리핑을 온보딩이면 교수 대사로 오버라이드** (app.js:510-512 세팅부를 조건 분기로 교체)

```js
        if (onboarding) {
          $("#intro-title").textContent = `🎓 ${PROF.name}`;
          $("#intro-desc").textContent = PROF.intro + "\n\n" + PROF.checkBrief;
          $("#intro-best").textContent = "준비되면 시작을 누르세요";
          onboarding = false; // 브리핑 1회만 교수 인트로, 이후 재측정은 일반 브리핑
        } else {
          $("#intro-title").textContent = "🧠 뇌 나이 체크";
          $("#intro-desc").textContent = `${session.queue.length}가지 과제가 쉬는 시간 없이 자동으로 이어져요. (약 2분)\n빠르고 정확할수록 젊게 나와요 — 최고 속도·무오답이면 20세!`;
          $("#intro-best").textContent = "준비되면 시작을 누르세요";
        }
```

`#btn-go`(시작)는 기존 배선 그대로 배터리를 시작하므로 재배선 불필요.

- [ ] **Step 4: 투어를 측정 완료 후 시작하도록 재배치**

`tourStep()`(288)의 그랜드파더링 조건은 유지(기존 유저 skip). 신규 유저는 측정을 마쳐야 `ageChecks().length>0`이 되므로, 투어 1스텝 문구를 훈련 유도로 교체 — `TOUR` 배열 첫 원소(app.js:282)를 아래로 수정:

```js
    { btn: "#btn-daily", msg: () => "뇌 나이를 쟀으니, 이제 매일 훈련해 젊게 유지해요 — '오늘의 훈련'부터! 🐾" },
```

투어 시작 타이밍: `finishCheck` 종료 후 홈 복귀 시 `renderHome()`가 `renderTour()`를 부르므로(231), 측정 후 자연히 투어가 뜬다. 단 신규 유저의 `bw_tour` 초기값이 0이어야 함 — `tourStep()`에서 `ageChecks().length`가 이미 있으면 스킵되던 로직을 신규 온보딩과 충돌하지 않게 확인: 측정 직후 ageChecks가 1이 되어 `tourStep`이 `TOUR.length`(스킵)로 판정될 수 있음. **수정 필요** → `tourStep()`의 기존유저 판정에서 `bw_onboard`를 우선:

```js
  function tourStep() {
    let s = store.get("bw_tour", null);
    if (s === null) {
      // 온보딩을 방금 마친 신규 유저는 투어를 보여준다. 진짜 기존 유저(온보딩 없이 기록 보유)만 스킵.
      const veteran = !store.get("bw_onboard", 0) && (history().length || ageChecks().length);
      s = veteran ? TOUR.length : 0;
      store.set("bw_tour", s);
    }
    return s;
  }
```

- [ ] **Step 5: 브라우저 E2E — 신규 유저 흐름**

launch.json "brain-walk" 서버 → 콘솔에서 `localStorage.clear()` 후 리로드.
Expected 순서:
1. 체크 브리핑 화면이 교수 대사로: 제목 "🎓 말티씨 박사", 본문 PROF.intro+checkBrief, "시작"(`#btn-go`) 버튼
2. 시작 → 3-2-1 → 5과제 무중단 측정
3. "당신의 뇌 나이는… N세" 공개
4. 홈 복귀 → 투어 1스텝이 `#btn-daily`에 "…이제 매일 훈련해…" 로 표시
콘솔 에러 0.

- [ ] **Step 6: 브라우저 E2E — 기존 유저 스킵**

콘솔에서 기존 유저 모사: `localStorage.setItem('bw_history', JSON.stringify([{date:'2026-07-01',score:70,name:'테스트'}]))` 후 리로드.
Expected: 온보딩 브리핑 **안 뜨고** 홈 직행, 투어 없음.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: 첫 부팅 온보딩 재배치 — 교수 브리핑→뇌나이 측정 직행, 투어는 측정 후"
```

---

### Task 3: 뇌 나이 납득성 — 교수 진단 내러티브 + 분해 카드 (⑤)

측정 결과에 과제별 강약을 말로 풀고, 속도/오답 기여분을 시각화해 누가 봐도 수긍하게.

**Files:**
- Modify: `app.js` — `finishCheck`(824-910 구간), `metas` 활용부
- Modify: `style.css` — 분해 막대·내러티브 카드 스타일

**Interfaces:**
- Consumes: `finishCheck`의 `metas`(과제별 `{ratio, err, rt}` app.js:828-836), `speedAge`/`errAdd`/`age`, `session.queue`(과제명), `PROF`
- Produces: `function ageNarrative(queue, metas, speedAge, errAdd)` → 교수 진단 문장(string)

- [ ] **Step 1: 진단 내러티브 생성기 추가** (app.js, `finishCheck` 위)

```js
  // 🎓 과제별 강약을 교수 어투로 서술 — 뇌 나이의 개인화된 근거 (납득성)
  function ageNarrative(queue, metas, speedAge, errAdd) {
    // 가장 빠른/느린 과제(ratio 낮을수록 빠름), 가장 잘/못 맞힌 과제(err 낮을수록 정확)
    const withName = queue.map((g, i) => ({ name: g.name, ...metas[i] }));
    const fast = withName.reduce((a, b) => b.ratio < a.ratio ? b : a);
    const slow = withName.reduce((a, b) => b.ratio > a.ratio ? b : a);
    const worst = withName.reduce((a, b) => b.err > a.err ? b : a);
    const speedy = speedAge <= 35;
    let s = speedy ? `${fast.name}에선 젊은 층 못지않게 빨랐어요.` : `전반적으로 반응이 조금 느긋했어요(특히 ${slow.name}).`;
    if (errAdd >= 9) s += ` 다만 ${worst.name}에서 실수가 있어 나이가 올라갔습니다.`;
    else s += ` 정확도는 훌륭했어요.`;
    return s;
  }
```

- [ ] **Step 2: 공개 연출에 교수 드럼롤 + 공개 후 진단 삽입**

`finishCheck` 내 "두구두구두구…" 세팅부(app.js:862)를 `PROF.revealDrum`으로:

```js
    $("#coach-bubble").textContent = PROF.revealDrum;
```

그리고 나이 공개(카운트업) 직후 결과 상세에 진단 문장·분해를 넣는다. `metas`·`speedAge`·`errAdd`가 스코프에 있는 지점(공개 렌더 이후)에서:

```js
    const narrative = ageNarrative(session.queue, metas, speedAge, errAdd);
    const spPct = Math.round(Math.max(0, Math.min(100, (speedAge - 20) / 65 * 100)));
    const erPct = Math.round(Math.max(0, Math.min(100, errAdd / 45 * 100)));
    $("#result-detail").insertAdjacentHTML("beforeend", `
      <div class="age-why">
        <div class="why-line">🎓 ${narrative}</div>
        <div class="why-bar"><span>속도</span><div class="bar"><i style="width:${spPct}%"></i></div></div>
        <div class="why-bar"><span>정확도</span><div class="bar err"><i style="width:${erPct}%"></i></div></div>
        <small class="why-note">속도·실수가 각각 나이를 얼마나 끌어올렸는지예요. 재미로 보는 추정치랍니다.</small>
      </div>`);
```

주: `session.queue`/`metas` 순서 일치 필수(둘 다 과제 순서 동일). `#result-detail`이 공개 시 innerHTML 초기화되는지(861) 확인 후, 이 삽입은 **초기화 이후**에 오도록 배치.

- [ ] **Step 3: 분해 카드 CSS 추가** (style.css, `.tease` 근처)

```css
.age-why { margin-top: var(--sp-4); padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--border-hairline); border-radius: var(--radius-lg);
  background: var(--surface); color: var(--fg-primary); text-align: left; }
.why-line { font-size: 16px; margin-bottom: var(--sp-3); }
.why-bar { display: flex; align-items: center; gap: var(--sp-2); font-size: 14px; margin: 4px 0; color: var(--fg-secondary); }
.why-bar .bar { flex: 1; height: 10px; border-radius: 5px; background: var(--charcoal-100); overflow: hidden; }
.why-bar .bar i { display: block; height: 100%; background: var(--aia-red); }
.why-bar .bar.err i { background: var(--charcoal-500); }
.why-note { display: block; margin-top: var(--sp-2); color: var(--fg-tertiary); }
```

(`--charcoal-100`·`--charcoal-500`·`--border-hairline`·`--surface`·`--fg-*` 모두 style.css에 실존 확인됨)

- [ ] **Step 4: 브라우저 E2E — 납득성 렌더 + 극단값 회귀**

서버 리로드 → 뇌 나이 체크 1회 완주.
Expected: 공개 후 🎓 진단 문장 + 속도/정확도 막대 2개 표시. 다크모드 토글 시 글자 안 사라짐(테마 변수).
회귀: 콘솔에서 방치(무응답) 측정 → 고령(80대 근처), 빠르게 무오답 → 20대. `age`가 20~85 벗어나지 않음.

- [ ] **Step 5: Commit**

```bash
git add app.js style.css
git commit -m "feat: 뇌 나이 납득성 — 교수 진단 내러티브 + 속도/정확도 분해 카드"
```

---

### Task 4: 홈 교수 인사 + 뇌 나이 체크 강조 (④ + ③ home)

홈에 말티씨 박사 인사(시간대·연속출석), 매일 측정을 시그니처 액션으로 강조.

**Files:**
- Modify: `app.js` — `renderHome`(192-232), 특히 `#home-tip`(225)

**Interfaces:**
- Consumes: `PROF.homeGreet` (Task 1), `streakDays()`, 기존 `#home-tip`/`#btn-check`

- [ ] **Step 1: 홈 인사를 교수 페르소나로** (app.js:225 `#home-tip` 세팅 교체)

미완료 시 교수 인사, 완료 시 기존 팁 유지:

```js
    $("#home-tip").textContent = doneToday
      ? `💬 ${PROF.name}: ${TIPS[dayIdx]}`
      : `🎓 ${PROF.name}: ${PROF.homeGreet(new Date().getHours(), streakDays().n)}`;
```

- [ ] **Step 2: 뇌 나이 체크 버튼 강조** (renderHome 내, 오늘 미측정이면 todo 글로우)

```js
    const measuredToday = ageChecks().some(r => r.date === today() && mine(r, player()));
    const cb = $("#btn-check");
    if (cb) cb.classList.toggle("todo", !measuredToday);
```

(`.todo` 클래스는 이미 `#btn-daily`에 쓰는 강조 스타일 재사용)

- [ ] **Step 3: 브라우저 E2E**

서버 리로드(기존 유저 상태). Expected: 홈 하단에 "🎓 말티씨 박사: {시간대 인사}" 표시. 오늘 측정 전이면 뇌 나이 체크 버튼에 todo 강조. 콘솔에서 시간 바꿔(`Date` 못 바꾸면 `PROF.homeGreet(20,3)` 호출로 문구만 확인) 저녁 문구 다른지.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: 홈 말티씨 박사 인사(시간대·연속출석) + 뇌 나이 체크 강조"
```

---

### Task 5: 미니게임 손맛 감사·튜닝 (⑥)

`FX.flash` 공통 레이어는 이미 강력(⭕✕/스파크/콤보/진동/사운드). 커버리지 감사 + 원조식 "짧고 경쾌" 튜닝.

**Files:**
- Read/audit: `games/*.js` (각 미니게임)
- Modify: `games/juice.js` — 필요 시 judge/spark/vibrate 상수, 누락 게임 연결
- Modify: `games/style` 관련 CSS(judge 지속·크기) — 있으면

**Interfaces:**
- Consumes: `FX.flash(ok)`(juice.js:74), `FX.judge`(97)

- [ ] **Step 1: 커버리지 감사**

Run(리포): `grep -rn "FX.flash" games/*.js` 로 각 게임이 정답/오답 판정 시 `FX.flash(true/false)`를 부르는지 확인. 정답 처리하는데 `FX.flash` 호출이 없는 게임 목록화.
Expected 산출물: 누락 게임 리스트(없으면 "전 게임 커버됨" 기록하고 Step 2로).

- [ ] **Step 2: 누락 게임 연결 (있을 때만)**

누락된 게임의 정답/오답 확정 지점에 `FX.flash(ok)` 추가(점수 가산 로직 옆). 각 수정은 해당 게임 파일에서 1~2줄.
(누락 없으면 이 스텝 skip — 코드 변경 없음)

- [ ] **Step 3: 튜닝 — 원조식 짧고 경쾌**

`FX.judge`(juice.js:97-104) 지속 420ms가 리듬 안 깨는지 실기 감으로 점검. 과하면 340ms로. `judge-o`(정답 ⭕) 연출을 원조 빨간 동그라미 손맛에 맞춰 CSS에서 소폭 강조(색/두께). 진동 패턴(88)은 그대로(이미 콤보 에스컬레이션).
변경은 상수/CSS 수준. 과튜닝 금지 — 눈에 띄는 불균일만 손봄.

- [ ] **Step 4: 브라우저 검증 — 게임별 손맛**

서버에서 자유 플레이로 계산·기억·스트룹·Simon·recall 각 1판씩. Expected: 정답 시 ⭕ + 스파크 + (폰이면)진동, 오답 시 ✕. 게임 간 손맛 일관(누락 없음).

- [ ] **Step 5: Commit**

```bash
git add games/
git commit -m "fix: 미니게임 손맛 FX.flash 커버리지 감사 + 원조식 판정 튜닝"
```

(코드 변경이 없으면(전 게임 이미 커버·튜닝 불필요) 이 태스크는 "감사 결과 무변경"으로 커밋 생략하고 플랜에 기록)

---

### Task 6: 시뮬 회귀 + 캐시버스트 + 최종 확인

전체 무회귀 확인 후 배포 준비. push는 사용자 승인 후.

**Files:**
- Modify: `index.html` — 캐시버스트 `?v=59` → `?v=60` (모든 `?v=59` 일괄, `logo.png?v=2`는 유지)

- [ ] **Step 1: 시뮬 하네스 E2E**

launch.json 서버 브라우저에서 `sim/autoplay.js` 주입 실행(프로젝트 노트 절차: `window.prompt` 스텁 후 `__runAll()`).
Expected: 25종 게임 + 데일리(5) + 뇌나이 체크(5과제) 전부 완주, 콘솔 에러 0. `bw_backup_*` 백업으로 실기록 보호 확인, 종료 후 정리.

- [ ] **Step 2: 온보딩 회귀 재확인**

`localStorage.clear()` 리로드 → 인트로→측정→진단→홈→투어 순서 정상(Task 2·3 통합 동작).

- [ ] **Step 3: 캐시버스트 범프 (마지막)**

Run(리포): `sed -i 's/?v=59/?v=60/g' index.html`
Run: `grep -o '?v=[0-9]*' index.html | sort | uniq -c` → v60 다수 + logo v2 1개 확인.

- [ ] **Step 4: 최종 커밋**

```bash
git add index.html
git commit -m "chore: 캐시버스트 v60 — 교수 온보딩·납득성·손맛 릴리스"
```

- [ ] **Step 5: 사용자 승인 후 push (자동배포)**

사용자에게 배포 승인 요청. 승인 시 `git push`. 이후 라이브(https://jeongsangkim-sys.github.io/brain-walk/) 검증.

- [ ] **Step 6: 옵시디언 노트 갱신**

`wiki/projects/brain-walk.md` "현재 상태"·"열린 실" 갱신 + `log.md` 한 줄 + `index.md` 확인 (vault 규약 §8).

---

## Self-Review

- **Spec coverage**: ①교수인트로+온보딩→Task2 · ②측정직행→Task2 · ③교수상시개입→Task1(대사)+Task4(홈)+Task3(공개드럼롤/진단) · ④데일리허브정렬→Task4 · ⑤납득성→Task3 · ⑥손맛→Task5. 검증·배포→Task6. 전 축 커버.
- **Placeholder scan**: 실코드 확인 완료 — 온보딩은 별도 화면·버튼 없이 기존 `#game-intro` 브리핑/`#btn-go` 재사용(Task2), CSS 변수 실존 확인(Task3). 잔여 플레이스홀더 없음. 대사·코드 모두 구체값.
- **Type consistency**: `PROF`/`profSay`/`ageNarrative`/`isNewUser`/`startOnboard` 이름 태스크 간 일치. `metas`·`session.queue` 순서 동일 전제 Task3에 명시.
