// 사운드 — WebAudio 합성 (외부 파일 없음). 브라우저 정책상 첫 사용자 입력 후 활성화.
window.SND = (function () {
  let ctx = null, master = null, bgmTimer = null, bgmStep = 0;
  let enabled = true;

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.25;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // 단일 톤: 주파수, 길이, 파형, 볼륨, 시작 지연
  function tone(freq, dur, type, vol, delay) {
    if (!enabled) return;
    const c = ac();
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0]; // C5 D5 E5 G5 A5

  return {
    setEnabled(v) { enabled = v; if (!v) this.bgmStop(); },
    good() { tone(660, 0.09, "triangle", 0.5); tone(880, 0.12, "triangle", 0.5, 0.07); },
    bad() { tone(160, 0.18, "sawtooth", 0.35); tone(120, 0.2, "sawtooth", 0.25, 0.05); },
    tick() { tone(1000, 0.05, "square", 0.15); },
    start() { tone(523, 0.1, "triangle", 0.4); tone(659, 0.1, "triangle", 0.4, 0.1); tone(784, 0.16, "triangle", 0.45, 0.2); },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.5, i * 0.13));
      tone(1319, 0.4, "triangle", 0.4, 0.55);
    },
    // 잔잔한 마림바풍 배경 루프 (게임 중에만)
    bgmStart() {
      if (!enabled || bgmTimer) return;
      ac();
      bgmTimer = setInterval(() => {
        if (!enabled) return;
        const seq = [0, 2, 4, 2, 3, 1, 2, 0];
        const f = PENTA[seq[bgmStep % seq.length]] / 2; // 한 옥타브 아래
        tone(f, 0.5, "sine", 0.07);
        bgmStep++;
      }, 600);
    },
    bgmStop() { clearInterval(bgmTimer); bgmTimer = null; }
  };
})();
