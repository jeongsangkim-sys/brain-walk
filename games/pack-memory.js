// 기억·관찰 계열 게임 팩
(function () {
  const U = window.BW_UTIL;
  // 전부 SMP 그림문자만 사용 — ✂☂ 류는 폰에서 흑백/깨짐 위험
  const EMOJI = ["🍎", "🚗", "🐶", "🌻", "🎩", "🍞", "🐟", "🌙", "📕", "🌂", "🔔", "🍌"];

  // ---------- 직전 그림 (1-back / 2-back — 작업기억) ----------
  window.GAME_PHOTO = {
    id: "photo", name: "직전 그림", icon: "🖼️", mode: "count",
    intro: "그림이 잠깐 나왔다 사라져요.\n방금 본 그림을 골라내세요.",
    start(area, level, api) {
      const BACK = level >= 8 ? 3 : level >= 4 ? 2 : 1;
      const ROUNDS = 8;
      let r = 0, ok = 0;
      const hist = [];
      area.innerHTML = `
        <div class="inst" id="ph-inst"></div>
        <div class="problem emoji-text" id="ph-card" style="font-size:96px"></div>
        <div class="feedback" id="ph-fb"></div>
        <div class="choices emoji-choices" id="ph-c"></div>`;
      const inst = area.querySelector("#ph-inst");
      const card = area.querySelector("#ph-card");
      const fb = area.querySelector("#ph-fb");
      const choices = area.querySelector("#ph-c");

      function showNext() {
        const e = EMOJI[U.rand(0, EMOJI.length - 1)];
        hist.push(e);
        card.textContent = e;
        card.classList.remove("card-pop"); void card.offsetWidth; card.classList.add("card-pop");
        inst.textContent = "잘 보세요…";
        fb.textContent = "";
        choices.innerHTML = "";
        setTimeout(ask, 1200);
      }
      function ask() {
        if (hist.length <= BACK) { showNext(); return; }
        if (r >= ROUNDS) {
          api.finish(Math.round(100 * ok / ROUNDS), `${ok}/${ROUNDS} 정답`);
          return;
        }
        r++;
        card.textContent = "❓";
        // BACK=1: 방금 가려진 그 그림 (사용자가 자연스럽게 기대하는 정답)
        inst.textContent = BACK === 1 ? `(${r}/${ROUNDS}) 방금 본 그림은?` : `(${r}/${ROUNDS}) ${BACK}장 전 그림은?`;
        const ans = hist[hist.length - BACK];
        const opts = new Set([ans]);
        while (opts.size < 4) opts.add(EMOJI[U.rand(0, EMOJI.length - 1)]);
        U.renderChoices(choices, U.shuffle([...opts]), (v, btn) => {
          const good = v === ans;
          U.markBtn(btn, good);
          if (good) { ok++; fb.textContent = "정답!"; fb.className = "feedback flash-good"; }
          else { fb.textContent = `정답은 ${ans}`; fb.className = "feedback flash-bad"; }
          FX.flash(good);
          card.textContent = "";
          choices.innerHTML = "";
          setTimeout(showNext, 650); // 피드백 볼 틈 준 뒤 다음 그림 등장
        });
      }
      showNext();
      api.onTimeUp(() => {});
    }
  };

  // ---------- 5×5 기억 (패턴 재현 — 시공간 기억) ----------
  window.GAME_GRID55 = {
    id: "grid55", name: "5×5 기억", icon: "🧩", mode: "count", check: true,
    intro: "불이 켜진 칸을 외웠다가\n그대로 다시 눌러 보세요.",
    start(area, level, api) {
      const ROUNDS = 5;
      const K_ = () => Math.min(8, 3 + level + Math.floor(hit / 8)); // 인-세션 램프
      let r = 0, hit = 0, miss = 0;
      area.innerHTML = `<div class="feedback" id="g5-fb"></div><div class="grid5" id="g5"></div>`;
      const fb = area.querySelector("#g5-fb");
      const grid = area.querySelector("#g5");

      function round() {
        if (r >= ROUNDS) {
          const total = hit + miss;
          api.finish(Math.round(100 * (total ? hit / total : 0)), `맞춘 칸 ${hit} · 실수 ${miss}`);
          return;
        }
        r++;
        fb.textContent = `${r} / ${ROUNDS} — 외우세요!`;
        fb.className = "feedback";
        grid.innerHTML = "";
        const targets = new Set();
        const K = K_(); // 이번 라운드 칸 수
        while (targets.size < K) targets.add(U.rand(0, 24));
        const cells = [];
        for (let i = 0; i < 25; i++) {
          const c = document.createElement("button");
          c.className = "g5cell" + (targets.has(i) ? " lit" : "");
          grid.appendChild(c);
          cells.push(c);
        }
        let armed = false, found = 0, wrongs = 0;
        setTimeout(() => {
          cells.forEach(c => c.classList.remove("lit"));
          fb.textContent = "눌러 보세요!";
          armed = true;
        }, 1200 + K * 150);
        cells.forEach((c, i) => {
          c.onclick = () => {
            if (!armed || c.classList.contains("done")) return;
            c.classList.add("done");
            if (targets.has(i)) {
              hit++; found++;
              c.classList.add("lit");
              if (found >= K) { fb.textContent = "성공!"; fb.className = "feedback flash-good"; FX.flash(true); setTimeout(round, 450); }
            } else {
              miss++; wrongs++;
              c.classList.add("wrongcell");
              if (wrongs >= 3) { fb.textContent = "다음 판으로!"; fb.className = "feedback flash-bad"; FX.flash(false); setTimeout(round, 450); }
            }
          };
        });
      }
      round();
      api.onTimeUp(() => {});
    }
  };

  // ---------- 순서 따라 누르기 (사이먼식 — 순서 기억. N-back '같은 위치'가 규칙 난해로 교체됨) ----------
  window.GAME_SIMON = {
    id: "simon", name: "순서 따라 누르기", icon: "💡",
    intro: "칸에 불이 차례로 켜져요.\n켜진 순서 그대로 따라 누르세요!",
    start(area, level, api) {
      let wins = 0, good = 0, bad = 0;
      let len = Math.min(6, 2 + Math.floor(level / 3)); // Lv3 시작 3칸, 성공마다 +1
      let alive = true;
      const timers = [];
      // 홈 이탈로 보드가 떨어져 나가면 타이머 체인 중단 (백그라운드 무한 라운드 방지)
      const later = (fn, ms) => timers.push(setTimeout(() => { if (alive && document.body.contains(grid)) fn(); }, ms));

      area.innerHTML = `
        <div class="inst" id="sm-inst"></div>
        <div class="feedback" id="sm-fb"></div>
        <div class="grid3" id="sm"></div>`;
      const inst = area.querySelector("#sm-inst");
      const fb = area.querySelector("#sm-fb");
      const grid = area.querySelector("#sm");
      for (let k = 0; k < 9; k++) {
        const c = document.createElement("button");
        c.className = "g3cell";
        grid.appendChild(c);
      }
      const cells = [...grid.querySelectorAll(".g3cell")];
      let seq = [], idx = -1; // -1 = 보여주는 중(입력 잠금)

      function playback(k) {
        if (k >= seq.length) { inst.textContent = "따라 누르세요!"; idx = 0; return; }
        const c = cells[seq[k]];
        c.classList.add("on");
        later(() => { c.classList.remove("on"); later(() => playback(k + 1), 160); }, 520);
      }
      function round() {
        seq = [];
        while (seq.length < len) {
          const v = U.rand(0, 8);
          if (seq[seq.length - 1] !== v) seq.push(v); // 같은 칸 연속 방지 (헷갈림 컷)
        }
        idx = -1;
        inst.textContent = `잘 보세요 — ${len}칸!`;
        fb.textContent = "";
        fb.className = "feedback";
        later(() => playback(0), 550);
      }
      cells.forEach((c, p) => c.onclick = () => {
        if (!alive || idx < 0) return;
        if (p === seq[idx]) {
          good++;
          FX.flash(true);
          c.classList.add("on");
          later(() => c.classList.remove("on"), 220);
          idx++;
          if (idx >= seq.length) {
            wins++;
            idx = -1;
            len = Math.min(9, len + 1);
            fb.textContent = "성공! 한 칸 더 길어져요";
            fb.className = "feedback flash-good";
            later(round, 700);
          }
        } else {
          bad++;
          FX.flash(false);
          const right = cells[seq[idx]];
          right.classList.add("on"); // 정답 칸을 보여줌
          later(() => right.classList.remove("on"), 500);
          fb.textContent = "여기였어요 — 다시 한 번!";
          fb.className = "feedback flash-bad";
          idx = -1;
          len = Math.max(2, len - 1);
          later(round, 850);
        }
      });
      round();

      api.onTimeUp(() => {
        alive = false;
        timers.forEach(clearTimeout);
        const taps = good + bad;
        const acc = taps ? good / taps : 0;
        api.finish(Math.round(100 * acc * Math.min(1, wins / 3)), `완주 ${wins}라운드 · 최장 ${Math.max(0, len - 1)}칸`);
      });
    }
  };

  // ---------- 인원 세기 (드나드는 사람 추적 — 주의 유지) ----------
  window.GAME_PEOPLE = {
    id: "people", name: "인원 세기", icon: "🏠", mode: "count",
    intro: "집에 사람이 드나들어요.\n지금 안에 몇 명인지 기억하세요!",
    start(area, level, api) {
      const ROUNDS = 4;
      // 인-세션 램프: 맞춘 라운드만큼 드나듦 횟수↑·속도↑
      const EVENTS_ = () => 4 + level + ok;
      const GAP_ = () => Math.max(950, 1600 - level * 100 - ok * 120);
      let r = 0, ok = 0;
      area.innerHTML = `
        <div class="pe-stage" id="pe-stage">
          <img src="assets/house.png" class="pe-house" alt="집">
        </div>
        <div class="inst sr-only" id="pe-ev"></div>
        <div class="feedback" id="pe-fb"></div>
        <div class="choices" id="pe-c"></div>`;
      const stage = area.querySelector("#pe-stage");
      const ev = area.querySelector("#pe-ev");
      const fb = area.querySelector("#pe-fb");
      const choices = area.querySelector("#pe-c");

      // 사람이 실제로 걸어 들어가고 나오는 연출
      function walk(n, entering) {
        for (let i = 0; i < n; i++) {
          const w = document.createElement("span");
          w.className = "walker " + (entering ? "in" : "out");
          w.textContent = entering ? "🚶" : "🏃";
          w.style.animationDelay = i * 0.18 + "s";
          w.style.bottom = 8 + i * 6 + "px";
          stage.appendChild(w);
          setTimeout(() => w.remove(), 1100 + i * 180);
        }
      }

      function round() {
        if (r >= ROUNDS) {
          api.finish(Math.round(100 * ok / ROUNDS), `${ok}/${ROUNDS} 정답`);
          return;
        }
        r++;
        choices.innerHTML = "";
        fb.textContent = `${r} / ${ROUNDS}`;
        fb.className = "feedback";
        let inside = U.rand(1, 3), e = 0;
        const EVENTS = EVENTS_(), GAP = GAP_(); // 이번 라운드 난이도
        ev.textContent = `처음에 ${inside}명 있어요`; // 스크린리더·시뮬용 (화면엔 숨김)
        // 시작 인원을 그림으로: 집 앞에 서 있다가 안으로 들어감
        for (let k = 0; k < inside; k++) {
          const w = document.createElement("span");
          w.className = "walker init";
          w.textContent = "🧍";
          w.style.left = `calc(50% + ${(k - (inside - 1) / 2) * 34 - 14}px)`;
          w.style.bottom = "6px";
          w.style.animationDelay = 1000 + k * 150 + "ms";
          stage.appendChild(w);
          setTimeout(() => w.remove(), 2100 + k * 150);
        }
        let iv = null;
        setTimeout(() => { iv = setInterval(tick, GAP); }, 2300); // 시작 인원 보여준 뒤 이벤트 시작
        function tick() {
          if (e >= EVENTS) {
            clearInterval(iv);
            ev.textContent = "지금 몇 명일까요?";
            const opts = new Set([inside]);
            while (opts.size < 4) { const d = Math.max(0, inside + U.rand(-3, 3)); if (d !== inside) opts.add(d); }
            let answered = false; // 라운드 전환 대기 중 연타 방지
            U.renderChoices(choices, U.shuffle([...opts]), (v, btn) => {
              if (answered) return; answered = true;
              const good = v === inside;
              U.markBtn(btn, good);
              if (good) { ok++; fb.textContent = "정답!"; fb.className = "feedback flash-good"; }
              else { fb.textContent = `정답은 ${inside}명`; fb.className = "feedback flash-bad"; }
              FX.flash(good);
              setTimeout(round, 500);
            });
            return;
          }
          e++;
          const enter = inside <= 0 ? true : Math.random() < 0.55;
          const n = U.rand(1, 2);
          if (enter) { inside += n; walk(n, true); ev.textContent = `${n}명 들어갔어요`; }
          else { const out = Math.min(n, inside); inside -= out; walk(out, false); ev.textContent = `${out}명 나왔어요`; }
        }
      }
      round();
      api.onTimeUp(() => {});
    }
  };

  // ---------- 새 세기 (날아가는 새 세기 — 주의 분할) ----------
  window.GAME_BIRDS = {
    id: "birds", name: "새 세기", icon: "🐦", mode: "count",
    intro: "새들이 날아가요.\n나비 말고 \"새\"만 세어 보세요!",
    start(area, level, api) {
      const ROUNDS = 3;
      let r = 0, ok = 0;
      area.innerHTML = `
        <div class="feedback" id="bi-fb"></div>
        <div class="board short" id="bi-sky"></div>
        <div class="choices" id="bi-c"></div>`;
      const sky = area.querySelector("#bi-sky");
      const fb = area.querySelector("#bi-fb");
      const choices = area.querySelector("#bi-c");

      function round() {
        if (r >= ROUNDS) {
          api.finish(Math.round(100 * ok / ROUNDS), `${ok}/${ROUNDS} 정답`);
          return;
        }
        r++;
        choices.innerHTML = "";
        fb.textContent = `${r} / ${ROUNDS} — 새를 세세요!`;
        fb.className = "feedback";
        sky.innerHTML = "";
        const birds = 4 + level + U.rand(0, 3) + ok; // 인-세션 램프: 맞출수록 새 증가
        const moths = level >= 2 ? U.rand(2, 4) : 0;
        const total = birds + moths;
        const items = U.shuffle([...Array(birds).fill("bird"), ...Array(moths).fill("butterfly")]);
        items.forEach((kind, k) => {
          const s = document.createElement("img");
          s.className = "flyer";
          s.src = `assets/${kind}.png`;
          s.alt = kind === "bird" ? "새" : "나비";
          s.style.top = 10 + Math.random() * (sky.clientHeight - 60) + "px";
          s.style.animationDuration = (2.2 + Math.random() * 1.6) / (1 + level * 0.1) + "s";
          s.style.animationDelay = (k * (3800 / total)) / 1000 + "s";
          sky.appendChild(s);
        });
        setTimeout(() => {
          fb.textContent = "새가 몇 마리였죠?";
          const opts = new Set([birds]);
          while (opts.size < 4) { const d = Math.max(1, birds + U.rand(-3, 3)); if (d !== birds) opts.add(d); }
          let answered = false; // 연타 방지
          U.renderChoices(choices, U.shuffle([...opts]), (v, btn) => {
            if (answered) return; answered = true;
            const good = v === birds;
            U.markBtn(btn, good);
            if (good) { ok++; fb.textContent = "정답!"; fb.className = "feedback flash-good"; }
            else { fb.textContent = `정답은 ${birds}마리`; fb.className = "feedback flash-bad"; }
            FX.flash(good);
            setTimeout(round, 500);
          });
        }, 4600 + total * 120);
      }
      round();
      api.onTimeUp(() => {});
    }
  };

  // ---------- 상자 세기 (가려진 상자까지 세기 — 공간 추론) ----------
  window.GAME_BOXES = {
    id: "boxes", name: "상자 세기", icon: "📦", mode: "count",
    intro: "쌓인 상자가 모두 몇 개일까요?\n뒤에 가려진 상자도 세어야 해요!",
    start(area, level, api) {
      const ROUNDS = 5;
      let r = 0, ok = 0;
      area.innerHTML = `
        <div class="feedback" id="bx-fb"></div>
        <canvas id="bx-cv" width="360" height="280" style="max-width:100%"></canvas>
        <div class="choices" id="bx-c"></div>`;
      const cv = area.querySelector("#bx-cv"), ctx = cv.getContext("2d");
      const fb = area.querySelector("#bx-fb");
      const choices = area.querySelector("#bx-c");

      function drawCube(x, y, s) {
        const h = s * 0.5;
        // 윗면
        ctx.fillStyle = "#F2C94C";
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + s, y - h); ctx.lineTo(x + s * 2, y); ctx.lineTo(x + s, y + h);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // 왼쪽면
        ctx.fillStyle = "#D9A422";
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + s, y + h); ctx.lineTo(x + s, y + h + s); ctx.lineTo(x, y + s);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // 오른쪽면
        ctx.fillStyle = "#B8860B";
        ctx.beginPath();
        ctx.moveTo(x + s * 2, y); ctx.lineTo(x + s, y + h); ctx.lineTo(x + s, y + h + s); ctx.lineTo(x + s * 2, y + s);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }

      function round() {
        if (r >= ROUNDS) {
          api.finish(Math.round(100 * ok / ROUNDS), `${ok}/${ROUNDS} 정답`);
          return;
        }
        r++;
        choices.innerHTML = "";
        fb.textContent = `${r} / ${ROUNDS}`;
        fb.className = "feedback";
        // 높이 지도: 뒤로 갈수록 높거나 같아야 자연스러움 → 자유 배치 + 지지 규칙(공중부양 없음)
        const R = 2 + (level >= 3 ? 1 : 0), C = 2 + (level >= 2 ? 1 : 0);
        const hmap = [];
        let total = 0;
        for (let i = 0; i < R; i++) {
          hmap.push([]);
          for (let j = 0; j < C; j++) {
            const h = U.rand(i === R - 1 ? 1 : 0, 2 + Math.min(2, level));
            hmap[i].push(h); total += h;
          }
        }
        if (total < 3) { hmap[R - 1][0] += 3; total += 3; }
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = "#2B3A55"; ctx.lineWidth = 2;
        const s = 38, ox = cv.width / 2 - s, oy = 60;
        // 뒤(작은 i)부터 그리기
        for (let i = 0; i < R; i++)
          for (let j = C - 1; j >= 0; j--)
            for (let k = 0; k < hmap[i][j]; k++) {
              const x = ox + (j - i) * s;
              const y = oy + (i + j) * s * 0.5 + (2 - 0) * s - k * s;
              drawCube(x, y + 60, s);
            }
        const opts = new Set([total]);
        while (opts.size < 4) { const d = Math.max(1, total + U.rand(-3, 3)); if (d !== total) opts.add(d); }
        let answered = false; // 연타 방지
        U.renderChoices(choices, U.shuffle([...opts]), (v, btn) => {
          if (answered) return; answered = true;
          const good = v === total;
          U.markBtn(btn, good);
          if (good) { ok++; fb.textContent = "정답!"; fb.className = "feedback flash-good"; }
          else { fb.textContent = `정답은 ${total}개`; fb.className = "feedback flash-bad"; }
          FX.flash(good);
          setTimeout(round, 500);
        });
      }
      round();
      api.onTimeUp(() => {});
    }
  };

  // ---------- 이중과제 (계산 판단 + 별 세기 동시에) ----------
  window.GAME_DUAL = {
    id: "dual", name: "이중과제", icon: "🎭", sec: 25,
    intro: "계산이 맞는지 O/X로 답하면서\n⭐가 몇 번 나왔는지도 세세요!",
    start(area, level, api) {
      let eqOk = 0, eqBad = 0, stars = 0;
      area.innerHTML = `
        <div class="problem" id="du-q"></div>
        <div class="feedback" id="du-fb"></div>
        <div class="choices" id="du-c"></div>
        <div class="star-zone" id="du-star"></div>`;
      const q = area.querySelector("#du-q");
      const fb = area.querySelector("#du-fb");
      const starZone = area.querySelector("#du-star");
      let truth = true;

      function next() {
        const a = U.rand(1, 9), b = U.rand(1, 9);
        truth = Math.random() < 0.5;
        const shown = truth ? a + b : a + b + (Math.random() < 0.5 ? 1 : -1) * U.rand(1, 3);
        q.textContent = `${a} + ${b} = ${shown}`;
      }
      U.renderChoices(area.querySelector("#du-c"), ["⭕ 맞다", "❌ 틀리다"], (v, btn) => {
        const saidTrue = v.startsWith("⭕");
        const good = saidTrue === truth;
        U.markBtn(btn, good);
        if (good) { eqOk++; fb.textContent = "정답!"; fb.className = "feedback flash-good"; }
        else { eqBad++; fb.textContent = "앗!"; fb.className = "feedback flash-bad"; }
        FX.flash(good);
        next();
      });
      next();

      const starIv = setInterval(() => {
        if (Math.random() < 0.5) {
          stars++;
          const s = document.createElement("span");
          s.textContent = "⭐";
          s.className = "star-pop";
          s.style.left = Math.random() * 80 + 10 + "%";
          starZone.appendChild(s);
          setTimeout(() => s.remove(), 700);
        }
      }, Math.max(1500, 2400 - level * 200));

      api.onTimeUp(() => {
        clearInterval(starIv);
        // 2단계 질문: 별 개수
        area.innerHTML = `
          <div class="problem">⭐가 몇 번 나왔나요?</div>
          <div class="choices" id="du-sc"></div>`;
        // stars가 0에 가까우면 ±2 범위로는 보기 4개가 안 나옴 → 위쪽으로 넓힘
        const opts = new Set([stars]);
        let guard = 0;
        while (opts.size < 4) {
          const d = Math.max(0, stars + U.rand(-2, 3));
          if (d !== stars) opts.add(d);
          if (++guard > 60) { opts.add(stars + opts.size); } // 안전판
        }
        U.renderChoices(area.querySelector("#du-sc"), U.shuffle([...opts]), v => {
          const starPart = v === stars ? 1 : Math.abs(v - stars) === 1 ? 0.5 : 0;
          const n = eqOk + eqBad, eqAcc = n ? eqOk / n : 0;
          const score = Math.round(70 * eqAcc * Math.min(1, n / 8) + 30 * starPart);
          api.finish(score, `계산 ${eqOk}/${n} · 별 ${stars}개 (답 ${v})`);
        });
      });
    }
  };
})();
