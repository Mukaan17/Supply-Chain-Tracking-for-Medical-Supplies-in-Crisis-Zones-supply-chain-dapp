/**
 * TransactionQueue Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import TransactionQueue from '../../components/TransactionQueue';
import * as useTransaction from '../../hooks/useTransaction';

jest.mock('../../hooks/useTransaction');

describe('TransactionQueue Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no transactions', () => {
    useTransaction.useTransaction.mockReturnValue({
      pendingTransactions: [],
      transactionHistory: [],
      cancelTransaction: jest.fn(),
    });

    const { container } = render(<TransactionQueue network="sepolia" />);
    expect(container.firstChild).toBeNull();
  });

  it('displays pending transactions', () => {
    const mockTransactions = [
      {
        id: '1',
        status: 'pending',
        hash: '0x123',
        metadata: { method: 'createPackage', description: 'Test' },
        submittedAt: Date.now(),
      },
    ];

    useTransaction.useTransaction.mockReturnValue({
      pendingTransactions: mockTransactions,
      transactionHistory: [],
      cancelTransaction: jest.fn(),
    });

    render(<TransactionQueue network="sepolia" />);
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByText(/createPackage/i)).toBeInTheDocument();
  });

  it('displays transaction history', () => {
    const mockHistory = [
      {
        id: '1',
        status: 'confirmed',
        hash: '0x123',
        metadata: { method: 'transferOwnership' },
      },
    ];

    useTransaction.useTransaction.mockReturnValue({
      pendingTransactions: [],
      transactionHistory: mockHistory,
      cancelTransaction: jest.fn(),
    });

    render(<TransactionQueue network="sepolia" />);
    expect(screen.getByText(/history/i)).toBeInTheDocument();
  });
});

