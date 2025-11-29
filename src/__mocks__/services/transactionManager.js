/**
 * Transaction Manager Service Mock
 */

export default {
  addTransaction: jest.fn((promise, metadata) =>
    Promise.resolve({
      id: 'test-id',
      transaction: promise,
      status: 'pending',
      metadata,
      submittedAt: Date.now(),
    })
  ),
  getPendingTransactions: jest.fn(() => []),
  getHistory: jest.fn(() => []),
  getTransaction: jest.fn(),
  getTransactionByHash: jest.fn(),
  cancelTransaction: jest.fn(),
};


