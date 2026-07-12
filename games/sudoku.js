// 스도쿠 9×9 — 체류시간 킬러 콘텐츠 (분량제: 다 채우면 끝)
// 인기 스도쿠 앱 표준: 하트 3개(실수 3번 끝) + 행/열/박스·같은숫자 하이라이트 + 숫자별 남은 개수
// 하트 시스템이 "빈칸 찍고 1~9 연타" 무지성 공략을 원천 봉쇄한다.
(function () {
  const U = window.BW_UTIL;

  window.GAME_SUDOKU = {
    id: "sudoku", name: "스도쿠", icon: "🔢", mode: "count",
    intro: "가로·세로·3×3 상자에\n1~9가 한 번씩만!\n❤️ 3개 — 실수 3번이면 끝이에요.",
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

      const LIVES = 3;
      let filled = 0, mistakes = 0, selected = null, over = false;
      area.innerHTML = `
        <div class="feedback" id="su-fb">빈칸을 고른 뒤 숫자를 누르세요</div>
        <div class="inst" id="su-prog"></div>
        <div class="sudoku9" id="su"></div>
        <div class="su-pad" id="su-pad"></div>`;
      const grid = area.querySelector("#su");
      const fb = area.querySelector("#su-fb");
      const prog = area.querySelector("#su-prog");
      const updateProg = () =>
        prog.textContent = `${"❤️".repeat(LIVES - mistakes)}${"🖤".repeat(mistakes)}  ·  남은 칸 ${HOLES - filled}`;
      updateProg();

      const cells = []; // {el, r, c, val(현재 표시값 또는 0)}
      const cellAt = i => cells[i];

      // 하이라이트: 선택 셀의 행/열/박스 + 보드 위 같은 숫자
      function highlight() {
        cells.forEach(x => x.el.classList.remove("hl", "same"));
        if (!selected) return;
        const { r, c } = selected;
        const bx = Math.floor(c / 3) * 3, by = Math.floor(r / 3) * 3;
        cells.forEach(x => {
          if (x.r === r || x.c === c || (x.r >= by && x.r < by + 3 && x.c >= bx && x.c < bx + 3))
            x.el.classList.add("hl");
        });
        const v = selected.val;
        if (v) cells.forEach(x => { if (x.val === v) x.el.classList.add("same"); });
      }

      for (let i = 0; i < 81; i++) {
        const r = Math.floor(i / 9), c = i % 9;
        const el = document.createElement("button");
        el.className = "sucell" +
          ((c % 3 === 2 && c !== 8) ? " br" : "") +
          ((r % 3 === 2 && r !== 8) ? " bb" : "");
        const cell = { el, r, c, val: holes.has(i) ? 0 : sol[r][c] };
        if (holes.has(i)) {
          el.classList.add("hole");
        } else {
          el.textContent = sol[r][c];
          el.classList.add("fixed");
        }
        // 채워진 칸도 탭 가능 — 같은 숫자 하이라이트용 (인기 앱 표준)
        el.onclick = () => {
          if (over) return;
          cells.forEach(x => x.el.classList.remove("sel"));
          el.classList.add("sel");
          selected = cell;
          highlight();
        };
        grid.appendChild(el);
        cells.push(cell);
      }

      // 숫자 패드: 남은 개수 표시, 9개 다 배치된 숫자는 비활성
      const pad = area.querySelector("#su-pad");
      const keys = [];
      const countOf = n => cells.filter(x => x.val === n).length;
      function refreshPad() {
        keys.forEach(({ b, n }) => {
          const left = 9 - countOf(n);
          b.querySelector("small").textContent = left;
          b.disabled = left <= 0;
        });
      }
      function finish() {
        over = true;
        const el2 = api.elapsedSec();
        const target = 240 + HOLES * 6; // 여유 기준
        const done = filled >= HOLES;
        const score = done
          ? Math.round(Math.max(0, 1 - mistakes * 0.08) * Math.min(1, target / el2) * 100)
          : Math.round(40 * filled / HOLES); // 하트 소진: 진행도 부분 점수
        api.finish(score, done
          ? `${HOLES}칸 ${Math.round(el2)}초 · 실수 ${mistakes}`
          : `❤️ 소진 — ${filled}/${HOLES}칸에서 마감`);
      }
      for (let n = 1; n <= 9; n++) {
        const b = document.createElement("button");
        b.className = "choice-btn su-key";
        b.innerHTML = `${n}<small></small>`;
        b.onclick = () => {
          if (over) return;
          if (!selected || selected.val) { fb.textContent = "먼저 빈칸을 고르세요"; fb.className = "feedback"; return; }
          if (n === sol[selected.r][selected.c]) {
            selected.val = n;
            selected.el.textContent = n;
            selected.el.classList.remove("sel", "hole");
            selected.el.classList.add("fixed", "solved");
            filled++;
            updateProg(); refreshPad(); highlight();
            selected = null;
            cells.forEach(x => x.el.classList.remove("sel"));
            fb.textContent = "좋아요!"; fb.className = "feedback flash-good";
            FX.flash(true);
            if (filled >= HOLES) finish();
          } else {
            mistakes++;
            updateProg();
            fb.textContent = mistakes >= LIVES ? "하트를 다 썼어요…" : `거기엔 안 들어가요! (❤️ ${LIVES - mistakes}개 남음)`;
            fb.className = "feedback flash-bad";
            FX.flash(false);
            if (mistakes >= LIVES) finish();
          }
        };
        pad.appendChild(b);
        keys.push({ b, n });
      }
      refreshPad();
      api.onTimeUp(() => {});
    }
  };
})();
