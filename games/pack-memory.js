// 기억·관찰 계열 게임 팩
(function () {
  const U = window.BW_UTIL;
  const EMOJI = ["🍎", "🚗", "🐶", "🌻", "⚽", "🎩", "🍞", "🐟", "🌙", "✂️", "☂️", "🔔"];

  // ---------- 직전 그림 (1-back / 2-back — 작업기억) ----------
  window.GAME_PHOTO = {
    id: "photo", name: "직전 그림", icon: "🖼️", mode: "count",
    intro: "그림이 한 장씩 지나가요.\n\"직전에 본 그림\"을 골라내세요.",
    start(area, level, api) {
      const BACK = level >= 8 ? 3 : level >= 4 ? 2 : 1;
      const ROUNDS = 8;
      let r = 0, ok = 0;
      const hist = [];
      area.innerHTML = `
        <div class="inst" id="ph-inst"></div>
        <div class="problem" id="ph-card" style="font-size:96px"></div>
        <div class="feedback" id="ph-fb"></div>
        <div class="choices" id="ph-c"></div>`;
      const inst = area.querySelector("#ph-inst");
      const card = area.querySelector("#ph-card");
      const fb = area.querySelector("#ph-fb");
      const choices = area.querySelector("#ph-c");

      function showNext() {
        const e = EMOJI[U.rand(0, EMOJI.length - 1)];
        hist.push(e);
        card.textContent = e;
        inst.textContent = "잘 보세요…";
        choices.innerHTML = "";
        setTimeout(ask, 1100);
      }
      function ask() {
        if (hist.length <= BACK) { showNext(); return; }
        if (r >= ROUNDS) {
          api.finish(Math.round(100 * ok / ROUNDS), `${ok}/${ROUNDS} 정답`);
          return;
        }
        r++;
        card.textContent = "❓";
        inst.textContent = BACK === 1 ? `(${r}/${ROUNDS}) 직전 그림은?` : `(${r}/${ROUNDS}) 2장 전 그림은?`;
        const ans = hist[hist.length - 1 - BACK];
        const opts = new Set([ans]);
        while (opts.size < 4) opts.add(EMOJI[U.rand(0, EMOJI.length - 1)]);
        U.renderChoices(choices, U.shuffle([...opts]), (v, btn) => {
          const good = v === ans;
          U.markBtn(btn, good);
          if (good) { ok++; fb.textContent = "정답!"; fb.className = "feedback flash-good"; }
          else { fb.textContent = `정답은 ${ans}`; fb.className = "feedback flash-bad"; }
          FX.flash(good);
          showNext();
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
      const ROUNDS = 5, K = Math.min(8, 3 + level);
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
              if (found >= K) { fb.textContent = "성공!"; fb.className = "feedback flash-good"; FX.flash(true); setTimeout(round, 700); }
            } else {
              miss++; wrongs++;
              c.classList.add("wrongcell");
              if (wrongs >= 3) { fb.textContent = "다음 판으로!"; fb.className = "feedback flash-bad"; FX.flash(false); setTimeout(round, 700); }
            }
          };
        });
      }
      round();
      api.onTimeUp(() => {});
    }
  };

  // ---------- 같은 위치 (N-back — 워킹 메모리) ----------
  window.GAME_NBACK = {
    id: "nback", name: "같은 위치", icon: "📍", mode: "count",
    intro: "네모가 차례로 나타나요.\n직전과 같은 자리면 버튼을 누르세요!",
    start(area, level, api) {
      const N = level >= 8 ? 3 : level >= 4 ? 2 : 1;
      const STIM = 18, GAP = Math.max(1100, 1700 - level * 120);
      let i = 0, hits = 0, fa = 0, targets = 0;
      const seq = [];
      for (let k = 0; k < STIM; k++) {
        if (k >= N && Math.random() < 0.35) { seq.push(seq[k - N]); }
        else {
          let v; do { v = U.rand(0, 8); } while (k >= N && v === seq[k - N] && Math.random() < 0.7);
          seq.push(v);
        }
      }
      seq.forEach((v, k) => { if (k >= N && v === seq[k - N]) targets++; });

      area.innerHTML = `
        <div class="inst" id="nb-inst"></div>
        <div class="grid3" id="nb"></div>
        <button class="big-btn primary" id="nb-btn" style="max-width:320px">같은 자리! 🔔</button>`;
      area.querySelector("#nb-inst").textContent = N === 1 ? "직전과 같은 자리에 나오면 누르세요" : "2번 전과 같은 자리면 누르세요";
      const grid = area.querySelector("#nb");
      for (let k = 0; k < 9; k++) grid.appendChild(document.createElement("div")).className = "g3cell";
      const cells = grid.querySelectorAll(".g3cell");
      let pressed = false;

      area.querySelector("#nb-btn").onclick = () => {
        if (pressed || i === 0) return;
        pressed = true;
        const isT = i - 1 >= N && seq[i - 1] === seq[i - 1 - N];
        if (isT) hits++; else fa++;
        FX.flash(isT);
      };

      const iv = setInterval(() => {
        cells.forEach(c => c.classList.remove("on"));
        if (i >= STIM) {
          clearInterval(iv);
          const score = Math.max(0, Math.round(100 * (hits - fa) / Math.max(1, targets)));
          api.finish(score, `잡음 ${hits}/${targets} · 헛누름 ${fa}`);
          return;
        }
        cells[seq[i]].classList.add("on");
        pressed = false;
        i++;
      }, GAP);
      api.onTimeUp(() => { clearInterval(iv); });
    }
  };

  // ---------- 인원 세기 (드나드는 사람 추적 — 주의 유지) ----------
  window.GAME_PEOPLE = {
    id: "people", name: "인원 세기", icon: "🏠", mode: "count",
    intro: "집에 사람이 드나들어요.\n지금 안에 몇 명인지 기억하세요!",
    start(area, level, api) {
      const ROUNDS = 4, EVENTS = 4 + level, GAP = Math.max(1150, 1600 - level * 100);
      let r = 0, ok = 0;
      area.innerHTML = `
        <div class="pe-stage" id="pe-stage">
          <img src="assets/house.png" class="pe-house" alt="집">
        </div>
        <div class="inst" id="pe-ev"></div>
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
        ev.textContent = `처음에 ${inside}명 있어요`;
        const iv = setInterval(() => {
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
              setTimeout(round, 800);
            });
            return;
          }
          e++;
          const enter = inside <= 0 ? true : Math.random() < 0.55;
          const n = U.rand(1, 2);
          if (enter) { inside += n; walk(n, true); ev.textContent = `${n}명 들어갔어요`; }
          else { const out = Math.min(n, inside); inside -= out; walk(out, false); ev.textContent = `${out}명 나왔어요`; }
        }, GAP);
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
        const birds = 4 + level + U.rand(0, 3);
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
            setTimeout(round, 800);
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
          setTimeout(round, 800);
        });
      }
      round();
      api.onTimeUp(() => {});
    }
  };

  // ---------- 이중과제 (계산 판단 + 별 세기 동시에) ----------
  window.GAME_DUAL = {
    id: "dual", name: "이중과제", icon: "🎭", sec: 30,
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
