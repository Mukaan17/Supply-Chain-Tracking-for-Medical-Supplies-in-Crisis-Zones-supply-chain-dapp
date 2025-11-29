/**
 * Error Handler Utility Mock
 */

export const handleError = jest.fn((error, context) => ({
  message: error.message || 'An error occurred',
  type: 'system',
  context,
  recoverable: true,
}));

export default { handleError };


