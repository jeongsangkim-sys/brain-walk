// 미니 스도쿠 4×4 — 논리 퍼즐 (분량제: 다 채우면 끝)
(function () {
  const U = window.BW_UTIL;

  window.GAME_SUDOKU = {
    id: "sudoku", name: "미니 스도쿠", icon: "🔢", mode: "count",
    intro: "가로·세로·2×2 칸에\n1~4가 한 번씩만 들어가요.",
    start(area, level, api) {
      // 기본 해답 생성: 밴드/열 섞기 + 숫자 치환
      const base = [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1]
      ];
      const digits = U.shuffle([1, 2, 3, 4]);
      let sol = base.map(row => row.map(v => digits[v - 1]));
      if (Math.random() < 0.5) sol = sol.map(r => [...r].reverse());
      if (Math.random() < 0.5) sol = [...sol].reverse();
      // 행 교환(같은 밴드 내), 열 교환(같은 스택 내)
      if (Math.random() < 0.5) [sol[0], sol[1]] = [sol[1], sol[0]];
      if (Math.random() < 0.5) [sol[2], sol[3]] = [sol[3], sol[2]];
      if (Math.random() < 0.5) sol = sol.map(r => [r[1], r[0], r[2], r[3]]);
      if (Math.random() < 0.5) sol = sol.map(r => [r[0], r[1], r[3], r[2]]);

      const HOLES = Math.min(12, 6 + level);
      const holes = new Set();
      while (holes.size < HOLES) holes.add(U.rand(0, 15));

      let filled = 0, mistakes = 0, selected = null;
      area.innerHTML = `
        <div class="feedback" id="su-fb">빈칸을 고른 뒤 숫자를 누르세요</div>
        <div class="sudoku" id="su"></div>
        <div class="choices" id="su-pad" style="max-width:360px"></div>`;
      const grid = area.querySelector("#su");
      const fb = area.querySelector("#su-fb");

      const cells = [];
      for (let i = 0; i < 16; i++) {
        const r = Math.floor(i / 4), c = i % 4;
        const el = document.createElement("button");
        el.className = "sucell" +
          ((c === 1) ? " br" : "") + ((r === 1) ? " bb" : "");
        if (holes.has(i)) {
          el.classList.add("hole");
          el.onclick = () => {
            if (el.classList.contains("fixed")) return;
            cells.forEach(x => x.classList.remove("sel"));
            el.classList.add("sel");
            selected = { el, ans: sol[r][c] };
          };
        } else {
          el.textContent = sol[r][c];
          el.classList.add("fixed");
        }
        grid.appendChild(el);
        cells.push(el);
      }

      const pad = area.querySelector("#su-pad");
      [1, 2, 3, 4].forEach(n => {
        const b = document.createElement("button");
        b.className = "choice-btn";
        b.textContent = n;
        b.onclick = () => {
          if (!selected) { fb.textContent = "먼저 빈칸을 고르세요"; return; }
          if (n === selected.ans) {
            selected.el.textContent = n;
            selected.el.classList.remove("sel", "hole");
            selected.el.classList.add("fixed", "solved");
            selected = null;
            filled++;
            fb.textContent = "좋아요!"; fb.className = "feedback flash-good";
            FX.flash(true);
            if (filled >= HOLES) {
              const el2 = api.elapsedSec();
              const score = Math.round(Math.max(0, 1 - mistakes * 0.08) * Math.min(1, (30 + HOLES * 6) / el2) * 100);
              api.finish(score, `${el2}초 · 실수 ${mistakes}`);
            }
          } else {
            mistakes++;
            fb.textContent = "거기엔 안 들어가요!"; fb.className = "feedback flash-bad";
            FX.flash(false);
          }
        };
        pad.appendChild(b);
      });
      api.onTimeUp(() => {});
    }
  };
})();
