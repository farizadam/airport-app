import { makeAutoObservable, runInAction } from "mobx";
import api from "../lib/api";

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

  constructor() {
    makeAutoObservable(this);
  }

  async fetchNotifications() {
    this.loading = true;
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
