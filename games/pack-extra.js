// 확장 팩 — 검증된 인기 두뇌게임 구성 3종 (전부 공개 인지과제/실생활 과제 기반, IP 안전)
// 잔돈 계산(실생활 산수) · 짝 맞추기(카드 페어) · 어느 쪽이 많을까(수량 비교)
(function () {
  const U = window.BW_UTIL;

  // ---------- 잔돈 계산 — 낸 돈에서 물건값 빼기 (실생활 계산) ----------
  window.GAME_CHANGE = {
    id: "change", name: "잔돈 계산", icon: "💰", sec: 30,
    intro: "물건을 사고 받을\n거스름돈을 고르세요.",
    start(area, level, api) {
      let ok = 0, bad = 0, streak = 0;
      const TARGET = U.targetFor("change", 6, 30);
      area.innerHTML = `
        <div class="problem" id="ch-q"></div>
        <div class="feedback" id="ch-fb"></div>
        <div class="choices" id="ch-c"></div>`;
      const q = area.querySelector("#ch-q");
      const fb = area.querySelector("#ch-fb");
      const c = area.querySelector("#ch-c");

      function next() {
        const lv = Math.min(9, level + Math.floor(ok / 3));
        // 레벨별: 지폐 커지고 가격 단위 잘게
        let pay, price;
        if (lv <= 2) { pay = 1000; price = U.rand(1, 9) * 100; }
        else if (lv <= 4) { pay = [1000, 5000][U.rand(0, 1)]; price = U.rand(2, pay / 100 - 1) * 100 + [0, 50][U.rand(0, 1)]; }
        else if (lv <= 6) { pay = 5000; price = U.rand(5, 44) * 100 + U.rand(0, 9) * 10; }
        else { pay = 10000; price = U.rand(11, 94) * 100 + U.rand(0, 9) * 10; }
        const ans = pay - price;
        q.innerHTML = `${price.toLocaleString()}원 물건<br>💵 ${pay.toLocaleString()}원을 냈어요`;
        // 오답: 자릿수 실수 패턴 (±100/±500/±10 헷갈림)
        const opts = new Set([ans]);
        const NEAR = [100, -100, 500, -500, 1000, -1000, 10, -10, 90, -90];
        while (opts.size < 4) {
          const d = ans + NEAR[U.rand(0, NEAR.length - 1)];
          if (d > 0 && d !== ans) opts.add(d);
        }
        c.innerHTML = "";
        U.shuffle([...opts]).forEach(v => {
          const b = document.createElement("button");
          b.className = "choice-btn";
          b.textContent = v.toLocaleString() + "원";
          b.style.fontSize = "24px";
          b.onclick = () => {
            const good = v === ans;
            U.markBtn(b, good);
            if (good) { ok++; streak++; fb.textContent = "정답!" + U.comboText(streak); fb.className = "feedback flash-good"; }
            else { bad++; streak = 0; fb.textContent = `거스름돈은 ${ans.toLocaleString()}원`; fb.className = "feedback flash-bad"; }
            FX.flash(good);
            next();
          };
          c.appendChild(b);
        });
      }
      next();
      api.onTimeUp(() => {
        const n = ok + bad, acc = n ? ok / n : 0;
        api.finish(Math.round(100 * acc * Math.min(1, ok / TARGET)), `정답 ${ok} · 오답 ${bad}`);
      });
    }
  };

  // ---------- 짝 맞추기 — 카드 페어 (작업 기억, 분량제) ----------
  window.GAME_PAIRS = {
    id: "pairs", name: "짝 맞추기", icon: "🃏", mode: "count",
    intro: "카드를 뒤집어\n같은 그림 짝을 찾으세요.",
    start(area, level, api) {
      const EMO = ["🍎", "🍌", "🍇", "🍓", "🥕", "🌽", "🐟", "🍞", "☂️", "🧦", "🌻", "🐕"];
      const PAIRS = level <= 3 ? 6 : 8; // 4×3 또는 4×4
      const cards = U.shuffle(U.shuffle(EMO).slice(0, PAIRS).flatMap(e => [e, e]));
      let open = null, lock = false, matched = 0, flips = 0;
      area.innerHTML = `
        <div class="feedback" id="pr-fb">짝을 찾으세요!</div>
        <div class="inst" id="pr-prog"></div>
        <div class="pairs-grid" id="pr"></div>`;
      const fb = area.querySelector("#pr-fb");
      const prog = area.querySelector("#pr-prog");
      const upd = () => prog.textContent = `찾은 짝 ${matched}/${PAIRS} · 뒤집기 ${flips}`;
      upd();
      const grid = area.querySelector("#pr");
      grid.style.gridTemplateColumns = "repeat(4, 1fr)";
      cards.forEach(emo => {
        const b = document.createElement("button");
        b.className = "pcard";
        b.textContent = "🐾";
        b.onclick = () => {
          if (lock || b.classList.contains("open") || b.classList.contains("done")) return;
          flips++;
          b.textContent = emo; b.classList.add("open");
          if (!open) { open = { b, emo }; upd(); return; }
          if (open.emo === emo) {
            open.b.classList.add("done"); b.classList.add("done");
            open.b.classList.remove("open"); b.classList.remove("open");
            matched++; open = null;
            fb.textContent = "짝!"; fb.className = "feedback flash-good";
            FX.flash(true); upd();
            if (matched >= PAIRS) {
              const sec = api.elapsedSec();
              // 최소 뒤집기 = 2×PAIRS. 효율·시간 복합 점수
              const eff = Math.min(1, (PAIRS * 2.6) / flips);
              const spd = Math.min(1, (PAIRS * 6) / sec);
              api.finish(Math.round(100 * (eff * 0.6 + spd * 0.4)), `뒤집기 ${flips}회 · ${Math.round(sec)}초`);
            }
          } else {
            const prev = open; open = null; lock = true;
            fb.textContent = "다른 그림!"; fb.className = "feedback flash-bad";
            FX.flash(false); upd();
            setTimeout(() => {
              prev.b.textContent = "🐾"; prev.b.classList.remove("open");
              b.textContent = "🐾"; b.classList.remove("open");
              lock = false;
            }, 650);
          }
        };
        grid.appendChild(b);
      });
      api.onTimeUp(() => {});
    }
  };

  // ---------- 어느 쪽이 많을까 — 수량 비교 (순간 수 감각) ----------
  window.GAME_COMPARE = {
    id: "compare", name: "어느 쪽이 많을까", icon: "⚖️", sec: 25,
    intro: "그림이 더 많은 쪽을\n빠르게 누르세요!",
    start(area, level, api) {
      let ok = 0, bad = 0, streak = 0;
      const TARGET = U.targetFor("compare", 10, 25);
      area.innerHTML = `
        <div class="feedback" id="cp-fb">더 많은 쪽!</div>
        <div class="compare-wrap">
          <button class="cmp-box" id="cp-l"></button>
          <button class="cmp-box" id="cp-r"></button>
        </div>`;
      const fb = area.querySelector("#cp-fb");
      const L = area.querySelector("#cp-l"), R = area.querySelector("#cp-r");
      const EMO = ["🍎", "🐤", "⭐", "🎈", "🐟", "🌸"];
      let more = null; // "L" | "R"

      function next() {
        const lv = Math.min(9, level + Math.floor(ok / 4));
        // 레벨↑ = 개수 많아지고 차이 좁아짐 (수 감각 정밀도)
        const base = 4 + lv * 2;
        const diff = Math.max(1, 5 - Math.floor(lv / 2));
        const a = U.rand(base, base + 6);
        const b = a + diff * (Math.random() < 0.5 ? 1 : -1);
        const emo = EMO[U.rand(0, EMO.length - 1)];
        more = a > b ? "L" : "R";
        L.innerHTML = Array(a).fill(`<span>${emo}</span>`).join("");
        R.innerHTML = Array(Math.max(1, b)).fill(`<span>${emo}</span>`).join("");
      }
      const pick = side => {
        const good = side === more;
        if (good) { ok++; streak++; fb.textContent = "정답!" + U.comboText(streak); fb.className = "feedback flash-good"; }
        else { bad++; streak = 0; fb.textContent = "반대쪽이 더 많았어요!"; fb.className = "feedback flash-bad"; }
        FX.flash(good);
        next();
      };
      L.onclick = () => pick("L");
      R.onclick = () => pick("R");
      next();
      api.onTimeUp(() => {
        const n = ok + bad, acc = n ? ok / n : 0;
        api.finish(Math.round(100 * acc * Math.min(1, ok / TARGET)), `정답 ${ok} · 오답 ${bad}`);
      });
    }
  };
})();
