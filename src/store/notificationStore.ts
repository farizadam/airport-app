import { makeAutoObservable, runInAction } from "mobx";
import api from "../lib/api";
import { getItemAsync } from "expo-secure-store";

export interface Notification {
  _id: string;
  user_id: string;
  type: string;
  payload: any;
  is_read: boolean;
  createdAt: string;
}

class NotificationStore {
  notifications: Notification[] = [];
  loading = false;
  error: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  startPolling(intervalMs = 10000) {
    if (this.pollingInterval) return;
    this.fetchNotifications(); // Initial fetch
    this.pollingInterval = setInterval(() => {
      this.fetchNotifications(true); // silent fetch
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async fetchNotifications(silent = false) {
    // Skip if no token available
    const token = await getItemAsync("accessToken");
    if (!token) return;

    if (!silent) this.loading = true;
    this.error = null;
    try {
      const res = await api.get("/notifications");
      runInAction(() => {
        this.notifications = res.data.notifications;
        this.loading = false;
      });
    } catch (e: any) {
      runInAction(() => {
        this.error = e.message || "Failed to fetch notifications";
        this.loading = false;
      });
    }
  }

  async markAsRead(notificationId: string) {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      runInAction(() => {
        const notif = this.notifications.find((n) => n._id === notificationId);
        if (notif) notif.is_read = true;
      });
    } catch (e) {
      // handle error
    }
  }
}

const notificationStore = new NotificationStore();
export default notificationStore;
