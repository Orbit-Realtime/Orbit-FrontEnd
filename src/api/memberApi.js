import axiosInstance from "./axios";

export const signup = (username, password, nickname) =>
  axiosInstance.post("/api/member", { username, password, nickname });

export const login = (username, password) =>
  axiosInstance.post("/api/member/login", { username, password });

export const getMembers = () =>
  axiosInstance.get("/api/members");
