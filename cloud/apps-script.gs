/**
 * 두뇌 산책 — 구글 시트 온라인 기록판 (Apps Script)
 *
 * [설정 방법 — 5분, 1회]
 * 1. sheets.google.com 에서 새 스프레드시트 생성 (이름 아무거나, 예: 두뇌산책 기록)
 * 2. 메뉴 확장 프로그램 → Apps Script 클릭
 * 3. 열린 편집기에 이 파일 내용 전체를 붙여넣고 저장
 * 4. 우상단 [배포] → [새 배포] → 유형: 웹 앱
 *    - 실행 계정: 나
 *    - 액세스 권한: **모든 사용자** (익명 포함. 이걸로 해야 게임에서 접근 가능)
 * 5. [배포] 누르고 권한 승인 → 나오는 웹 앱 URL 복사
 *    (https://script.google.com/macros/s/XXXX/exec 형태)
 * 6. 게임 기록 화면 → [🌐 온라인 순위 연결] 버튼 → URL 붙여넣기. 끝.
 *
 * 시트 구조(자동 생성): records 탭 — 날짜 | 이름 | 게임 | 점수
 * 주의: URL을 아는 사람은 누구나 기록을 읽고 쓸 수 있음. 가족/지인 공유용.
 */

const SHEET_NAME = "records";

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["date", "name", "game", "score"]);
  }
  return sh;
}

// 기록 추가: POST body = JSON {name, game, score}
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const name = String(d.name || "게스트").slice(0, 12);
    const game = String(d.game || "").slice(0, 20);
    const score = Math.max(0, Math.min(100, Number(d.score) || 0));
    if (!game) throw new Error("no game");
    sheet_().appendRow([new Date(), name, game, score]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 순위 조회: GET → { games: {게임id: {name, score, date}}, daily: [top10] }
function doGet(e) {
  const rows = sheet_().getDataRange().getValues().slice(1); // 헤더 제외
  const games = {};   // 게임별 1위
  const daily = [];   // 데일리 두뇌 점수 전체
  rows.forEach(r => {
    const [date, name, game, score] = r;
    const rec = { name: String(name), score: Number(score), date: Utilities.formatDate(new Date(date), "Asia/Seoul", "MM-dd") };
    if (game === "daily") {
      daily.push(rec);
    }
    if (!games[game] || rec.score > games[game].score) games[game] = rec;
  });
  daily.sort((a, b) => b.score - a.score);
  return ContentService.createTextOutput(JSON.stringify({
    games,
    daily: daily.slice(0, 10)
  })).setMimeType(ContentService.MimeType.JSON);
}
