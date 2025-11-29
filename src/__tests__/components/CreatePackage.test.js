/**
 * CreatePackage Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreatePackage from '../../components/CreatePackage';

const mockContract = {
  createPackage: jest.fn(),
};

const mockProvider = {
  getNetwork: jest.fn(() =>
    Promise.resolve({ chainId: 11155111n, name: 'sepolia' })
  ),
};

describe('CreatePackage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CreatePackage contract={mockContract} />);
    expect(screen.getByText(/Create Package/i)).toBeInTheDocument();
  });

  it('displays description input', () => {
    render(<CreatePackage contract={mockContract} />);
    const input = screen.getByPlaceholderText(/description/i);
    expect(input).toBeInTheDocument();
  });

  it('validates description length', () => {
    render(<CreatePackage contract={mockContract} />);
    const input = screen.getByPlaceholderText(/description/i);
    const button = screen.getByRole('button', { name: /create/i });

    // Too short
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.click(button);

    expect(screen.getByText(/too short/i)).toBeInTheDocument();
  });

  it('creates package with valid description', async () => {
    const mockTx = {
      wait: jest.fn(() => Promise.resolve()),
    };
    mockContract.createPackage.mockResolvedValue(mockTx);

    render(
      <CreatePackage contract={mockContract} provider={mockProvider} />
    );

    const input = screen.getByPlaceholderText(/description/i);
    const button = screen.getByRole('button', { name: /create/i });

    fireEvent.change(input, { target: { value: 'Medical Supplies Package' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockContract.createPackage).toHaveBeenCalledWith(
        'Medical Supplies Package'
      );
    });
  });

  it('handles transaction rejection', async () => {
    mockContract.createPackage.mockRejectedValue(
      new Error('User rejected transaction')
    );

    render(
      <CreatePackage contract={mockContract} provider={mockProvider} />
    );

    const input = screen.getByPlaceholderText(/description/i);
    const button = screen.getByRole('button', { name: /create/i });

    fireEvent.change(input, { target: { value: 'Test Package' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/rejected/i)).toBeInTheDocument();
    });
  });
});

