// 반응시간 수집 — FX.flash(모든 정답/오답이 지나는 길목)에서 중앙 기록
window.RT = {
  _t0: 0, _game: null, _sess: null,
  start(gameId) { this._game = gameId; this._t0 = performance.now(); this._sess = { n: 0, sum: 0 }; },
  stop() { this._game = null; },
  note(ok) {
    if (!this._game) return;
    const now = performance.now();
    const dt = now - this._t0;
    this._t0 = now;
    if (dt < 200 || dt > 15000) return; // 대기·이탈 노이즈 컷
    this._sess.n++; this._sess.sum += dt;
    try {
      const all = JSON.parse(localStorage.getItem("bw_rt") || "{}");
      const a = all[this._game] = all[this._game] || { n: 0, ok: 0, ms: [] };
      a.n++; if (ok) a.ok++;
      a.ms.push(Math.round(dt));
      if (a.ms.length > 100) a.ms.shift(); // 최근 100개만 (중앙값용)
      localStorage.setItem("bw_rt", JSON.stringify(all));
    } catch {}
  },
  sessAvg() { return this._sess && this._sess.n >= 3 ? this._sess.sum / this._sess.n / 1000 : null; },
  median(gameId) {
    try {
      const a = JSON.parse(localStorage.getItem("bw_rt") || "{}")[gameId];
      if (!a || a.ms.length < 30) return null;
      const s = [...a.ms].sort((x, y) => x - y);
      return s[Math.floor(s.length / 2)];
    } catch { return null; }
  }
};

// 공통 연출(FX) + 유틸
window.FX = {
  _combo: 0, _lastGood: 0,
  flash(ok) {
    // 자체 콤보 추적: 2.5초 내 연속 정답이면 효과음 피치 상승
    const now = Date.now();
    if (ok) { this._combo = (now - this._lastGood < 2500) ? this._combo + 1 : 0; this._lastGood = now; }
    else this._combo = 0;
    if (window.RT) RT.note(ok);
    if (window.SND) ok ? SND.good(this._combo) : SND.bad();
    if (navigator.vibrate) navigator.vibrate(ok ? 15 : [50, 40, 50]); // 햅틱 손맛
    this.judge(ok);
    if (ok && this._combo > 0 && this._combo % 5 === 0) this.comboBurst(this._combo + 1);
    const el = document.getElementById("game-area");
    if (!el) return;
    el.classList.remove("fx-good", "fx-bad");
    void el.offsetWidth;
    el.classList.add(ok ? "fx-good" : "fx-bad");
  },
  // 닌텐도식 ⭕/❌ 대형 판정 오버레이 (짧고 반투명 — 리듬 안 깨게)
  judge(ok) {
    const j = document.createElement("div");
    j.className = "judge " + (ok ? "judge-o" : "judge-x");
    j.textContent = ok ? "◯" : "✕";
    document.body.appendChild(j);
    setTimeout(() => j.remove(), 420);
  },
  // 콤보 마일스톤(5·10·15…) — 미니 축포 + 문구 팝
  comboBurst(n) {
    const t = document.createElement("div");
    t.className = "combo-float";
    t.textContent = `🔥 ${n}연속!`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 900);
    const COLORS = ["#D31145", "#F2876B", "#FFD34D"];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("span");
      s.className = "confetti";
      s.style.background = COLORS[i % 3];
      s.style.left = 35 + Math.random() * 30 + "vw";
      s.style.animationDelay = Math.random() * 0.2 + "s";
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 2600);
    }
    if (navigator.vibrate) navigator.vibrate([20, 30, 20, 30, 40]);
  },
  // 숫자 카운트업 (결과 점수 롤링). rAF는 백그라운드 탭에서 멈추므로 최종값 안전판 필수.
  countUp(el, to, suffix, dur) {
    const t0 = performance.now(), D = dur || 700;
    const failsafe = setTimeout(() => { el.textContent = to + suffix; }, D + 150);
    const step = t => {
      const p = Math.min(1, (t - t0) / D);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else clearTimeout(failsafe);
    };
    requestAnimationFrame(step);
  },
  // 드럼롤 숫자 플리커 후 공개 (뇌 나이 발표)
  reveal(el, to, suffix, onDone) {
    if (window.SND) SND.drumroll(1.6);
    const t0 = performance.now();
    const iv = setInterval(() => {
      el.textContent = (20 + Math.floor(Math.random() * 60)) + suffix;
      if (performance.now() - t0 > 1600) {
        clearInterval(iv);
        el.textContent = to + suffix;
        el.classList.remove("score-big"); void el.offsetWidth; el.classList.add("score-big");
        if (window.SND) SND.crash();
        onDone && onDone();
      }
    }, 70);
  },
  confetti() {
    if (window.SND) SND.fanfare();
    // AIA 브랜드 팔레트 색종이 (레드·살몬·퍼플·차콜)
    const COLORS = ["#D31145", "#F2876B", "#8A6BBC", "#1A1A1A", "#FBA48A", "#B70D3A"];
    for (let i = 0; i < 30; i++) {
      const s = document.createElement("span");
      s.className = "confetti";
      s.style.background = COLORS[i % COLORS.length];
      s.style.left = Math.random() * 100 + "vw";
      s.style.animationDelay = Math.random() * 0.6 + "s";
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 3000);
    }
  }
};

window.BW_UTIL = {
  rand: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  shuffle: a => [...a].sort(() => Math.random() - 0.5),
  // 정답 주변 4지선다 생성
  choicesAround(ans, spread) {
    const set = new Set([ans]);
    while (set.size < 4) {
      const d = ans + window.BW_UTIL.rand(-spread, spread);
      if (d !== ans && d >= 0) set.add(d);
    }
    return window.BW_UTIL.shuffle([...set]);
  },
  // 4지선다 버튼 렌더 (숫자/이모지 공용)
  renderChoices(el, opts, onPick) {
    el.innerHTML = "";
    opts.forEach(v => {
      const b = document.createElement("button");
      b.className = "choice-btn";
      b.textContent = v;
      b.onclick = () => onPick(v, b);
      el.appendChild(b);
    });
  },
  // 콤보 문구
  comboText(streak) { return streak >= 3 ? ` 🔥${streak}연속!` : ""; },
  // 속도 등급 (목표시간/실제시간 비율)
  speedGrade(r) {
    return r >= 1 ? "🚀 로켓급!" : r >= 0.8 ? "🚄 고속열차급" : r >= 0.6 ? "🚗 자동차급" : r >= 0.4 ? "🚲 자전거급" : "🚶 산책급";
  },
  // 목표 문항 수 자동 교정: 실측 반응시간 중앙값(표본 30+)이 있으면 그걸로, 없으면 기본값
  targetFor(gameId, fallback, durationSec) {
    const med = window.RT ? RT.median(gameId) : null;
    if (!med) return fallback;
    const t = Math.round((durationSec * 1000 / med) * 0.9); // 중앙값 속도의 90%를 만점 기준으로
    return Math.max(Math.round(fallback * 0.7), Math.min(fallback * 2, t));
  },
  // 답 버튼 정답/오답 플래시
  markBtn(b, ok) {
    if (!b || !b.classList) return;
    b.classList.remove("btn-good", "btn-bad");
    void b.offsetWidth;
    b.classList.add(ok ? "btn-good" : "btn-bad");
  }
};
