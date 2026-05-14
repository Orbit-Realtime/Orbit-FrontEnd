import axiosInstance from "./axios";

export const createSpace = (receiverIds, title) =>
  axiosInstance.post("/api/chat/room", { receiverIds, title });

export const getSpaces = () =>
  axiosInstance.get("/api/chat/rooms");

export const leaveSpace = (chatRoomId) =>
  axiosInstance.delete(`/api/chat/room/${chatRoomId}`);

export const renameSpace = (chatRoomId, title) =>
  axiosInstance.patch(`/api/chat/room/${chatRoomId}`, { title });

export const getSpaceMembers = (chatRoomId) =>
  axiosInstance.get(`/api/chat/room/${chatRoomId}/members`);

export const inviteMembers = (chatRoomId, memberIds) =>
  axiosInstance.post(`/api/chat/room/${chatRoomId}/members`, { memberIds });
