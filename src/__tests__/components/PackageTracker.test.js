/**
 * PackageTracker Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PackageTracker from '../../components/PackageTracker';
import { ethers } from 'ethers';

// Mock dependencies
jest.mock('../../services/logging');
jest.mock('../../services/errorTracking');
jest.mock('../../hooks/useTransaction');

const mockContract = {
  getPackageDetails: jest.fn(),
  transferOwnership: jest.fn(),
  markAsDelivered: jest.fn(),
  markAsInTransit: jest.fn(),
  filters: {
    PackageCreated: jest.fn(),
    PackageTransferred: jest.fn(),
    PackageDelivered: jest.fn(),
  },
  on: jest.fn(),
  off: jest.fn(),
  queryFilter: jest.fn(),
  target: '0x1234567890123456789012345678901234567890',
};

const mockProvider = {
  getBlockNumber: jest.fn(() => Promise.resolve(1000)),
  getBlock: jest.fn(() => Promise.resolve({ timestamp: Date.now() / 1000 })),
};

describe('PackageTracker Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <PackageTracker
        contract={mockContract}
        account="0x123"
        provider={mockProvider}
      />
    );
    expect(screen.getByText(/Track Package/i)).toBeInTheDocument();
  });

  it('displays search input', () => {
    render(
      <PackageTracker
        contract={mockContract}
        account="0x123"
        provider={mockProvider}
      />
    );
    const input = screen.getByPlaceholderText(/package id/i);
    expect(input).toBeInTheDocument();
  });

  it('fetches package details on form submit', async () => {
    mockContract.getPackageDetails.mockResolvedValue([
      ethers.BigNumber.from(1),
      'Test Package',
      '0xCreator',
      '0xOwner',
      ethers.BigNumber.from(0),
      ethers.BigNumber.from(Date.now()),
      ethers.BigNumber.from(Date.now()),
    ]);

    render(
      <PackageTracker
        contract={mockContract}
        account="0x123"
        provider={mockProvider}
      />
    );

    const input = screen.getByPlaceholderText(/package id/i);
    const button = screen.getByRole('button', { name: /fetch/i });

    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockContract.getPackageDetails).toHaveBeenCalledWith(1);
    });
  });

  it('displays error for invalid package ID', async () => {
    mockContract.getPackageDetails.mockRejectedValue(
      new Error('Package does not exist')
    );

    render(
      <PackageTracker
        contract={mockContract}
        account="0x123"
        provider={mockProvider}
      />
    );

    const input = screen.getByPlaceholderText(/package id/i);
    const button = screen.getByRole('button', { name: /fetch/i });

    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('validates package ID input', () => {
    render(
      <PackageTracker
        contract={mockContract}
        account="0x123"
        provider={mockProvider}
      />
    );

    const input = screen.getByPlaceholderText(/package id/i);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    // Should show validation error
    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
  });
});

