// 두뇌 산책 — 공통 로직 (라우팅·타이머·점수·저장·연출)
(function () {
  const U = window.BW_UTIL;

  // 게임 등록부: daily=오늘의 훈련 후보, check=뇌 나이 체크 후보
  const REG = [
    { g: window.GAME_CALC, daily: true },
    { g: window.GAME_MEMORY, daily: true },
    { g: window.GAME_STROOP, daily: true, check: true },
    { g: window.GAME_TRAIL, daily: true, check: true },
    { g: window.GAME_RPS, daily: true },
    { g: window.GAME_FLAGS, daily: true },
    { g: window.GAME_CALC25, daily: true },
    { g: window.GAME_SIGN, daily: true, check: true },
    { g: window.GAME_CALC100 },
    { g: window.GAME_SERIAL, check: true },
    { g: window.GAME_HIGHEST, check: true },
    { g: window.GAME_SPEEDCOUNT, check: true },
    { g: window.GAME_PHOTO, daily: true },
    { g: window.GAME_GRID55, check: true },
    { g: window.GAME_NBACK, daily: true, check: true },
    { g: window.GAME_PEOPLE, daily: true },
    { g: window.GAME_BIRDS, daily: true },
    { g: window.GAME_BOXES, daily: true },
    { g: window.GAME_DUAL, daily: true },
    { g: window.GAME_SUDOKU },
    { g: window.GAME_CHANGE, daily: true },
    { g: window.GAME_PAIRS, daily: true },
    { g: window.GAME_COMPARE, daily: true, check: true },
    { g: window.GAME_FLOW, daily: true },
    { g: window.GAME_ARROWS, daily: true }
  ].filter(r => r.g);
  const ALL = REG.map(r => r.g);
  const DAILY_POOL = REG.filter(r => r.daily).map(r => r.g);
  const CHECK_POOL = REG.filter(r => r.check).map(r => r.g);

  // 인플레이 힌트 — 플레이 중 타이머 아래 상시 표시 (규칙 헷갈릴 때 즉시 확인)
  const HINTS = {
    calc: "정답을 고르세요 — 빠를수록 점수 ↑",
    memory: "가려진 칸을 작은 수부터 순서대로!",
    stroop: "글자 뜻 말고, 글자의 '색'을 고르세요",
    trail: "1→가→2→나… 숫자·글자 번갈아 누르기",
    rps: "'지세요'면 지는 손을 골라야 해요",
    flags: "'아니야!'가 붙으면 반대 깃발!",
    calc25: "25문제 완주 — 빠를수록 점수 ↑",
    calc100: "50문제 완주 — 페이스 유지!",
    sign: "계산이 맞아지는 부호를 고르세요",
    serial: "앞 결과에서 같은 수를 계속 빼세요",
    highest: "가장 컸던 숫자의 자리를 누르세요",
    speedcount: "왼쪽·오른쪽 번갈아 눌러야 올라가요",
    photo: "방금 사라진 그림을 고르세요",
    grid55: "불 켜졌던 칸을 그대로 다시 누르세요",
    nback: "직전과 같은 자리에 또 나오면 버튼!",
    people: "들어가고 나간 사람을 계속 셈하세요",
    birds: "나비는 빼고, 새만 세세요",
    boxes: "뒤에 가려진 상자까지 세야 해요",
    dual: "계산 O/X 하면서 ⭐ 횟수도 세기",
    sudoku: "가로·세로·3×3에 1~9가 한 번씩 · ❤️ 3개",
    change: "낸 돈 − 물건값 = 거스름돈",
    pairs: "같은 그림 두 장을 찾아 뒤집으세요",
    compare: "개수가 더 많은 쪽을 빠르게!",
    flow: "같은 색 점끼리 — 길이 겹치면 안 돼요",
    arrows: "길이 뚫린 화살표부터 차례로 내보내요"
  };

  const ICONS = { calc: "➕", memory: "👀", stroop: "🎨", trail: "🔗" }; // v1 게임 아이콘 보강
  const icon = g => g.icon || ICONS[g.id] || "🧠";
  const iconSrc = g => `assets/icons/${g.id}.png`; // 게임별 일러스트 아이콘

  // ---------- 저장 ----------
  const store = {
    get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  };
  // 로컬(한국) 날짜 기준 — toISOString은 UTC라 오전 9시 전에 어제로 찍히는 버그 방지
  const localDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => localDate(new Date());
  const levels = () => store.get("bw_levels", {});
  const best = () => store.get("bw_best", {});
  const history = () => store.get("bw_history", []);
  const ageChecks = () => store.get("bw_agecheck", []);
  // 가족 기록 분리: 기록에 이름 태그. 이름 없는 옛 기록은 모두의 것으로 인정(레거시 그레이스)
  const mine = (r, who) => !who || !r.name || r.name === who;
  const myHist = who => history().filter(r => mine(r, who));
  const settings = () => store.get("bw_settings", { relaxMode: false, sound: true });
  // 시작 레벨 3 — 몸풀기 생략, 첫 판부터 본 훈련 난도(JS 피드백: 더 어렵게). 못 따라오면 DDA가 내려줌
  const levelOf = id => levels()[id] || 3;

  function adjustLevel(id, score) {
    const lv = levels();
    const cur = lv[id] || 3;
    // 65↑ 승급 / 30↓ 강등 — 승급 문턱을 낮춰 '살짝 벅찬' 구간에 더 빨리 도달 (난이도 상향)
    if (score >= 65) lv[id] = Math.min(9, cur + 1);
    else if (score < 30) lv[id] = Math.max(1, cur - 1);
    else lv[id] = cur;
    store.set("bw_levels", lv);
  }
  // 플레이어 이름 (오락실식 명예 기록 — 같은 기기 가족 대결용)
  const player = () => store.get("bw_player", "");
  function askPlayer(force) {
    let p = player();
    if (!p || force) {
      const input = window.prompt("플레이어 이름을 알려주세요! (최고 기록에 남아요)", p || "");
      p = (input || p || "게스트").trim().slice(0, 8) || "게스트";
      store.set("bw_player", p);
      renderHome();
    }
    return p;
  }
  const champs = () => store.get("bw_champs", {});

  function updateBest(id, score) {
    const b = best();
    const prev = b[id] || 0;
    if (score > prev) {
      b[id] = score;
      store.set("bw_best", b);
      const c = champs();
      c[id] = { name: player() || "게스트", date: today() };
      store.set("bw_champs", c);
      CLOUD.submit(id, player() || "게스트", score); // 온라인 기록판 (연결 시)
    }
    return prev;
  }

  const medal = s => s >= 85 ? "🥇" : s >= 65 ? "🥈" : s >= 40 ? "🥉" : "";

  // ---------- 게임 해금 (원작식: 훈련한 날이 쌓이면 새 게임이 열림) ----------
  const UNLOCK_SEQ = ["calc", "memory", "stroop", "rps", "trail", "flags",
    "calc25", "sign", "photo", "people", "birds", "highest", "grid55",
    "boxes", "dual", "nback", "serial", "speedcount", "sudoku", "calc100",
    "change", "pairs", "compare", "flow", "arrows"];
  const stamps = () => new Set(history().map(r => r.date)).size; // 훈련한 날 수
  const unlockLimit = () => 6 + stamps() * 3; // 시작 6종 + 하루 3종씩
  const UNLOCK_COST = 300; // 🐾 마일로 조기 해금 (도장 대안)
  const isUnlocked = g => UNLOCK_SEQ.indexOf(g.id) < unlockLimit() || (wallet().games || []).includes(g.id);
  const unlockDay = g => Math.ceil((UNLOCK_SEQ.indexOf(g.id) - 5) / 3); // 필요한 도장 수
  // 뇌 나이(재미용 추정): 비선형 곡선 — 20세는 평균 100점(만점)에서만.
  // 90점=26세, 80점=35세, 65점=48세, 50점=66세, 30점~=80세
  const brainAge = s => Math.min(80, 20 + Math.round(0.35 * Math.pow(Math.max(0, 100 - s), 1.25)));

  // ---------- 화면 전환 ----------
  const $ = s => document.querySelector(s);
  function show(name) {
    document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
    $("#screen-" + name).classList.add("active");
  }
  document.querySelectorAll("[data-goto]").forEach(b => b.onclick = () => { stopTimer(); renderHome(); show(b.dataset.goto); });

  // ---------- 홈 ----------
  // 스트릭 실드: 7일에 한 번은 쉬어도 연속 기록 유지 (Streak Ruin 방지)
  function streakDays() {
    const dates = new Set(myHist(player()).map(h => h.date));
    let n = 0, shieldUsed = false;
    const usedWeeks = new Set();
    const d = new Date();
    if (!dates.has(today())) d.setDate(d.getDate() - 1); // 오늘은 아직 실패 아님
    while (true) {
      if (dates.has(localDate(d))) { n++; d.setDate(d.getDate() - 1); continue; }
      const wk = Math.floor(d.getTime() / 604800000); // 7일 단위 주 키
      const next = new Date(d); next.setDate(next.getDate() - 1);
      // 그 주 실드 미사용 + 하루짜리 공백이면 쉼표로 이어줌
      if (!usedWeeks.has(wk) && dates.has(localDate(next)) && n > 0) {
        usedWeeks.add(wk); shieldUsed = true;
        d.setDate(d.getDate() - 1);
        continue;
      }
      break;
    }
    return { n, shieldUsed };
  }
  function renderHome() {
    $("#home-date").textContent = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const s = streakDays().n, shield = streakDays().shieldUsed;
    const ac = ageChecks().filter(r => mine(r, player()));
    let line = s > 0 ? `🔥 ${s}일 연속 산책 중${shield ? " 🛡️" : ""}` : "";
    if (ac.length) line += (line ? "  ·  " : "") + `🧠 최근 뇌 나이 ${ac[ac.length - 1].age}세`;
    $("#home-streak").textContent = line;
    $("#home-player").textContent = player() ? `🙋 ${player()} (바꾸기)` : "🙋 이름 정하기";
    $("#home-player").onclick = () => askPlayer(true);
    // 오늘의 훈련 완료 여부에 따른 습관 유도 카피 (본인 기준 — 가족별 하루 1회)
    const doneToday = myHist(player()).some(r => r.date === today());
    const hh = new Date().getHours();
    const GREET = hh < 5 ? "늦은 밤에도 반가워요!" : hh < 11 ? "좋은 아침이에요!" : hh < 17 ? "오후 머리 깨우기 딱 좋은 시간!" : hh < 22 ? "오늘 하루 마무리 산책 어때요?" : "자기 전 가볍게 한 판!";
    $("#daily-sub").textContent = doneToday
      ? `오늘 완료 ✓ 새 훈련 5종이 약 ${24 - hh}시간 뒤 열려요`
      : "게임당 18초, 5게임 — 딱 1분 30초!";
    $("#btn-daily").classList.toggle("todo", !doneToday);

    // 오늘의 한 마디 (박사 잡담 포지션 — 일반 상식만, 의료 조언 아님)
    const TIPS = [
      "가벼운 산책 뒤에 하면 머리가 더 잘 돌아가요.",
      "어제보다 1점이면 충분한 성장이에요.",
      "소리 내어 숫자를 읽으면 계산이 빨라져요.",
      "잠을 푹 잔 날은 기억 게임이 잘 돼요.",
      "새로운 게임에 도전하는 것 자체가 좋은 자극이에요.",
      "손가락을 많이 쓰면 두뇌도 함께 깨어나요.",
      "매일 같은 시간에 하면 습관이 되기 쉬워요.",
      "가족과 점수 내기를 하면 두 배로 재미있어요.",
      "물 한 잔 마시고 시작해 보세요.",
      "틀려도 괜찮아요. 뇌는 실수에서 더 배워요."
    ];
    const dayIdx = Math.floor(Date.now() / 86400000) % TIPS.length; // 하루 하나 고정
    // 미완료: 시간대 인사로 유도 / 완료: 오늘의 팁
    $("#home-tip").textContent = doneToday ? `💬 ${TIPS[dayIdx]}` : `💬 ${GREET} 딱 1분 30초만 걷고 가요!`;
    $("#chk-relax").checked = settings().relaxMode;
    $("#chk-sound").checked = settings().sound !== false;
    $("#chk-notify").checked = !!settings().notify;
    $("#chk-ink").checked = !!settings().ink;
    renderTour();
  }

  // ---------- 🚶 첫걸음 안내 투어 (첫 방문: 이름→훈련부터, 이후 메뉴를 순서대로 코치가 안내) ----------
  const TOUR = [
    { btn: "#btn-daily", msg: () => player() ? "먼저 '오늘의 훈련' — 5게임 딱 1분 30초면 끝!" : "처음 오셨네요! 이름 정하고 1분 30초짜리 '오늘의 훈련'부터 🐾" },
    { btn: "#btn-check", msg: () => "훈련 잘하셨어요! 이번엔 '뇌 나이 체크' — 누르면 바로 측정 시작!" },
    { btn: "#btn-free", msg: () => "'자유 플레이'에선 원하는 게임만 골라서 할 수 있어요." },
    { btn: "#btn-sudoku", msg: () => "'퍼즐 산책'에선 스도쿠·점 잇기를 느긋하게 — 레벨 1000 등반도!" },
    { btn: "#btn-stats", msg: () => "마지막이에요! '기록 보기'에서 도장 달력과 점수 흐름을 봐요." }
  ];
  function tourStep() {
    let s = store.get("bw_tour", null);
    if (s === null) { // 이미 기록이 있는 기존 사용자는 안내 생략 (그랜드파더링)
      s = (history().length || ageChecks().length) ? TOUR.length : 0;
      store.set("bw_tour", s);
    }
    return s;
  }
  function renderTour() {
    document.querySelectorAll(".tour-tip").forEach(e => e.remove());
    document.querySelectorAll(".tour-glow").forEach(e => e.classList.remove("tour-glow"));
    const step = tourStep();
    if (step >= TOUR.length) return;
    const t = TOUR[step];
    const btn = $(t.btn);
    btn.classList.add("tour-glow");
    const tip = document.createElement("div");
    tip.className = "tour-tip";
    tip.innerHTML = `<img class="tour-dog" src="assets/mascot.png" alt="" onerror="this.remove()"><span>${t.msg()}</span><button class="tour-skip">건너뛰기</button>`;
    btn.parentNode.insertBefore(tip, btn);
    tip.querySelector(".tour-skip").onclick = e => { e.stopPropagation(); store.set("bw_tour", TOUR.length); renderTour(); };
    // 안내한 메뉴를 누르면 다음 단계로 — renderHome 재호출로 쌓인 중복 리스너는 step 가드로 무해
    btn.addEventListener("click", () => {
      if (tourStep() === step) store.set("bw_tour", step + 1);
    }, { once: true, capture: true });
  }
  $("#chk-relax").onchange = e => store.set("bw_settings", { ...settings(), relaxMode: e.target.checked });
  $("#chk-ink").onchange = e => store.set("bw_settings", { ...settings(), ink: e.target.checked });
  $("#chk-sound").onchange = e => {
    store.set("bw_settings", { ...settings(), sound: e.target.checked });
    SND.setEnabled(e.target.checked);
  };
  SND.setEnabled(settings().sound !== false);

  // ---------- 알림 (주말 이탈 방어) ----------
  // 서비스워커(sw.js)가 Periodic Background Sync로 "오늘 훈련 안 한 날" 낮 시간에 알림.
  // 서버 없는 정적 호스팅이라 진짜 푸시는 불가 — 설치된 PWA(안드로이드 크롬)에서만 동작.
  // ponytail: iOS는 서버 푸시 필수라 미지원, 서버 생기면 Web Push로 승격
  async function mirrorTrained() {
    // SW는 localStorage를 못 읽음 → 마지막 훈련일을 Cache API로 미러
    try {
      const h = history();
      const cache = await caches.open("bw-meta");
      await cache.put("/bw-last-trained", new Response(h.length ? h[h.length - 1].date : ""));
    } catch { }
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { });
    mirrorTrained();
  }
  $("#chk-notify").onchange = async e => {
    const on = e.target.checked;
    store.set("bw_settings", { ...settings(), notify: on });
    if (!on) {
      try { (await navigator.serviceWorker.ready).periodicSync.unregister("bw-reminder"); } catch { }
      return;
    }
    try {
      if ((await Notification.requestPermission()) !== "granted") throw 0;
      const reg = await navigator.serviceWorker.ready;
      if (!("periodicSync" in reg)) throw 0;
      await reg.periodicSync.register("bw-reminder", { minInterval: 12 * 60 * 60 * 1000 });
      await mirrorTrained();
    } catch {
      e.target.checked = false;
      store.set("bw_settings", { ...settings(), notify: false });
      alert("이 브라우저에서는 자동 알림을 지원하지 않아요.\n안드로이드 크롬에서 '홈 화면에 추가'로 설치하면 켤 수 있어요.");
    }
  };

  // ---------- 게임 실행 ----------
  let timerId = null, timeUpCb = null;
  function stopTimer() { clearInterval(timerId); timerId = null; }

  let session = null; // { mode: daily|free|check, queue, i, results }

  // 🏠 인게임 홈 버튼 — 진행 중이던 판은 버리고 즉시 홈으로 (늦은 finish는 세션 가드가 무시)
  $("#game-home").onclick = () => {
    const playing = session && $("#game-intro").style.display === "none";
    if (playing && !confirm("진행 중인 게임을 그만두고 홈으로 갈까요?\n(이번 판 점수는 남지 않아요)")) return;
    stopTimer();
    try { SND.bgmStop(); } catch { }
    try { RT.stop(); } catch { }
    session = null;            // 세션 무효화 — 게임 내부의 늦은 finish()·타임업 콜백 차단
    timeUpCb = null;
    window.BW_CAMPAIGN = null; // 캠페인 판도 폐기 (진행도는 클리어 시에만 저장되므로 안전)
    $("#screen-game").classList.remove("low-time");
    $("#game-area").innerHTML = "";
    renderHome();
    show("home");
  };

  function startSession(mode, queue) {
    if (!window.__campStarting) window.BW_CAMPAIGN = null; // 스테일 캠페인 방지
    askPlayer(false); // 첫 플레이 때 한 번만 물어봄
    session = { mode, queue, i: 0, results: {} };
    runCurrent();
  }

  function runCurrent() {
    stopTimer(); // 이전 게임 타이머 잔존 방지
    $("#screen-game").classList.remove("low-time");
    const game = session.queue[session.i];
    const lv = levelOf(game.id);
    // ⚡ 황금 산책: 시간제 게임 15% 확률 — 이 판 점수 +10 (예측불가 보상). 체크는 측정이라 제외
    session.golden = session.mode !== "check" && !game.mode && Math.random() < 0.15;
    show("game");
    $("#game-name").innerHTML = `<img class="name-img" src="${iconSrc(game)}" alt="" onerror="this.remove()"> ${game.name} <span class="lv-chip">Lv.${lv}</span>`;
    $("#game-timer").textContent = "";
    $("#timer-fill").style.width = "100%";
    $("#game-area").innerHTML = "";
    $("#game-intro").style.display = "flex";
    const ii = $("#intro-icon");
    ii.style.visibility = "visible";
    ii.src = iconSrc(game);
    $("#intro-title").textContent = (session.mode === "check" ? `과제 ${session.i + 1}/3 · ` : "") + game.name;
    $("#intro-desc").textContent = game.intro;
    const b = best()[game.id];
    $("#intro-best").textContent = (session.golden ? "⚡ 황금 산책! 이 판 점수 +10 · " : "") +
      (b != null ? `내 최고 기록 ${b}점 ${medal(b)} — 넘어 보세요!` : "첫 도전이에요!");

    $("#game-hint").textContent = "";
    $("#btn-go").onclick = async () => {
      const sess0 = session; // 카운트다운 중 홈 이탈 감지용
      // 체크 모드: 3-2-1 카운트다운 (검사 긴장감)
      if (session.mode === "check") {
        const ov = document.createElement("div");
        ov.className = "count-ov";
        document.body.appendChild(ov);
        for (const n of [3, 2, 1]) {
          ov.textContent = n;
          ov.classList.remove("pop"); void ov.offsetWidth; ov.classList.add("pop");
          SND.tick();
          await new Promise(r => setTimeout(r, 650));
        }
        ov.remove();
      }
      if (session !== sess0) return; // 카운트다운 사이에 홈으로 나감 — 게임 시작 취소
      SND.start(); SND.bgmStart();
      RT.start(game.id); // 반응시간 수집 시작
      FX.comboReset(); // 콤보 배지·최고 연속 초기화
      $("#game-hint").textContent = HINTS[game.id] ? `💡 ${HINTS[game.id]}` : "";
      $("#game-intro").style.display = "none";
      const elT = $("#game-timer");
      const fill = $("#timer-fill");
      elT.classList.remove("low");
      timeUpCb = null;
      const t0 = Date.now();

      const mySession = session, myIdx = session.i;
      const api = {
        onTimeUp(cb) { timeUpCb = cb; },
        elapsedSec: () => Math.round((Date.now() - t0) / 100) / 10,
        finish(score, detail) {
          // 세션이 바뀐 뒤 도착한 늦은 finish는 무시 (점수 오염 방지)
          if (session !== mySession || session.i !== myIdx) return;
          stopTimer();
          $("#screen-game").classList.remove("low-time");
          SND.bgmStop();
          RT.stop();
          // 채점 곡선: score^1.3 디플레이션 — 게임별 원점수가 후해서 중상위권을 눌러줌 (JS 피드백)
          score = Math.round(100 * Math.pow(Math.min(100, Math.max(0, score)) / 100, 1.3));
          // 속도 가중: 평균 반응이 빠르면 보너스·느리면 감점, 낮은 레벨일수록 비중 큼(쉬운 판은 속도가 실력) — 뇌 나이 변별력
          const rt = RT.sessAvg();
          if (rt != null) {
            const w = lv <= 3 ? 1 : Math.max(0.4, 1 - (lv - 3) * 0.15); // Lv3까지 100% → Lv7+ 40%
            let f = Math.max(0.75, Math.min(1.12, 1.36 - 0.3 * rt));    // 평균 0.8초≈+12% · 1.2초≈0 · 2초≈-24%
            if (settings().relaxMode) f = Math.max(1, f); // 여유 모드는 감점 없음 ('산책' 정체성)
            score = Math.min(100, Math.round(score * (1 + (f - 1) * w))); // 반응시간 표기는 결과 화면 '평균 반응'이 담당
          }
          if (session.golden) { score = Math.min(100, score + 10); detail += " · ⚡황금 +10"; }
          onGameDone(game, score, detail);
        }
      };

      // 👻 고스트 대결: 상대 페이스 바 (시간제 게임만 — 분량제는 종료 비교만)
      const gr = $("#ghost-race");
      gr.hidden = !(session.ghost && !game.mode);
      if (!gr.hidden) {
        $("#ghost-label").textContent = `👻 ${session.ghost.name}님의 고스트(${session.ghost.score}점)가 달리는 중`;
        $("#ghost-fill").style.width = "0%";
      }

      if (game.mode === "count") {
        // 분량제: 시간은 올라가기만, 게임이 스스로 끝냄
        fill.style.width = "0%";
        let t = 0;
        elT.textContent = "0초";
        timerId = setInterval(() => { t++; elT.textContent = t + "초"; }, 1000);
      } else {
        // BW_TEST_SEC: 콘솔 테스트용 단축 타이머 · 데일리는 게임당 18초 고정(5게임=1분 30초 약속)
        const baseSec = session.mode === "daily" ? DAILY_SEC : (game.sec || 25);
        const dur = Math.round((window.BW_TEST_SEC || baseSec) * (settings().relaxMode ? 1.5 : 1));
        let left = dur;
        elT.textContent = left + "초";
        fill.classList.remove("low");
        timerId = setInterval(() => {
          left--;
          elT.textContent = left + "초";
          fill.style.width = (100 * left / dur) + "%";
          if (!gr.hidden) $("#ghost-fill").style.width = (100 * (dur - left) / dur) + "%";
          if (left <= 10) elT.classList.add("low");
          if (left <= 5 && left > 0 && !settings().relaxMode) {
            // 여유 모드에선 압박 연출(비네트·틱·진동) 전부 끔 — '산책' 정체성 보호
            SND.tick();
            fill.classList.add("low");
            $("#screen-game").classList.add("low-time");
            if (left <= 3 && navigator.vibrate) navigator.vibrate(25);
          }
          if (left <= 0) { stopTimer(); timeUpCb && timeUpCb(); }
        }, 1000);
      }
      game.start($("#game-area"), lv, api);
    };

    // 체크 모드: 인트로·시작 버튼 생략 — 누르는 순간 3-2-1 후 바로 측정 (과제 사이도 자동 연결)
    if (session.mode === "check") {
      $("#game-intro").style.display = "none";
      $("#btn-go").click();
    }
  }

  function comment(score) {
    if (score >= 85) return "훌륭해요! 오늘 머리가 쌩쌩 돌아가네요.";
    if (score >= 65) return "좋아요, 점점 날카로워지고 있어요.";
    if (score >= 40) return "좋은 페이스예요. 한 번 더 하면 더 오를 거예요.";
    return "괜찮아요. 매일 조금씩이 실력의 비결이에요.";
  }

  // ---------- 🐾 산책 마일리지 + 🎨 테마 상점 (가족 공동 지갑 — 도장과 동일 철학) ----------
  function wallet() {
    let w = store.get("bw_wallet", null);
    if (!w) {
      // 소급 적립: 기존 기록 전부 마일리지로 인정 (그랜드파더링)
      const earned = history().reduce((a, r) => a + (r.score || 0), 0) + ageChecks().reduce((a, r) => a + (r.avg || 0), 0);
      w = { earned, spent: 0, owned: ["basic"], games: [] };
      store.set("bw_wallet", w);
    }
    if (!w.games) w.games = []; // 구버전 지갑 마이그레이션 (마일 게임해금)
    if (!w.welcome) { // 🎁 웰컴 300마일 — 첫날부터 '쓰는 맛' (기존 지갑도 1회 지급)
      w.welcome = true; w.earned += 300;
      store.set("bw_wallet", w);
    }
    return w;
  }
  const miles = () => wallet().earned - wallet().spent;
  function earnMiles(n) {
    if (n <= 0) return;
    const w = wallet();
    w.earned += n;
    store.set("bw_wallet", w);
    renderShopBtn();
  }
  const THEMES = [
    { id: "basic", name: "기본 레드", cost: 0, c: null },
    { id: "dawn", name: "새벽 산책", cost: 300, c: "#3E6DB5" },
    { id: "forest", name: "숲길", cost: 300, c: "#2E7D5B" },
    { id: "sunset", name: "노을", cost: 500, c: "#D96C2C" },
    { id: "olive", name: "클래식 올리브", cost: 1000, c: "#6B6D3C" }
  ];
  function applyTheme(id) {
    const t = THEMES.find(x => x.id === id) || THEMES[0];
    // 액센트 변수 하나만 바꾸면 전체 테마 전환 (--fg-link·--border-focus가 이걸 참조)
    if (t.c) document.documentElement.style.setProperty("--aia-red", t.c);
    else document.documentElement.style.removeProperty("--aia-red");
  }
  applyTheme(settings().theme || "basic");
  function renderShopBtn() {
    $("#shop-toggle").innerHTML = `🎨 테마 상점 · 🐾 ${miles().toLocaleString()}마일`;
  }
  function renderShop() {
    const w = wallet();
    const cur = settings().theme || "basic";
    $("#shop-list").innerHTML = THEMES.map(t => {
      const owned = w.owned.includes(t.id);
      const state = t.id === cur ? `<b class="shop-on">적용 중</b>`
        : owned ? `<button class="who-chip" data-act="use" data-id="${t.id}">적용</button>`
          : miles() >= t.cost ? `<button class="who-chip" data-act="buy" data-id="${t.id}">🐾 ${t.cost}</button>`
            : `<span class="shop-locked">🐾 ${t.cost}</span>`;
      return `<div class="shop-row"><span class="swatch" style="background:${t.c || "#D31145"}"></span><span class="shop-name">${t.name}</span>${state}</div>`;
    }).join("") + `<div class="disclaimer">마일리지는 훈련·체크 점수만큼 쌓여요. 가족 공동 지갑!</div>`;
    $("#shop-list").querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
      const t = THEMES.find(x => x.id === b.dataset.id);
      if (b.dataset.act === "buy") {
        if (miles() < t.cost) return;
        const w2 = wallet();
        w2.spent += t.cost; w2.owned.push(t.id);
        store.set("bw_wallet", w2);
        FX.confetti(); // 구매 축하
      }
      store.set("bw_settings", { ...settings(), theme: t.id });
      applyTheme(t.id);
      renderShopBtn(); renderShop();
    });
  }
  $("#shop-toggle").onclick = () => {
    const list = $("#shop-list");
    list.hidden = !list.hidden;
    if (!list.hidden) renderShop();
  };
  renderShopBtn();

  // 🍪 웰니스 쿠키 문구 (일반 상식·위트 — 의료 조언 아님)
  const COOKIES = [
    "웃음은 공짜 두뇌 영양제래요. 오늘 한 번 크게 웃어 보기!",
    "계단을 오르면 다리보다 기억력이 먼저 좋아진대요.",
    "낮에 본 하늘 색, 자기 전에 떠올려 보세요. 그게 기억 훈련이에요.",
    "새로운 길로 퇴근하면 뇌가 '여행 중'이라고 착각한대요.",
    "오늘 마신 물 잔 수를 세어 보세요. 세는 것 자체가 훈련!",
    "귤 향기를 맡으면 기분이 3% 밝아진다는 소문이 있어요. (출처: 말티즈)",
    "손으로 쓴 글씨는 타자보다 오래 기억에 남는대요.",
    "10분 산책은 커피 반 잔만큼 머리를 깨워요.",
    "오늘 처음 보는 단어 하나를 사전에서 찾아보세요. 뇌가 좋아해요.",
    "저녁에 오늘 있었던 일 3가지를 떠올리면 그게 바로 회상 훈련!",
    "식물에 물 주며 이름을 불러 주세요. 다정함도 습관이에요.",
    "콧노래는 뇌의 스트레칭이래요. 지금 한 소절 어때요?",
    "양치질을 반대 손으로 해 보세요. 뇌가 깜짝 놀라요.",
    "오래된 사진 한 장을 꺼내 보세요. 추억 회상은 최고의 두뇌 간식!",
    "잠들기 전 스마트폰 대신 창밖 보기 — 내일 점수가 오를지도?"
  ];

  // 말티즈 코치 대사 (결과 화면 말풍선)
  const COACH = {
    record: ["신기록이에요! 오늘 간식 두 배! 🦴", "역대 최고! 저 방금 세 바퀴 돌았어요!", "이 기록, 액자에 걸어야 해요! 🏆", "가족분들한테 자랑해도 돼요, 진짜로!", "이 속도면 제가 산책 끌려다니겠어요!"],
    high: ["대단해요! 제 꼬리가 저절로 흔들려요 🐾", "이 정도면 제가 배워야겠는걸요?", "오늘 두뇌 회전 최고 속도예요!", "옆집 강아지한테 소문 낼게요!", "황금 산책 걸릴 자격 있는 실력!"],
    mid: ["좋아요, 어제의 나를 이기는 중!", "꾸준함이 제일 무서운 재능이에요.", "감이 점점 올라오고 있어요!", "메달 냄새가 나요… 킁킁 🐾", "한 판 더 하면 넘을 것 같은데요?"],
    low: ["괜찮아요, 실수도 훈련이에요!", "다음 판은 분명 오를 거예요. 한 판 더?", "처음엔 다 그래요. 내일 보자고요! 🐾", "오늘은 몸풀기! 내일이 진짜예요.", "저도 공 못 잡는 날이 있어요. 멍."]
  };
  function coachSay(score, isRecord) {
    const pool = isRecord ? COACH.record : score >= 80 ? COACH.high : score >= 50 ? COACH.mid : COACH.low;
    $("#coach-bubble").textContent = pool[Math.floor(Math.random() * pool.length)];
    setCoachFace(isRecord || score >= 80 ? "happy" : score < 40 ? "sad" : "base");
  }
  // 코치 표정 스왑 — 점수 따라 기뻐하고 시무룩해짐 (원작 교수 얼굴 포지션)
  function setCoachFace(kind) {
    const img = document.querySelector("#screen-result .coach-img");
    if (img) img.src = kind === "happy" ? "assets/mascot-happy.png" : kind === "sad" ? "assets/mascot-sad.png" : "assets/mascot.png";
  }

  function onGameDone(game, score, detail) {
    session.results[game.id] = score;
    adjustLevel(game.id, score);
    const prevBest = updateBest(game.id, score);
    const isRecord = score > prevBest && prevBest > 0;

    const last = session.i >= session.queue.length - 1;

    // 체크 모드: 과제 사이 점수 화면 없이 직행 — 마지막 과제 끝나면 바로 나이 공개
    if (session.mode === "check") {
      if (!last) { session.i++; runCurrent(); }
      else finishCheck();
      return;
    }

    show("result");
    $("#result-title").textContent = (isRecord ? "🏆 신기록! " : "") + game.name + " 결과";
    FX.countUp($("#result-score"), score, "점 " + medal(score));
    // 니어미스: 다음 메달까지 5점 이내면 아쉬움 자극
    const near = [[85, "🥇"], [65, "🥈"], [40, "🥉"]].find(([t]) => score < t && t - score <= 5);
    $("#result-comment").textContent = isRecord ? `이전 최고 ${prevBest}점을 넘었어요!`
      : near ? `아깝다! ${near[0] - score}점만 더 하면 ${near[1]}이었어요!` : comment(score);
    const rtAvg = RT.sessAvg();
    const mc = FX._maxCombo >= 5 ? ` · 🔥 최고 ${FX._maxCombo}연속` : "";
    // 자유 플레이도 마일 적립 (점수의 20%) — 많이 걸을수록 쌓이는 경제
    let mileLine = "";
    if (session.mode === "free") {
      const earn = Math.round(score * 0.2);
      if (earn > 0) { earnMiles(earn); mileLine = ` · 🐾 +${earn}마일`; }
    }
    $("#result-detail").textContent = detail + (rtAvg ? ` · 평균 반응 ${rtAvg.toFixed(1)}초` : "") + mc + mileLine;
    coachSay(score, isRecord);
    if (isRecord) FX.confetti();
    $("#btn-next").textContent = last
      ? (session.mode === "daily" ? "종합 결과 보기" : session.mode === "check" ? "뇌 나이 확인" : "🔁 다시 도전")
      : "다음 게임 →";
    $("#btn-next").onclick = () => {
      if (!last) { session.i++; runCurrent(); }
      else if (session.mode === "daily") finishDaily();
      else if (session.mode === "check") finishCheck();
      else startSession("free", [game]); // 자유 플레이: 같은 게임 재도전 (홈은 아래 버튼)
    };

    // ⚔️ 고스트 대결 결과 / 자유 플레이 대결장 보내기
    const shareBtn = $("#btn-ghost-share");
    const ghost = session.ghost;
    if (ghost && last) {
      const win = score > ghost.score;
      $("#result-title").textContent = (win ? "🎉 " : "👻 ") + game.name + " 대결 결과";
      $("#result-comment").textContent =
        win ? `${ghost.name}님의 고스트(${ghost.score}점)를 앞질렀어요!`
          : score === ghost.score ? `${ghost.name}님과 딱 동점! 막상막하예요.`
            : `${ghost.name}님의 고스트(${ghost.score}점)가 ${ghost.score - score}점 앞섰어요. 다음 산책에서 설욕!`;
      if (win) FX.confetti();
      shareBtn.hidden = false;
      shareBtn.textContent = win ? "⚔️ 역도발 대결장 보내기" : "⚔️ 설욕 대결장 보내기";
      shareBtn.onclick = () => shareGhost(game, score,
        win ? `${player() || "게스트"}님이 ${ghost.name}님의 고스트를 앞질렀어요! (${game.name} ${score}점) 다시 붙어 보실래요?`
          : `${player() || "게스트"}님이 ${game.name} ${score}점으로 재도전장을 보냈어요!`);
    } else if (session.mode === "free" && last) {
      shareBtn.hidden = false;
      shareBtn.textContent = "⚔️ 친구에게 대결장 보내기";
      shareBtn.onclick = () => shareGhost(game, score, `${player() || "게스트"}님의 ${game.name} ${score}점 — 이길 수 있어요?`);
    } else shareBtn.hidden = true;

    // 🧗 퍼즐 캠페인 체인: 클리어 → 진행도 저장 → '레벨 N+1' 원버튼 연속
    if (window.BW_CAMPAIGN && window.BW_CAMPAIGN.id === game.id && last) {
      const lv = window.BW_CAMPAIGN.level;
      window.BW_CAMPAIGN = null;
      const pz = store.get("bw_puzzle", {});
      if ((pz[game.id] || 1) <= lv) { pz[game.id] = Math.min(CAMP_MAX, lv + 1); store.set("bw_puzzle", pz); }
      $("#result-title").textContent = `🧗 레벨 ${lv} 클리어!`;
      if (lv >= CAMP_MAX) {
        $("#btn-next").textContent = "🏆 1000레벨 정복!";
        $("#btn-next").onclick = () => { renderHome(); show("home"); FX.confetti(); };
      } else {
        $("#btn-next").textContent = `레벨 ${lv + 1} 도전 →`;
        $("#btn-next").onclick = () => startCampaign(game, lv + 1);
      }
    }
  }

  // ---------- 👻 고스트 대결 링크 (서버 없는 소셜 — URL 파라미터만) ----------
  async function shareGhost(game, score, msg) {
    const u = new URL(location.origin + location.pathname);
    u.searchParams.set("gg", game.id);
    u.searchParams.set("gs", score);
    u.searchParams.set("gn", player() || "게스트");
    const text = `🐾 [브레인워크 대결장] ${msg}\n${u}`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      alert("대결 링크를 복사했어요!\n카톡 등에 붙여넣어 보내세요.");
    } catch { /* 사용자가 공유 취소 */ }
  }

  function finishDaily() {
    const scores = Object.values(session.results);
    const total = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const h = history();
    const who = player() || "게스트";
    const already = h.some(r => r.date === today() && mine(r, who));
    if (!already) {
      h.push({ date: today(), score: total, games: session.results, name: who });
      store.set("bw_history", h);
      mirrorTrained(); // 알림용 훈련일 미러 (SW가 읽음)
      CLOUD.submit("daily", who, total); // 온라인 기록판 (연결 시)
      earnMiles(total); // 🐾 점수만큼 마일리지 적립
    }
    // 어제의 나와 대결 (본인 기록만)
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yRec = h.find(r => r.date === localDate(yd) && mine(r, who));
    let vs = "";
    if (yRec) {
      const d = total - yRec.score;
      vs = d > 0 ? `<br>⚔️ 어제의 나 ${yRec.score}점 → 오늘 ${total}점, <b>+${d}점 승리!</b>`
        : d < 0 ? `<br>⚔️ 어제의 나 ${yRec.score}점 → 오늘 ${total}점. 내일 설욕전!`
          : `<br>⚔️ 어제와 동점. 막상막하!`;
      if (d > 0) FX.confetti();
    }
    show("result");
    $("#result-title").textContent = "오늘의 두뇌 점수";
    FX.countUp($("#result-score"), total, "점 " + medal(total));
    coachSay(total, false);
    $("#result-comment").textContent = already ? "오늘 점수는 이미 기록되어 있어 연습으로만 남아요." : comment(total);
    $("#result-detail").innerHTML =
      session.queue.map(g => `${icon(g)} ${g.name}: ${session.results[g.id]}점 ${medal(session.results[g.id])}`).join("<br>") + vs;
    $("#btn-next").textContent = "기록 보기";
    $("#btn-next").onclick = () => { renderStats(); show("stats"); };

    // 🍪 웰니스 쿠키 + 🔮 내일 예고 (자이가르닉 — 끝났다는 느낌을 지움)
    const el2 = $("#result-detail");
    const cookieIdx = Math.floor(Date.now() / 86400000) % COOKIES.length; // 하루 하나 고정
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    const teaseGames = dailyLineup(localDate(tmr));
    const hoursLeft = 24 - new Date().getHours();
    el2.innerHTML += (already ? "" : `<br>🐾 <b>+${total} 마일</b> 적립! (보유 ${miles().toLocaleString()}마일)`) + `
      <button class="cookie-card" id="cookie-card">🍪 <b>오늘의 웰니스 쿠키</b> <small>눌러서 열기</small></button>
      <div class="tease">🔮 내일의 산책 예고
        <span class="tease-icons">${teaseGames.map(g => `<img src="${iconSrc(g)}" alt="?" onerror="this.outerHTML='❓'">`).join("")}</span>
        <small>새 훈련 5종, 자정에 열려요 (약 ${hoursLeft}시간 뒤)</small>
      </div>`;
    $("#cookie-card").onclick = e => {
      e.currentTarget.outerHTML = `<div class="cookie-open">🥠 ${COOKIES[cookieIdx]}</div>`;
      SND.pop && SND.pop();
    };

    // 🌐 온라인 실시간 비교 — 사회적 증거 (연결 시)
    if (CLOUD.enabled()) {
      CLOUD.fetchTop().then(top => {
        if (!top || !top.daily || !top.daily.length) return;
        const list = top.daily;
        const rank = list.filter(r => r.score > total).length + 1;
        const el = $("#result-detail");
        // 서열식 대신 산책 은유 — 콘셉트 톤 유지
        if (rank <= 10 && (list.length < 10 || total >= list[list.length - 1].score))
          el.innerHTML += `<br>🌐 오늘 함께 산책한 사람들 중 <b>${rank}번째</b>로 상쾌한 걸음!`;
        else
          el.innerHTML += `<br>🌐 오늘의 선두 ${list[0].name}님과 ${list[0].score - total}점 차이 — 내일 나란히 걸어봐요!`;
      }).catch(() => {});
    }
  }

  function finishCheck() {
    const scores = Object.values(session.results);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const age = brainAge(avg);
    const all = ageChecks();
    const who = player() || "게스트";
    const minecks = all.filter(r => mine(r, who));
    const prev = minecks.length ? minecks[minecks.length - 1].age : null;
    // 원작식: 뇌 나이 기록은 하루 1회(본인 기준). 추가 측정은 연습으로만
    const measuredToday = minecks.some(r => r.date === today());
    if (!measuredToday) {
      all.push({ date: today(), age, avg, name: who });
      store.set("bw_agecheck", all);
      earnMiles(avg); // 🐾 마일리지 적립
    }
    show("result");
    $("#result-title").textContent = "🧠 당신의 뇌 나이는…";
    $("#result-comment").textContent = "";
    $("#result-detail").innerHTML = "";
    $("#coach-bubble").textContent = "두구두구두구…";
    // 드럼롤 → 숫자 롤링 → 쾅 공개
    FX.reveal($("#result-score"), age, "세", () => {
      $("#result-comment").textContent =
        measuredToday ? "오늘은 이미 측정했어요 — 이번 건 연습 기록이에요. 내일 다시 재 봐요!"
          : prev == null ? "첫 측정이에요. 내일 또 재 보세요!"
            : age < prev ? `지난번 ${prev}세보다 젊어졌어요!`
              : age > prev ? `지난번 ${prev}세보다 살짝 높네요. 컨디션 탓일 거예요.`
                : "지난번과 같아요. 안정적!";
      const tier = age <= 32 ? 1 : age <= 45 ? 2 : age <= 62 ? 3 : 4; // 로켓/파워워킹/산책/여유
      $("#result-detail").innerHTML =
        `<img class="age-img" src="assets/age${tier}.png" alt="" onerror="this.remove()">` +
        session.queue.map(g => `${icon(g)} ${g.name}: ${session.results[g.id]}점`).join("<br>") +
        `<br><span class="disclaimer">놀이용 추정치예요. 의료 검사가 아닙니다.</span>`;
      $("#coach-bubble").textContent =
        prev != null && age < prev ? "젊어졌어요! 훈련 효과 제대로네요! 🐾"
          : age <= 35 ? "이 두뇌, 팔팔한데요?"
            : "내일 또 재면 더 젊어질 거예요!";
      setCoachFace((prev != null && age < prev) || age <= 35 ? "happy" : prev != null && age > prev ? "sad" : "base");
      if (prev != null && age < prev) FX.confetti();
    });
    $("#btn-next").textContent = "기록 보기";
    $("#btn-next").onclick = () => { renderStats(); show("stats"); };
  }

  // ---------- 진입점 ----------
  const DAILY_COUNT = 5; // 오늘의 훈련 게임 수
  const DAILY_SEC = 18;  // 게임당 18초 × 5 = 정확히 90초 — "1분 30초면 끝" 카피와 실플레이 일치
  // 데일리: 인지 영역별 1개씩 우선 확보 — 완전 랜덤이면 같은 계열만 몰릴 수 있음
  const CATS = {
    calc: "수", calc25: "수", sign: "수", change: "수",
    memory: "기억", photo: "기억", nback: "기억", pairs: "기억",
    stroop: "반응", rps: "반응", flags: "반응", dual: "반응",
    trail: "관찰", people: "관찰", birds: "관찰", boxes: "관찰", compare: "관찰", flow: "관찰", arrows: "관찰"
  };
  // 날짜 시드 결정적 랜덤 — 오늘 라인업을 어제 미리 알 수 있음 (내일 예고용)
  function dailyLineup(dateStr) {
    let h = 2166136261;
    for (const c of dateStr) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
    const shuffle = a => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
    // '18초씩 5게임=1분 30초' 약속 — 시간제 게임만(분량제 count는 시간 컷이 안 먹혀 제외), 영역별 1개 먼저 뽑고 나머지 채움
    const pool = DAILY_POOL.filter(g => isUnlocked(g) && !g.mode);
    const byCat = {};
    pool.forEach(g => (byCat[CATS[g.id]] = byCat[CATS[g.id]] || []).push(g));
    const picked = shuffle(Object.keys(byCat).sort()).map(c => shuffle(byCat[c])[0]);
    const rest = shuffle(pool.filter(g => !picked.includes(g)));
    return picked.concat(rest).slice(0, DAILY_COUNT);
  }
  $("#btn-daily").onclick = () => startSession("daily", dailyLineup(today()));
  $("#btn-check").onclick = () => startSession("check", U.shuffle(CHECK_POOL).slice(0, 3));
  $("#btn-free").onclick = () => {
    const list = $("#free-list");
    list.innerHTML = "";
    ALL.forEach((g, gi) => {
      const b = document.createElement("button");
      const open = isUnlocked(g);
      b.className = "free-card" + (open ? "" : " locked");
      b.style.setProperty("--i", gi); // 등장 스태거
      const bs = best()[g.id];
      b.innerHTML = open
        ? `<img class="fc-img" src="${iconSrc(g)}" alt="" onerror="this.outerHTML='<span class=fc-icon>${icon(g)}</span>'"><span class="fc-name">${g.name}</span><span class="fc-best">${bs != null ? bs + "점 " + medal(bs) : "미도전"}</span>`
        : `<span class="fc-icon">🔒</span><span class="fc-name">${g.name}</span><span class="fc-best">도장 ${unlockDay(g)}개 · 또는 🐾 ${UNLOCK_COST}마일</span>`;
      if (open) b.onclick = () => startSession("free", [g]);
      else b.onclick = () => { // 🐾 마일 조기 해금
        if (miles() < UNLOCK_COST) { alert(`🐾 마일이 부족해요. (보유 ${miles()} / 필요 ${UNLOCK_COST})\n오늘의 훈련으로 마일을 모아 보세요!`); return; }
        if (!confirm(`'${g.name}' 게임을 🐾 ${UNLOCK_COST}마일로 바로 열까요?\n(보유 ${miles().toLocaleString()}마일)`)) return;
        const w = wallet();
        w.spent += UNLOCK_COST; w.games.push(g.id);
        store.set("bw_wallet", w);
        renderShopBtn();
        FX.confetti();
        $("#btn-free").click(); // 목록 새로고침
      };
      list.appendChild(b);
    });
    show("free");
  };
  $("#btn-stats").onclick = () => { renderStats(); show("stats"); };

  // 👻 대결장 수신: ?gg=게임&gs=점수&gn=이름 — 홈에 도전장 카드
  (function ghostFromURL() {
    const q = new URLSearchParams(location.search);
    if (!q.get("gg")) return;
    const g = ALL.find(x => x.id === q.get("gg"));
    const score = Math.max(0, Math.min(100, Math.round(+q.get("gs") || 0)));
    const name = decodeURIComponent(q.get("gn") || "친구").slice(0, 8);
    q.delete("gg"); q.delete("gs"); q.delete("gn");
    window.history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "")); // 재실행 방지 (board 파라미터는 보존)
    if (!g) return;
    const card = document.createElement("button");
    card.className = "menu-btn primary";
    card.innerHTML = `<span class="mi">👻</span>
      <span class="mt"><b>${name}님의 대결장 도착!</b><small>${g.name} ${score}점 — 고스트를 이겨 보세요</small></span>
      <span class="mc">⚔️</span>`;
    card.onclick = () => {
      card.remove();
      startSession("free", [g]); // 해금 무관 — 대결장은 바로 입장
      session.ghost = { name, score };
    };
    document.querySelector(".home-menu").prepend(card);
  })();

  // ---------- 스도쿠 전용 모드 (보상: 도장으로 난이도 해금) ----------
  const SUDOKU_DIFFS = [
    { name: "쉬움", desc: "빈칸 30개 — 가볍게 몸풀기", holes: 30, need: 0 },
    { name: "보통", desc: "빈칸 40개 — 오늘의 본판", holes: 40, need: 3 },
    { name: "어려움", desc: "빈칸 50개 — 진짜 실력 시험", holes: 50, need: 7 }
  ];
  // 퍼즐 캠페인 (레벨 1~1000, 진행도 저장)
  const CAMP_MAX = 1000;
  const puzzleLv = id => Math.min(CAMP_MAX, (store.get("bw_puzzle", {})[id] || 1));
  function startCampaign(g, lv) {
    window.__campStarting = true;
    startSession("free", [g]);
    window.__campStarting = false;
    window.BW_CAMPAIGN = { id: g.id, level: lv };
  }

  const CHEV = `<span class="mc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg></span>`;
  const puzzleItem = (iconId, title, desc, onClick, locked) => {
    const b = document.createElement("button");
    b.className = "menu-btn" + (locked ? " locked-diff" : "");
    b.innerHTML = `<span class="mi"><img class="pz-ico" src="assets/icons/${iconId}.png" alt="" onerror="this.remove()"></span>` +
      `<span class="mt"><b>${title}</b><small>${desc}</small></span>` + (locked ? "" : CHEV);
    if (!locked) b.onclick = onClick;
    return b;
  };
  // 1단계: 퍼즐 3종 목록
  function renderPuzzleMenu() {
    const box = $("#sudoku-diffs");
    box.innerHTML = "";
    box.appendChild(puzzleItem("flow", `점 잇기 · 레벨 ${puzzleLv("flow")}`, "깰수록 커지는 판 — 1000레벨 등반", () => startCampaign(window.GAME_FLOW, puzzleLv("flow"))));
    box.appendChild(puzzleItem("arrows", `화살표 탈출 · 레벨 ${puzzleLv("arrows")}`, "깰수록 빽빽해지는 미로 — 1000레벨 등반", () => startCampaign(window.GAME_ARROWS, puzzleLv("arrows"))));
    box.appendChild(puzzleItem("sudoku", "스도쿠", "난이도 골라서 느긋하게 한 판", renderSudokuDiffs));
  }
  // 2단계: 스도쿠 난이도
  function renderSudokuDiffs() {
    const box = $("#sudoku-diffs");
    box.innerHTML = "";
    const back = document.createElement("button");
    back.className = "big-btn ghost small";
    back.textContent = "← 퍼즐 목록";
    back.onclick = renderPuzzleMenu;
    box.appendChild(back);
    const s = stamps();
    SUDOKU_DIFFS.forEach(d => {
      const open = s >= d.need;
      const b = puzzleItem("sudoku", (open ? "" : "🔒 ") + d.name,
        open ? d.desc : `🐾 도장 ${d.need}개면 열려요`,
        () => { window.BW_SUDOKU_DIFF = d.holes; startSession("free", [window.GAME_SUDOKU]); }, !open);
      box.appendChild(b);
    });
  }
  $("#btn-sudoku").onclick = () => { renderPuzzleMenu(); show("sudoku"); };

  // ---------- 도장 달력 (훈련·체크한 날 = 발도장) ----------
  function renderCal() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const pad2 = n => String(n).padStart(2, "0");
    const trained = new Set([
      ...history().filter(r => mine(r, statsWho)).map(r => r.date),
      ...ageChecks().filter(r => mine(r, statsWho)).map(r => r.date)
    ].filter(d => d.startsWith(`${y}-${pad2(m + 1)}`)));
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const stamp = settings().stamp || "🐾";
    let html = `<h3>${m + 1}월 산책 도장 <small>(${trained.size}일)</small>` +
      `<button class="stamp-pick" id="stamp-pick" title="도장 모양 바꾸기">${stamp} 바꾸기</button></h3><div class="cal-grid">`;
    "일월화수목금토".split("").forEach(d => html += `<div class="cal-head">${d}</div>`);
    for (let i = 0; i < first; i++) html += `<div></div>`;
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${pad2(m + 1)}-${pad2(d)}`;
      const today_ = d === now.getDate();
      html += `<div class="cal-day${today_ ? " today" : ""}">${trained.has(key) ? `<span class="stamp">${stamp}</span>` : d}</div>`;
    }
    $("#stamp-cal").innerHTML = html + "</div>";
    // 도장 모양 고르기 (원작 스탬프 커스텀 오마주)
    $("#stamp-pick").onclick = () => {
      const STAMPS = ["🐾", "🌸", "⭐", "❤️", "😀", "🏆"];
      const next = STAMPS[(STAMPS.indexOf(stamp) + 1) % STAMPS.length];
      store.set("bw_settings", { ...settings(), stamp: next });
      renderCal();
    };
  }

  // ---------- 기록 ----------
  let statsWho = null; // null=전체, 이름=그 사람만 (기록 화면 필터)
  function renderWhoChips() {
    const names = [...new Set([...history(), ...ageChecks()].map(r => r.name).filter(Boolean))];
    const box = $("#stats-who");
    if (names.length < 2) { box.innerHTML = ""; statsWho = null; return; }
    if (statsWho && !names.includes(statsWho)) statsWho = null;
    box.innerHTML = ["전체", ...names].map(n =>
      `<button class="who-chip${(n === "전체" ? statsWho === null : statsWho === n) ? " on" : ""}" data-who="${n}">${n === "전체" ? "👨‍👩‍👧 전체" : "🙋 " + n}</button>`
    ).join("");
    box.querySelectorAll(".who-chip").forEach(b => b.onclick = () => {
      statsWho = b.dataset.who === "전체" ? null : b.dataset.who;
      renderStats();
    });
  }
  function renderStats() {
    renderWhoChips();
    renderCal();
    const h = history().filter(r => mine(r, statsWho)).slice(-14);
    const cv = $("#chart"), ctx = cv.getContext("2d");
    // 다크 모드 대응: 캔버스 색은 CSS 토큰에서 읽음
    const css = getComputedStyle(document.documentElement);
    const tok = (n, f) => (css.getPropertyValue(n) || "").trim() || f;
    const cInk = tok("--fg-primary", "#1A1A1A"), cAxis = tok("--border-hairline", "#DDDDDD"), cLabel = tok("--fg-tertiary", "#757575");
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = "14px Manrope, sans-serif";
    ctx.fillStyle = cInk;
    if (h.length === 0) {
      ctx.font = "20px sans-serif";
      ctx.fillText("아직 기록이 없어요. 오늘의 훈련을 시작해 보세요!", 90, 145);
    } else {
      const P = 40, W = cv.width - P * 2, H = cv.height - P * 2;
      ctx.strokeStyle = cAxis;
      ctx.beginPath(); ctx.moveTo(P, P); ctx.lineTo(P, P + H); ctx.lineTo(P + W, P + H); ctx.stroke();
      [0, 50, 100].forEach(v => {
        const y = P + H - (v / 100) * H;
        ctx.fillText(String(v), 10, y + 5);
      });
      const step = h.length > 1 ? W / (h.length - 1) : 0;
      ctx.strokeStyle = "#D31145"; ctx.lineWidth = 3;
      ctx.beginPath();
      h.forEach((r, i) => {
        const x = P + (h.length > 1 ? i * step : W / 2);
        const y = P + H - (r.score / 100) * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = "#D31145";
      h.forEach((r, i) => {
        const x = P + (h.length > 1 ? i * step : W / 2);
        const y = P + H - (r.score / 100) * H;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = cLabel;
        ctx.fillText(r.date.slice(5), x - 18, P + H + 20);
        ctx.fillStyle = "#D31145";
      });
    }
    renderTrend();
    renderCloud();
    const b = best(), c = champs();
    // 👑 가족 서열: 이름별 명예의 전당 보유 수 (원작 가족 경쟁 오마주)
    const tally = {};
    Object.values(c).forEach(r => tally[r.name] = (tally[r.name] || 0) + 1);
    const tallyLine = Object.keys(tally).length >= 2
      ? `<div class="family-rank">👑 명예의 전당 보유: ` +
        Object.entries(tally).sort((x, y) => y[1] - x[1]).map(([n, k]) => `<b>${n}</b> ${k}개`).join(" · ") + `</div>`
      : "";
    $("#best-table").innerHTML = tallyLine + "<h3>게임별 최고 기록</h3>" + ALL.map(g => {
      const score = b[g.id] != null ? b[g.id] + "점 " + medal(b[g.id]) : "—";
      const who = c[g.id] ? `<span class="champ-name">${c[g.id].name}</span>` : "";
      return `<div class="best-row"><span>${icon(g)} ${g.name}</span><b>${score}${who}</b></div>`;
    }).join("");
  }

  // ---------- 흐름 분석 (치매 위험 "판정"이 아닌 정직한 추세 알림) ----------
  function renderTrend() {
    const h = history().filter(r => mine(r, statsWho));
    const box = $("#trend-box");
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    let body;
    if (h.length === 0) { box.innerHTML = ""; return; }
    const latest = h[h.length - 1];
    const ac = ageChecks().filter(r => mine(r, statsWho));
    const ageLine = ac.length
      ? `<div class="trend-age">재미로 보는 뇌 나이: <b>${ac[ac.length - 1].age}세</b> <small>(${ac[ac.length - 1].date} 체크)</small></div>`
      : `<div class="trend-age">재미로 보는 뇌 나이: <b>${brainAge(latest.score)}세</b> <small>(최근 훈련 ${latest.score}점 기준)</small></div>`;
    if (h.length < 6) {
      body = "기록이 6일 이상 쌓이면 점수 흐름 분석을 보여드려요.";
    } else {
      const recent = avg(h.slice(-3).map(r => r.score));
      const base = avg(h.slice(0, -3).slice(-7).map(r => r.score));
      const diff = Math.round(recent - base);
      if (diff <= -8) body = `📉 최근 3회 평균이 평소보다 ${-diff}점 낮아요. 수면·컨디션 영향일 수 있어요. 낮은 흐름이 오래 가면 가볍게 점검해 보세요.`;
      else if (diff >= 5) body = `📈 최근 3회 평균이 평소보다 ${diff}점 높아요. 흐름이 좋습니다!`;
      else body = `➖ 점수 흐름이 안정적이에요. 꾸준함이 최고의 훈련입니다.`;
    }
    box.innerHTML = ageLine + `<div>${body}</div>` +
      `<div class="disclaimer">이 게임은 의료 검사가 아니며, 치매를 진단하거나 위험을 예측할 수 없어요.</div>`;
  }

  // ---------- 온라인 기록판 (구글 시트) ----------
  const GAME_NAMES = {};
  ALL.forEach(g => GAME_NAMES[g.id] = g.name);
  GAME_NAMES.daily = "오늘의 훈련";

  async function renderCloud() {
    const box = $("#cloud-board");
    if (!CLOUD.enabled()) { box.innerHTML = ""; return; }
    box.innerHTML = `<h3>🌐 온라인 명예의 전당</h3><div class="cloud-hint">불러오는 중…</div>`;
    const top = await CLOUD.fetchTop();
    if (!top) { box.innerHTML = `<h3>🌐 온라인 명예의 전당</h3><div class="cloud-hint">연결 실패 — URL을 확인해 주세요.</div>`; return; }
    const dailyRows = (top.daily || []).map((r, i) =>
      `<div class="best-row"><span>${i + 1}위 ${r.name} <span class="champ-name">${r.date}</span></span><b>${r.score}점 ${medal(r.score)}</b></div>`
    ).join("") || `<div class="cloud-hint">아직 기록이 없어요. 오늘의 훈련 점수가 자동으로 올라가요!</div>`;
    const gameRows = Object.entries(top.games || {}).filter(([id]) => id !== "daily").map(([id, r]) =>
      `<div class="best-row"><span>${GAME_NAMES[id] || id}</span><b>${r.score}점 <span class="champ-name">${r.name}</span></b></div>`
    ).join("");
    box.innerHTML = `<h3>🌐 온라인 명예의 전당</h3>
      <h4>오늘의 훈련 TOP 10</h4>${dailyRows}
      ${gameRows ? `<h4>게임별 1위</h4>${gameRows}` : ""}`;
  }

  // ---------- 마스코트 이스터에그 (원작 교수 얼굴 찌르기 오마주) ----------
  let petCount = 0, petTimer = null;
  $("#mascot").onclick = () => {
    SND.bark();
    const m = $("#mascot");
    m.classList.remove("mascot-jump"); void m.offsetWidth; m.classList.add("mascot-jump");
    petCount++;
    clearTimeout(petTimer);
    petTimer = setTimeout(() => petCount = 0, 2500);
    const tip = $("#home-tip");
    if (petCount >= 5) { tip.textContent = "💬 알았어요, 알았어! 산책 가고 싶은 거죠? 😆"; FX.confetti(); petCount = 0; }
    else tip.textContent = ["💬 멍멍! 🐾", "💬 헤헤, 간지러워요!", "💬 오늘도 같이 훈련해요!", "💬 멍! (쓰다듬 +1)"][petCount % 4];
  };

  // 자동 연결 링크: ?board=<웹앱URL> 로 열면 온라인 순위 URL 자동 저장 (폰 설정 원클릭)
  try {
    const bp = new URLSearchParams(location.search).get("board");
    if (bp && /^https:\/\/script\.google\.com\/macros\//.test(bp)) {
      const isNew = CLOUD.url() !== bp;
      CLOUD.setUrl(bp);
      // 로드 초기 replaceState는 크롬이 무시할 수 있어 지연 실행
      setTimeout(() => { try { history.replaceState(null, "", location.pathname); } catch {} }, 300);
      if (isNew) alert("🌐 온라인 순위가 연결됐어요!");
    }
  } catch {}

  renderHome();
})();
