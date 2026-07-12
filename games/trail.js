// 순서 잇기 — 1→가→2→나… 교대로 클릭 (Trail Making Test B 변형)
window.GAME_TRAIL = {
  id: "trail",
  name: "순서 잇기",
  intro: "숫자와 글자를 번갈아\n1 → 가 → 2 → 나 순서로 누르세요.",

  start(area, level, api) {
    const HANGUL = ["가", "나", "다", "라", "마", "바", "사", "아"];
    const PAIRS0 = Math.min(7, 2 + level);  // 시작 쌍 수 (보드 한계 7쌍=14개)
    // 인-세션 램프: 판을 깰 때마다 +1쌍
    const PAIRS_ = () => Math.min(7, PAIRS0 + Math.max(0, boards - 1));
    let good = 0, bad = 0, cleared = 0, boards = 0;
    let alive = true;

    area.innerHTML = `<div class="feedback" id="tr-fb"></div><div class="board" id="tr-board"></div>`;
    const board = area.querySelector("#tr-board");
    const fb = area.querySelector("#tr-fb");

    function newBoard() {
      if (!alive) return;
      boards++;
      const seq = [];
      const PAIRS = PAIRS_(); // 이번 판 쌍 수 (boards는 newBoard 진입 시 이미 +1됨)
      for (let i = 0; i < PAIRS; i++) { seq.push(String(i + 1)); seq.push(HANGUL[i]); }
      board.innerHTML = "";
      const W = board.clientWidth - 80, H = board.clientHeight - 80;
      const placed = [];
      let idx = 0;
      seq.forEach(label => {
        let x, y, tries = 0;
        do {
          x = Math.random() * W; y = Math.random() * H; tries++;
        } while (tries < 200 && placed.some(p => Math.hypot(p.x - x, p.y - y) < 90));
        placed.push({ x, y });
        const t = document.createElement("button");
        t.className = "tile";
        t.style.left = x + "px"; t.style.top = y + "px";
        t.textContent = label;
        t.onclick = () => {
          if (!alive) return;
          if (label === seq[idx]) {
            good++; cleared++;
            t.classList.add("cleared");
            idx++;
            fb.textContent = "";
            if (idx >= seq.length) { fb.textContent = "완료!"; fb.className = "feedback flash-good"; setTimeout(newBoard, 400); }
          } else {
            bad++;
            fb.textContent = `다음은 "${seq[idx]}" 차례예요`;
            fb.className = "feedback flash-bad";
          }
        };
        board.appendChild(t);
      });
    }
    newBoard();

    api.onTimeUp(() => {
      alive = false;
      const clicks = good + bad;
      const acc = clicks ? good / clicks : 0;
      const expected = PAIRS0 * 2;   // 25초에 한 판 완주 기준(시작 난이도 기준)
      const score = Math.round(100 * acc * Math.min(1, cleared / expected));
      api.finish(score, `지운 칸 ${cleared} · 실수 ${bad}`);
    });
  }
};
