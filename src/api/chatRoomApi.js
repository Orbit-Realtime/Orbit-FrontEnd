import axiosInstance from "./axios";

export const createChatRoom = (receiverIds, title) =>
  axiosInstance.post("/api/chat/room", { receiverIds, title });

export const getChatRooms = () =>
  axiosInstance.get("/api/chat/rooms");

export const leaveChatRoom = (chatRoomId) =>
  axiosInstance.delete(`/api/chat/room/${chatRoomId}`);

export const renameChatRoom = (chatRoomId, title) =>
  axiosInstance.patch(`/api/chat/room/${chatRoomId}`, { title });

export const getChatRoomMembers = (chatRoomId) =>
  axiosInstance.get(`/api/chat/room/${chatRoomId}/members`);

export const inviteMembers = (chatRoomId, memberIds) =>
  axiosInstance.post(`/api/chat/room/${chatRoomId}/members`, { memberIds });
