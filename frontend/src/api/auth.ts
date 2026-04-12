import { apiRequest, setAccessToken } from "@/api/client";
import type { User } from "@/api/types";

type LoginResponse = {
  access: string;
  user: User;
};

export async function login(email: string, password: string) {
  const response = await apiRequest<LoginResponse>("/auth/login/", {
    method: "POST",
    body: { email, password },
    skipAuth: true,
  });
  setAccessToken(response.access);
  return response.user;
}

export async function refreshAccessToken() {
  const response = await apiRequest<{ access: string }>("/auth/refresh/", {
    method: "POST",
    skipAuth: true,
  });
  setAccessToken(response.access);
  return response.access;
}

export function getMe() {
  return apiRequest<User>("/auth/me/");
}

export async function logout() {
  await apiRequest<void>("/auth/logout/", {
    method: "POST",
    skipAuth: true,
  });
  setAccessToken(null);
}
