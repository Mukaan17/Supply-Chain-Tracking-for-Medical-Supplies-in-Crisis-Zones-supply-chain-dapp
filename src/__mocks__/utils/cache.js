/**
 * Cache Service Mock
 */

export default {
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  has: jest.fn(() => Promise.resolve(false)),
  getStats: jest.fn(() => ({ size: 0, maxSize: 1000, enabled: true })),
};


