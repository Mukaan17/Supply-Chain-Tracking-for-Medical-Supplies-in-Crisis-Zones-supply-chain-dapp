/**
 * Cache Service Tests
 */

import cacheService from '../../utils/cache';

describe('Cache Service', () => {
  beforeEach(async () => {
    await cacheService.clear();
  });

  it('should set and get cached value', async () => {
    await cacheService.set('test-key', 'test-value');
    const value = await cacheService.get('test-key');
    expect(value).toBe('test-value');
  });

  it('should return null for non-existent key', async () => {
    const value = await cacheService.get('non-existent');
    expect(value).toBeNull();
  });

  it('should delete cached value', async () => {
    await cacheService.set('test-key', 'test-value');
    await cacheService.delete('test-key');
    const value = await cacheService.get('test-key');
    expect(value).toBeNull();
  });

  it('should check if key exists', async () => {
    await cacheService.set('test-key', 'test-value');
    const exists = await cacheService.has('test-key');
    expect(exists).toBe(true);
  });

  it('should clear all cache', async () => {
    await cacheService.set('key1', 'value1');
    await cacheService.set('key2', 'value2');
    await cacheService.clear();
    
    const value1 = await cacheService.get('key1');
    const value2 = await cacheService.get('key2');
    expect(value1).toBeNull();
    expect(value2).toBeNull();
  });

  it('should respect TTL', async () => {
    await cacheService.set('test-key', 'test-value', { ttl: 100 });
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const value = await cacheService.get('test-key');
    expect(value).toBeNull();
  });
});

