// 순간 기억 — 숫자 위치를 외운 뒤 작은 수부터 클릭
window.GAME_MEMORY = {
  id: "memory",
  name: "순간 기억",
  intro: "숫자가 잠깐 나타났다가 가려집니다.\n작은 수부터 순서대로 눌러 주세요.",

  start(area, level, api) {
    const N0 = Math.min(9, 3 + level);  // 시작 개수 (보드 한계 9)
    // 인-세션 램프: 2연승마다 외울 개수 +1
    const N_ = () => Math.min(9, N0 + Math.floor(roundWins / 2));
    const SHOW_MS = 1200 + level * 250;
    let good = 0, bad = 0, rounds = 0, roundWins = 0;
    let alive = true;

    area.innerHTML = `<div class="feedback" id="mem-fb"></div><div class="board" id="mem-board"></div>`;
    const board = area.querySelector("#mem-board");
    const fb = area.querySelector("#mem-fb");

    function placeTiles(nums) {
      board.innerHTML = "";
      // 격자 셀 추첨 + 셀 안 지터 — 이전 랜덤 산포는 타일끼리 겹쳐 숫자가 가려지는 버그(폰 실사고)
      const COLS = 4, ROWS = 3; // 12셀 ≥ 최대 9타일
      const TILE = 76; // .tile 데스크톱 크기 기준(모바일 64px은 여유만 커짐)
      const cw = board.clientWidth / COLS, ch = board.clientHeight / ROWS;
      const cells = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells.push([c, r]);
      for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
      return nums.map((n, i) => {
        const [c, r] = cells[i];
        const x = c * cw + Math.random() * Math.max(0, cw - TILE);
        const y = r * ch + Math.random() * Math.max(0, ch - TILE);
        const t = document.createElement("button");
        t.className = "tile";
        t.style.left = x + "px"; t.style.top = y + "px";
        t.textContent = n;
        board.appendChild(t);
        return t;
      });
    }

    function round() {
      if (!alive) return;
      rounds++;
      const nums = [];
      const N = N_(); // 이번 라운드 개수
      while (nums.length < N) {
        const v = 1 + Math.floor(Math.random() * 50);
        if (!nums.includes(v)) nums.push(v);
      }
      const sorted = [...nums].sort((a, b) => a - b);
      const tiles = placeTiles(nums);
      fb.textContent = "외우세요!";
      fb.className = "feedback";
      let idx = -1; // -1 = 아직 가리기 전

      setTimeout(() => {
        if (!alive) return;
        tiles.forEach(t => t.classList.add("hidden-num"));
        fb.textContent = "작은 수부터!";
        idx = 0;
      }, SHOW_MS);

      tiles.forEach(t => {
        t.onclick = () => {
          if (!alive || idx < 0) return;
          const v = Number(t.textContent);
          if (v === sorted[idx]) {
            good++;
            FX.flash(true); // 정답 손맛 (음·진동·판정·스파크·콤보)
            t.classList.remove("hidden-num");
            t.classList.add("cleared");
            idx++;
            if (idx >= N) { roundWins++; idx = -2; fb.textContent = "성공!"; fb.className = "feedback flash-good"; setTimeout(round, 450); }
          } else {
            bad++;
            FX.flash(false);
            t.classList.remove("hidden-num");
            t.classList.add("wrong");
            fb.textContent = "순서가 달라요";
            fb.className = "feedback flash-bad";
            idx = -2; // 라운드 종료
            setTimeout(round, 550);
          }
        };
      });
    }
    round();

    api.onTimeUp(() => {
      alive = false;
      const picks = good + bad;
      const acc = picks ? good / picks : 0;
      const score = Math.round(100 * acc * Math.min(1, rounds / 2)); // 30초 기준
      api.finish(score, `성공 라운드 ${roundWins} · 시도 ${rounds}`);
    });
  }
};
