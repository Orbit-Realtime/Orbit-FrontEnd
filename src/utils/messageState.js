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
 * 서버 echo의 clientMessageId와 일치하는 pending message를 제거한다.
 *
 * - clientMessageId가 없으면 pendingMessages를 그대로 반환한다.
 * - 일치하는 항목이 없어도 안전하게 동작한다 (idempotent).
 *
 * @param {Array<{clientMessageId: string}>} pendingMessages
 * @param {string|null|undefined} clientMessageId - 서버 echo의 clientMessageId
 * @returns {Array<{clientMessageId: string}>}
 */
export function removePendingByClientMessageId(pendingMessages, clientMessageId) {
  if (!clientMessageId) return pendingMessages;
  return pendingMessages.filter((p) => p.clientMessageId !== clientMessageId);
}

/**
 * clientMessageId와 일치하는 pending message의 status를 "sending"에서 "failed"로 변경한다.
 *
 * - status가 "sending"인 항목만 대상으로 한다 (이미 "failed"이거나 echo로 제거된 항목은 건드리지 않음, idempotent).
 * - 일치하는 항목이 없으면 pendingMessages를 그대로 반환한다.
 *
 * @param {Array<{clientMessageId: string, status: string}>} pendingMessages
 * @param {string} clientMessageId - timeout이 만료된 pending message의 clientMessageId
 * @returns {Array<{clientMessageId: string, status: string}>}
 */
export function markPendingMessageFailed(pendingMessages, clientMessageId) {
  return pendingMessages.map((p) =>
    p.clientMessageId === clientMessageId && p.status === "sending"
      ? { ...p, status: "failed" }
      : p
  );
}

/**
 * READ_EVENT를 받아 messages 배열에 unreadMemberCount 감소를 적용한다.
 *
 * 정책:
 * - previousLastReadChatId < chatId <= currentLastReadChatId 범위에 해당하는 메시지만 대상
 * - 이벤트를 발생시킨 멤버 본인의 메시지는 제외
 * - unreadMemberCount는 0 아래로 내려가지 않는다
 *
 * @param {Array<{chatId: number, senderId: number, unreadMemberCount: number}>} messages
 * @param {{ memberId: number, previousLastReadChatId: number|null, currentLastReadChatId: number }} readEvent
 * @returns {Array}
 */
export function applyReadEvent(messages, readEvent) {
  const previous = readEvent.previousLastReadChatId;
  const current = readEvent.currentLastReadChatId;
  return messages.map((msg) => {
    const inRange =
      (previous === null || msg.chatId > previous) &&
      msg.chatId <= current;
    const isReadMemberOwnMessage = msg.senderId === readEvent.memberId;
    if (!inRange || isReadMemberOwnMessage) {
      return msg;
    }
    return {
      ...msg,
      unreadMemberCount: Math.max(0, msg.unreadMemberCount - 1),
    };
  });
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
