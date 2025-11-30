// Web Vitals reporting - made optional to prevent chunk loading errors
const reportWebVitals = onPerfEntry => {
  // Skip in development to avoid chunk loading issues
  if (process.env.NODE_ENV === 'development') {
    return;
  }
  
  if (onPerfEntry && onPerfEntry instanceof Function) {
    // Use setTimeout to defer loading, preventing blocking
    setTimeout(() => {
      import('web-vitals')
        .then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
          try {
            getCLS(onPerfEntry);
            getFID(onPerfEntry);
            getFCP(onPerfEntry);
            getLCP(onPerfEntry);
            getTTFB(onPerfEntry);
          } catch (err) {
            // Ignore errors in web vitals collection
          }
        })
        .catch(() => {
          // Silently fail - web vitals is non-critical
        });
    }, 0);
  }
};

export default reportWebVitals;
