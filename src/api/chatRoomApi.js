import axiosInstance from "./axios";

export const createChatRoom = (receiverIds, title) =>
  axiosInstance.post("/api/chat/room", { receiverIds, title });

export const getChatRooms = () =>
  axiosInstance.get("/api/chat/rooms");
