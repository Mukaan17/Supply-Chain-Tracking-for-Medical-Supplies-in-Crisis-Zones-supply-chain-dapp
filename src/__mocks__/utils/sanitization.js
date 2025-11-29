/**
 * Sanitization Utility Mock
 */

export const sanitizePackageId = jest.fn((id) => {
  const num = parseInt(id, 10);
  return isNaN(num) ? null : num;
});

export const sanitizeAddress = jest.fn((address) => address);

export const sanitizeDescription = jest.fn((desc) => desc);

export default {
  sanitizePackageId,
  sanitizeAddress,
  sanitizeDescription,
};


