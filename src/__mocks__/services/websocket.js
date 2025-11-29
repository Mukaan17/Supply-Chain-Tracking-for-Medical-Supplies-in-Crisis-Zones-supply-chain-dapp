/**
 * WebSocket Service Mock
 */

export default {
  enabled: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
  on: jest.fn(() => jest.fn()),
  off: jest.fn(),
  getStatus: jest.fn(() => ({ connected: false, enabled: false })),
};


