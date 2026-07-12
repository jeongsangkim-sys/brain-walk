// 점 잇기 — 같은 색 점 두 개를 겹치지 않는 길로 연결 (넘버링크 계열 공개 퍼즐 장르)
// 퍼즐 생성은 역산: 격자를 뱀길 K개로 완전 분할 → 각 길의 양끝을 점으로. 항상 풀 수 있음.
(function () {
  const U = window.BW_UTIL;
  const COLORS = ["#E8722C", "#3A6EA5", "#3E8E5A", "#D9A422", "#8A6BBC", "#C94F4F", "#2AA8A0", "#B5651D", "#D96C9C", "#5C6B2F", "#7A7A7A", "#274B8F"];

  // 격자(N×N)를 길이 3+ 뱀길 pairs개로 분할 (실패 시 재시도)
  function carve(N, pairs) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const owner = new Array(N * N).fill(-1);
      const paths = [];
      const nbr = i => {
        const r = Math.floor(i / N), c = i % N, out = [];
        if (r > 0) out.push(i - N);
        if (r < N - 1) out.push(i + N);
        if (c > 0) out.push(i - 1);
        if (c < N - 1) out.push(i + 1);
        return out;
      };
      let free = N * N;
      let ok = true;
      for (let p = 0; p < pairs; p++) {
        // 남은 칸 중 시작점: 마지막 길은 남은 전부를 써야 함
        const starts = owner.map((o, i) => o < 0 ? i : -1).filter(i => i >= 0);
        if (!starts.length) { ok = false; break; }
        let cur = starts[U.rand(0, starts.length - 1)];
        const path = [cur];
        owner[cur] = p;
        const targetLen = p === pairs - 1 ? free : Math.max(3, Math.round(free / (pairs - p)) + U.rand(-1, 1));
        while (path.length < targetLen) {
          const nx = nbr(cur).filter(j => owner[j] < 0);
          if (!nx.length) break;
          cur = nx[U.rand(0, nx.length - 1)];
          owner[cur] = p;
          path.push(cur);
        }
        if (path.length < 3) { ok = false; break; }
        free -= path.length;
        paths.push(path);
      }
      if (ok && free === 0) return paths;
    }
    return null;
  }

  window.GAME_FLOW = {
    id: "flow", name: "점 잇기", icon: "🔀", mode: "count",
    intro: "같은 색 점끼리 길을 그어 이으세요.\n길은 서로 겹칠 수 없어요!",
    start(area, level, api) {
      // 캠페인 모드: 레벨 1~1000 곡선 (한 판) / 일반: 빠른 2판
      const camp = window.BW_CAMPAIGN && window.BW_CAMPAIGN.id === "flow" ? window.BW_CAMPAIGN.level : 0;
      const N = camp ? Math.min(9, 5 + Math.floor((camp - 1) / 60)) : (level <= 3 ? 5 : level <= 6 ? 6 : 7);
      const PAIRS = camp ? Math.min(N + 3, 12, 4 + Math.floor((camp - 1) / 25)) : (level <= 3 ? 4 : level <= 6 ? 5 : 6);
      const BOARDS = camp ? 1 : 2;
      let board = 0, resets = 0, alive = true;

      area.innerHTML = `
        <div class="feedback" id="fw-fb">점을 누른 채 끌어서 이으세요</div>
        <div class="inst" id="fw-prog"></div>
        <div class="flow-grid" id="fw"></div>`;
      const fb = area.querySelector("#fw-fb");
      const prog = area.querySelector("#fw-prog");
      const grid = area.querySelector("#fw");

      let sol, endsOf, paths, cells, active = null;

      function newBoard() {
        if (!alive) return;
        board++;
        prog.textContent = camp ? `레벨 ${camp}` : `판 ${board} / ${BOARDS}`;
        sol = carve(N, PAIRS);
        if (!sol) { api.finish(0, "퍼즐 생성 실패"); return; } // 사실상 도달 불가
        window.__flowSol = sol; // 시뮬 하네스 훅
        endsOf = sol.map(p => [p[0], p[p.length - 1]]);
        paths = COLORS.slice(0, PAIRS).map(() => []);
        grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
        grid.innerHTML = "";
        cells = [];
        for (let i = 0; i < N * N; i++) {
          const d = document.createElement("div");
          d.className = "fcell";
          d.dataset.i = i;
          const dot = endsOf.findIndex(e => e.includes(i));
          if (dot >= 0) {
            d.innerHTML = `<i class="fdot" style="background:${COLORS[dot]}"></i>`;
            d.dataset.dot = dot;
          }
          grid.appendChild(d);
          cells.push(d);
        }
        paint();
      }

      const ownerOf = i => paths.findIndex(p => p.includes(+i));
      function paint() {
        cells.forEach((d, i) => {
          const o = ownerOf(i);
          d.style.background = o >= 0 ? COLORS[o] + "55" : "";
          d.classList.toggle("fon", o >= 0);
        });
      }
      const adjacent = (a, b) => {
        const ra = Math.floor(a / N), ca = a % N, rb = Math.floor(b / N), cb = b % N;
        return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
      };
      function connected(c) {
        const p = paths[c];
        return p.length > 1 && endsOf[c].every(e => p.includes(e));
      }
      function tryExtend(i) {
        if (active == null) return;
        const p = paths[active];
        const last = p[p.length - 1];
        if (i === last) return;
        const back = p.indexOf(i);
        if (back >= 0) { p.length = back + 1; paint(); return; } // 자기 길 위로 되돌아가면 잘라냄
        if (!adjacent(last, i)) return;
        const o = ownerOf(i);
        if (o >= 0 && o !== active) return; // 남의 길 차단
        const dot = cells[i].dataset.dot;
        if (dot != null && +dot !== active) return; // 남의 점 차단
        if (connected(active)) return; // 이미 완성된 길은 연장 금지
        p.push(i);
        paint();
        if (connected(active)) {
          FX.flash(true);
          fb.textContent = "연결!"; fb.className = "feedback flash-good";
          if (paths.every((_, c) => connected(c))) {
            if (board >= BOARDS) {
              alive = false;
              const el = api.elapsedSec();
              const target = BOARDS * (N * N * 1.2); // 여유 기준
              api.finish(Math.round(100 * Math.min(1, target / el) * Math.max(0.5, 1 - resets * 0.05)),
                (camp ? `레벨 ${camp} 클리어! · ` : `${BOARDS}판 · `) + `${Math.round(el)}초 · 다시 그림 ${resets}`);
            } else {
              fb.textContent = "완성! 다음 판이에요";
              setTimeout(newBoard, 600);
            }
          }
        }
      }
      // 입력: 점(또는 자기 길)에서 시작해 끌기
      grid.addEventListener("pointerdown", e => {
        const cell = e.target.closest(".fcell");
        if (!cell) return;
        e.preventDefault();
        const i = +cell.dataset.i;
        const dot = cell.dataset.dot;
        const o = ownerOf(i);
        if (dot != null) {
          active = +dot;
          if (connected(active) || !paths[active].includes(i)) {
            if (paths[active].length) resets++;
            paths[active] = [i]; // 점에서 새로 시작 (기존 길 리셋)
          }
        } else if (o >= 0) {
          active = o;
          paths[o].length = paths[o].indexOf(i) + 1; // 길 중간을 잡으면 거기까지 자름
        } else return;
        paint();
      });
      grid.addEventListener("pointermove", e => {
        if (active == null) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const cell = el && el.closest(".fcell");
        if (cell) tryExtend(+cell.dataset.i);
      });
      const up = () => { active = null; };
      grid.addEventListener("pointerup", up);
      grid.addEventListener("pointercancel", up);

      // 시뮬 하네스용: 해답 즉시 채우기
      window.__flowSolve = () => {
        sol.forEach((p, c) => {
          active = c;
          paths[c] = [p[0]];
          p.slice(1).forEach(i => tryExtend(i));
        });
        active = null;
      };
      newBoard();
      api.onTimeUp(() => {});
    }
  };
})();
