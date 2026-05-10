import axiosInstance from "./axios";

export const getDiscussion = (messageId) =>
  axiosInstance.get(`/api/messages/${messageId}/discussion`);

export const createDiscussion = (messageId) =>
  axiosInstance.post(`/api/messages/${messageId}/discussion`);
