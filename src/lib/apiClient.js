import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000",
  headers: { "Content-Type": "application/json" },
  // 필요시 timeout 등 옵션 추가
});

export default api;
