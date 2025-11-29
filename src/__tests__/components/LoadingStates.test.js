/**
 * LoadingStates Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  PackageCardSkeleton,
  ListItemSkeleton,
  LoadingSpinner,
  LoadingOverlay,
  InlineLoader,
  TableSkeleton,
} from '../../components/LoadingStates';

describe('LoadingStates Components', () => {
  it('renders PackageCardSkeleton', () => {
    render(<PackageCardSkeleton />);
    const skeleton = screen.getByRole('generic');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders ListItemSkeleton', () => {
    render(<ListItemSkeleton />);
    const skeleton = screen.getByRole('generic');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders LoadingSpinner', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('generic');
    expect(spinner).toBeInTheDocument();
  });

  it('renders LoadingOverlay with message', () => {
    render(<LoadingOverlay message="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders InlineLoader', () => {
    render(<InlineLoader message="Processing" />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('renders TableSkeleton', () => {
    render(<TableSkeleton rows={3} columns={4} />);
    const table = screen.getByRole('generic');
    expect(table).toBeInTheDocument();
  });
});

