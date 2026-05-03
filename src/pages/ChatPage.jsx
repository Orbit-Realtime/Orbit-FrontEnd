import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../socket/useWebSocket";
import { useRoomActivity } from "../socket/useRoomActivity";
import { getChatRooms, leaveChatRoom, renameChatRoom } from "../api/chatRoomApi";
import { getChatHistory } from "../api/chatApi";
import { changeNickname, changePassword } from "../api/memberApi";
import ChatRoomList from "../components/chat/ChatRoomList";
import ChatWindow from "../components/chat/ChatWindow";
import MemberList from "../components/chat/MemberList";
import ChangePasswordModal from "../components/chat/ChangePasswordModal";

const TAB = { ROOMS: "rooms", MEMBERS: "members" };

const sortRooms = (rooms) =>
  [...rooms].sort((a, b) => {
    if (!a.createdDate && !b.createdDate) return 0;
    if (!a.createdDate) return 1;
    if (!b.createdDate) return -1;
    return new Date(b.createdDate) - new Date(a.createdDate);
  });

export default function ChatPage() {
  const navigate = useNavigate();
  const { auth, signout, updateNickname } = useAuth();

  const [tab, setTab] = useState(TAB.ROOMS);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const nicknameInputRef = useRef(null);
  const [chatRooms, setChatRooms] = useState([]);
  const [roomsError, setRoomsError] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lastReadChatId, setLastReadChatId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [oldestChatId, setOldestChatId] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [wsError, setWsError] = useState(null);

  // 재연결 감지용: connected false→true 전환 시 ENTER_ROOM 재전송에 사용
  const selectedRoomIdRef = useRef(null);
  const prevConnectedRef = useRef(false);
  // 초기 연결과 재연결 구분 (초기 마운트 getChatRooms와 재연결 getChatRooms 중복 방지)
  const isInitialConnectRef = useRef(true);
  // getChatHistory 세대 번호 (재연결 연속 발생 시 stale 응답 폐기용)
  const historyFetchIdRef = useRef(0);
  // memberId별 마지막 처리한 currentLastReadChatId 추적 (READ_EVENT 멱등성 보장)
  const memberLastReadRef = useRef({});

  // 채팅방 목록 초기 조회
  useEffect(() => {
    getChatRooms()
      .then((result) => {
        setChatRooms(sortRooms(result.data ?? []));
        setRoomsError(false);
      })
      .catch(() => setRoomsError(true));
  }, []);

  // 채팅방 목록 갱신
  const refreshChatRooms = useCallback(() => {
    getChatRooms()
      .then((result) => {
        setChatRooms(sortRooms(result.data ?? []));
        setRoomsError(false);
      })
      .catch(() => setRoomsError(true));
  }, []);

  // WebSocket 수신 메시지 처리
  const handleMessage = useCallback(
    (data) => {
      switch (data.messageType) {
        case "CHAT_MESSAGE":
          if (data.chatRoomId === selectedRoomId) {
            setMessages((prev) => [...prev, data]);
          }
          break;

        case "UPDATE_CHAT_ROOM":
          setChatRooms((prev) => {
            const roomExists = prev.some((r) => r.chatRoomId === data.chatRoomId);
            if (!roomExists) {
              setTimeout(refreshChatRooms, 0);
              return prev;
            }
            return sortRooms(prev.map((room) => {
              if (room.chatRoomId !== data.chatRoomId) return room;
              if (
                data.lastChatId != null &&
                room.lastChatId != null &&
                data.lastChatId < room.lastChatId
              ) {
                return room;
              }
              return {
                ...room,
                title: data.title ?? room.title,
                lastMessage: data.lastMessage,
                createdDate: data.createdDate,
                lastChatId: data.lastChatId,
                unreadMessageCount: data.chatRoomId === selectedRoomId ? 0 : data.unreadMessageCount,
              };
            }));
          });
          break;

        case "READ_EVENT": {
          if (data.chatRoomId !== selectedRoomId) break;

          const lastProcessed = memberLastReadRef.current[data.memberId] ?? null;
          if (lastProcessed !== null && data.currentLastReadChatId <= lastProcessed) break;

          memberLastReadRef.current[data.memberId] = data.currentLastReadChatId;

          setMessages((prev) =>
            prev.map((msg) => {
              const previous = data.previousLastReadChatId;
              const current = data.currentLastReadChatId;

              const inRange =
                (previous === null || msg.chatId > previous) &&
                msg.chatId <= current;

              const isReadMemberOwnMessage = msg.senderId === data.memberId;

              if (!inRange || isReadMemberOwnMessage) return msg;

              return {
                ...msg,
                unreadMemberCount: Math.max(0, msg.unreadMemberCount - 1),
              };
            })
          );

          break;
        }

        case "ERROR":
          setWsError(data.message);
          break;

        default:
          break;
      }
    },
    [selectedRoomId, refreshChatRooms]
  );

  const { connected, reconnecting, sendEnterRoom, sendChatMessage, sendRoomActive, sendRoomInactive } = useWebSocket(handleMessage);

  const { notifyEntered } = useRoomActivity({ selectedRoomId, connected, sendRoomActive, sendRoomInactive });

  // selectedRoomIdRef를 최신 selectedRoomId로 동기화 (reconnect effect에서 사용)
  useEffect(() => { selectedRoomIdRef.current = selectedRoomId; }, [selectedRoomId]);

  // wsError 자동 소멸 (4초)
  useEffect(() => {
    if (!wsError) return;
    const timer = setTimeout(() => setWsError(null), 4000);
    return () => clearTimeout(timer);
  }, [wsError]);

  // 재연결 시 state recovery: WebSocket이 false→true로 바뀌면 상태 재동기화
  useEffect(() => {
    if (connected && !prevConnectedRef.current) {
      if (!isInitialConnectRef.current) {
        refreshChatRooms();

        const roomId = selectedRoomIdRef.current;
        if (roomId !== null) {
          sendEnterRoom(roomId);
          notifyEntered(roomId);

          memberLastReadRef.current = {};
          setMessages([]);
          setHistoryLoading(true);
          setHistoryError(false);
          const fetchId = ++historyFetchIdRef.current;
          getChatHistory(roomId)
            .then((result) => {
              if (fetchId !== historyFetchIdRef.current) return;
              const { messages: msgs, lastReadChatId: lrcid, hasMore: more } = result.data;
              setMessages(msgs ?? []);
              setLastReadChatId(lrcid ?? null);
              setHasMore(more ?? false);
              setOldestChatId(msgs?.[0]?.chatId ?? null);
              setHistoryError(false);
            })
            .catch(() => {
              if (fetchId !== historyFetchIdRef.current) return;
              setHistoryError(true);
            })
            .finally(() => {
              if (fetchId !== historyFetchIdRef.current) return;
              setHistoryLoading(false);
            });
        }
      }
      isInitialConnectRef.current = false;
    }
    prevConnectedRef.current = connected;
  }, [connected, sendEnterRoom, notifyEntered, refreshChatRooms]);

  // 채팅방 선택
  const handleSelectRoom = useCallback(
    (roomId) => {
      if (roomId === selectedRoomId) return;
      memberLastReadRef.current = {};
      setSelectedRoomId(roomId);
      setMessages([]);
      setLastReadChatId(null);
      setHasMore(false);
      setOldestChatId(null);
      setIsLoadingMore(false);
      setHistoryLoading(true);
      setHistoryError(false);
      sendEnterRoom(roomId);
      // ENTER_ROOM 전송 후 useRoomActivity 내부 상태를 동기화한다.
      // ROOM_ACTIVE는 보내지 않는다 (ENTER_ROOM이 백엔드 activate를 처리함).
      notifyEntered(roomId);
      getChatHistory(roomId)
        .then((result) => {
          const { messages: msgs, lastReadChatId: lrcid, hasMore: more } = result.data;
          setMessages(msgs ?? []);
          setLastReadChatId(lrcid ?? null);
          setHasMore(more ?? false);
          setOldestChatId(msgs?.[0]?.chatId ?? null);
          setHistoryError(false);
        })
        .catch(() => setHistoryError(true))
        .finally(() => setHistoryLoading(false));
    },
    [selectedRoomId, sendEnterRoom, notifyEntered]
  );

  // 이전 메시지 로드
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || !oldestChatId) return;
    setIsLoadingMore(true);
    getChatHistory(selectedRoomId, oldestChatId)
      .then((result) => {
        const { messages: older, hasMore: more } = result.data;
        setMessages((prev) => [...(older ?? []), ...prev]);
        setHasMore(more ?? false);
        setOldestChatId(older?.[0]?.chatId ?? oldestChatId);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMore(false));
  }, [hasMore, isLoadingMore, oldestChatId, selectedRoomId]);

  // 메시지 전송
  const handleSend = useCallback(
    (message) => {
      sendChatMessage(selectedRoomId, message);
    },
    [selectedRoomId, sendChatMessage]
  );

  // 채팅방 나가기
  const handleLeaveRoom = useCallback(async () => {
    if (!selectedRoomId) return;
    const roomId = selectedRoomId;
    try {
      await leaveChatRoom(roomId);
      setSelectedRoomId(null);
      setChatRooms((prev) => prev.filter((r) => r.chatRoomId !== roomId));
    } catch (e) {
      // ignore
    }
  }, [selectedRoomId]);

  // 채팅방 이름 변경
  const handleRenameRoom = useCallback(async (newTitle) => {
    if (!selectedRoomId || !newTitle.trim()) return;
    try {
      await renameChatRoom(selectedRoomId, newTitle.trim());
      setChatRooms((prev) =>
        prev.map((r) =>
          r.chatRoomId === selectedRoomId ? { ...r, title: newTitle.trim() } : r
        )
      );
    } catch (e) {
      // ignore
    }
  }, [selectedRoomId]);

  // 채팅방 생성 완료: 목록 갱신 + 채팅 탭으로 이동
  const handleRoomCreated = useCallback(() => {
    refreshChatRooms();
    setTab(TAB.ROOMS);
  }, [refreshChatRooms]);

  // 닉네임 편집 시작
  const startEditNickname = () => {
    setEditNickname(auth?.nickname ?? "");
    setIsEditingNickname(true);
    setTimeout(() => nicknameInputRef.current?.focus(), 0);
  };

  const commitNickname = async () => {
    setIsEditingNickname(false);
    const trimmed = editNickname.trim();
    if (!trimmed || trimmed === auth?.nickname) return;
    try {
      await changeNickname(trimmed);
      updateNickname(trimmed);
    } catch (e) {
      // ignore
    }
  };

  const handleNicknameKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitNickname(); }
    if (e.key === "Escape") { setIsEditingNickname(false); }
  };

  // 로그아웃
  const handleSignout = () => {
    signout();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative flex flex-col h-screen bg-neutral-900 text-white overflow-hidden">
      {/* 재연결 배너 */}
      {!connected && (
        <div className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium flex-shrink-0 ${
          reconnecting ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
        }`}>
          {reconnecting ? (
            <>
              <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
              서버에 재연결 중입니다...
            </>
          ) : (
            "연결이 끊어졌습니다. 페이지를 새로고침 해주세요."
          )}
        </div>
      )}

      {/* 서버 에러 배너 */}
      {wsError && (
        <div className="flex items-center justify-between gap-2 py-1.5 px-4 text-xs font-medium flex-shrink-0 bg-orange-500/20 text-orange-400">
          <span>{wsError}</span>
          <button
            onClick={() => setWsError(null)}
            className="flex-shrink-0 hover:text-white transition-colors"
            aria-label="에러 메시지 닫기"
          >
            ✕
          </button>
        </div>
      )}

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
      {/* 좌측 사이드바 */}
      <div className={`flex-col border-r border-neutral-700 flex-shrink-0 w-full md:w-80 ${selectedRoomId ? "hidden md:flex" : "flex"}`}>
        {/* 헤더 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-700">
          <div className="flex-1 min-w-0">
            {isEditingNickname ? (
              <input
                ref={nicknameInputRef}
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                onBlur={commitNickname}
                onKeyDown={handleNicknameKeyDown}
                className="w-full bg-neutral-700 text-white text-sm font-bold px-2 py-0.5 rounded outline-none border border-neutral-500"
              />
            ) : (
              <button
                onClick={startEditNickname}
                className="font-bold text-white hover:text-neutral-300 transition-colors text-left truncate w-full"
                title="클릭하여 닉네임 변경"
              >
                {auth?.nickname}
              </button>
            )}
            <p className="text-xs text-neutral-500 mt-0.5">
              {connected ? "🟢 온라인" : "🔴 오프라인"}
            </p>
          </div>
          <button
            onClick={() => setShowPasswordModal(true)}
            title="비밀번호 변경"
            className="flex-shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
          </button>
          <button
            onClick={handleSignout}
            title="로그아웃"
            className="flex-shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-neutral-700">
          <button
            onClick={() => setTab(TAB.ROOMS)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${tab === TAB.ROOMS
                ? "text-white border-b-2 border-blue-500"
                : "text-neutral-500 hover:text-neutral-300"}`}
          >
            채팅
          </button>
          <button
            onClick={() => setTab(TAB.MEMBERS)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${tab === TAB.MEMBERS
                ? "text-white border-b-2 border-blue-500"
                : "text-neutral-500 hover:text-neutral-300"}`}
          >
            친구
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-hidden">
          {tab === TAB.ROOMS ? (
            <ChatRoomList
              chatRooms={chatRooms}
              roomsError={roomsError}
              onRetry={refreshChatRooms}
              selectedRoomId={selectedRoomId}
              onSelectRoom={handleSelectRoom}
            />
          ) : (
            <MemberList onRoomCreated={handleRoomCreated} />
          )}
        </div>
      </div>

      {/* 우측 채팅 영역 */}
      <div className={`flex-1 flex-col overflow-hidden ${selectedRoomId ? "flex" : "hidden md:flex"}`}>
        {selectedRoomId ? (
          <ChatWindow
            room={chatRooms.find((r) => r.chatRoomId === selectedRoomId)}
            messages={messages}
            lastReadChatId={lastReadChatId}
            onSend={handleSend}
            loading={historyLoading}
            historyError={historyError}
            onBack={() => setSelectedRoomId(null)}
            onLeave={handleLeaveRoom}
            onRename={handleRenameRoom}
            connected={connected}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-500">
            채팅방을 선택하세요.
          </div>
        )}
      </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}
