import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// Sentry import is optional - only if enabled in config
import config from './config';
import errorTracking from './services/errorTracking';
import logger from './services/logging';
import { wagmiConfig } from './config/wagmi';
import { NotificationProvider } from './contexts/NotificationContext';

// Initialize error tracking
if (config.services.sentry.enabled && config.services.sentry.dsn) {
  errorTracking.init();
}

// In development, unregister any existing service workers to avoid caching issues
if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
  // Clear all caches in development
  if ('caches' in window) {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        caches.delete(cacheName);
      });
    });
  }
}

// Register service worker for offline support (only in production)
// In development, service workers can cause chunk loading issues with HMR
if ('serviceWorker' in navigator && config.features.offlineMode && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    // Check for version mismatch in localStorage
    const storedVersion = localStorage.getItem('app_version');
    const currentVersion = config.app.version;
    
    // If version changed, clear all caches and reload
    if (storedVersion && storedVersion !== currentVersion) {
      logger.info(`Version changed from ${storedVersion} to ${currentVersion}. Clearing cache...`);
      localStorage.setItem('app_version', currentVersion);
      
      // Unregister all service workers
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
      
      // Clear all caches
      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          cacheNames.forEach((cacheName) => {
            caches.delete(cacheName);
          });
        });
      }
      
      // Force hard reload
      window.location.reload();
      return;
    }
    
    // Store current version
    localStorage.setItem('app_version', currentVersion);
    
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        logger.info('Service Worker registered', { scope: registration.scope, version: currentVersion });
        
        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, reload
                logger.info('New service worker available. Reloading...');
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((error) => {
        logger.error('Service Worker registration failed', error);
      });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Wrap App with Error Boundary (Sentry integration handled in ErrorBoundary component)
const AppWrapper = App;

root.render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <AppWrapper />
        </NotificationProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);

// Report web vitals (non-blocking, errors are handled in reportWebVitals)
try {
  reportWebVitals((metric) => {
    logger.debug('Web Vital', metric);
    // Send to analytics if enabled
    if (config.features.analytics) {
      // Analytics tracking would go here
    }
  });
} catch (error) {
  // Silently fail - web vitals is non-critical
  logger.debug('Web Vitals reporting failed', error);
}
