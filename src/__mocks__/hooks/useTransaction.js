/**
 * useTransaction Hook Mock
 */

export function useTransaction() {
  return {
    pendingTransactions: [],
    transactionHistory: [],
    loading: false,
    submitTransaction: jest.fn(),
    getTransaction: jest.fn(),
    getTransactionByHash: jest.fn(),
    cancelTransaction: jest.fn(),
    estimateGas: jest.fn(),
    getGasPrice: jest.fn(),
  };
}

export default useTransaction;


