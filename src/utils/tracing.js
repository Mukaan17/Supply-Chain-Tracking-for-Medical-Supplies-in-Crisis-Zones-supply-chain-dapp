/**
 * Distributed Tracing Utilities
 * 
 * Provides tracing for transactions and operations.
 */

import logger from '../services/logging';

class TracingService {
  constructor() {
    this.spans = new Map();
    this.traces = [];
    this.maxTraces = 100;
  }

  /**
   * Start a span
   */
  startSpan(name, parentSpanId = null) {
    const spanId = this._generateSpanId();
    const traceId = parentSpanId
      ? this.spans.get(parentSpanId)?.traceId
      : this._generateTraceId();

    const span = {
      spanId,
      traceId,
      name,
      parentSpanId,
      startTime: Date.now(),
      tags: {},
      logs: [],
    };

    this.spans.set(spanId, span);

    logger.debug('Span started', { spanId, name });

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(spanId, tags = {}) {
    const span = this.spans.get(spanId);
    if (!span) {
      logger.warn('Span not found', { spanId });
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.tags = { ...span.tags, ...tags };

    // Add to trace
    this._addToTrace(span);

    logger.debug('Span ended', {
      spanId,
      name: span.name,
      duration: span.duration,
    });

    return span;
  }

  /**
   * Add tag to span
   */
  addTag(spanId, key, value) {
    const span = this.spans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  /**
   * Add log to span
   */
  addLog(spanId, message, data = {}) {
    const span = this.spans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        message,
        data,
      });
    }
  }

  /**
   * Get trace
   */
  getTrace(traceId) {
    return this.traces.find(t => t.traceId === traceId);
  }

  /**
   * Get all traces
   */
  getAllTraces() {
    return [...this.traces];
  }

  /**
   * Clear traces
   */
  clearTraces() {
    this.spans.clear();
    this.traces = [];
  }

  /**
   * Add span to trace
   */
  _addToTrace(span) {
    let trace = this.traces.find(t => t.traceId === span.traceId);

    if (!trace) {
      trace = {
        traceId: span.traceId,
        spans: [],
        startTime: span.startTime,
        endTime: span.endTime,
        duration: span.duration,
      };
      this.traces.push(trace);

      // Keep only last N traces
      if (this.traces.length > this.maxTraces) {
        this.traces.shift();
      }
    }

    trace.spans.push(span);
    trace.endTime = Math.max(trace.endTime, span.endTime);
    trace.duration = trace.endTime - trace.startTime;
  }

  /**
   * Generate span ID
   */
  _generateSpanId() {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID
   */
  _generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
const tracingService = new TracingService();

export default tracingService;

