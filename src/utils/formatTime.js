export function formatDateDivider(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dayOfWeek = days[date.getDay()];
  return `${year}년 ${month}월 ${day}일 ${dayOfWeek}요일`;
}

export function formatSpaceTime(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isSameDay) {
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "오후" : "오전";
    const hour = h % 12 || 12;
    return `${ampm} ${hour}:${m}`;
  }

  if (isYesterday) return "어제";

  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}`;
}

export function formatMessageTime(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "오후" : "오전";
  const hour = h % 12 || 12;
  const timeStr = `${ampm} ${hour}:${m}`;

  if (isSameDay) return timeStr;
  if (isYesterday) return `어제 ${timeStr}`;

  const mo = date.getMonth() + 1;
  const d = date.getDate();
  return `${mo}/${d} ${timeStr}`;
}
