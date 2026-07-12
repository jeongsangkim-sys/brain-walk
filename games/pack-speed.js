// 순발력·계산 계열 게임 팩
// 공통: U = BW_UTIL, 시간제 게임은 api.onTimeUp에서 점수 계산,
// 분량제(mode:"count") 게임은 스스로 api.finish 호출.
(function () {
  const U = window.BW_UTIL;

  // ---------- 가위바위보 (지시 따라 이기기/지기/비기기 — 억제력) ----------
  window.GAME_RPS = {
    id: "rps", name: "가위바위보", icon: "✌️", sec: 25,
    intro: "상대 손을 보고 지시대로!\n\"이기세요\"면 이기는 손을 고르세요.",
    start(area, level, api) {
      const BEATS = { 0: 1, 1: 2, 2: 0 };            // 바위0>가위1>보2>바위0
      let ok = 0, bad = 0, streak = 0;
      const TARGET = U.targetFor("rps", 12, 30);
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
        // 인-세션 램프: 정답 6개 넘으면 저레벨에도 '비기기' 등장
        const modes = (level <= 2 && ok < 6) ? ["win", "lose"] : ["win", "lose", "draw"];
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
        U.markBtn(cWrap.children[p], good);
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
    id: "flags", name: "깃발 들기", icon: "🚩", sec: 25,
    intro: "지시대로 깃발을 드세요.\n\"아니야!\"가 붙으면 반대 깃발!",
    start(area, level, api) {
      let ok = 0, bad = 0, streak = 0;
      const TARGET = U.targetFor("flags", 12, 30);
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
        // 인-세션 램프: 정답 쌓일수록 '아니야!' 비율 상승 (1레벨도 5정답부터 등장)
        const negP = Math.min(0.65, (level >= 2 ? 0.2 + level * 0.1 : 0) + (ok >= 5 ? 0.15 + ok * 0.02 : 0));
        const neg = Math.random() < negP;
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
          U.markBtn(b, good);
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
            api.finish(Math.round(100 * acc * Math.min(1, TARGET_SEC / el)),
              `${COUNT}문제 ${el}초 · 정답 ${ok} · ${U.speedGrade(TARGET_SEC / el)}`);
            return;
          }
          prog.textContent = `${done + 1} / ${COUNT}`;
          const p = problem();
          q.textContent = p.t + " = ?";
          U.renderChoices(area.querySelector("#cm-c"), U.choicesAround(p.ans, 8), (v, btn) => {
            if (done >= COUNT) return;
            done++;
            const good = v === p.ans;
            U.markBtn(btn, good);
            if (good) { ok++; streak++; fb.textContent = "정답!" + U.comboText(streak); fb.className = "feedback flash-good"; }
            else { streak = 0; fb.textContent = `정답은 ${p.ans}`; fb.className = "feedback flash-bad"; }
            FX.flash(good);
            next();
          });
        }
        next();
        api.onTimeUp(() => {});
      }
    };
  }
  window.GAME_CALC25 = calcMarathon("calc25", "계산 25", "⚡", 25, 50);
  window.GAME_CALC100 = calcMarathon("calc100", "계산 50", "💯", 50, 105); // 100은 웹+시니어에 과함 → 50 (id는 기록 연속성 위해 유지)

  // ---------- 부호 찾기 (a ? b = c 에서 +−× 고르기 — 역산 추론) ----------
  window.GAME_SIGN = {
    id: "sign", name: "부호 찾기", icon: "❔", sec: 25,
    intro: "빈칸에 들어갈 부호를 고르세요.\n7 ❔ 3 = 21 이면 ×!",
    start(area, level, api) {
      const OPS = [["+", (a, b) => a + b], ["−", (a, b) => a - b], ["×", (a, b) => a * b]];
      let ok = 0, bad = 0, streak = 0;
      const TARGET = U.targetFor("sign", 9, 30);
      area.innerHTML = `
        <div class="problem" id="sg-q"></div>
        <div class="feedback" id="sg-fb"></div>
        <div class="choices three" id="sg-c"></div>`;
      const q = area.querySelector("#sg-q");
      const fb = area.querySelector("#sg-fb");
      let answer = 0;

      function next() {
        // 정답 부호가 유일해질 때까지 생성 (예: 2+2=2×2 모호성 배제)
        for (let guard = 0; guard < 50; guard++) {
          const lv = level + Math.floor(ok / 4); // 인-세션 램프
          const hi = lv <= 2 ? 9 : lv <= 5 ? 12 : 19;
          const a = U.rand(2, hi), b = U.rand(2, Math.min(9, hi));
          const pick = U.rand(0, 2);
          const c = OPS[pick][1](a, b);
          if (c < 0) continue;
          const matches = OPS.filter(([, f]) => f(a, b) === c).length;
          if (matches !== 1) continue;
          answer = pick;
          q.innerHTML = `${a} <span style="color:var(--aia-red)">❔</span> ${b} = ${c}`;
          return;
        }
        q.textContent = "3 ❔ 3 = 9"; answer = 2; // 폴백
      }
      const c = area.querySelector("#sg-c");
      c.innerHTML = "";
      OPS.forEach(([sym], i) => {
        const b = document.createElement("button");
        b.className = "choice-btn";
        b.textContent = sym;
        b.onclick = () => {
          const good = i === answer;
          U.markBtn(b, good);
          if (good) { ok++; streak++; fb.textContent = "정답!" + U.comboText(streak); fb.className = "feedback flash-good"; }
          else { bad++; streak = 0; fb.textContent = `정답은 ${OPS[answer][0]}`; fb.className = "feedback flash-bad"; }
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

  // ---------- 연속 뺄셈 (serial subtraction — 신경심리 표준 과제) ----------
  window.GAME_SERIAL = {
    id: "serial", name: "연속 뺄셈", icon: "➖", mode: "count", check: true,
    intro: "시작 숫자에서 같은 수를\n계속 빼 나가세요.",
    start(area, level, api) {
      const SUB = [3, 7, 9, 13, 17, 19, 23, 27, 33][level - 1] || 7;
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
          api.finish(Math.round(100 * (ok / STEPS) * Math.min(1, 30 / el)),
            `${ok}/${STEPS} 정답 · ${el}초 · ${U.speedGrade(30 / el)}`);
          return;
        }
        const ans = cur - SUB;
        q.textContent = `${cur} − ${SUB} = ?`;
        U.renderChoices(area.querySelector("#se-c"), U.choicesAround(ans, 6), (v, btn) => {
          if (step >= STEPS) return;
          step++;
          const good = v === ans;
          U.markBtn(btn, good);
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
      const ROUNDS = 8;
      // 인-세션 램프: 맞출수록 숫자 개수↑·노출시간↓
      const N_ = () => Math.min(6, 3 + level + Math.floor(ok / 3));
      const SHOW_ = () => Math.max(450, 1100 - level * 100 - ok * 60);
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
        const N = N_();
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
        setTimeout(() => { tiles.forEach(t => { t.classList.add("hidden-num"); }); armed = true; }, SHOW_());
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
            setTimeout(round, 500);
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
            api.finish(Math.min(100, Math.round(100 * 14 / el)), `40까지 ${el}초 · ${U.speedGrade(14 / el)}`);
          }
        };
        c.appendChild(b);
      });
      api.onTimeUp(() => {});
    }
  };
})();
