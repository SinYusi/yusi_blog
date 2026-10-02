// 날짜는 서버(UTC)와 방문자 위치에 상관없이 한국 시간 기준으로 표시합니다. 빌드 결과가 환경에 따라 달라지지 않습니다.
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 2026-09-28 형식 */
export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 2026-10-05 09:00 형식 (한국 시간) */
export function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date).replace(", ", " ");
}
