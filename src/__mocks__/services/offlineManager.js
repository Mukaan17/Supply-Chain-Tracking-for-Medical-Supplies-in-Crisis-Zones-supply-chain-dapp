/**
 * Offline Manager Service Mock
 */

export default {
  init: jest.fn(),
  isCurrentlyOnline: jest.fn(() => true),
  addToQueue: jest.fn(),
  getQueueSize: jest.fn(() => 0),
  clearQueue: jest.fn(),
  onSyncStatusChange: jest.fn(() => jest.fn()),
};


