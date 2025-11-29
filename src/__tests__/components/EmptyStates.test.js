/**
 * EmptyStates Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  NoPackagesEmptyState,
  NoSearchResultsEmptyState,
  NoTransactionsEmptyState,
  ErrorEmptyState,
  OfflineEmptyState,
} from '../../components/EmptyStates';

describe('EmptyStates Components', () => {
  it('renders NoPackagesEmptyState', () => {
    render(<NoPackagesEmptyState />);
    expect(screen.getByText(/no packages yet/i)).toBeInTheDocument();
  });

  it('renders NoPackagesEmptyState with create button', () => {
    const onCreateClick = jest.fn();
    render(<NoPackagesEmptyState onCreateClick={onCreateClick} />);
    
    const button = screen.getByRole('button', { name: /create package/i });
    expect(button).toBeInTheDocument();
    
    button.click();
    expect(onCreateClick).toHaveBeenCalled();
  });

  it('renders NoSearchResultsEmptyState', () => {
    render(<NoSearchResultsEmptyState searchTerm="test" />);
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    expect(screen.getByText(/test/i)).toBeInTheDocument();
  });

  it('renders NoTransactionsEmptyState', () => {
    render(<NoTransactionsEmptyState />);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });

  it('renders ErrorEmptyState', () => {
    render(<ErrorEmptyState error="Test error" />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('renders ErrorEmptyState with retry button', () => {
    const onRetry = jest.fn();
    render(<ErrorEmptyState error="Test error" onRetry={onRetry} />);
    
    const button = screen.getByRole('button', { name: /try again/i });
    expect(button).toBeInTheDocument();
    
    button.click();
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders OfflineEmptyState', () => {
    render(<OfflineEmptyState />);
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
  });
});

