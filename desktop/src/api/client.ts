import axios, { AxiosError } from "axios";

import { useAuthStore } from "@/store/auth";

export const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://127.0.0.1:8000";

export const api = axios.create({ baseURL: API_BASE, timeout: 30_000 });

api.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().tokens?.access;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);
