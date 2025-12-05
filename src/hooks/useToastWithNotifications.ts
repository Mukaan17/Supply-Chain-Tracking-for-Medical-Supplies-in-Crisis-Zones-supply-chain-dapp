import { useMemo } from 'react';
import { toast as sonnerToast } from 'sonner';
import { useNotifications } from '../contexts/NotificationContext';

export function useToastWithNotifications() {
  // This hook must be called within NotificationProvider
  // The error will be thrown if provider is missing, which helps catch setup issues
  const { addNotification } = useNotifications();

  // Memoize the toast object to prevent it from being recreated on every render
  // This prevents infinite loops when toast is used in dependency arrays
  // Use useCallback for each method to ensure stable references
  const toast = useMemo(() => {
    // Wrap addNotification calls in setTimeout to defer state updates
    // This prevents immediate re-renders that could cause infinite loops
    const safeAddNotification = (notification: Parameters<typeof addNotification>[0]) => {
      // Defer the notification to next tick to break potential render loops
      setTimeout(() => {
        try {
          addNotification(notification);
        } catch (error) {
          // Silently fail if notification context is unavailable
          console.warn('Failed to add notification:', error);
        }
      }, 0);
    };

    return {
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
        safeAddNotification({
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
        safeAddNotification({
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
        safeAddNotification({
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
        safeAddNotification({
          type: 'warning',
          title,
          description: options?.description,
        });
      },
    };
  }, [addNotification]);

  return toast;
}

