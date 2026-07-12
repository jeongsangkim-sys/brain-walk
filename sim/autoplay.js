// 시뮬레이션 하네스 — 전 게임(현 23종) 자동 완주 + 데일리/뇌나이체크 E2E
// 사용: 콘솔에서 <script src="sim/autoplay.js"> 주입. 결과는 window.__sim
// 주의: 실행 전 localStorage 스냅샷, 종료 후 복원 (실기록 오염 방지)
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const HANGUL = ["가", "나", "다", "라", "마", "바", "사", "아"];
  const CMAP = { "rgb(201, 79, 79)": "빨강", "rgb(58, 110, 165)": "파랑", "rgb(62, 142, 90)": "초록", "rgb(217, 164, 34)": "노랑" };

  window.__sim = { results: [], done: false, errs: [] };
  window.addEventListener("error", e => __sim.errs.push(e.message));

  // ----- 게임별 스마트 클릭 (매 틱 호출) -----
  const S = { g5cap: [], phHist: [], phLast: "", peCount: null, peLast: "", suPad: 0, prSeen: {} };

  function calcAnswer(txt) {
    const m = txt.match(/(\d+)\s*([+\-×−÷])\s*(\d+)/);
    if (!m) return null;
    const a = +m[1], b = +m[3], op = m[2];
    return op === "+" ? a + b : op === "×" ? a * b : op === "÷" ? a / b : a - b;
  }
  function clickChoice(sel, val) {
    const b = $$(sel).find(x => x.textContent == val);
    if (b) { b.click(); return true; }
    return false;
  }

  function smartClick() {
    // 속산/계산 마라톤/연속 뺄셈
    for (const [q, c] of [["#calc-q", "#calc-choices .choice-btn"], ["#cm-q", "#cm-c .choice-btn"], ["#se-q", "#se-c .choice-btn"]]) {
      const el = $(q);
      if (el && el.textContent) {
        const ans = calcAnswer(el.textContent);
        if (ans != null && clickChoice(c, ans)) return;
      }
    }
    // 스트룹
    const st = $("#st-word");
    if (st && st.textContent) {
      const ink = CMAP[getComputedStyle(st).color];
      const b = $$("#st-choices .choice-btn").find(x => x.dataset.name === ink);
      if (b) { b.click(); return; }
    }
    // 가위바위보
    const rh = $("#rps-hand");
    if (rh) {
      const comp = Math.round(parseFloat(rh.style.backgroundPosition || "0") / 50);
      const inst = ($("#rps-inst") || {}).textContent || "";
      const WINPICK = { 1: 0, 2: 1, 0: 2 }, BEATS = { 0: 1, 1: 2, 2: 0 };
      const p = inst.includes("이기") ? WINPICK[comp] : inst.includes("지세요") ? BEATS[comp] : comp;
      const btns = $$("#rps-c .hand-btn");
      if (btns[p]) { btns[p].click(); return; }
    }
    // 깃발
    const fl = $("#fl-inst");
    if (fl && fl.textContent) {
      const red = fl.textContent.includes("빨강"), neg = fl.textContent.includes("아니야");
      const btns = $$("#fl-c .choice-btn");
      const t = (red !== neg) ? 0 : 1;
      if (btns[t]) { btns[t].click(); return; }
    }
    // 순간 기억: 숨겨진 타일 중 가장 작은 수
    const memTiles = $$("#mem-board .tile.hidden-num").filter(t => !t.classList.contains("cleared") && !t.classList.contains("wrong"));
    if (memTiles.length) {
      memTiles.sort((a, b) => +a.textContent - +b.textContent)[0].click();
      return;
    }
    // 순서 잇기: 랭크 최소 타일
    const trTiles = $$("#tr-board .tile").filter(t => !t.classList.contains("cleared"));
    if (trTiles.length) {
      const rank = l => /^\d+$/.test(l) ? (+l - 1) * 2 : HANGUL.indexOf(l) * 2 + 1;
      trTiles.sort((a, b) => rank(a.textContent) - rank(b.textContent))[0].click();
      return;
    }
    // 최고 숫자: 숨김 후 최대값
    const hiTiles = $$("#hi-board .tile.hidden-num");
    if (hiTiles.length) {
      hiTiles.sort((a, b) => +b.textContent - +a.textContent)[0].click();
      return;
    }
    // 고속 세기: 번갈아
    const scN = $("#sc-n");
    if (scN) {
      const btns = $$("#sc-c .choice-btn");
      if (btns.length === 2) { btns[+scN.textContent % 2].click(); return; }
    }
    // 5×5 기억: 켜진 칸 캡처 → 숨은 뒤 재현
    const g5 = $$("#g5 .g5cell");
    if (g5.length) {
      const lit = g5.map((c, i) => c.classList.contains("lit") && !c.classList.contains("done") ? i : -1).filter(i => i >= 0);
      if (lit.length) { S.g5cap = lit; return; }
      if (S.g5cap.length) { const i = S.g5cap.shift(); g5[i] && g5[i].click(); return; }
      return;
    }
    // 직전 그림: 카드 이력 추적
    const ph = $("#ph-card");
    if (ph) {
      const t = ph.textContent;
      if (t && t !== "❓" && t !== S.phLast) { S.phHist.push(t); S.phLast = t; }
      const btns = $$("#ph-c .choice-btn");
      if (btns.length) {
        const back = (($("#ph-inst") || {}).textContent || "").includes("2장") ? 2 : 1;
        const ans = S.phHist[S.phHist.length - 1 - back];
        (btns.find(b => b.textContent === ans) || btns[0]).click();
        S.phLast = ""; // 다음 카드 다시 추적
        return;
      }
      return;
    }
    // 인원 세기: 이벤트 파싱 추적
    const pe = $("#pe-ev");
    if (pe) {
      const t = pe.textContent;
      if (t !== S.peLast) {
        S.peLast = t;
        let m;
        if ((m = t.match(/처음에 (\d+)명/))) S.peCount = +m[1];
        else if ((m = t.match(/(\d+)명 들어/))) S.peCount += +m[1];
        else if ((m = t.match(/(\d+)명 나왔/))) S.peCount -= +m[1];
      }
      const btns = $$("#pe-c .choice-btn");
      if (btns.length) {
        (btns.find(b => +b.textContent === S.peCount) || btns[0]).click();
        S.peCount = null; S.peLast = "";
        return;
      }
      return;
    }
    // 새 세기: 새 이미지 수 세기
    const sky = $("#bi-sky");
    if (sky) {
      const btns = $$("#bi-c .choice-btn");
      if (btns.length) {
        const birds = $$("#bi-sky .flyer").filter(f => (f.src || "").includes("bird")).length;
        (btns.find(b => +b.textContent === birds) || btns[0]).click();
        return;
      }
      return;
    }
    // 스도쿠: 빈칸 선택 → 해답 훅으로 정답 패드 (하트 시스템이라 오답 순회 금지)
    const hole = $(".sucell.hole");
    if (hole || $(".sucell.sel")) {
      const sel = $(".sucell.sel.hole") || $(".sucell.sel");
      if ((!sel || !sel.classList.contains("hole")) && hole) { hole.click(); return; }
      if (sel && window.__sudokuSol) {
        const cells = $$(".sucell");
        const idx = cells.indexOf(sel);
        const ans = window.__sudokuSol[Math.floor(idx / 9)][idx % 9];
        const pad = $$("#su-pad .choice-btn").find(b => +(b.textContent.match(/\d/) || [0])[0] === ans);
        if (pad) { pad.click(); return; }
      }
      return;
    }
    // 잔돈 계산: 낸 돈 − 물건값
    const ch = $("#ch-q");
    if (ch && ch.textContent) {
      const m = ch.textContent.match(/([\d,]+)원 물건.*?([\d,]+)원을/);
      if (m) {
        const ans = +m[2].replace(/,/g, "") - +m[1].replace(/,/g, "");
        const b = $$("#ch-c .choice-btn").find(x => +x.textContent.replace(/[,원]/g, "") === ans);
        if (b) { b.click(); return; }
      }
      return;
    }
    // 어느 쪽이 많을까: span 수 비교
    if ($("#cp-l")) {
      const l = $$("#cp-l span").length, r = $$("#cp-r span").length;
      (l > r ? $("#cp-l") : $("#cp-r")).click();
      return;
    }
    // 짝 맞추기: 본 카드 기억 → 아는 짝 우선, 없으면 새 카드 (앞면=이미지)
    const pcards = $$(".pcard");
    const pface = c => { const im = c.querySelector("img"); return im ? im.dataset.e || im.src : (c.textContent !== "🐾" ? c.textContent : null); };
    if (pcards.length) {
      if ($$(".pcard.open").length >= 2) return; // 미스매치 복귀 대기
      pcards.forEach((c, i) => { const f = pface(c); if (f && !c.classList.contains("done")) S.prSeen[i] = f; });
      const openIdx = pcards.findIndex(c => c.classList.contains("open"));
      if (openIdx >= 0) {
        const emo = pface(pcards[openIdx]);
        const mate = Object.entries(S.prSeen).find(([i, e]) => +i !== openIdx && e === emo && !pcards[+i].classList.contains("done"));
        if (mate) { pcards[+mate[0]].click(); return; }
        const fresh = pcards.findIndex((c, i) => c.textContent === "🐾" && S.prSeen[i] == null);
        pcards[fresh >= 0 ? fresh : pcards.findIndex(c => c.textContent === "🐾")].click();
        return;
      }
      // 아는 짝 페어가 이미 있으면 그걸 열기
      const known = {};
      for (const [i, e] of Object.entries(S.prSeen)) {
        if (pcards[+i].classList.contains("done")) continue;
        if (known[e] != null) { pcards[known[e]].click(); return; }
        known[e] = +i;
      }
      const fresh = pcards.findIndex((c, i) => c.textContent === "🐾" && S.prSeen[i] == null && !c.classList.contains("done"));
      if (fresh >= 0) { pcards[fresh].click(); return; }
      const anyClosed = pcards.findIndex(c => c.textContent === "🐾" && !c.classList.contains("done"));
      if (anyClosed >= 0) pcards[anyClosed].click();
      return;
    }
    // 이중과제 별 질문 / 상자 세기 / 기타: 아무 보기나
    const any = $$("#game-area .choice-btn");
    if (any.length) { any[Math.floor(Math.random() * any.length)].click(); return; }
    // N-back: 방치 (자체 종료)
  }

  // ----- 자동 플레이어 루프 -----
  function startAuto() {
    stopAuto();
    window.__auto = setInterval(() => {
      try {
        const active = document.querySelector(".screen.active");
        if (!active || active.id !== "screen-game") return;
        const intro = $("#game-intro");
        if (intro && intro.style.display !== "none") { $("#btn-go").click(); return; }
        smartClick();
      } catch (e) { __sim.errs.push("AUTO " + e.message); }
    }, 220);
  }
  function stopAuto() { clearInterval(window.__auto); }

  async function waitResult(capMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < capMs) {
      await sleep(400);
      const a = document.querySelector(".screen.active");
      if (a && a.id === "screen-result") return true;
    }
    return false;
  }
  function goHome() {
    const g = $$("#screen-result [data-goto=home]")[0] || $$("[data-goto=home]")[0];
    g && g.click();
  }

  // ----- 드라이버 -----
  window.__runAll = async function () {
    // 스냅샷
    const KEYS = ["bw_history", "bw_levels", "bw_best", "bw_settings", "bw_agecheck", "bw_player", "bw_champs", "bw_rt"];
    const snap = {};
    KEYS.forEach(k => snap[k] = localStorage.getItem(k));
    // 시뮬 중 사용자가 실플레이하면 종료 복원이 그 기록을 덮어씀 → 영구 백업 남김 (수동 복구용)
    localStorage.setItem("bw_backup_" + Date.now(), JSON.stringify(snap));
    localStorage.setItem("bw_levels", "{}"); // 전부 기본 레벨로
    // 해금: 가짜 도장 8개 주입 (6+8*3=30 ≥ 전 게임) — 종료 시 스냅샷 복원으로 제거됨
    const fake = [];
    for (let d = 1; d <= 8; d++) {
      const dt = new Date(); dt.setDate(dt.getDate() - d);
      fake.push({ date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`, score: 50, games: {}, name: "심" });
    }
    localStorage.setItem("bw_history", JSON.stringify(fake));
    window.BW_TEST_SEC = 5;
    startAuto();
    try {
      // 1) 전 게임 개별 완주 (free-list 카드 수만큼 동적)
      goHome(); await sleep(200);
      $("#btn-free").click(); await sleep(150);
      const N = $$(".free-card").length;
      for (let i = 0; i < N; i++) {
        Object.assign(S, { g5cap: [], phHist: [], phLast: "", peCount: null, peLast: "", suPad: 0, prSeen: {} });
        goHome();
        await sleep(200);
        $("#btn-free").click();
        await sleep(150);
        const card = $$(".free-card")[i];
        const name = card.querySelector(".fc-name").textContent;
        if (card.classList.contains("locked")) { __sim.results.push({ i, name, done: false, score: "LOCKED", sane: false }); continue; }
        card.click();
        const ok = await waitResult(70000);
        const scoreTxt = ($("#result-score") || {}).textContent || "";
        const score = parseInt(scoreTxt) ;
        __sim.results.push({
          i, name,
          done: ok,
          score: isNaN(score) ? scoreTxt : score,
          sane: !isNaN(score) && score >= 0 && score <= 100,
          detail: ($("#result-detail") || {}).textContent || "",
          coach: ($("#coach-bubble") || {}).textContent || ""
        });
        await sleep(300);
      }
      // 2) 데일리 E2E
      goHome(); await sleep(250);
      $("#btn-daily").click();
      let dailyOk = false;
      for (let g = 0; g < 3; g++) {
        if (!await waitResult(70000)) break;
        const last = $("#btn-next").textContent.includes("종합");
        $("#btn-next").click();
        await sleep(400);
        if (last) { dailyOk = document.querySelector(".screen.active").id === "screen-result"; break; }
      }
      __sim.daily = { ok: dailyOk, score: ($("#result-score") || {}).textContent, vs: ($("#result-detail") || {}).textContent };
      // 3) 뇌 나이 체크 E2E
      goHome(); await sleep(250);
      $("#btn-check").click();
      let checkOk = false;
      for (let g = 0; g < 3; g++) {
        if (!await waitResult(70000)) break;
        const last = $("#btn-next").textContent.includes("뇌 나이");
        $("#btn-next").click();
        await sleep(400);
        if (last) {
          await sleep(2400); // 드럼롤 대기
          checkOk = true;
          __sim.check = { age: ($("#result-score") || {}).textContent, coach: ($("#coach-bubble") || {}).textContent };
        }
      }
      __sim.checkOk = checkOk;
    } finally {
      stopAuto();
      KEYS.forEach(k => snap[k] == null ? localStorage.removeItem(k) : localStorage.setItem(k, snap[k]));
      __sim.done = true;
    }
  };
  window.__runAll();
})();
