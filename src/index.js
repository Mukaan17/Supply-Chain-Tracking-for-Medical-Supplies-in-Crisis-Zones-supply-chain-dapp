import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// Sentry import is optional - only if enabled in config
// import config from './config';
import errorTracking from './services/errorTracking';
import logger from './services/logging';

// Initialize error tracking
if (config.services.sentry.enabled && config.services.sentry.dsn) {
  errorTracking.init();
}

// Register service worker for offline support
if ('serviceWorker' in navigator && config.features.offlineMode) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        logger.info('Service Worker registered', { scope: registration.scope });
      })
      .catch((error) => {
        logger.error('Service Worker registration failed', error);
      });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));

// Wrap App with Error Boundary (Sentry integration handled in ErrorBoundary component)
const AppWrapper = App;

root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);

// Report web vitals
reportWebVitals((metric) => {
  logger.debug('Web Vital', metric);
  // Send to analytics if enabled
  if (config.features.analytics) {
    // Analytics tracking would go here
  }
});
