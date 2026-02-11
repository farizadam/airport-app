import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastConfig {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, default 4000
  actions?: ToastAction[];
  icon?: string; // Ionicons name
}

interface ToastState {
  visible: boolean;
  config: ToastConfig | null;
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  config: null,
  showToast: (config) => {
    set({ visible: true, config });
  },
  hideToast: () => {
    set({ visible: false, config: null });
  },
}));

// Convenience helpers for quick usage
export const toast = {
  success: (title: string, message?: string, actions?: ToastAction[]) =>
    useToastStore.getState().showToast({ type: "success", title, message, actions }),
  error: (title: string, message?: string) =>
    useToastStore.getState().showToast({ type: "error", title, message }),
  warning: (title: string, message?: string) =>
    useToastStore.getState().showToast({ type: "warning", title, message }),
  info: (title: string, message?: string, actions?: ToastAction[]) =>
    useToastStore.getState().showToast({ type: "info", title, message, actions }),
};
