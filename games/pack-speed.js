// 순발력·계산 계열 게임 팩
// 공통: U = BW_UTIL, 시간제 게임은 api.onTimeUp에서 점수 계산,
// 분량제(mode:"count") 게임은 스스로 api.finish 호출.
(function () {
  const U = window.BW_UTIL;

  // ---------- 가위바위보 (지시 따라 이기기/지기/비기기 — 억제력) ----------
  window.GAME_RPS = {
    id: "rps", name: "가위바위보", icon: "✌️", sec: 30,
    intro: "상대 손을 보고 지시대로!\n\"이기세요\"면 이기는 손을 고르세요.",
    start(area, level, api) {
      const BEATS = { 0: 1, 1: 2, 2: 0 };            // 바위0>가위1>보2>바위0
      let ok = 0, bad = 0, streak = 0;
      const TARGET = 12;
      area.innerHTML = `
        <div class="inst" id="rps-inst"></div>
        <div class="hand-view" id="rps-hand"></div>
        <div class="feedback" id="rps-fb"></div>
        <div class="choices three" id="rps-c"></div>`;
      const inst = area.querySelector("#rps-inst");
      const hand = area.querySelector("#rps-hand");
      const fb = area.querySelector("#rps-fb");
      let comp = 0, goal = "win";

      function next() {
        comp = U.rand(0, 2);
        const modes = level <= 1 ? ["win"] : level <= 2 ? ["win", "lose"] : ["win", "lose", "draw"];
        goal = modes[U.rand(0, modes.length - 1)];
        inst.textContent = goal === "win" ? "이기세요!" : goal === "lose" ? "지세요!" : "비기세요!";
        inst.className = "inst " + goal;
        hand.style.backgroundPosition = (comp * 50) + "% 50%"; // 스프라이트 3분할
      }
      const NAMES = ["바위", "가위", "보"];
      const cWrap = area.querySelector("#rps-c");
      cWrap.innerHTML = "";
      NAMES.forEach((name, p) => {
        const b = document.createElement("button");
        b.className = "choice-btn hand-btn";
        b.innerHTML = `<span class="hand-mini" style="background-position:${p * 50}% 50%"></span>${name}`;
        b.onclick = () => pick(p);
        cWrap.appendChild(b);
      });
      function pick(p) {
        const win = BEATS[p] === comp, draw = p === comp;
        const good = goal === "win" ? win : goal === "lose" ? (!win && !draw) : draw;
        if (good) { ok++; streak++; fb.textContent = "정답!" + U.comboText(streak); fb.className = "feedback flash-good"; }
        else { bad++; streak = 0; fb.textContent = "아까워요!"; fb.className = "feedback flash-bad"; }
        FX.flash(good);
        next();
      }
      next();
      api.onTimeUp(() => {
        const n = ok + bad, acc = n ? ok / n : 0;
        api.finish(Math.round(100 * acc * Math.min(1, n / TARGET)), `정답 ${ok} · 오답 ${bad}`);
      });
    }
  };

  // ---------- 깃발 들기 (청기백기식 지시·부정 지시 — 억제력) ----------
  window.GAME_FLAGS = {
    id: "flags", name: "깃발 들기", icon: "🚩", sec: 30,
    intro: "지시대로 깃발을 드세요.\n\"아니야!\"가 붙으면 반대 깃발!",
    start(area, level, api) {
      let ok = 0, bad = 0, streak = 0;
      const TARGET = 12;
      area.innerHTML = `
        <div class="problem" id="fl-inst" style="font-size:40px"></div>
        <div class="feedback" id="fl-fb"></div>
        <div class="choices" id="fl-c"></div>`;
      const inst = area.querySelector("#fl-inst");
      const fb = area.querySelector("#fl-fb");
      const FLAGS = [["빨강", "#C94F4F"], ["파랑", "#3A6EA5"]];
      let answer = 0;

      function next() {
        const f = U.rand(0, 1);
        const neg = level >= 2 && Math.random() < Math.min(0.6, 0.2 + level * 0.1);
        answer = neg ? 1 - f : f;
        inst.innerHTML = `<span style="color:${FLAGS[f][1]}">${FLAGS[f][0]} 깃발</span> ${neg ? "아니야!" : "올려!"}`;
      }
      const c = area.querySelector("#fl-c");
      c.innerHTML = "";
      FLAGS.forEach(([name, css], i) => {
        const b = document.createElement("button");
        b.className = "choice-btn";
        b.textContent = "🚩 " + name;
        b.style.color = css; b.style.borderColor = css;
        b.onclick = () => {
          const good = i === answer;
          if (good) { ok++; streak++; fb.textContent = "정답!" + U.comboText(streak); fb.className = "feedback flash-good"; }
          else { bad++; streak = 0; fb.textContent = "반대예요!"; fb.className = "feedback flash-bad"; }
          FX.flash(good);
          next();
        };
        c.appendChild(b);
      });
      next();
      api.onTimeUp(() => {
        const n = ok + bad, acc = n ? ok / n : 0;
        api.finish(Math.round(100 * acc * Math.min(1, n / TARGET)), `정답 ${ok} · 오답 ${bad}`);
      });
    }
  };

  // ---------- 계산 마라톤 공장 (25회 / 100회 — 분량제) ----------
  function calcMarathon(id, name, icon, COUNT, TARGET_SEC) {
    return {
      id, name, icon, mode: "count",
      intro: `계산 ${COUNT}문제를 빠르게!\n다 풀면 끝. 빠를수록 점수가 높아요.`,
      start(area, level, api) {
        let done = 0, ok = 0, streak = 0;
        area.innerHTML = `
          <div class="inst" id="cm-prog"></div>
          <div class="problem" id="cm-q"></div>
          <div class="feedback" id="cm-fb"></div>
          <div class="choices" id="cm-c"></div>`;
        const prog = area.querySelector("#cm-prog");
        const q = area.querySelector("#cm-q");
        const fb = area.querySelector("#cm-fb");

        function problem() {
          let a, b, op;
          if (level <= 2) { a = U.rand(1, 9); b = U.rand(1, 9); op = ["+", "-"][U.rand(0, 1)]; }
          else { a = U.rand(2, 12); b = U.rand(2, 12); op = ["+", "-", "×"][U.rand(0, 2)]; }
          if (op === "-" && b > a) [a, b] = [b, a];
          return { t: `${a} ${op} ${b}`, ans: op === "+" ? a + b : op === "-" ? a - b : a * b };
        }
        function next() {
          if (done >= COUNT) {
            const el = api.elapsedSec();
            const acc = ok / COUNT;
            api.finish(Math.round(100 * acc * Math.min(1, TARGET_SEC / el)), `${COUNT}문제 ${el}초 · 정답 ${ok}`);
            return;
          }
          prog.textContent = `${done + 1} / ${COUNT}`;
          const p = problem();
          q.textContent = p.t + " = ?";
          U.renderChoices(area.querySelector("#cm-c"), U.choicesAround(p.ans, 8), v => {
            if (done >= COUNT) return;
            done++;
            if (v === p.ans) { ok++; streak++; fb.textContent = "정답!" + U.comboText(streak); fb.className = "feedback flash-good"; }
            else { streak = 0; fb.textContent = `정답은 ${p.ans}`; fb.className = "feedback flash-bad"; }
            FX.flash(v === p.ans);
            next();
          });
        }
        next();
        api.onTimeUp(() => {});
      }
    };
  }
  window.GAME_CALC25 = calcMarathon("calc25", "계산 25", "⚡", 25, 50);
  window.GAME_CALC100 = calcMarathon("calc100", "계산 100", "💯", 100, 210);

  // ---------- 연속 뺄셈 (serial subtraction — 신경심리 표준 과제) ----------
  window.GAME_SERIAL = {
    id: "serial", name: "연속 뺄셈", icon: "➖", mode: "count", check: true,
    intro: "시작 숫자에서 같은 수를\n계속 빼 나가세요.",
    start(area, level, api) {
      const SUB = [3, 7, 9, 13, 17][level - 1] || 7;
      const STEPS = 8;
      let cur = U.rand(90, 120), step = 0, ok = 0;
      area.innerHTML = `
        <div class="inst" id="se-inst"></div>
        <div class="problem" id="se-q"></div>
        <div class="feedback" id="se-fb"></div>
        <div class="choices" id="se-c"></div>`;
      area.querySelector("#se-inst").textContent = `${SUB}씩 빼기 (${STEPS}번)`;
      const q = area.querySelector("#se-q");
      const fb = area.querySelector("#se-fb");

      function next() {
        if (step >= STEPS) {
          const el = api.elapsedSec();
          api.finish(Math.round(100 * (ok / STEPS) * Math.min(1, 30 / el)), `${ok}/${STEPS} 정답 · ${el}초`);
          return;
        }
        const ans = cur - SUB;
        q.textContent = `${cur} − ${SUB} = ?`;
        U.renderChoices(area.querySelector("#se-c"), U.choicesAround(ans, 6), v => {
          if (step >= STEPS) return;
          step++;
          const good = v === ans;
          if (good) { ok++; fb.textContent = "정답!"; fb.className = "feedback flash-good"; }
          else { fb.textContent = `정답은 ${ans}`; fb.className = "feedback flash-bad"; }
          FX.flash(good);
          cur = ans; // 오답이어도 정답 기준으로 이어감
          next();
        });
      }
      next();
      api.onTimeUp(() => {});
    }
  };

  // ---------- 최고 숫자 (잠깐 보이는 숫자 중 가장 큰 것 — 순간 판단+기억) ----------
  window.GAME_HIGHEST = {
    id: "highest", name: "최고 숫자", icon: "🔝", mode: "count", check: true,
    intro: "숫자들이 잠깐 보였다 숨어요.\n가장 큰 숫자 자리를 누르세요.",
    start(area, level, api) {
      const ROUNDS = 8, N = Math.min(6, 3 + level);
      const SHOW = Math.max(500, 1100 - level * 100);
      let r = 0, ok = 0;
      area.innerHTML = `<div class="feedback" id="hi-fb"></div><div class="board short" id="hi-board"></div>`;
      const board = area.querySelector("#hi-board");
      const fb = area.querySelector("#hi-fb");

      function round() {
        if (r >= ROUNDS) {
          const el = api.elapsedSec();
          api.finish(Math.round(100 * (ok / ROUNDS) * Math.min(1, 35 / el)), `${ok}/${ROUNDS} 정답 · ${el}초`);
          return;
        }
        r++;
        fb.textContent = `${r} / ${ROUNDS}`;
        fb.className = "feedback";
        const nums = [];
        while (nums.length < N) { const v = U.rand(10, 99); if (!nums.includes(v)) nums.push(v); }
        const max = Math.max(...nums);
        board.innerHTML = "";
        const W = board.clientWidth - 80, H = board.clientHeight - 80;
        const placed = [];
        const tiles = nums.map(n => {
          let x, y, t = 0;
          do { x = Math.random() * W; y = Math.random() * H; t++; }
          while (t < 200 && placed.some(p => Math.hypot(p.x - x, p.y - y) < 92));
          placed.push({ x, y });
          const b = document.createElement("button");
          b.className = "tile";
          b.style.left = x + "px"; b.style.top = y + "px";
          b.textContent = n;
          board.appendChild(b);
          return b;
        });
        let armed = false;
        setTimeout(() => { tiles.forEach(t => { t.classList.add("hidden-num"); }); armed = true; }, SHOW);
        tiles.forEach(t => {
          t.onclick = () => {
            if (!armed) return;
            armed = false;
            const good = Number(t.textContent) === max;
            if (good) ok++;
            t.classList.remove("hidden-num");
            if (!good) t.classList.add("wrong");
            fb.textContent = good ? "정답!" : `가장 큰 수는 ${max}`;
            fb.className = "feedback " + (good ? "flash-good" : "flash-bad");
            FX.flash(good);
            setTimeout(round, 800);
          };
        });
      }
      round();
      api.onTimeUp(() => {});
    }
  };

  // ---------- 고속 세기 (좌우 번갈아 최대한 빨리 40까지 — 처리속도) ----------
  window.GAME_SPEEDCOUNT = {
    id: "speedcount", name: "고속 세기", icon: "🐑", mode: "count", check: true,
    intro: "왼쪽·오른쪽 버튼을 번갈아 누르며\n40까지 최대한 빨리 세요!",
    start(area, level, api) {
      const GOAL = 40;
      let n = 0, next = 0; // next: 0=왼쪽 차례
      area.innerHTML = `
        <div class="problem" id="sc-n">0</div>
        <div class="feedback" id="sc-fb">왼쪽부터!</div>
        <div class="choices" id="sc-c"></div>`;
      const num = area.querySelector("#sc-n");
      const fb = area.querySelector("#sc-fb");
      const c = area.querySelector("#sc-c");
      ["👈 왼손", "👉 오른손"].forEach((label, i) => {
        const b = document.createElement("button");
        b.className = "choice-btn";
        b.style.minHeight = "120px";
        b.textContent = label;
        b.onclick = () => {
          if (i !== next) { fb.textContent = "번갈아서!"; fb.className = "feedback flash-bad"; return; }
          n++; next = 1 - next;
          num.textContent = n;
          fb.textContent = ""; fb.className = "feedback";
          if (n >= GOAL) {
            const el = api.elapsedSec();
            api.finish(Math.min(100, Math.round(100 * 14 / el)), `40까지 ${el}초`);
          }
        };
        c.appendChild(b);
      });
      api.onTimeUp(() => {});
    }
  };
})();
