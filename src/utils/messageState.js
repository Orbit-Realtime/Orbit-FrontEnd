/**
 * prev와 incoming을 chatId 기준으로 병합한다.
 *
 * 우선순위: prev > incoming
 * - READ_EVENT 등으로 이미 갱신된 prev 항목을 stale한 history 응답이 덮어쓰지 못하게 한다.
 * - WS CHAT_MESSAGE와 HTTP history fetch가 같은 chatId를 동시에 전달할 때 중복을 제거한다.
 * - incoming에만 존재하는 항목(WS 신규 메시지 또는 미포함 history 항목)은 추가한다.
 * - 병합 후 chatId 오름차순으로 정렬한다.
 *
 * @param {Array<{chatId: number}>} prev - 현재 메시지 상태 (WS 처리 결과 포함)
 * @param {Array<{chatId: number}>} incoming - 새로 도착한 메시지 배열 (history 또는 WS)
 * @returns {Array<{chatId: number}>}
 */
export function mergeMessagesById(prev, incoming) {
  const map = new Map();
  for (const msg of incoming) map.set(msg.chatId, msg);
  // prev가 나중에 덮어써서 우선순위를 가진다
  for (const msg of prev) map.set(msg.chatId, msg);
  return Array.from(map.values()).sort((a, b) => a.chatId - b.chatId);
}

/**
 * Discussion 메시지를 discussionMessageId 기준으로 병합한다.
 *
 * 우선순위: prev > incoming
 * - prev에 이미 존재하는 메시지는 유지
 * - incoming에만 있는 메시지는 추가
 * - 병합 후 discussionMessageId 오름차순 정렬
 *
 * @param {Array<{discussionMessageId: number}>} prev
 * @param {Array<{discussionMessageId: number}>} incoming
 * @returns {Array<{discussionMessageId: number}>}
 */
export function mergeDiscussionMessagesById(prev, incoming) {
  const map = new Map();
  for (const msg of incoming) map.set(msg.discussionMessageId, msg);
  // prev가 나중에 덮어써서 우선순위를 가진다
  for (const msg of prev) map.set(msg.discussionMessageId, msg);
  return Array.from(map.values()).sort(
    (a, b) => a.discussionMessageId - b.discussionMessageId
  );
}
