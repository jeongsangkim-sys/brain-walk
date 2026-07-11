// 온라인 기록판 — 구글 시트 Apps Script 연동 (선택 기능)
// URL 미설정이면 전부 조용히 무시. 실패해도 게임 진행에 영향 없음.
window.CLOUD = (function () {
  const KEY = "bw_cloud";
  const url = () => { try { return JSON.parse(localStorage.getItem(KEY)) || ""; } catch { return ""; } };

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
