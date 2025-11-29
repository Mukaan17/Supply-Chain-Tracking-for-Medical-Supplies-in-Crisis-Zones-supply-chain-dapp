/**
 * Retry Utility Tests
 */

import { retry } from '../../utils/retry';

describe('Retry Utility', () => {
  it('succeeds on first attempt', async () => {
    const fn = jest.fn(() => Promise.resolve('success'));
    const result = await retry(fn, { maxAttempts: 3 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure', async () => {
    let attempts = 0;
    const fn = jest.fn(() => {
      attempts++;
      if (attempts < 2) {
        return Promise.reject(new Error('Failed'));
      }
      return Promise.resolve('success');
    });

    const result = await retry(fn, { maxAttempts: 3 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('fails after max attempts', async () => {
    const fn = jest.fn(() => Promise.reject(new Error('Failed')));
    
    await expect(retry(fn, { maxAttempts: 3 })).rejects.toThrow('Failed');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects retry condition', async () => {
    const fn = jest.fn(() => Promise.reject(new Error('Permanent failure')));
    const shouldRetry = (error) => error.message !== 'Permanent failure';
    
    await expect(
      retry(fn, { maxAttempts: 3, shouldRetry })
    ).rejects.toThrow('Permanent failure');
    
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

