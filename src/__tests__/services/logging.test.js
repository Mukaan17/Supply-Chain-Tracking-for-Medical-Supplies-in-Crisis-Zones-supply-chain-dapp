/**
 * Logging Service Tests
 */

import logger from '../../services/logging';

describe('Logging Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  it('logs debug messages', () => {
    logger.debug('Test message', { data: 'test' });
    expect(console.log).toHaveBeenCalled();
  });

  it('logs info messages', () => {
    logger.info('Test message', { data: 'test' });
    expect(console.log).toHaveBeenCalled();
  });

  it('logs warning messages', () => {
    logger.warn('Test warning', { data: 'test' });
    expect(console.warn).toHaveBeenCalled();
  });

  it('logs error messages', () => {
    const error = new Error('Test error');
    logger.error('Test error', error, { data: 'test' });
    expect(console.error).toHaveBeenCalled();
  });
});

