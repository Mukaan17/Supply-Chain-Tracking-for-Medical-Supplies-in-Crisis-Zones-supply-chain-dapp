/**
 * @Author: Mukhil Sundararaj
 * @Date:   2025-09-11 19:05:37
 * @Last Modified by:   Mukhil Sundararaj
 * @Last Modified time: 2025-09-11 19:08:13
 */
import React, { useState, useEffect, useMemo } from 'react';
import { debounce } from '../utils/debounce';
import cacheService from '../utils/cache';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import { handleError } from '../utils/errorHandler';
import { VirtualList } from '../utils/virtualScroll';
import { NoSearchResultsEmptyState } from './EmptyStates';
import { ListItemSkeleton } from './LoadingStates';

export default function PackageSearch({ contract, onPackageSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPackages, setTotalPackages] = useState(0);
  const itemsPerPage = 20;

  const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: '0', label: 'Created' },
    { value: '1', label: 'In Transit' },
    { value: '2', label: 'Delivered' }
  ];

  const searchPackages = async () => {
    if (!contract || !searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    // Check cache first
    const cacheKey = `search_${searchTerm}_${statusFilter}_${currentPage}`;
    const cached = await cacheService.get(cacheKey, 'search');
    if (cached) {
      setSearchResults(cached);
      logger.debug('Search results loaded from cache', { searchTerm, statusFilter });
      return;
    }

    setIsSearching(true);
    setError('');
    
    try {
      logger.debug('Searching packages', { searchTerm, statusFilter, page: currentPage });
      
      // Get total packages count (if available)
      try {
        const total = await contract.getTotalPackages();
        setTotalPackages(Number(total));
      } catch (e) {
        // Fallback if method not available
        logger.debug('getTotalPackages not available, using estimate');
      }
      
      const results = [];
      const startId = (currentPage - 1) * itemsPerPage + 1;
      const endId = Math.min(startId + itemsPerPage - 1, totalPackages || 100);
      
      // Search in batches
      const searchPromises = [];
      for (let id = startId; id <= endId; id++) {
        searchPromises.push(
          contract.getPackageDetails(id)
            .then(packageData => ({
              id: packageData[0].toString(),
              description: packageData[1],
              creator: packageData[2],
              currentOwner: packageData[3],
              status: Number(packageData[4]),
            }))
            .catch(() => null) // Package doesn't exist
        );
      }
      
      const packages = await Promise.all(searchPromises);
      
      // Filter results
      const filtered = packages
        .filter(pkg => pkg !== null)
        .filter(pkg => {
          const matchesSearch = pkg.description.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStatus = statusFilter === 'all' || pkg.status.toString() === statusFilter;
          return matchesSearch && matchesStatus;
        });
      
      setSearchResults(filtered);
      
      // Cache results
      await cacheService.set(cacheKey, filtered, {
        namespace: 'search',
        ttl: 30000, // 30 seconds
      });
      
      logger.info('Search completed', {
        searchTerm,
        resultsCount: filtered.length,
        page: currentPage,
      });
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'PackageSearch',
        action: 'searchPackages',
      });
      logger.error('Search error', err, { searchTerm, statusFilter });
      errorTracking.captureException(err, {
        tags: { component: 'PackageSearch' },
      });
      setError(errorInfo.message || 'Failed to search packages');
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce(() => {
      setCurrentPage(1); // Reset to first page on new search
      searchPackages();
    }, 500),
    [searchTerm, statusFilter, contract]
  );

  useEffect(() => {
    if (searchTerm.trim()) {
      debouncedSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, statusFilter, debouncedSearch]);

  const handlePackageSelect = (packageData) => {
    if (onPackageSelect) {
      onPackageSelect(packageData.id);
    }
  };

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: 8,
      padding: 16,
      marginBottom: 20
    }}>
      <h3 style={{ marginTop: 0, color: '#2c3e50' }}>🔍 Search Packages</h3>
      
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: 12,
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: '16px'
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: 12,
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: '16px',
            backgroundColor: 'white'
          }}
        >
          {STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isSearching && (
        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
          🔍 Searching packages...
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: 4,
          padding: 12,
          color: '#721c24',
          marginBottom: 16
        }}>
          {error}
        </div>
      )}

      {searchResults.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 12px 0', color: '#495057' }}>
            Found {searchResults.length} package{searchResults.length !== 1 ? 's' : ''}
          </h4>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {searchResults.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => handlePackageSelect(pkg)}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: 4,
                  padding: 12,
                  marginBottom: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#e9ecef';
                  e.target.style.borderColor = '#007bff';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'white';
                  e.target.style.borderColor = '#dee2e6';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                      Package #{pkg.id}
                    </div>
                    <div style={{ color: '#6c757d', fontSize: '14px' }}>
                      {pkg.description}
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: pkg.status === 0 ? '#fff3cd' : pkg.status === 1 ? '#d1ecf1' : '#d4edda',
                    color: pkg.status === 0 ? '#856404' : pkg.status === 1 ? '#0c5460' : '#155724',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {pkg.status === 0 ? 'Created' : pkg.status === 1 ? 'In Transit' : 'Delivered'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {searchTerm && !isSearching && searchResults.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#6c757d' }}>
          No packages found matching your search criteria.
        </div>
      )}
    </div>
  );
}
