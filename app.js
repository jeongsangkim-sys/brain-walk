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
  const iconSrc = g => `assets/icons/${g.id}.png`; // 게임별 일러스트 아이콘

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
  const settings = () => store.get("bw_settings", { relaxMode: false, sound: true });
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
    session = { mode, queue, i: 0, results: {} };
    runCurrent();
  }

  function runCurrent() {
    stopTimer(); // 이전 게임 타이머 잔존 방지
    const game = session.queue[session.i];
    const lv = levelOf(game.id);
    show("game");
    $("#game-name").innerHTML = `<img class="name-img" src="${iconSrc(game)}" alt="" onerror="this.remove()"> ${game.name} (레벨 ${lv})`;
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
          if (left <= 5 && left > 0) SND.tick();
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
    $("#result-detail").textContent = detail;
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
    ac.push({ date: today(), age, avg });
    store.set("bw_agecheck", ac);
    show("result");
    $("#result-title").textContent = "🧠 재미로 보는 뇌 나이";
    $("#result-comment").textContent = "";
    $("#result-detail").innerHTML = "";
    $("#coach-bubble").textContent = "두구두구두구…";
    // 드럼롤 → 숫자 롤링 → 쾅 공개
    FX.reveal($("#result-score"), age, "세", () => {
      $("#result-comment").textContent =
        prev == null ? "첫 측정이에요. 내일 또 재 보세요!"
          : age < prev ? `지난번 ${prev}세보다 젊어졌어요!`
            : age > prev ? `지난번 ${prev}세보다 살짝 높네요. 컨디션 탓일 거예요.`
              : "지난번과 같아요. 안정적!";
      $("#result-detail").innerHTML =
        session.queue.map(g => `${icon(g)} ${g.name}: ${session.results[g.id]}점`).join("<br>") +
        `<br><span class="disclaimer">놀이용 추정치예요. 의료 검사가 아닙니다.</span>`;
      $("#coach-bubble").textContent =
        prev != null && age < prev ? "젊어졌어요! 산책 효과 제대로네요! 🐾"
          : age <= 35 ? "이 두뇌, 팔팔한데요?"
            : "내일 또 재면 더 젊어질 거예요!";
      if (prev != null && age < prev) FX.confetti();
    });
    $("#btn-next").textContent = "홈으로";
    $("#btn-next").onclick = () => { renderHome(); show("home"); };
  }

  // ---------- 진입점 ----------
  // 데일리: 인지 영역별 1개씩 (계산·기억·반응·관찰 중 3영역) — 완전 랜덤이면 같은 계열 3개가 걸릴 수 있음
  const CATS = {
    calc: "수", calc25: "수",
    memory: "기억", photo: "기억", nback: "기억",
    stroop: "반응", rps: "반응", flags: "반응", dual: "반응",
    trail: "관찰", people: "관찰", birds: "관찰", boxes: "관찰"
  };
  $("#btn-daily").onclick = () => {
    const byCat = {};
    DAILY_POOL.forEach(g => (byCat[CATS[g.id]] = byCat[CATS[g.id]] || []).push(g));
    const cats = U.shuffle(Object.keys(byCat)).slice(0, 3);
    startSession("daily", cats.map(c => U.shuffle(byCat[c])[0]));
  };
  $("#btn-check").onclick = () => startSession("check", U.shuffle(CHECK_POOL).slice(0, 3));
  $("#btn-free").onclick = () => {
    const list = $("#free-list");
    list.innerHTML = "";
    ALL.forEach(g => {
      const b = document.createElement("button");
      b.className = "free-card";
      const bs = best()[g.id];
      b.innerHTML = `<img class="fc-img" src="${iconSrc(g)}" alt="" onerror="this.outerHTML='<span class=fc-icon>${icon(g)}</span>'"><span class="fc-name">${g.name}</span><span class="fc-best">${bs != null ? bs + "점 " + medal(bs) : "미도전"}</span>`;
      b.onclick = () => startSession("free", [g]);
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
