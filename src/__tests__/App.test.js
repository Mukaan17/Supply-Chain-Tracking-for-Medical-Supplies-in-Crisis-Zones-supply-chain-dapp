/**
 * App Component Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import * as useWallet from '../hooks/useWallet';
import * as useContract from '../hooks/useContract';

// Mock hooks
jest.mock('../hooks/useWallet');
jest.mock('../hooks/useContract');
jest.mock('../services/errorTracking');
jest.mock('../services/analytics');
jest.mock('../services/monitoring');

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    useWallet.useWallet.mockReturnValue({
      account: null,
      provider: null,
      signer: null,
      network: null,
      loading: false,
      error: null,
      isConnected: false,
      connectWallet: jest.fn(),
      disconnectWallet: jest.fn(),
      switchNetwork: jest.fn(),
    });

    useContract.useContract.mockReturnValue({
      contract: null,
      loading: false,
      error: null,
      isReady: false,
      callContract: jest.fn(),
      sendTransaction: jest.fn(),
    });
  });

  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Supply Chain Tracking/i)).toBeInTheDocument();
  });

  it('displays connect wallet message when not connected', () => {
    render(<App />);
    expect(screen.getByText(/Connect Your Wallet/i)).toBeInTheDocument();
  });

  it('shows wallet connection button', () => {
    render(<App />);
    const connectButton = screen.getByRole('button', { name: /connect/i });
    expect(connectButton).toBeInTheDocument();
  });

  it('displays error when wallet connection fails', () => {
    useWallet.useWallet.mockReturnValue({
      account: null,
      error: new Error('Connection failed'),
      isConnected: false,
      loading: false,
    });

    render(<App />);
    expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
  });

  it('shows loading state during initialization', () => {
    useWallet.useWallet.mockReturnValue({
      account: null,
      loading: true,
      isConnected: false,
    });

    render(<App />);
    expect(screen.getByText(/Initializing/i)).toBeInTheDocument();
  });
});

