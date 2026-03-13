import axiosInstance from "./axios";

export const getChatHistory = (chatRoomId) =>
  axiosInstance.get(`/api/chats?chatRoomId=${chatRoomId}`);
