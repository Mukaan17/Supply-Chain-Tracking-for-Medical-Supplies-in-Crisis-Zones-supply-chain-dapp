/**
 * Transaction Manager Service Tests
 */

import transactionManager from '../../services/transactionManager';

describe('TransactionManager Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add transaction to queue', async () => {
    const mockTx = Promise.resolve({ hash: '0x123' });
    const entry = await transactionManager.addTransaction(mockTx, {
      method: 'test',
    });

    expect(entry).toBeDefined();
    expect(entry.id).toBeDefined();
    expect(entry.status).toBe('pending');
  });

  it('should get pending transactions', () => {
    const pending = transactionManager.getPendingTransactions();
    expect(Array.isArray(pending)).toBe(true);
  });

  it('should get transaction history', () => {
    const history = transactionManager.getHistory(10);
    expect(Array.isArray(history)).toBe(true);
  });

  it('should cancel transaction', () => {
    const result = transactionManager.cancelTransaction('test-id');
    expect(result).toBeDefined();
  });
});

