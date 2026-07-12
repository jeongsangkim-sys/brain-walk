// 순간 기억 — 숫자 위치를 외운 뒤 작은 수부터 클릭
window.GAME_MEMORY = {
  id: "memory",
  name: "순간 기억",
  intro: "숫자가 잠깐 나타났다가 가려집니다.\n작은 수부터 순서대로 눌러 주세요.",

  start(area, level, api) {
    const N = Math.min(9, 3 + level);   // 외울 개수 4~9 (보드 배치 한계)
    const SHOW_MS = 1500 + level * 300;
    let good = 0, bad = 0, rounds = 0, roundWins = 0;
    let alive = true;

    area.innerHTML = `<div class="feedback" id="mem-fb"></div><div class="board" id="mem-board"></div>`;
    const board = area.querySelector("#mem-board");
    const fb = area.querySelector("#mem-fb");

    function placeTiles(nums) {
      board.innerHTML = "";
      const W = board.clientWidth - 80, H = board.clientHeight - 80;
      const placed = [];
      return nums.map(n => {
        let x, y, tries = 0;
        do {
          x = Math.random() * W; y = Math.random() * H; tries++;
        } while (tries < 200 && placed.some(p => Math.hypot(p.x - x, p.y - y) < 92));
        placed.push({ x, y });
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
            t.classList.remove("hidden-num");
            t.classList.add("cleared");
            idx++;
            if (idx >= N) { roundWins++; idx = -2; fb.textContent = "성공!"; fb.className = "feedback flash-good"; setTimeout(round, 700); }
          } else {
            bad++;
            t.classList.remove("hidden-num");
            t.classList.add("wrong");
            fb.textContent = "순서가 달라요";
            fb.className = "feedback flash-bad";
            idx = -2; // 라운드 종료
            setTimeout(round, 900);
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
