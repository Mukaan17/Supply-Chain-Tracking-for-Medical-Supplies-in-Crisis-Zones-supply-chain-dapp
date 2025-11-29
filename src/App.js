/**
 * Main App Component
 * 
 * Enterprise-grade Supply Chain Tracking dApp with comprehensive error handling,
 * monitoring, and offline support.
 */

import './App.css';
import React, { useEffect, useState } from 'react';
import ConnectWalletButton from './components/ConnectWalletButton';
import CreatePackage from './components/CreatePackage';
import PackageTracker from './components/PackageTracker';
import ErrorBoundary, { ErrorDisplay } from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import NetworkStatus from './components/NetworkStatus';
import TransactionQueue from './components/TransactionQueue';
import { useWallet } from './hooks/useWallet';
import { useContract } from './hooks/useContract';
import config from './config';
import logger from './services/logging';
import errorTracking from './services/errorTracking';
import analytics from './services/analytics';
import monitoring from './services/monitoring';
import offlineManager from './services/offlineManager';
import websocketService from './services/websocket';
import { getNetworkByChainId, getMetaMaskNetworkConfig } from './config/networks';

function App() {
  const [appError, setAppError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Use custom hooks
  const wallet = useWallet();
  const { contract, loading: contractLoading, error: contractError, isReady: contractReady } = useContract(
    wallet.provider,
    wallet.signer,
    wallet.network?.name || config.network.default
  );

  // Initialize services
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize error tracking
        if (config.services.sentry.enabled) {
          errorTracking.init();
        }

        // Initialize analytics
        if (config.features.analytics) {
          analytics.init();
        }

        // Initialize monitoring
        monitoring.trackPageView('home');

        // Track app load
        analytics.trackEvent('app_loaded', {
          environment: config.app.environment,
          version: config.app.version,
        });

        logger.info('App initialized', {
          environment: config.app.environment,
          version: config.app.version,
        });

        setIsInitialized(true);
      } catch (error) {
        logger.error('Failed to initialize app', error);
        errorTracking.captureException(error, {
          tags: { component: 'App', action: 'init' },
        });
        setAppError('Failed to initialize application');
      }
    };

    init();
  }, []);

  // Track wallet connection
  useEffect(() => {
    if (wallet.isConnected && wallet.account) {
      analytics.setUserId(wallet.account);
      analytics.trackEvent('wallet_connected', {
        address: wallet.account,
        network: wallet.network?.name,
      });
      logger.info('Wallet connected in App', {
        address: wallet.account,
        network: wallet.network?.name,
      });
    }
  }, [wallet.isConnected, wallet.account, wallet.network]);

  // Handle offline status
  useEffect(() => {
    const unsubscribe = offlineManager.onSyncStatusChange((isOnline) => {
      if (isOnline) {
        logger.info('Network connection restored');
        analytics.trackEvent('network_restored');
      } else {
        logger.warn('Network connection lost');
        analytics.trackEvent('network_lost');
      }
    });

    return unsubscribe;
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (config.features.websocket && websocketService.enabled) {
      websocketService.connect();

      const unsubscribe = websocketService.on('package_update', (data) => {
        logger.debug('Package update from WebSocket', data);
        analytics.trackEvent('package_update_received', data);
      });

      return () => {
        unsubscribe();
        websocketService.disconnect();
      };
    }
  }, []);

  // Error handling
  const handleError = (error) => {
    logger.error('App error', error);
    errorTracking.captureException(error, {
      tags: { component: 'App' },
    });
    setAppError(error.message || 'An error occurred');
  };

  if (!isInitialized) {
    return <LoadingSpinner message="Initializing application..." />;
  }

  return (
    <ErrorBoundary>
      <div className="App" style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <header style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#2c3e50', marginBottom: 8 }}>
            🏥 Supply Chain Tracking dApp
          </h1>
          <p style={{ color: '#7f8c8d', margin: 0 }}>
            Track medical supplies on the blockchain
          </p>
          <p style={{ color: '#95a5a6', fontSize: '12px', margin: '4px 0 0 0' }}>
            Version {config.app.version} • {config.app.environment}
          </p>
        </header>

        <ErrorDisplay error={appError} onClear={() => setAppError(null)} />

        <ConnectWalletButton
          account={wallet.account}
          onConnect={wallet.connectWallet}
          isLoading={wallet.loading}
        />

        {wallet.network && (
          <NetworkStatus
            network={wallet.network.name}
            isCorrectNetwork={wallet.network.testnet || false}
            onSwitchNetwork={async (networkName) => {
              try {
                await wallet.switchNetwork(networkName);
              } catch (error) {
                handleError(error);
              }
            }}
          />
        )}

        {wallet.error && (
          <ErrorDisplay
            error={wallet.error.message || wallet.error}
            onClear={() => {}}
          />
        )}

        {wallet.loading && <LoadingSpinner message="Connecting to wallet..." />}

        {wallet.isConnected && contractReady ? (
          <div style={{ marginTop: 24 }}>
            <CreatePackage
              contract={contract}
              provider={wallet.provider}
              network={wallet.network?.name}
            />
            <hr style={{ margin: '32px 0' }} />
            <PackageTracker
              contract={contract}
              account={wallet.account}
              provider={wallet.provider}
              network={wallet.network?.name}
            />
            {wallet.network && (
              <TransactionQueue network={wallet.network.name} />
            )}
          </div>
        ) : wallet.isConnected && contractLoading ? (
          <LoadingSpinner message="Loading contract..." />
        ) : wallet.isConnected && contractError ? (
          <ErrorDisplay
            error={contractError.message || 'Failed to load contract'}
            onClear={() => {}}
          />
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              backgroundColor: '#f8f9fa',
              borderRadius: 8,
              border: '1px solid #dee2e6',
            }}
          >
            <h3 style={{ color: '#6c757d' }}>Connect Your Wallet</h3>
            <p style={{ color: '#6c757d' }}>
              Please connect your MetaMask wallet to start tracking packages.
            </p>
          </div>
        )}

        {/* Offline indicator */}
        {!offlineManager.isCurrentlyOnline() && (
          <div
            style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: 8,
              padding: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#856404' }}>
              📡 You're offline
            </div>
            <div style={{ fontSize: '12px', color: '#856404' }}>
              Transactions will be queued
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
