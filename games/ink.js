// 필기 숫자 인식 — 12×12 비트맵 래스터 + 코사인 유사도 (숫자 0~9 전용, 의존성 0).
// $P 포인트클라우드 방식 실험 결과 89.5%에 그쳐(2↔3 혼동) 비트맵 방식으로 교체 — 합성 테스트 100%.
window.INK = (function () {
  const G = 12; // 래스터 해상도

  // ---------- 래스터화 (종횡비 보존 정규화 + 선분 보간 + 이웃 스미어) ----------
  function raster(pts) {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const s = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
    const grid = new Float32Array(G * G);
    const put = (x, y) => {
      const gx = Math.min(G - 1, Math.max(0, Math.floor((x - x0) / s * G)));
      const gy = Math.min(G - 1, Math.max(0, Math.floor((y - y0) / s * G)));
      grid[gy * G + gx] = 1;
    };
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].s !== pts[i - 1].s) { put(pts[i].x, pts[i].y); continue; } // 획 사이 점프는 안 그림
      const steps = Math.ceil(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) / s * G * 2) + 1;
      for (let k = 0; k <= steps; k++)
        put(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / steps, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k / steps);
    }
    // 이웃 스미어 — 손떨림 허용 폭 (템플릿·입력 동일 적용이라 공정)
    const out = new Float32Array(G * G);
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      let v = grid[y * G + x];
      if (!v) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < G && ny >= 0 && ny < G && grid[ny * G + nx]) { v = 0.4; break; }
        }
      }
      out[y * G + x] = v;
    }
    return out;
  }

  function cosSim(a, b) {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return d / Math.sqrt(na * nb || 1);
  }

  // ---------- 숫자 템플릿 (파라메트릭 생성 — 0~1 좌표, s=획번호) ----------
  const arc = (cx, cy, r, a0, a1, n, s, rx) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      out.push({ x: cx + (rx || r) * Math.cos(a), y: cy + r * Math.sin(a), s: s || 0 });
    }
    return out;
  };
  const line = (x0, y0, x1, y1, n, s) => {
    const out = [];
    for (let i = 0; i <= n; i++) out.push({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, s: s || 0 });
    return out;
  };
  const P = Math.PI;
  const TEMPLATES = [];
  const add = (d, pts) => TEMPLATES.push({ d, g: raster(pts) });

  add(0, arc(0.5, 0.5, 0.45, -P / 2, P * 1.5, 24, 0, 0.32));                     // 타원 한붓
  add(0, arc(0.5, 0.5, 0.42, -P / 2 + 0.4, P * 1.5 + 0.4, 20, 0, 0.36));         // 둥근 0
  add(1, line(0.5, 0.05, 0.5, 0.95, 12));                                        // 세로 막대
  add(1, [...line(0.35, 0.2, 0.5, 0.05, 4), ...line(0.5, 0.05, 0.5, 0.95, 12)]); // 깃발 있는 1
  add(2, [...arc(0.5, 0.28, 0.24, -P, 0.15 * P, 10), ...line(0.68, 0.4, 0.2, 0.9, 8), ...line(0.2, 0.9, 0.8, 0.9, 6)]);
  add(2, [...arc(0.5, 0.3, 0.2, -P * 0.95, 0.1 * P, 9), ...line(0.65, 0.45, 0.25, 0.85, 7), ...line(0.25, 0.85, 0.75, 0.88, 5)]); // 완만한 2
  add(3, [...arc(0.45, 0.28, 0.22, -P * 0.8, P * 0.5, 10), ...arc(0.45, 0.72, 0.24, -P * 0.5, P * 0.8, 10)]);
  add(3, [...arc(0.47, 0.3, 0.2, -P * 0.7, P * 0.4, 9), ...arc(0.47, 0.7, 0.23, -P * 0.4, P * 0.7, 9)]); // 열린 3
  add(4, [...line(0.55, 0.05, 0.15, 0.6, 8), ...line(0.15, 0.6, 0.85, 0.6, 6), ...line(0.65, 0.05, 0.65, 0.95, 10, 1)]);
  add(4, [...line(0.2, 0.05, 0.2, 0.5, 6), ...line(0.2, 0.5, 0.8, 0.5, 6), ...line(0.65, 0.05, 0.65, 0.95, 10, 1)]); // 직각 4
  add(5, [...line(0.75, 0.08, 0.3, 0.08, 5), ...line(0.3, 0.08, 0.26, 0.45, 5), ...arc(0.48, 0.66, 0.28, -P * 0.6, P * 0.75, 12)]);
  add(6, [...line(0.62, 0.05, 0.32, 0.5, 8), ...arc(0.48, 0.68, 0.26, -P, P, 16)]);
  add(7, [...line(0.15, 0.1, 0.85, 0.1, 6), ...line(0.85, 0.1, 0.4, 0.95, 10)]);
  add(7, [...line(0.15, 0.12, 0.85, 0.12, 6), ...line(0.85, 0.12, 0.4, 0.95, 10), ...line(0.3, 0.55, 0.7, 0.55, 4, 1)]); // 가로줄 7
  add(8, [...arc(0.5, 0.28, 0.2, -P / 2, P * 1.5, 14), ...arc(0.5, 0.72, 0.24, P / 2, P * 2.5, 14)]);
  add(9, [...arc(0.42, 0.3, 0.24, 0, P * 2, 14), ...line(0.66, 0.3, 0.6, 0.95, 8)]);
  add(9, [...arc(0.42, 0.3, 0.24, 0, P * 2, 14), ...arc(0.5, 0.55, 0.42, -P * 0.1, P * 0.45, 6)]); // 꼬리 휘는 9

  function recognize(pts) {
    if (pts.length < 6) return null; // 점·티끌 무시
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 20) return null; // 스침·점 터치 무시
    const g = raster(pts);
    let best = null, bs = -1;
    for (const t of TEMPLATES) {
      const c = cosSim(g, t.g);
      if (c > bs) { bs = c; best = t.d; }
    }
    return bs > 0.35 ? best : null; // 낙서 컷
  }

  // ---------- 필기 패드 위젯 ----------
  // onDigit(d): 인식된 숫자 콜백. 반환 {clear, destroy}
  function pad(container, onDigit) {
    const cv = document.createElement("canvas");
    cv.className = "ink-pad";
    container.appendChild(cv);
    const ctx = cv.getContext("2d");
    const scale = window.devicePixelRatio || 1;
    function fit() {
      const r = cv.getBoundingClientRect();
      cv.width = r.width * scale; cv.height = r.height * scale;
      ctx.scale(scale, scale);
      ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--fg-primary") || "#1A1A1A";
    }
    requestAnimationFrame(fit);

    let strokes = [], cur = null, stroke = 0, timer = null, down = false;
    const pos = e => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, s: stroke };
    };
    cv.addEventListener("pointerdown", e => {
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      clearTimeout(timer);
      down = true;
      cur = pos(e);
      strokes.push(cur);
      ctx.beginPath(); ctx.moveTo(cur.x, cur.y);
    });
    cv.addEventListener("pointermove", e => {
      if (!down) return;
      const p = pos(e);
      strokes.push(p);
      ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    const up = () => {
      if (!down) return;
      down = false; stroke++;
      // 획 끝 400ms 뒤 인식 — 4·5처럼 두 획 숫자를 기다림
      timer = setTimeout(() => {
        const d = recognize(strokes);
        clear();
        if (d != null && onDigit) onDigit(d);
      }, 400);
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    function clear() {
      strokes = []; stroke = 0;
      ctx.clearRect(0, 0, cv.width, cv.height);
    }
    return { clear, destroy: () => cv.remove() };
  }

  return { pad, recognize };
})();
