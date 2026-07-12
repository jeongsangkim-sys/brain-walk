// 온라인 기록판 — 구글 시트 Apps Script 연동
// 가족용 기본 기록판 URL 내장 (연결 절차 0). ?board= 링크로 다른 시트 덮어쓰기 가능.
window.CLOUD = (function () {
  const KEY = "bw_cloud";
  const DEFAULT = "https://script.google.com/macros/s/AKfycbygJBHULZF2JNuu36aH98nzZYd85T1DOidk1xu4WDvMiZ9glJha03anYVgMVxleY5YL/exec";
  const url = () => { try { return JSON.parse(localStorage.getItem(KEY)) || DEFAULT; } catch { return DEFAULT; } };

  return {
    enabled: () => !!url(),
    setUrl(u) { localStorage.setItem(KEY, JSON.stringify((u || "").trim())); },
    url,

    // 기록 전송 (fire-and-forget). text/plain이라 CORS preflight 없음.
    submit(game, name, score) {
      const u = url();
      if (!u) return;
      fetch(u, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ game, name, score })
      }).catch(() => {});
    },

    // 순위 조회 → {games, daily} 또는 null
    async fetchTop() {
      const u = url();
      if (!u) return null;
      try {
        const r = await fetch(u, { method: "GET" });
        return await r.json();
      } catch { return null; }
    }
  };
})();
