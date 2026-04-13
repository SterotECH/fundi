import { apiRequest } from "@/api/client";
import type { Notification, NotificationListResponse } from "@/api/types";

export type NotificationFilters = {
  read?: "true" | "false" | "";
};

export async function listNotifications(filters: NotificationFilters = {}) {
  const params = new URLSearchParams();

  if (filters.read) {
    params.set("read", filters.read);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<NotificationListResponse>(`/notifications/${query}`);
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<Notification>(`/notifications/${notificationId}/read/`, {
    method: "POST",
    body: {},
  });
}

export function markAllNotificationsRead() {
  return apiRequest<void>("/notifications/read-all/", {
    method: "POST",
    body: {},
  });
}
