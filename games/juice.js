// 공통 연출(FX) + 유틸
window.FX = {
  flash(ok) {
    if (window.SND) SND[ok ? "good" : "bad"]();
    const el = document.getElementById("game-area");
    if (!el) return;
    el.classList.remove("fx-good", "fx-bad");
    void el.offsetWidth;
    el.classList.add(ok ? "fx-good" : "fx-bad");
  },
  confetti() {
    if (window.SND) SND.fanfare();
    const EMO = ["🎉", "✨", "⭐", "🎊"];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement("span");
      s.className = "confetti";
      s.textContent = EMO[i % 4];
      s.style.left = Math.random() * 100 + "vw";
      s.style.animationDelay = Math.random() * 0.6 + "s";
      s.style.fontSize = 18 + Math.random() * 22 + "px";
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
  comboText(streak) { return streak >= 3 ? ` 🔥${streak}연속!` : ""; }
};
