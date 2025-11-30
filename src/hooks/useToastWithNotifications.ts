import { toast as sonnerToast } from 'sonner';
import { useNotifications } from '../contexts/NotificationContext';

export function useToastWithNotifications() {
  // This hook must be called within NotificationProvider
  // The error will be thrown if provider is missing, which helps catch setup issues
  const { addNotification } = useNotifications();

  const toast = {
    success: (title: string, options?: { description?: string; duration?: number }) => {
      sonnerToast.success(title, {
        ...options,
        style: {
          background: '#065f46', // green-800
          border: '1px solid #10b981', // green-500
          color: '#d1fae5', // green-100
        },
        className: 'toast-success',
      });
      addNotification({
        type: 'success',
        title,
        description: options?.description,
      });
    },
    error: (title: string, options?: { description?: string; duration?: number }) => {
      sonnerToast.error(title, {
        ...options,
        style: {
          background: '#7f1d1d', // red-900
          border: '1px solid #ef4444', // red-500
          color: '#fee2e2', // red-100
        },
        className: 'toast-error',
      });
      addNotification({
        type: 'error',
        title,
        description: options?.description,
      });
    },
    info: (title: string, options?: { description?: string; duration?: number }) => {
      sonnerToast.info(title, {
        ...options,
        style: {
          background: '#1e3a8a', // blue-900
          border: '1px solid #3b82f6', // blue-500
          color: '#dbeafe', // blue-100
        },
        className: 'toast-info',
      });
      addNotification({
        type: 'info',
        title,
        description: options?.description,
      });
    },
    warning: (title: string, options?: { description?: string; duration?: number }) => {
      sonnerToast.warning(title, {
        ...options,
        style: {
          background: '#78350f', // amber-900
          border: '1px solid #f59e0b', // amber-500
          color: '#fef3c7', // amber-100
        },
        className: 'toast-warning',
      });
      addNotification({
        type: 'warning',
        title,
        description: options?.description,
      });
    },
  };

  return toast;
}

