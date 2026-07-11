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

  // ---------- 저장 ----------
  const store = {
    get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const levels = () => store.get("bw_levels", {});
  const best = () => store.get("bw_best", {});
  const history = () => store.get("bw_history", []);
  const ageChecks = () => store.get("bw_agecheck", []);
  const settings = () => store.get("bw_settings", { relaxMode: false });
  const levelOf = id => levels()[id] || 1;

  function adjustLevel(id, score) {
    const lv = levels();
    const cur = lv[id] || 1;
    if (score >= 75) lv[id] = Math.min(5, cur + 1);
    else if (score < 40) lv[id] = Math.max(1, cur - 1);
    else lv[id] = cur;
    store.set("bw_levels", lv);
  }
  function updateBest(id, score) {
    const b = best();
    const prev = b[id] || 0;
    if (score > prev) { b[id] = score; store.set("bw_best", b); }
    return prev;
  }

  const medal = s => s >= 85 ? "🥇" : s >= 65 ? "🥈" : s >= 40 ? "🥉" : "";
  // 뇌 나이(재미용 추정): 100점=20세 ~ 0점=80세 선형 매핑
  const brainAge = s => Math.max(20, Math.round(80 - 0.6 * s));

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
    while (dates.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function renderHome() {
    $("#home-date").textContent = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const s = streakDays();
    const ac = ageChecks();
    let line = s > 0 ? `🔥 ${s}일 연속 산책 중` : "";
    if (ac.length) line += (line ? "  ·  " : "") + `🧠 최근 뇌 나이 ${ac[ac.length - 1].age}세`;
    $("#home-streak").textContent = line;
    $("#chk-relax").checked = settings().relaxMode;
  }
  $("#chk-relax").onchange = e => store.set("bw_settings", { relaxMode: e.target.checked });

  // ---------- 게임 실행 ----------
  let timerId = null, timeUpCb = null;
  function stopTimer() { clearInterval(timerId); timerId = null; }

  let session = null; // { mode: daily|free|check, queue, i, results }

  function startSession(mode, queue) {
    session = { mode, queue, i: 0, results: {} };
    runCurrent();
  }

  function runCurrent() {
    const game = session.queue[session.i];
    const lv = levelOf(game.id);
    show("game");
    $("#game-name").textContent = `${icon(game)} ${game.name} (레벨 ${lv})`;
    $("#game-timer").textContent = "";
    $("#timer-fill").style.width = "100%";
    $("#game-area").innerHTML = "";
    $("#game-intro").style.display = "flex";
    $("#intro-icon").textContent = icon(game);
    $("#intro-title").textContent = game.name;
    $("#intro-desc").textContent = game.intro;
    const b = best()[game.id];
    $("#intro-best").textContent = b != null ? `내 최고 기록 ${b}점 ${medal(b)} — 넘어 보세요!` : "첫 도전이에요!";

    $("#btn-go").onclick = () => {
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
        const dur = Math.round((window.BW_TEST_SEC || game.sec || 30) * (settings().relaxMode ? 1.5 : 1));
        let left = dur;
        elT.textContent = left + "초";
        timerId = setInterval(() => {
          left--;
          elT.textContent = left + "초";
          fill.style.width = (100 * left / dur) + "%";
          if (left <= 10) elT.classList.add("low");
          if (left <= 0) { stopTimer(); timeUpCb && timeUpCb(); }
        }, 1000);
      }
      game.start($("#game-area"), lv, api);
    };
  }

  function comment(score) {
    if (score >= 85) return "훌륭해요! 오늘 두뇌가 아주 상쾌하네요.";
    if (score >= 65) return "좋아요, 꾸준함이 실력입니다.";
    if (score >= 40) return "잘하고 있어요. 내일 또 걸어봐요.";
    return "천천히 가도 괜찮아요. 산책은 매일이 중요하니까요.";
  }

  function onGameDone(game, score, detail) {
    session.results[game.id] = score;
    adjustLevel(game.id, score);
    const prevBest = updateBest(game.id, score);
    const isRecord = score > prevBest && prevBest > 0;

    const last = session.i >= session.queue.length - 1;
    show("result");
    $("#result-title").textContent = (isRecord ? "🏆 신기록! " : "") + game.name + " 결과";
    $("#result-score").textContent = score + "점 " + medal(score);
    $("#result-comment").textContent = isRecord ? `이전 최고 ${prevBest}점을 넘었어요!` : comment(score);
    $("#result-detail").textContent = detail;
    if (isRecord) FX.confetti();
    $("#btn-next").textContent = last
      ? (session.mode === "daily" ? "종합 결과 보기" : session.mode === "check" ? "뇌 나이 확인" : "홈으로")
      : "다음 게임 →";
    $("#btn-next").onclick = () => {
      if (!last) { session.i++; runCurrent(); }
      else if (session.mode === "daily") finishDaily();
      else if (session.mode === "check") finishCheck();
      else { renderHome(); show("home"); }
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
    }
    // 어제의 나와 대결
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yRec = h.find(r => r.date === yd.toISOString().slice(0, 10));
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
    $("#result-score").textContent = total + "점 " + medal(total);
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
    ac.push({ date: today(), age, avg });
    store.set("bw_agecheck", ac);
    if (prev != null && age < prev) FX.confetti();
    show("result");
    $("#result-title").textContent = "🧠 재미로 보는 뇌 나이";
    $("#result-score").textContent = age + "세";
    $("#result-comment").textContent =
      prev == null ? "첫 측정이에요. 내일 또 재 보세요!"
        : age < prev ? `지난번 ${prev}세보다 젊어졌어요!`
          : age > prev ? `지난번 ${prev}세보다 살짝 높네요. 컨디션 탓일 거예요.`
            : "지난번과 같아요. 안정적!";
    $("#result-detail").innerHTML =
      session.queue.map(g => `${icon(g)} ${g.name}: ${session.results[g.id]}점`).join("<br>") +
      `<br><span class="disclaimer">놀이용 추정치예요. 의료 검사가 아닙니다.</span>`;
    $("#btn-next").textContent = "홈으로";
    $("#btn-next").onclick = () => { renderHome(); show("home"); };
  }

  // ---------- 진입점 ----------
  $("#btn-daily").onclick = () => startSession("daily", U.shuffle(DAILY_POOL).slice(0, 3));
  $("#btn-check").onclick = () => startSession("check", U.shuffle(CHECK_POOL).slice(0, 3));
  $("#btn-free").onclick = () => {
    const list = $("#free-list");
    list.innerHTML = "";
    ALL.forEach(g => {
      const b = document.createElement("button");
      b.className = "free-card";
      const bs = best()[g.id];
      b.innerHTML = `<span class="fc-icon">${icon(g)}</span><span class="fc-name">${g.name}</span><span class="fc-best">${bs != null ? bs + "점 " + medal(bs) : "미도전"}</span>`;
      b.onclick = () => startSession("free", [g]);
      list.appendChild(b);
    });
    show("free");
  };
  $("#btn-stats").onclick = () => { renderStats(); show("stats"); };

  // ---------- 기록 ----------
  function renderStats() {
    const h = history().slice(-14);
    const cv = $("#chart"), ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#2B3A55";
    if (h.length === 0) {
      ctx.font = "20px sans-serif";
      ctx.fillText("아직 기록이 없어요. 오늘의 훈련을 시작해 보세요!", 90, 145);
    } else {
      const P = 40, W = cv.width - P * 2, H = cv.height - P * 2;
      ctx.strokeStyle = "#B9AC97";
      ctx.beginPath(); ctx.moveTo(P, P); ctx.lineTo(P, P + H); ctx.lineTo(P + W, P + H); ctx.stroke();
      [0, 50, 100].forEach(v => {
        const y = P + H - (v / 100) * H;
        ctx.fillText(String(v), 10, y + 5);
      });
      const step = h.length > 1 ? W / (h.length - 1) : 0;
      ctx.strokeStyle = "#E8862E"; ctx.lineWidth = 3;
      ctx.beginPath();
      h.forEach((r, i) => {
        const x = P + (h.length > 1 ? i * step : W / 2);
        const y = P + H - (r.score / 100) * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = "#E8862E";
      h.forEach((r, i) => {
        const x = P + (h.length > 1 ? i * step : W / 2);
        const y = P + H - (r.score / 100) * H;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2B3A55";
        ctx.fillText(r.date.slice(5), x - 18, P + H + 20);
        ctx.fillStyle = "#E8862E";
      });
    }
    renderTrend();
    const b = best();
    $("#best-table").innerHTML = "<h3>게임별 최고 기록</h3>" + ALL.map(g =>
      `<div class="best-row"><span>${icon(g)} ${g.name}</span><b>${b[g.id] != null ? b[g.id] + "점 " + medal(b[g.id]) : "—"}</b></div>`
    ).join("");
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

  // ---------- 내보내기/가져오기 ----------
  $("#btn-export").onclick = () => {
    const data = {
      bw_history: history(), bw_levels: levels(), bw_best: best(),
      bw_settings: settings(), bw_agecheck: ageChecks()
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
      ["bw_history", "bw_levels", "bw_best", "bw_settings", "bw_agecheck"].forEach(k => { if (d[k] != null) store.set(k, d[k]); });
      renderStats();
      alert("가져오기 완료!");
    }).catch(() => alert("파일을 읽을 수 없어요."));
  };

  renderHome();
})();
