/**
 * Lazy Loading Utilities
 * 
 * Provides utilities for code splitting and lazy loading components.
 */

import { lazy, Suspense, useState, useEffect } from 'react';
import { LoadingSpinner } from '../components/LoadingStates';

/**
 * Create lazy-loaded component with loading fallback
 */
export function createLazyComponent(importFunc, fallback = null) {
  const LazyComponent = lazy(importFunc);

  return function LazyWrapper(props) {
    return (
      <Suspense fallback={fallback || <LoadingSpinner />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Lazy load route component
 */
export function lazyRoute(importFunc) {
  return createLazyComponent(importFunc, <LoadingSpinner size={48} />);
}

/**
 * Lazy load image
 */
export function LazyImage({ src, alt, ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div style={{ position: 'relative', ...props.style }}>
      {!loaded && !error && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <LoadingSpinner size={24} />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s',
          ...props.style,
        }}
        {...props}
      />
    </div>
  );
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [ref, setRef] = useState(null);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        ...options,
      }
    );

    observer.observe(ref);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return [setRef, isIntersecting];
}

export default {
  createLazyComponent,
  lazyRoute,
  LazyImage,
  useIntersectionObserver,
};

