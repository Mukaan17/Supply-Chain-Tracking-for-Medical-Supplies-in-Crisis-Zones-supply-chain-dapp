/**
 * IndexedDB Service Mock
 */

export default {
  init: jest.fn(() => Promise.resolve(true)),
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
  getAll: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
  saveTransaction: jest.fn(() => Promise.resolve()),
  getTransactionByHash: jest.fn(() => Promise.resolve(null)),
  getRecentTransactions: jest.fn(() => Promise.resolve([])),
  savePackage: jest.fn(() => Promise.resolve()),
  getPackage: jest.fn(() => Promise.resolve(null)),
};

export const STORES = {
  TRANSACTIONS: 'transactions',
  CACHE: 'cache',
  PACKAGES: 'packages',
};


