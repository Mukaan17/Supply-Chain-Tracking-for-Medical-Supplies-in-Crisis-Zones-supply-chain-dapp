/**
 * useWallet Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useWallet } from '../../hooks/useWallet';

// Mock window.ethereum
const mockEthereum = {
  request: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  selectedAddress: null,
};

global.window.ethereum = mockEthereum;

describe('useWallet Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEthereum.selectedAddress = null;
  });

  it('returns initial state when not connected', () => {
    const { result } = renderHook(() => useWallet());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.account).toBeNull();
    expect(result.current.provider).toBeNull();
  });

  it('connects wallet successfully', async () => {
    mockEthereum.request.mockResolvedValue(['0x1234567890123456789012345678901234567890']);
    mockEthereum.selectedAddress = '0x1234567890123456789012345678901234567890';

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.account).toBe('0x1234567890123456789012345678901234567890');
  });

  it('handles connection rejection', async () => {
    mockEthereum.request.mockRejectedValue(new Error('User rejected'));

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});

