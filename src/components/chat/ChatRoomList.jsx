import ChatRoomItem from "./ChatRoomItem";

export default function ChatRoomList({ chatRooms, roomsError, onRetry, selectedRoomId, onSelectRoom }) {
  if (roomsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-neutral-500 text-sm">채팅방 목록을 불러오지 못했습니다.</p>
        <button
          onClick={onRetry}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (chatRooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        채팅방이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {chatRooms.map((room) => (
        <ChatRoomItem
          key={room.chatRoomId}
          room={room}
          isSelected={room.chatRoomId === selectedRoomId}
          onClick={() => onSelectRoom(room.chatRoomId)}
        />
      ))}
    </div>
  );
}
