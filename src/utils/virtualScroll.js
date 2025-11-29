/**
 * Virtual Scrolling Utilities
 * 
 * Provides virtual scrolling for large lists to improve performance.
 */

import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Hook for virtual scrolling
 */
export function useVirtualScroll({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      ...item,
      index: startIndex + index,
    }));
  }, [items, startIndex, endIndex]);

  const offsetY = startIndex * itemHeight;

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return {
    containerRef,
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
  };
}

/**
 * Virtual list component
 */
export function VirtualList({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  ...props
}) {
  const {
    containerRef,
    visibleItems,
    totalHeight,
    offsetY,
  } = useVirtualScroll({
    items,
    itemHeight,
    containerHeight,
    overscan,
  });

  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        overflow: 'auto',
        ...props.style,
      }}
      {...props}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div
              key={item.id || index}
              style={{
                height: itemHeight,
              }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default {
  useVirtualScroll,
  VirtualList,
};

