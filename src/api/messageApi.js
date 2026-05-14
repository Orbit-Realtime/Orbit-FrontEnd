import axiosInstance from "./axios";

export const getMessageHistory = (chatRoomId, beforeChatId = null) => {
  const params = { chatRoomId };
  if (beforeChatId !== null) params.beforeChatId = beforeChatId;
  return axiosInstance.get("/api/chats", { params });
};
