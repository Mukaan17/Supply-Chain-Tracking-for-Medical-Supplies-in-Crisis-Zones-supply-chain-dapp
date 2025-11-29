/**
 * Validation Utilities Tests
 */

import {
  validatePackageId,
  validateAddress,
  validateDescription,
} from '../../utils/validation';

describe('Validation Utilities', () => {
  describe('validatePackageId', () => {
    it('validates numeric package ID', () => {
      expect(validatePackageId('1')).toBeNull();
      expect(validatePackageId('123')).toBeNull();
    });

    it('rejects non-numeric package ID', () => {
      expect(validatePackageId('abc')).toBeTruthy();
      expect(validatePackageId('1a')).toBeTruthy();
    });

    it('rejects empty package ID', () => {
      expect(validatePackageId('')).toBeTruthy();
      expect(validatePackageId(null)).toBeTruthy();
    });

    it('rejects zero or negative package ID', () => {
      expect(validatePackageId('0')).toBeTruthy();
      expect(validatePackageId('-1')).toBeTruthy();
    });
  });

  describe('validateAddress', () => {
    it('validates correct Ethereum address', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      expect(validateAddress(validAddress)).toBeNull();
    });

    it('rejects invalid address format', () => {
      expect(validateAddress('0x123')).toBeTruthy();
      expect(validateAddress('not-an-address')).toBeTruthy();
    });

    it('rejects empty address', () => {
      expect(validateAddress('')).toBeTruthy();
      expect(validateAddress(null)).toBeTruthy();
    });

    it('rejects zero address', () => {
      expect(validateAddress('0x0000000000000000000000000000000000000000')).toBeTruthy();
    });
  });

  describe('validateDescription', () => {
    it('validates description within length limits', () => {
      expect(validateDescription('Valid description')).toBeNull();
      expect(validateDescription('abc')).toBeNull(); // Min length
    });

    it('rejects description too short', () => {
      expect(validateDescription('ab')).toBeTruthy();
      expect(validateDescription('')).toBeTruthy();
    });

    it('rejects description too long', () => {
      const longDesc = 'a'.repeat(501);
      expect(validateDescription(longDesc)).toBeTruthy();
    });

    it('rejects null or undefined', () => {
      expect(validateDescription(null)).toBeTruthy();
      expect(validateDescription(undefined)).toBeTruthy();
    });
  });
});

