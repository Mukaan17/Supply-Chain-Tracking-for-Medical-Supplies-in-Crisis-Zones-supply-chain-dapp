/**
 * useContract Hook Tests
 */

import { renderHook } from '@testing-library/react';
import { useContract } from '../../hooks/useContract';
import { ethers } from 'ethers';

const mockProvider = {
  getNetwork: jest.fn(() => Promise.resolve({ chainId: 11155111n, name: 'sepolia' })),
};

const mockSigner = {
  getAddress: jest.fn(() => Promise.resolve('0x123')),
};

describe('useContract Hook', () => {
  it('returns initial state when provider not available', () => {
    const { result } = renderHook(() => useContract(null, null, 'sepolia'));

    expect(result.current.contract).toBeNull();
    expect(result.current.isReady).toBe(false);
  });

  it('initializes contract when provider and signer available', () => {
    const { result } = renderHook(() =>
      useContract(mockProvider, mockSigner, 'sepolia')
    );

    // Contract should be initialized
    expect(result.current.contract).toBeDefined();
  });

  it('handles network changes', () => {
    const { result, rerender } = renderHook(
      ({ network }) => useContract(mockProvider, mockSigner, network),
      { initialProps: { network: 'sepolia' } }
    );

    expect(result.current.contract).toBeDefined();

    rerender({ network: 'mainnet' });

    // Contract should be reinitialized for new network
    expect(result.current.contract).toBeDefined();
  });
});

