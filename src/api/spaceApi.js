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

export const getSpaceByInviteCode = (inviteCode) =>
  axiosInstance.get(`/api/spaces/invite/${inviteCode}`);

export const joinSpaceByInviteCode = (inviteCode) =>
  axiosInstance.post(`/api/spaces/invite/${inviteCode}/join`);

export const getInviteCode = (spaceId) =>
  axiosInstance.get(`/api/spaces/${spaceId}/invite-code`);
