/**
 * useContract Hook Mock
 */

export function useContract(provider, signer, networkName) {
  return {
    contract: null,
    loading: false,
    error: null,
    isReady: false,
    callContract: jest.fn(),
    sendTransaction: jest.fn(),
  };
}

export default useContract;


