import { useState, useEffect, useCallback, useMemo } from "react";
import { getChatRooms } from "../api/chatRoomApi";

const sortRooms = (rooms) =>
  [...rooms].sort((a, b) => {
    if (!a.createdDate && !b.createdDate) return 0;
    if (!a.createdDate) return 1;
    if (!b.createdDate) return -1;
    return new Date(b.createdDate) - new Date(a.createdDate);
  });

export function useChatRooms(selectedRoomId) {
  const [chatRooms, setChatRooms] = useState([]);
  const [roomsError, setRoomsError] = useState(false);

  useEffect(() => {
    getChatRooms()
      .then((result) => {
        setChatRooms(sortRooms(result.data ?? []));
        setRoomsError(false);
      })
      .catch(() => setRoomsError(true));
  }, []);

  const refreshChatRooms = useCallback(() => {
    getChatRooms()
      .then((result) => {
        setChatRooms(sortRooms(result.data ?? []));
        setRoomsError(false);
      })
      .catch(() => setRoomsError(true));
  }, []);

  // UPDATE_CHAT_ROOM WebSocket 이벤트 처리.
  // roomExists === false: 새로 초대된 방은 인라인 추가 대신 전체 재조회로 처리.
  // lastChatId 역전 시 stale 이벤트 무시.
  const applyRoomUpdate = useCallback(
    (data) => {
      setChatRooms((prev) => {
        const roomExists = prev.some((r) => r.chatRoomId === data.chatRoomId);
        if (!roomExists) {
          setTimeout(refreshChatRooms, 0);
          return prev;
        }
        return sortRooms(
          prev.map((room) => {
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
              unreadMessageCount: data.unreadMessageCount,
            };
          })
        );
      });
    },
    [refreshChatRooms]
  );

  const removeRoom = useCallback((roomId) => {
    setChatRooms((prev) => prev.filter((r) => r.chatRoomId !== roomId));
  }, []);

  const patchRoom = useCallback((roomId, patch) => {
    setChatRooms((prev) =>
      prev.map((r) => (r.chatRoomId === roomId ? { ...r, ...patch } : r))
    );
  }, []);

  const selectedRoom = useMemo(
    () => chatRooms.find((r) => r.chatRoomId === selectedRoomId),
    [chatRooms, selectedRoomId]
  );

  return {
    chatRooms,
    roomsError,
    selectedRoom,
    refreshChatRooms,
    applyRoomUpdate,
    removeRoom,
    patchRoom,
  };
}
