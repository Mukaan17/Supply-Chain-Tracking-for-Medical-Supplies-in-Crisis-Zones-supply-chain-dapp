/**
 * useWallet Hook Mock
 */

export function useWallet() {
  return {
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
  };
}

export default useWallet;


