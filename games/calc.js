// 속산 — 사칙연산 4지선다
window.GAME_CALC = {
  id: "calc",
  name: "속산",
  intro: "화면의 계산 문제를 보고\n네 개의 답 중 정답을 고르세요.",

  start(area, level, api) {
    let correct = 0, wrong = 0, streak = 0;
    const TARGET = BW_UTIL.targetFor("calc", 7, 30); // 실측 반응시간 있으면 자동 교정

    const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    // 인-세션 램프: 정답 4개마다 한 단계 어려워짐 (원작 감각)
    const eff = () => Math.min(9, level + Math.floor(correct / 3)); // 원작 감각: 잘하면 빨리 벅차짐

    function makeProblem() {
      let a, b, op;
      const lv = eff();
      if (lv <= 1) { a = rand(1, 9); b = rand(1, 9); op = Math.random() < 0.5 ? "+" : "-"; }
      else if (lv === 2) { a = rand(2, 9); b = rand(2, 9); op = ["+", "-", "×"][rand(0, 2)]; }
      else if (lv === 3) { a = rand(10, 50); b = rand(10, 50); op = Math.random() < 0.5 ? "+" : "-"; }
      else if (lv === 4) { a = rand(10, 99); b = rand(2, 9); op = ["+", "-", "×"][rand(0, 2)]; }
      else if (lv <= 6) { a = rand(11, 99); b = rand(11, 99); op = ["+", "-", "×"][rand(0, 2)]; if (op === "×") b = rand(2, 12); }
      else { a = rand(101, 999); b = rand(11, 99); op = ["+", "-", "×"][rand(0, 2)]; if (op === "×") { a = rand(12, 29); b = rand(11, 19); } }
      // 4레벨부터 나눗셈 섞임 (나누어떨어지게 역산 생성)
      if (lv >= 4 && Math.random() < 0.25) {
        b = rand(2, 9);
        a = b * rand(2, lv >= 7 ? 19 : 9);
        op = "÷";
      }
      if (op === "-" && b > a) [a, b] = [b, a];
      const ans = op === "+" ? a + b : op === "-" ? a - b : op === "÷" ? a / b : a * b;
      return { text: `${a} ${op} ${b} = ?`, ans };
    }

    // 필기 입력 모드 (설정 토글, 태블릿용) — 4지선다 대신 손글씨로 답 쓰기
    let inkMode = false;
    try { inkMode = !!JSON.parse(localStorage.getItem("bw_settings")).ink && !!window.INK; } catch { }

    function judge(good, ans) {
      if (good) { correct++; streak++; elFb().textContent = "정답!" + BW_UTIL.comboText(streak); elFb().className = "feedback flash-good"; }
      else { wrong++; streak = 0; elFb().textContent = `아쉬워요 (정답 ${ans})`; elFb().className = "feedback flash-bad"; }
      FX.flash(good);
    }
    const elFb = () => area.querySelector("#calc-fb");

    let next;
    if (inkMode) {
      area.innerHTML = `
        <div class="problem" id="calc-q"></div>
        <div class="feedback" id="calc-fb"></div>
        <div class="ink-ans" id="calc-ans">&nbsp;</div>
        <div id="calc-pad-wrap"></div>
        <button class="big-btn ghost small" id="calc-del">⌫ 한 글자 지우기</button>`;
      const elQ = area.querySelector("#calc-q");
      const elAns = area.querySelector("#calc-ans");
      let p = null, digits = "";
      const render = () => { elAns.textContent = digits || " "; };
      INK.pad(area.querySelector("#calc-pad-wrap"), d => {
        digits += d;
        render();
        if (digits.length >= String(p.ans).length) { // 자릿수 차면 자동 제출 (원작 방식)
          judge(Number(digits) === p.ans, p.ans);
          next();
        }
      });
      area.querySelector("#calc-del").onclick = () => { digits = digits.slice(0, -1); render(); };
      next = () => { p = makeProblem(); digits = ""; render(); elQ.textContent = p.text; };
    } else {
      area.innerHTML = `
        <div class="problem" id="calc-q"></div>
        <div class="feedback" id="calc-fb"></div>
        <div class="choices" id="calc-choices"></div>`;
      const elQ = area.querySelector("#calc-q");
      const elC = area.querySelector("#calc-choices");
      next = () => {
        const p = makeProblem();
        elQ.textContent = p.text;
        const opts = new Set([p.ans]);
        while (opts.size < 4) {
          const d = p.ans + rand(-10, 10);
          if (d !== p.ans && d >= 0) opts.add(d);
        }
        elC.innerHTML = "";
        [...opts].sort(() => Math.random() - 0.5).forEach(v => {
          const b = document.createElement("button");
          b.className = "choice-btn";
          b.textContent = v;
          b.onclick = () => {
            const good = v === p.ans;
            BW_UTIL.markBtn(b, good);
            judge(good, p.ans);
            next();
          };
          elC.appendChild(b);
        });
      };
    }
    next();

    api.onTimeUp(() => {
      const attempts = correct + wrong;
      const acc = attempts ? correct / attempts : 0;
      const score = Math.round(100 * acc * Math.min(1, attempts / TARGET));
      api.finish(score, `정답 ${correct} · 오답 ${wrong}`);
    });
  }
};
