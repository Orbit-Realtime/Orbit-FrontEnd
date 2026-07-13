import { sortSpaces, applyRoomMessageSummary, mergeSpaceSnapshot } from '../../utils/spaceState';

// ── applyRoomMessageSummary ─────────────────────────────────────────────────

test('최신 summary가 도착하면 lastMessage/lastChatId/createdDate가 갱신되고 title은 유지된다', () => {
  const spaces = [
    { chatRoomId: 1, title: '개발팀', lastMessage: 'old', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
  ];
  const event = { chatRoomId: 1, lastMessage: 'new message', lastChatId: 11, createdDate: '2026-01-02T00:00:00' };

  const result = applyRoomMessageSummary(spaces, event, false);

  expect(result[0].lastMessage).toBe('new message');
  expect(result[0].lastChatId).toBe(11);
  expect(result[0].createdDate).toBe('2026-01-02T00:00:00');
  expect(result[0].title).toBe('개발팀');
});

test('비활성 방(isActiveSpace=false)은 unreadMessageCount가 1 증가한다', () => {
  const spaces = [
    { chatRoomId: 1, title: '개발팀', lastMessage: 'old', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 2 },
  ];
  const event = { chatRoomId: 1, lastMessage: 'new message', lastChatId: 11, createdDate: '2026-01-02T00:00:00' };

  const result = applyRoomMessageSummary(spaces, event, false);

  expect(result[0].unreadMessageCount).toBe(3);
});

test('선택된 방이라도 isActiveSpace가 false로 전달되면 unreadMessageCount가 증가한다(selected != active 회귀 방지)', () => {
  // 순수 함수는 selected 여부를 알지 못한다 — 호출부가 isSpaceActive(spaceId) 판정을 boolean으로 넘겨야 한다.
  // 방이 선택돼 있어도 document가 background거나 window가 unfocused면 isActiveSpace=false가 전달돼야 하고,
  // 그 경우에도 unread는 증가해야 한다.
  const spaces = [
    { chatRoomId: 1, title: '선택된 방(백그라운드)', lastMessage: 'old', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
  ];
  const event = { chatRoomId: 1, lastMessage: 'new message while backgrounded', lastChatId: 11, createdDate: '2026-01-02T00:00:00' };

  const result = applyRoomMessageSummary(spaces, event, false);

  expect(result[0].unreadMessageCount).toBe(1);
});

test('unreadMessageCount가 없으면 0으로 간주하고 1 증가한다', () => {
  const spacesUndefined = [
    { chatRoomId: 1, title: '개발팀', lastChatId: 10, createdDate: '2026-01-01T00:00:00' },
  ];
  const spacesNull = [
    { chatRoomId: 1, title: '개발팀', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: null },
  ];
  const event = { chatRoomId: 1, lastMessage: 'new message', lastChatId: 11, createdDate: '2026-01-02T00:00:00' };

  expect(applyRoomMessageSummary(spacesUndefined, event, false)[0].unreadMessageCount).toBe(1);
  expect(applyRoomMessageSummary(spacesNull, event, false)[0].unreadMessageCount).toBe(1);
});

test('활성 방(isActiveSpace=true)은 unreadMessageCount가 0이 된다', () => {
  const spaces = [
    { chatRoomId: 1, title: '개발팀', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 5 },
  ];
  const event = { chatRoomId: 1, lastMessage: 'new message', lastChatId: 11, createdDate: '2026-01-02T00:00:00' };

  const result = applyRoomMessageSummary(spaces, event, true);

  expect(result[0].unreadMessageCount).toBe(0);
});

test('incoming.lastChatId가 현재와 동일하면(중복) 이벤트를 무시하고 unread도 증가하지 않는다', () => {
  const spaces = [
    { chatRoomId: 1, title: '개발팀', lastMessage: 'old', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 2 },
  ];
  const event = { chatRoomId: 1, lastMessage: 'duplicate', lastChatId: 10, createdDate: '2026-01-02T00:00:00' };

  const result = applyRoomMessageSummary(spaces, event, false);

  expect(result).toBe(spaces);
  expect(result[0].lastMessage).toBe('old');
  expect(result[0].unreadMessageCount).toBe(2);
});

test('incoming.lastChatId가 현재보다 작으면(역전) 이벤트를 무시하고 unread도 증가하지 않는다', () => {
  const spaces = [
    { chatRoomId: 1, title: '개발팀', lastMessage: 'newer', lastChatId: 10, createdDate: '2026-01-02T00:00:00', unreadMessageCount: 2 },
  ];
  const event = { chatRoomId: 1, lastMessage: 'stale', lastChatId: 9, createdDate: '2026-01-01T00:00:00' };

  const result = applyRoomMessageSummary(spaces, event, false);

  expect(result).toBe(spaces);
  expect(result[0].lastMessage).toBe('newer');
  expect(result[0].unreadMessageCount).toBe(2);
});

test('event.chatRoomId와 일치하는 Space가 없으면 spaces를 그대로 반환한다', () => {
  const spaces = [
    { chatRoomId: 1, title: '개발팀', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
  ];
  const event = { chatRoomId: 999, lastMessage: 'hello', lastChatId: 1, createdDate: '2026-01-02T00:00:00' };

  const result = applyRoomMessageSummary(spaces, event, false);

  expect(result).toBe(spaces);
});

test('summary 적용 후 createdDate 기준으로 재정렬된다', () => {
  const spaces = [
    { chatRoomId: 1, title: '오래된 방', lastChatId: 1, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
    { chatRoomId: 2, title: '최근 방', lastChatId: 5, createdDate: '2026-01-03T00:00:00', unreadMessageCount: 0 },
  ];
  // 1번 방에 새 메시지가 도착 → 2번 방보다 최신이 됨
  const event = { chatRoomId: 1, lastMessage: 'hi', lastChatId: 2, createdDate: '2026-01-05T00:00:00' };

  const result = applyRoomMessageSummary(spaces, event, false);

  expect(result.map((s) => s.chatRoomId)).toEqual([1, 2]);
});

// ── mergeSpaceSnapshot ───────────────────────────────────────────────────────

test('snapshot이 local보다 최신이면 snapshot summary를 사용한다', () => {
  const current = [
    { chatRoomId: 1, title: '개발팀', lastMessage: 'old', lastChatId: 5, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 1 },
  ];
  const snapshot = [
    { chatRoomId: 1, title: '개발팀', lastMessage: 'newer from server', lastChatId: 10, createdDate: '2026-01-02T00:00:00', unreadMessageCount: 0 },
  ];

  const result = mergeSpaceSnapshot(current, snapshot);

  expect(result[0].lastMessage).toBe('newer from server');
  expect(result[0].lastChatId).toBe(10);
  expect(result[0].unreadMessageCount).toBe(0);
});

test('lastChatId가 같으면 snapshot 값을 그대로 사용해 unread 등을 서버 기준으로 보정한다', () => {
  const current = [
    { chatRoomId: 1, title: '개발팀', lastMessage: 'msg', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 3 },
  ];
  const snapshot = [
    { chatRoomId: 1, title: '개발팀', lastMessage: 'msg', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
  ];

  const result = mergeSpaceSnapshot(current, snapshot);

  expect(result[0]).toEqual(snapshot[0]);
});

test('local summary가 snapshot보다 최신이면 snapshot의 title은 유지하고 summary 필드는 local 값을 보존한다', () => {
  const current = [
    { chatRoomId: 1, title: '개발팀', lastMessage: 'local newest', lastChatId: 20, createdDate: '2026-01-03T00:00:00', unreadMessageCount: 4 },
  ];
  const snapshot = [
    { chatRoomId: 1, title: '변경된 제목', lastMessage: 'stale', lastChatId: 10, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
  ];

  const result = mergeSpaceSnapshot(current, snapshot);

  expect(result[0].title).toBe('변경된 제목');
  expect(result[0].lastMessage).toBe('local newest');
  expect(result[0].lastChatId).toBe(20);
  expect(result[0].createdDate).toBe('2026-01-03T00:00:00');
  expect(result[0].unreadMessageCount).toBe(4);
});

test('local에만 있는 Space는 결과에서 제거되고, snapshot에만 있는 Space는 추가된다', () => {
  const current = [
    { chatRoomId: 1, title: '방1', lastChatId: 1, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
    { chatRoomId: 2, title: '나간 방', lastChatId: 1, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
  ];
  const snapshot = [
    { chatRoomId: 1, title: '방1', lastChatId: 1, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
    { chatRoomId: 3, title: '새로 초대된 방', lastChatId: 1, createdDate: '2026-01-02T00:00:00', unreadMessageCount: 1 },
  ];

  const result = mergeSpaceSnapshot(current, snapshot);

  expect(result.map((s) => s.chatRoomId).sort()).toEqual([1, 3]);
});

test('local 또는 snapshot의 lastChatId가 없어도 안전하게 병합된다', () => {
  const localMissing = [
    { chatRoomId: 1, title: '방1', createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
  ];
  const snapshotHasChatId = [
    { chatRoomId: 1, title: '방1', lastMessage: 'from server', lastChatId: 5, createdDate: '2026-01-02T00:00:00', unreadMessageCount: 2 },
  ];
  // local에 lastChatId가 없으면 보존할 local summary가 없으므로 snapshot을 사용한다
  expect(mergeSpaceSnapshot(localMissing, snapshotHasChatId)[0]).toEqual(snapshotHasChatId[0]);

  const localHasChatId = [
    { chatRoomId: 1, title: '방1', lastMessage: 'local msg', lastChatId: 5, createdDate: '2026-01-02T00:00:00', unreadMessageCount: 1 },
  ];
  const snapshotMissing = [
    { chatRoomId: 1, title: '방1', createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
  ];
  // snapshot에 lastChatId가 없고 local에는 있으면 local summary가 더 최신이므로 보존한다
  const result = mergeSpaceSnapshot(localHasChatId, snapshotMissing);
  expect(result[0].lastMessage).toBe('local msg');
  expect(result[0].lastChatId).toBe(5);
});

test('병합 결과는 createdDate 기준으로 재정렬된다', () => {
  const current = [
    { chatRoomId: 1, title: '방1', lastChatId: 1, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
  ];
  const snapshot = [
    { chatRoomId: 1, title: '방1', lastChatId: 1, createdDate: '2026-01-01T00:00:00', unreadMessageCount: 0 },
    { chatRoomId: 2, title: '방2', lastChatId: 1, createdDate: '2026-01-05T00:00:00', unreadMessageCount: 0 },
  ];

  const result = mergeSpaceSnapshot(current, snapshot);

  expect(result.map((s) => s.chatRoomId)).toEqual([2, 1]);
});

// ── sortSpaces ───────────────────────────────────────────────────────────────

test('sortSpaces는 createdDate 최신순으로 정렬하고 원본 배열을 변경하지 않는다', () => {
  const spaces = [
    { chatRoomId: 1, createdDate: '2026-01-01T00:00:00' },
    { chatRoomId: 2, createdDate: '2026-01-03T00:00:00' },
    { chatRoomId: 3, createdDate: '2026-01-02T00:00:00' },
  ];

  const result = sortSpaces(spaces);

  expect(result.map((s) => s.chatRoomId)).toEqual([2, 3, 1]);
  expect(spaces.map((s) => s.chatRoomId)).toEqual([1, 2, 3]);
});

test('createdDate가 없는 Space는 뒤로 정렬된다', () => {
  const spaces = [
    { chatRoomId: 1, createdDate: null },
    { chatRoomId: 2, createdDate: '2026-01-01T00:00:00' },
  ];

  const result = sortSpaces(spaces);

  expect(result.map((s) => s.chatRoomId)).toEqual([2, 1]);
});
