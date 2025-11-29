/**
 * Ethers.js Mock
 * 
 * Mocks ethers.js for testing
 */

export const ethers = {
  BrowserProvider: jest.fn(),
  Contract: jest.fn(),
  BigNumber: {
    from: jest.fn((value) => ({
      toString: () => String(value),
      toNumber: () => Number(value),
    })),
  },
  utils: {
    formatEther: jest.fn((value) => String(value)),
    parseEther: jest.fn((value) => value),
    formatUnits: jest.fn((value) => String(value)),
    parseUnits: jest.fn((value) => value),
  },
};

export default ethers;


