import { mergeMessagesById, mergeDiscussionMessagesById, applyReadEvent } from '../../utils/messageState';

test('history 응답이 늦게 도착해도 동일 chatId 메시지는 중복되지 않는다', () => {
  // WS로 먼저 도착한 메시지가 READ_EVENT로 갱신된 상태
  const prev = [{ chatId: 4, content: 'ws-msg', unreadMemberCount: 3 }];
  // 이후 도착한 history 응답 — chatId 4가 stale 값(5)으로 중복 포함
  const incoming = [
    { chatId: 1, content: 'A', unreadMemberCount: 0 },
    { chatId: 2, content: 'B', unreadMemberCount: 0 },
    { chatId: 3, content: 'C', unreadMemberCount: 0 },
    { chatId: 4, content: 'ws-msg', unreadMemberCount: 5 },
  ];

  const result = mergeMessagesById(prev, incoming);

  expect(result).toHaveLength(4);
  expect(result.map((m) => m.chatId)).toEqual([1, 2, 3, 4]);
  // prev 우선 — READ_EVENT로 갱신된 값(3)이 stale history 값(5)에 덮이지 않는다
  expect(result[3].unreadMemberCount).toBe(3);
});

test('WS로 먼저 수신된 메시지는 늦게 도착한 history 응답에 의해 유실되지 않는다', () => {
  // history가 먼저 도착해 set된 상태
  const afterHistory = mergeMessagesById([], [
    { chatId: 1, content: 'A' },
    { chatId: 2, content: 'B' },
  ]);

  // 이후 WS 신규 메시지 도착
  const result = mergeMessagesById(afterHistory, [{ chatId: 3, content: 'C' }]);

  expect(result).toHaveLength(3);
  expect(result.map((m) => m.chatId)).toEqual([1, 2, 3]);
  expect(result[2].content).toBe('C');
});

test('메시지 병합 결과는 chatId 오름차순을 유지한다', () => {
  const prev = [{ chatId: 5 }, { chatId: 3 }];
  const incoming = [{ chatId: 1 }, { chatId: 4 }, { chatId: 2 }];

  const result = mergeMessagesById(prev, incoming);

  expect(result.map((m) => m.chatId)).toEqual([1, 2, 3, 4, 5]);
});

test('Discussion sync 응답이 늦게 도착해도 WS 메시지는 유실되지 않는다', () => {
  // WS로 먼저 도착한 Discussion 메시지
  const prev = [{ discussionMessageId: 4, content: 'ws-discussion' }];
  // 이후 도착한 sync 응답 — id 4 미포함 (fetch 시점 이후 저장됨)
  const incoming = [
    { discussionMessageId: 1 },
    { discussionMessageId: 2 },
    { discussionMessageId: 3 },
  ];

  const result = mergeDiscussionMessagesById(prev, incoming);

  expect(result).toHaveLength(4);
  expect(result.map((m) => m.discussionMessageId)).toEqual([1, 2, 3, 4]);
  // prev 우선 — WS로 받은 메시지가 유지된다
  expect(result[3].content).toBe('ws-discussion');
});

test('동일 discussionMessageId 메시지는 중복 병합되지 않는다', () => {
  const prev = [{ discussionMessageId: 1 }, { discussionMessageId: 2 }];
  // sync 응답이 동일한 id를 포함
  const incoming = [{ discussionMessageId: 1 }, { discussionMessageId: 2 }];

  const result = mergeDiscussionMessagesById(prev, incoming);

  expect(result).toHaveLength(2);
  expect(result.map((m) => m.discussionMessageId)).toEqual([1, 2]);
});

test('Discussion 메시지 병합 결과는 discussionMessageId 오름차순을 유지한다', () => {
  const prev = [{ discussionMessageId: 5 }, { discussionMessageId: 3 }];
  const incoming = [
    { discussionMessageId: 1 },
    { discussionMessageId: 4 },
    { discussionMessageId: 2 },
  ];

  const result = mergeDiscussionMessagesById(prev, incoming);

  expect(result.map((m) => m.discussionMessageId)).toEqual([1, 2, 3, 4, 5]);
});

// ── applyReadEvent ─────────────────────────────────────────────────────────

test('READ_EVENT 범위에 포함된 메시지만 unreadMemberCount가 감소한다', () => {
  const messages = [
    { chatId: 1, senderId: 99, unreadMemberCount: 3 },
    { chatId: 2, senderId: 99, unreadMemberCount: 3 },
    { chatId: 3, senderId: 99, unreadMemberCount: 3 },
    { chatId: 4, senderId: 99, unreadMemberCount: 3 },
  ];
  const readEvent = {
    memberId: 42,
    previousLastReadChatId: 2,
    currentLastReadChatId: 3,
  };

  const result = applyReadEvent(messages, readEvent);

  // chatId 1, 2: 범위 밖 → 변화 없음
  expect(result[0].unreadMemberCount).toBe(3);
  expect(result[1].unreadMemberCount).toBe(3);
  // chatId 3: 범위 안 (2 < 3 <= 3) → 감소
  expect(result[2].unreadMemberCount).toBe(2);
  // chatId 4: 범위 밖 (4 > 3) → 변화 없음
  expect(result[3].unreadMemberCount).toBe(3);
});

test('READ_EVENT를 발생시킨 사용자의 메시지는 unreadMemberCount가 감소하지 않는다', () => {
  const messages = [
    { chatId: 1, senderId: 42, unreadMemberCount: 3 }, // 이벤트 발생자 본인 메시지
    { chatId: 2, senderId: 99, unreadMemberCount: 3 }, // 다른 멤버 메시지
  ];
  const readEvent = {
    memberId: 42,
    previousLastReadChatId: null,
    currentLastReadChatId: 2,
  };

  const result = applyReadEvent(messages, readEvent);

  // 본인 메시지 → 감소하지 않음
  expect(result[0].unreadMemberCount).toBe(3);
  // 다른 멤버 메시지 → 감소
  expect(result[1].unreadMemberCount).toBe(2);
});

test('unreadMemberCount는 0 아래로 내려가지 않는다', () => {
  const messages = [
    { chatId: 1, senderId: 99, unreadMemberCount: 0 },
  ];
  const readEvent = {
    memberId: 42,
    previousLastReadChatId: null,
    currentLastReadChatId: 1,
  };

  const result = applyReadEvent(messages, readEvent);

  expect(result[0].unreadMemberCount).toBe(0);
});
