/**
 * Monitoring Service Mock
 */

export default {
  trackPageView: jest.fn(),
  recordMetric: jest.fn(),
  trackError: jest.fn(),
  trackAPICall: jest.fn(),
  trackTransaction: jest.fn(),
  getMetricsSummary: jest.fn(() => ({})),
  clearMetrics: jest.fn(),
};


