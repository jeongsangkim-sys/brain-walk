// 두뇌 산책 서비스워커 — 알림 전용. 캐싱 의도적으로 없음(스테일 에셋 함정 방지, index.html의 ?v= 버스팅이 유일한 캐시 전략).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// app.js와 동일한 로컬(한국) 날짜 키 — toISOString(UTC) 금지
const localDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function lastTrained() {
  try {
    const cache = await caches.open("bw-meta");
    const res = await cache.match("/bw-last-trained");
    return res ? (await res.text()) : "";
  } catch { return ""; }
}

self.addEventListener("periodicsync", e => {
  if (e.tag !== "bw-reminder") return;
  e.waitUntil((async () => {
    const now = new Date();
    const hh = now.getHours();
    if (hh < 9 || hh >= 21) return; // 밤·이른 아침엔 조용히
    if ((await lastTrained()) === localDate(now)) return; // 오늘 이미 산책함
    // 앱이 이미 열려 있으면 알림 불필요
    const wins = await self.clients.matchAll({ type: "window" });
    if (wins.length) return;
    await self.registration.showNotification("두뇌 산책 🐾", {
      body: "오늘의 훈련이 기다리고 있어요 — 3분이면 끝!",
      icon: "assets/icon-192.png",
      badge: "assets/icon-192.png",
      tag: "bw-daily-reminder" // 하루 여러 번 sync 와도 알림은 1개로 교체
    });
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window" });
    if (wins.length) return wins[0].focus();
    return self.clients.openWindow("./");
  })());
});
