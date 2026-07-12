// 스도쿠 9×9 — 체류시간 킬러 콘텐츠 (분량제: 다 채우면 끝)
// 정답과 다른 숫자는 즉시 반려하는 아케이드식 — 유일해 검사 불필요
(function () {
  const U = window.BW_UTIL;

  window.GAME_SUDOKU = {
    id: "sudoku", name: "스도쿠", icon: "🔢", mode: "count",
    intro: "가로·세로·3×3 상자에\n1~9가 한 번씩만 들어가요.\n천천히, 끝까지!",
    start(area, level, api) {
      // 해답 생성: 표준 패턴 + 밴드/행/열/숫자 셔플
      const pattern = (r, c) => (3 * (r % 3) + Math.floor(r / 3) + c) % 9;
      const digits = U.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const shuffleBand = () => {
        const bands = U.shuffle([0, 1, 2]);
        return bands.flatMap(b => U.shuffle([0, 1, 2]).map(i => b * 3 + i));
      };
      const rows = shuffleBand(), cols = shuffleBand();
      const sol = rows.map(r => cols.map(c => digits[pattern(r, c)]));
      window.__sudokuSol = sol; // 디버그/검증 훅

      // 전용 모드에서 난이도 지정 시 우선, 아니면 레벨 기반 (L1=29 ~ L8+=50)
      const HOLES = window.BW_SUDOKU_DIFF || Math.min(50, 26 + level * 3);
      window.BW_SUDOKU_DIFF = 0;
      const holes = new Set();
      while (holes.size < HOLES) holes.add(U.rand(0, 80));

      let filled = 0, mistakes = 0, selected = null;
      area.innerHTML = `
        <div class="feedback" id="su-fb">빈칸을 고른 뒤 숫자를 누르세요</div>
        <div class="inst" id="su-prog"></div>
        <div class="sudoku9" id="su"></div>
        <div class="su-pad" id="su-pad"></div>`;
      const grid = area.querySelector("#su");
      const fb = area.querySelector("#su-fb");
      const prog = area.querySelector("#su-prog");
      const updateProg = () => prog.textContent = `남은 칸 ${HOLES - filled}`;
      updateProg();

      const cells = [];
      for (let i = 0; i < 81; i++) {
        const r = Math.floor(i / 9), c = i % 9;
        const el = document.createElement("button");
        el.className = "sucell" +
          ((c % 3 === 2 && c !== 8) ? " br" : "") +
          ((r % 3 === 2 && r !== 8) ? " bb" : "");
        if (holes.has(i)) {
          el.classList.add("hole");
          el.onclick = () => {
            if (!el.classList.contains("hole")) return;
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
      for (let n = 1; n <= 9; n++) {
        const b = document.createElement("button");
        b.className = "choice-btn su-key";
        b.textContent = n;
        b.onclick = () => {
          if (!selected) { fb.textContent = "먼저 빈칸을 고르세요"; fb.className = "feedback"; return; }
          if (n === selected.ans) {
            selected.el.textContent = n;
            selected.el.classList.remove("sel", "hole");
            selected.el.classList.add("fixed", "solved");
            selected = null;
            filled++;
            updateProg();
            fb.textContent = "좋아요!"; fb.className = "feedback flash-good";
            FX.flash(true);
            if (filled >= HOLES) {
              const el2 = api.elapsedSec();
              const target = 240 + HOLES * 6; // 여유 기준
              const score = Math.round(Math.max(0, 1 - mistakes * 0.04) * Math.min(1, target / el2) * 100);
              api.finish(score, `${HOLES}칸 ${Math.round(el2)}초 · 실수 ${mistakes}`);
            }
          } else {
            mistakes++;
            fb.textContent = "거기엔 안 들어가요!"; fb.className = "feedback flash-bad";
            FX.flash(false);
          }
        };
        pad.appendChild(b);
      }
      api.onTimeUp(() => {});
    }
  };
})();
