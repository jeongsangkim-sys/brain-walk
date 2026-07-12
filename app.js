// 두뇌 산책 — 공통 로직 (라우팅·타이머·점수·저장·연출)
(function () {
  const U = window.BW_UTIL;

  // 게임 등록부: daily=오늘의 훈련 후보, check=뇌 나이 체크 후보
  const REG = [
    { g: window.GAME_CALC, daily: true },
    { g: window.GAME_MEMORY, daily: true },
    { g: window.GAME_STROOP, daily: true },
    { g: window.GAME_TRAIL, daily: true, check: true },
    { g: window.GAME_RPS, daily: true },
    { g: window.GAME_FLAGS, daily: true },
    { g: window.GAME_CALC25, daily: true },
    { g: window.GAME_SIGN, daily: true },
    { g: window.GAME_CALC100 },
    { g: window.GAME_SERIAL, check: true },
    { g: window.GAME_HIGHEST, check: true },
    { g: window.GAME_SPEEDCOUNT, check: true },
    { g: window.GAME_PHOTO, daily: true },
    { g: window.GAME_GRID55, check: true },
    { g: window.GAME_NBACK, daily: true },
    { g: window.GAME_PEOPLE, daily: true },
    { g: window.GAME_BIRDS, daily: true },
    { g: window.GAME_BOXES, daily: true },
    { g: window.GAME_DUAL, daily: true },
    { g: window.GAME_SUDOKU }
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
    sudoku: "가로·세로·3×3에 1~9가 한 번씩"
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
  const settings = () => store.get("bw_settings", { relaxMode: false, sound: true });
  const levelOf = id => levels()[id] || 1;

  function adjustLevel(id, score) {
    const lv = levels();
    const cur = lv[id] || 1;
    if (score >= 75) lv[id] = Math.min(9, cur + 1);
    else if (score < 40) lv[id] = Math.max(1, cur - 1);
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
    "boxes", "dual", "nback", "serial", "speedcount", "sudoku", "calc100"];
  const stamps = () => new Set(history().map(r => r.date)).size; // 훈련한 날 수
  const unlockLimit = () => 6 + stamps() * 3; // 시작 6종 + 하루 3종씩
  const isUnlocked = g => UNLOCK_SEQ.indexOf(g.id) < unlockLimit();
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
    const dates = new Set(history().map(h => h.date));
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
    const ac = ageChecks();
    let line = s > 0 ? `🔥 ${s}일 연속 산책 중${shield ? " 🛡️" : ""}` : "";
    if (ac.length) line += (line ? "  ·  " : "") + `🧠 최근 뇌 나이 ${ac[ac.length - 1].age}세`;
    $("#home-streak").textContent = line;
    $("#home-player").textContent = player() ? `🙋 ${player()} (바꾸기)` : "🙋 이름 정하기";
    $("#home-player").onclick = () => askPlayer(true);
    // 오늘의 훈련 완료 여부에 따른 습관 유도 카피
    const doneToday = history().some(r => r.date === today());
    const hh = new Date().getHours();
    const GREET = hh < 5 ? "늦은 밤에도 반가워요!" : hh < 11 ? "좋은 아침이에요!" : hh < 17 ? "오후 머리 깨우기 딱 좋은 시간!" : hh < 22 ? "오늘 하루 마무리 산책 어때요?" : "자기 전 가볍게 한 판!";
    $("#daily-sub").textContent = doneToday ? "오늘 완료 ✓ 내일 새 훈련이 기다려요" : "아직 안 했어요 — 3분이면 끝!";
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
    $("#home-tip").textContent = doneToday ? `💬 ${TIPS[dayIdx]}` : `💬 ${GREET} 3분만 걷고 가요!`;
    $("#chk-relax").checked = settings().relaxMode;
    $("#chk-sound").checked = settings().sound !== false;
    $("#chk-notify").checked = !!settings().notify;
    $("#chk-ink").checked = !!settings().ink;
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

  function startSession(mode, queue) {
    askPlayer(false); // 첫 플레이 때 한 번만 물어봄
    session = { mode, queue, i: 0, results: {} };
    runCurrent();
  }

  function runCurrent() {
    stopTimer(); // 이전 게임 타이머 잔존 방지
    $("#screen-game").classList.remove("low-time");
    const game = session.queue[session.i];
    const lv = levelOf(game.id);
    // ⚡ 황금 산책: 시간제 게임 15% 확률 — 이 판 점수 +10 (예측불가 보상)
    session.golden = !game.mode && Math.random() < 0.15;
    show("game");
    $("#game-name").innerHTML = `<img class="name-img" src="${iconSrc(game)}" alt="" onerror="this.remove()"> ${game.name} <span class="lv-chip">Lv.${lv}</span>`;
    $("#game-timer").textContent = "";
    $("#timer-fill").style.width = "100%";
    $("#game-area").innerHTML = "";
    $("#game-intro").style.display = "flex";
    const ii = $("#intro-icon");
    ii.style.visibility = "visible";
    ii.src = iconSrc(game);
    $("#intro-title").textContent = game.name;
    $("#intro-desc").textContent = game.intro;
    const b = best()[game.id];
    $("#intro-best").textContent = (session.golden ? "⚡ 황금 산책! 이 판 점수 +10 · " : "") +
      (b != null ? `내 최고 기록 ${b}점 ${medal(b)} — 넘어 보세요!` : "첫 도전이에요!");

    $("#game-hint").textContent = "";
    $("#btn-go").onclick = () => {
      SND.start(); SND.bgmStart();
      RT.start(game.id); // 반응시간 수집 시작
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
          if (session.golden) { score = Math.min(100, score + 10); detail += " · ⚡황금 +10"; }
          onGameDone(game, score, detail);
        }
      };

      if (game.mode === "count") {
        // 분량제: 시간은 올라가기만, 게임이 스스로 끝냄
        fill.style.width = "0%";
        let t = 0;
        elT.textContent = "0초";
        timerId = setInterval(() => { t++; elT.textContent = t + "초"; }, 1000);
      } else {
        // BW_TEST_SEC: 콘솔 테스트용 단축 타이머
        const dur = Math.round((window.BW_TEST_SEC || game.sec || 25) * (settings().relaxMode ? 1.5 : 1));
        let left = dur;
        elT.textContent = left + "초";
        fill.classList.remove("low");
        timerId = setInterval(() => {
          left--;
          elT.textContent = left + "초";
          fill.style.width = (100 * left / dur) + "%";
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
  }

  function comment(score) {
    if (score >= 85) return "훌륭해요! 오늘 머리가 쌩쌩 돌아가네요.";
    if (score >= 65) return "좋아요, 점점 날카로워지고 있어요.";
    if (score >= 40) return "좋은 페이스예요. 한 번 더 하면 더 오를 거예요.";
    return "괜찮아요. 매일 조금씩이 실력의 비결이에요.";
  }

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
    show("result");
    $("#result-title").textContent = (isRecord ? "🏆 신기록! " : "") + game.name + " 결과";
    FX.countUp($("#result-score"), score, "점 " + medal(score));
    // 니어미스: 다음 메달까지 5점 이내면 아쉬움 자극
    const near = [[85, "🥇"], [65, "🥈"], [40, "🥉"]].find(([t]) => score < t && t - score <= 5);
    $("#result-comment").textContent = isRecord ? `이전 최고 ${prevBest}점을 넘었어요!`
      : near ? `아깝다! ${near[0] - score}점만 더 하면 ${near[1]}이었어요!` : comment(score);
    const rtAvg = RT.sessAvg();
    $("#result-detail").textContent = detail + (rtAvg ? ` · 평균 반응 ${rtAvg.toFixed(1)}초` : "");
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
  }

  function finishDaily() {
    const scores = Object.values(session.results);
    const total = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const h = history();
    const already = h.some(r => r.date === today());
    if (!already) {
      h.push({ date: today(), score: total, games: session.results });
      store.set("bw_history", h);
      mirrorTrained(); // 알림용 훈련일 미러 (SW가 읽음)
      CLOUD.submit("daily", player() || "게스트", total); // 온라인 기록판 (연결 시)
    }
    // 어제의 나와 대결
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yRec = h.find(r => r.date === localDate(yd));
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
    const ac = ageChecks();
    const prev = ac.length ? ac[ac.length - 1].age : null;
    // 원작식: 뇌 나이 기록은 하루 1회. 추가 측정은 연습으로만
    const measuredToday = ac.some(r => r.date === today());
    if (!measuredToday) {
      ac.push({ date: today(), age, avg });
      store.set("bw_agecheck", ac);
    }
    show("result");
    $("#result-title").textContent = "🧠 재미로 보는 뇌 나이";
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
      $("#result-detail").innerHTML =
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
  // 데일리: 인지 영역별 1개씩 (계산·기억·반응·관찰 중 3영역) — 완전 랜덤이면 같은 계열 3개가 걸릴 수 있음
  const CATS = {
    calc: "수", calc25: "수", sign: "수",
    memory: "기억", photo: "기억", nback: "기억",
    stroop: "반응", rps: "반응", flags: "반응", dual: "반응",
    trail: "관찰", people: "관찰", birds: "관찰", boxes: "관찰"
  };
  $("#btn-daily").onclick = () => {
    const byCat = {};
    DAILY_POOL.filter(isUnlocked).forEach(g => (byCat[CATS[g.id]] = byCat[CATS[g.id]] || []).push(g));
    const cats = U.shuffle(Object.keys(byCat)).slice(0, 3);
    startSession("daily", cats.map(c => U.shuffle(byCat[c])[0]));
  };
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
        : `<span class="fc-icon">🔒</span><span class="fc-name">${g.name}</span><span class="fc-best">🐾 도장 ${unlockDay(g)}개면 열려요</span>`;
      if (open) b.onclick = () => startSession("free", [g]);
      list.appendChild(b);
    });
    show("free");
  };
  $("#btn-stats").onclick = () => { renderStats(); show("stats"); };

  // ---------- 스도쿠 전용 모드 (보상: 도장으로 난이도 해금) ----------
  const SUDOKU_DIFFS = [
    { name: "쉬움", desc: "빈칸 30개 — 가볍게 몸풀기", holes: 30, need: 0 },
    { name: "보통", desc: "빈칸 40개 — 오늘의 본판", holes: 40, need: 3 },
    { name: "어려움", desc: "빈칸 50개 — 진짜 실력 시험", holes: 50, need: 7 }
  ];
  $("#btn-sudoku").onclick = () => {
    const box = $("#sudoku-diffs");
    box.innerHTML = "";
    const s = stamps();
    SUDOKU_DIFFS.forEach(d => {
      const open = s >= d.need;
      const b = document.createElement("button");
      b.className = "menu-btn" + (open ? "" : " locked-diff");
      b.innerHTML = `<span class="mt"><b>${open ? "" : "🔒 "}${d.name}</b><small>${open ? d.desc : `🐾 도장 ${d.need}개면 열려요`}</small></span>` +
        (open ? `<span class="mc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg></span>` : "");
      if (open) b.onclick = () => {
        window.BW_SUDOKU_DIFF = d.holes;
        startSession("free", [window.GAME_SUDOKU]);
      };
      box.appendChild(b);
    });
    show("sudoku");
  };

  // ---------- 도장 달력 (훈련·체크한 날 = 발도장) ----------
  function renderCal() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const pad2 = n => String(n).padStart(2, "0");
    const trained = new Set([
      ...history().map(r => r.date),
      ...ageChecks().map(r => r.date)
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
  function renderStats() {
    renderCal();
    const h = history().slice(-14);
    const cv = $("#chart"), ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = "14px Manrope, sans-serif";
    ctx.fillStyle = "#1A1A1A";
    if (h.length === 0) {
      ctx.font = "20px sans-serif";
      ctx.fillText("아직 기록이 없어요. 오늘의 훈련을 시작해 보세요!", 90, 145);
    } else {
      const P = 40, W = cv.width - P * 2, H = cv.height - P * 2;
      ctx.strokeStyle = "#DDDDDD";
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
        ctx.fillStyle = "#757575";
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
    const h = history();
    const box = $("#trend-box");
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    let body;
    if (h.length === 0) { box.innerHTML = ""; return; }
    const latest = h[h.length - 1];
    const ac = ageChecks();
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

  $("#btn-cloud").onclick = () => {
    // 이미 연결됨 → 상태 안내 + 해제 여부만 (URL 재입력 요구 금지)
    if (CLOUD.enabled()) {
      if (confirm("🌐 온라인 순위가 이미 연결되어 있어요.\n\n[확인] = 연결 해제\n[취소] = 그대로 두기")) {
        CLOUD.setUrl("");
        renderCloud();
      }
      return;
    }
    const u = window.prompt("구글 시트 기록판 URL을 붙여넣으세요.\n(자동 연결 링크로 열면 이 과정이 필요 없어요)", "");
    if (u === null) return; // 취소
    const t = (u || "").trim();
    if (t && !/^https:\/\/script\.google\.com\/macros\//.test(t)) {
      alert("URL 형식이 아니에요.\nhttps://script.google.com/macros/… 로 시작하는 웹 앱 URL을 붙여넣어 주세요.");
      return;
    }
    CLOUD.setUrl(t);
    renderCloud();
  };

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
