/**
 * useTransaction Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useTransaction } from '../../hooks/useTransaction';
import transactionManager from '../../services/transactionManager';

jest.mock('../../services/transactionManager');
jest.mock('../../services/logging');
jest.mock('../../services/errorTracking');

describe('useTransaction Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionManager.getPendingTransactions.mockReturnValue([]);
    transactionManager.getHistory.mockReturnValue([]);
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useTransaction());

    expect(result.current.pendingTransactions).toEqual([]);
    expect(result.current.transactionHistory).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('submits transaction', async () => {
    const mockEntry = {
      id: '1',
      transaction: {},
      status: 'pending',
    };
    transactionManager.addTransaction.mockResolvedValue(mockEntry);

    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      const entry = await result.current.submitTransaction(
        Promise.resolve({}),
        { method: 'test' }
      );
      expect(entry).toEqual(mockEntry);
    });

    expect(transactionManager.addTransaction).toHaveBeenCalled();
  });

  it('estimates gas', async () => {
    const mockContract = {
      testMethod: {
        estimateGas: jest.fn(() => Promise.resolve(21000n)),
      },
    };

    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      const estimate = await result.current.estimateGas(
        mockContract,
        'testMethod',
        'arg1'
      );
      expect(estimate).toBe(21000n);
    });
  });

  it('handles gas estimation errors', async () => {
    const mockContract = {
      testMethod: {
        estimateGas: jest.fn(() => Promise.reject(new Error('Estimation failed'))),
      },
    };

    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      await expect(
        result.current.estimateGas(mockContract, 'testMethod')
      ).rejects.toThrow('Estimation failed');
    });
  });
});

