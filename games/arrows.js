// 화살표 탈출 — 화살표를 탭하면 가리키는 방향으로 날아감. 길에 다른 화살표가 있으면 막힘.
// 전부 내보내면 클리어 (언블록 계열 공개 퍼즐 장르). 생성은 역산: 제거 역순으로 삽입 = 항상 풀이 존재.
(function () {
  const U = window.BW_UTIL;
  const DIRS = [[0, -1, "↑"], [0, 1, "↓"], [-1, 0, "←"], [1, 0, "→"]]; // dx, dy, 표기

  // 역산 생성: 새 화살표는 삽입 시점의 보드에서 탈출로가 뚫려 있어야 함
  // → 제거는 삽입의 정확한 역순으로 가능 (풀이 보장)
  function build(N, count) {
    const grid = new Array(N * N).fill(null); // null | {d}
    const cells = [];
    for (let k = 0; k < count; k++) {
      // 후보: 빈 칸 × 방향 중 탈출로가 비어있는 조합
      const options = [];
      for (let i = 0; i < N * N; i++) {
        if (grid[i]) continue;
        const r = Math.floor(i / N), c = i % N;
        for (let d = 0; d < 4; d++) {
          const [dx, dy] = DIRS[d];
          let x = c + dx, y = r + dy, clear = true;
          while (x >= 0 && x < N && y >= 0 && y < N) {
            if (grid[y * N + x]) { clear = false; break; }
            x += dx; y += dy;
          }
          if (clear) options.push([i, d]);
        }
      }
      if (!options.length) break;
      const [i, d] = options[U.rand(0, options.length - 1)];
      grid[i] = { d };
      cells.push(i);
    }
    return grid;
  }

  window.GAME_ARROWS = {
    id: "arrows", name: "화살표 탈출", icon: "➡️", mode: "count",
    intro: "화살표를 눌러 그 방향으로 내보내세요.\n길에 다른 화살표가 있으면 못 나가요!",
    start(area, level, api) {
      // 캠페인 모드: 레벨 1~1000 곡선 (한 판, 밀도 점증) / 일반: 빠른 2판
      const camp = window.BW_CAMPAIGN && window.BW_CAMPAIGN.id === "arrows" ? window.BW_CAMPAIGN.level : 0;
      const N = camp ? Math.min(9, 5 + Math.floor((camp - 1) / 70)) : (level <= 3 ? 5 : level <= 6 ? 6 : 7);
      const COUNT = camp ? Math.min(N * N - 4, 10 + Math.floor((camp - 1) / 6)) : (level <= 3 ? 10 : level <= 6 ? 15 : 20);
      const BOARDS = camp ? 1 : 2;
      let board = 0, blocked = 0, cleared = 0, alive = true;

      area.innerHTML = `
        <div class="feedback" id="ar-fb">막힌 화살표는 나중에!</div>
        <div class="inst" id="ar-prog"></div>
        <div class="arrows-grid" id="ar"></div>`;
      const fb = area.querySelector("#ar-fb");
      const prog = area.querySelector("#ar-prog");
      const wrap = area.querySelector("#ar");

      let grid, remain;

      function newBoard() {
        if (!alive) return;
        board++;
        grid = build(N, COUNT);
        remain = grid.filter(Boolean).length;
        window.__arrowsGrid = { grid, N }; // 시뮬 하네스 훅
        wrap.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
        wrap.innerHTML = "";
        for (let i = 0; i < N * N; i++) {
          const b = document.createElement("button");
          b.className = "acell";
          b.dataset.i = i;
          if (grid[i]) {
            b.textContent = DIRS[grid[i].d][2];
            b.classList.add("live");
          } else b.disabled = true;
          b.onclick = () => tap(i, b);
          wrap.appendChild(b);
        }
        upd();
      }
      const upd = () => prog.textContent = (camp ? `레벨 ${camp}` : `판 ${board}/${BOARDS}`) + ` · 남은 화살표 ${remain}`;

      function pathClear(i) {
        const a = grid[i];
        const [dx, dy] = DIRS[a.d];
        const N_ = N;
        let x = i % N_ + dx, y = Math.floor(i / N_) + dy;
        while (x >= 0 && x < N_ && y >= 0 && y < N_) {
          if (grid[y * N_ + x]) return false;
          x += dx; y += dy;
        }
        return true;
      }

      function tap(i, btn) {
        if (!alive || !grid[i]) return;
        if (pathClear(i)) {
          cleared++;
          remain--;
          // 날아가는 연출: 방향으로 슬라이드 후 소멸
          const [dx, dy] = DIRS[grid[i].d];
          btn.style.transition = "transform 0.25s ease-in, opacity 0.25s";
          btn.style.transform = `translate(${dx * 60}px, ${dy * 60}px)`;
          btn.style.opacity = "0";
          grid[i] = null;
          setTimeout(() => { btn.textContent = ""; btn.disabled = true; btn.classList.remove("live"); btn.style.cssText = ""; }, 260);
          FX.flash(true);
          upd();
          if (remain <= 0) {
            if (board >= BOARDS) {
              alive = false;
              const el = api.elapsedSec();
              const target = BOARDS * COUNT * 1.6;
              api.finish(Math.round(100 * Math.min(1, target / el) * Math.max(0.5, 1 - blocked * 0.04)),
                (camp ? `레벨 ${camp} 클리어! · ` : `${BOARDS}판 · `) + `${Math.round(el)}초 · 막힘 ${blocked}`);
            } else {
              fb.textContent = "탈출 완료! 다음 판이에요";
              fb.className = "feedback flash-good";
              setTimeout(newBoard, 650);
            }
          }
        } else {
          blocked++;
          btn.classList.remove("ashake"); void btn.offsetWidth; btn.classList.add("ashake");
          fb.textContent = "막혔어요! 앞의 화살표부터";
          fb.className = "feedback flash-bad";
          FX.flash(false);
          upd();
        }
      }

      // 시뮬 하네스용: 뚫린 화살표를 반복 제거
      window.__arrowsSolve = () => {
        for (let guard = 0; guard < N * N * 4; guard++) {
          const idx = grid.findIndex((a, i) => a && pathClear(i));
          if (idx < 0) break;
          tap(idx, wrap.children[idx]);
        }
      };
      newBoard();
      api.onTimeUp(() => {});
    }
  };
})();
