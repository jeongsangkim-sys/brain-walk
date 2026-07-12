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
  function streakDays() {
    const dates = new Set(history().map(h => h.date));
    let n = 0;
    const d = new Date();
    if (!dates.has(today())) d.setDate(d.getDate() - 1);
    while (dates.has(localDate(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function renderHome() {
    $("#home-date").textContent = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const s = streakDays();
    const ac = ageChecks();
    let line = s > 0 ? `🔥 ${s}일 연속 산책 중` : "";
    if (ac.length) line += (line ? "  ·  " : "") + `🧠 최근 뇌 나이 ${ac[ac.length - 1].age}세`;
    $("#home-streak").textContent = line;
    $("#home-player").textContent = player() ? `🙋 ${player()} (바꾸기)` : "🙋 이름 정하기";
    $("#home-player").onclick = () => askPlayer(true);
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
    $("#home-tip").textContent = `💬 ${TIPS[dayIdx]}`;
    $("#chk-relax").checked = settings().relaxMode;
    $("#chk-sound").checked = settings().sound !== false;
  }
  $("#chk-relax").onchange = e => store.set("bw_settings", { ...settings(), relaxMode: e.target.checked });
  $("#chk-sound").onchange = e => {
    store.set("bw_settings", { ...settings(), sound: e.target.checked });
    SND.setEnabled(e.target.checked);
  };
  SND.setEnabled(settings().sound !== false);

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
    const game = session.queue[session.i];
    const lv = levelOf(game.id);
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
    $("#intro-best").textContent = b != null ? `내 최고 기록 ${b}점 ${medal(b)} — 넘어 보세요!` : "첫 도전이에요!";

    $("#btn-go").onclick = () => {
      SND.start(); SND.bgmStart();
      RT.start(game.id); // 반응시간 수집 시작
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
          SND.bgmStop();
          RT.stop();
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
          if (left <= 5 && left > 0) { SND.tick(); fill.classList.add("low"); }
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
    record: ["신기록이에요! 오늘 간식 두 배! 🦴", "역대 최고! 저 방금 세 바퀴 돌았어요!", "이 기록, 액자에 걸어야 해요! 🏆"],
    high: ["대단해요! 제 꼬리가 저절로 흔들려요 🐾", "이 정도면 제가 배워야겠는걸요?", "오늘 두뇌 회전 최고 속도예요!"],
    mid: ["좋아요, 어제의 나를 이기는 중!", "꾸준함이 제일 무서운 재능이에요.", "감이 점점 올라오고 있어요!"],
    low: ["괜찮아요, 실수도 훈련이에요!", "다음 판은 분명 오를 거예요. 한 판 더?", "처음엔 다 그래요. 내일 보자고요! 🐾"]
  };
  function coachSay(score, isRecord) {
    const pool = isRecord ? COACH.record : score >= 80 ? COACH.high : score >= 50 ? COACH.mid : COACH.low;
    $("#coach-bubble").textContent = pool[Math.floor(Math.random() * pool.length)];
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
    $("#result-comment").textContent = isRecord ? `이전 최고 ${prevBest}점을 넘었어요!` : comment(score);
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
    let html = `<h3>${m + 1}월 산책 도장 <small>(${trained.size}일)</small></h3><div class="cal-grid">`;
    "일월화수목금토".split("").forEach(d => html += `<div class="cal-head">${d}</div>`);
    for (let i = 0; i < first; i++) html += `<div></div>`;
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${pad2(m + 1)}-${pad2(d)}`;
      const today_ = d === now.getDate();
      html += `<div class="cal-day${today_ ? " today" : ""}">${trained.has(key) ? `<span class="stamp">🐾</span>` : d}</div>`;
    }
    $("#stamp-cal").innerHTML = html + "</div>";
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
    $("#best-table").innerHTML = "<h3>게임별 최고 기록</h3>" + ALL.map(g => {
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
    const cur = CLOUD.url();
    const u = window.prompt(
      "구글 시트 기록판 URL을 붙여넣으세요.\n(만드는 법: cloud/apps-script.gs 파일 참고. 비우면 연결 해제)",
      cur
    );
    if (u === null) return; // 취소
    const t = (u || "").trim();
    if (t && !/^https:\/\/script\.google\.com\/macros\//.test(t)) {
      alert("URL 형식이 아니에요.\nhttps://script.google.com/macros/… 로 시작하는 웹 앱 URL을 붙여넣어 주세요.");
      return;
    }
    CLOUD.setUrl(t);
    renderCloud();
  };

  // ---------- 내보내기/가져오기 ----------
  $("#btn-export").onclick = () => {
    const data = {
      bw_history: history(), bw_levels: levels(), bw_best: best(),
      bw_settings: settings(), bw_agecheck: ageChecks(),
      bw_player: player(), bw_champs: champs()
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `brain-walk-${today()}.json`;
    a.click();
  };
  $("#btn-import").onclick = () => $("#file-import").click();
  $("#file-import").onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(t => {
      const d = JSON.parse(t);
      ["bw_history", "bw_levels", "bw_best", "bw_settings", "bw_agecheck", "bw_player", "bw_champs"].forEach(k => { if (d[k] != null) store.set(k, d[k]); });
      renderStats();
      alert("가져오기 완료!");
    }).catch(() => alert("파일을 읽을 수 없어요."));
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
