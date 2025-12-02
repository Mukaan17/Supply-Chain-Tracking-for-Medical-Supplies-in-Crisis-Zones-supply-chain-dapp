/**
 * Main App Component
 * 
 * Enterprise-grade Supply Chain Tracking dApp with comprehensive error handling,
 * monitoring, and offline support.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Navigation } from './components/Navigation';
import { DashboardView } from './components/dashboard-view';
import { CreateShipmentForm } from './components/create-shipment-form';
import { ShipmentsList } from './components/shipments-list';
import { ShipmentDetailModal } from './components/shipment-detail-modal';
import { PackagesFetcher } from './components/PackagesFetcher';
import ErrorBoundary, { ErrorDisplay } from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import NetworkStatus from './components/NetworkStatus';
import { useWallet } from './hooks/useWallet';
import { useContract } from './hooks/useContract';
import config from './config';
import logger from './services/logging';
import errorTracking from './services/errorTracking';
import analytics from './services/analytics';
import monitoring from './services/monitoring';
import offlineManager from './services/offlineManager';
import websocketService from './services/websocket';
import { Toaster } from 'sonner';
import { ParsedPackage } from './utils/packageParser';
import { useToastWithNotifications } from './hooks/useToastWithNotifications';

function App() {
  const [appError, setAppError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [lastShipmentsUpdate, setLastShipmentsUpdate] = useState<Date | null>(null);

  // Live blockchain data
  const [shipments, setShipments] = useState<ParsedPackage[]>([]);

  // Use custom hooks
  const wallet = useWallet();
  const contract = useContract();
  const toast = useToastWithNotifications();

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
      } catch (error: any) {
        logger.error('Failed to initialize app', error);
        errorTracking.captureException(error, {
          tags: { component: 'App', action: 'init' },
        });
        setAppError('Failed to initialize application');
      }
    };

    init();
  }, []);

  // Track wallet connection and show toast with network status
  useEffect(() => {
    if (wallet.isConnected && wallet.account && wallet.network) {
      analytics.setUserId(wallet.account);
      analytics.trackEvent('wallet_connected', {
        address: wallet.account,
        network: wallet.network?.name,
      });
      logger.info('Wallet connected in App', {
        address: wallet.account,
        network: wallet.network?.name,
      });

      // Determine if network is correct (Sepolia)
      const networkName = typeof wallet.network === 'string' ? wallet.network : (wallet.network?.name || '');
      const networkChainId = typeof wallet.network === 'object' ? wallet.network?.chainId : null;
      const isSepolia = networkName.toLowerCase().includes('sepolia') || 
                        networkChainId === 11155111 || 
                        contract.isReady;

      if (isSepolia) {
        toast.success('Network Status', {
          description: `Connected to Sepolia testnet (Chain ID: ${networkChainId || 11155111}). You can now create and track packages.`,
          duration: 5000,
        });
      } else {
        toast.warning('Network Status', {
          description: `Current Network: ${networkName} (Chain ID: ${networkChainId || 'Unknown'}). Please switch to Sepolia testnet (Chain ID: 11155111) for proper functionality.`,
          duration: 6000,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.isConnected, wallet.account, wallet.network, contract.isReady]);

  // Handle offline status
  useEffect(() => {
    const unsubscribe = offlineManager.onSyncStatusChange((isOnline: boolean) => {
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

      const unsubscribe = websocketService.on('package_update', (data: any) => {
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
  const handleError = (error: any) => {
    logger.error('App error', error);
    errorTracking.captureException(error, {
      tags: { component: 'App' },
    });
    setAppError(error.message || 'An error occurred');
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    try {
      if (wallet.connectors && wallet.connectors.length > 0) {
        await wallet.connectWallet(wallet.connectors[0].id);
        // Toast will be shown in the useEffect above
      }
    } catch (error: any) {
      handleError(error);
      toast.error('Failed to connect wallet', {
        description: error.message || 'Please try again',
      });
    }
  };

  const handleCreateShipment = (_formData: any) => {
    // When a package is created on blockchain, PackagesFetcher will automatically fetch it
    // This is just for UI feedback - actual creation happens in CreateShipmentForm
  };

  const handlePackagesLoaded = useCallback((packages: ParsedPackage[]) => {
    setShipments(packages);
    setIsLoadingShipments(false);
    setLastShipmentsUpdate(new Date());
  }, []);

  const handleUpdateStatus = (
    id: string,
    newStatus: string,
  ) => {
    // Status update is handled in ShipmentDetailModal via blockchain
    // This is just for UI feedback
    setShipments(
      shipments.map((s) =>
        s.id === id
          ? { ...s, status: newStatus, lastUpdate: 'Just now' }
          : s,
      ),
    );
  };

  const handleTransferOwnership = (
    id: string,
    newOwner: string,
  ) => {
    // Transfer is handled in ShipmentDetailModal via blockchain
    // This is just for UI feedback
    setShipments(
      shipments.map((s) =>
        s.id === id
          ? { ...s, owner: newOwner, lastUpdate: 'Just now' }
          : s,
      ),
    );
    setSelectedShipmentId(null);
  };

  const handleViewShipment = (id: string) => {
    setSelectedShipmentId(id);
  };

  const handleRefresh = async () => {
    setIsLoadingShipments(true);
    // Trigger refresh by clearing and refetching
    // PackagesFetcher will automatically refetch when wallet/contract changes
    setShipments([]);
    // The PackagesFetcher will reload automatically
  };

  const selectedShipment = shipments.find(
    (s) => s.id === selectedShipmentId,
  );

  // Calculate stats from live blockchain data
  const stats = {
    totalShipments: shipments.length,
    inTransit: shipments.filter(
      (s) => s.status === 'In Transit',
    ).length,
    delivered: shipments.filter((s) => s.status === 'Delivered')
      .length,
    delayed: shipments.filter((s) => {
      // Check for alerts: past expected date, temperature violations, etc.
      if (s.status === 'In Transit' && s.expectedDate) {
        const expected = new Date(s.expectedDate);
        const now = new Date();
        if (expected < now) return true;
      }
      // Could add more alert conditions here
      return false;
    }).length,
  };

  if (!isInitialized) {
    return <LoadingSpinner message="Initializing application..." />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950">
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              // Default style - individual toasts will override this
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
            },
          }}
        />

        <Navigation
          walletConnected={wallet.isConnected}
          walletAddress={wallet.account || ''}
          currentView={currentView}
          onConnectWallet={handleConnectWallet}
          onNavigate={setCurrentView}
          onSwitchAccount={async () => {
            try {
              await wallet.switchAccount();
              toast.success('Account Switch Requested', {
                description: 'Please select a different account in your wallet',
              });
            } catch (error: any) {
              toast.error('Failed to Switch Account', {
                description: error.message || 'Unable to switch account. Please try again.',
              });
            }
          }}
          onDisconnectWallet={() => {
            wallet.disconnectWallet();
            toast.info('Wallet Disconnected', {
              description: 'You have been disconnected from your wallet',
            });
          }}
        />

        <main className="max-w-7xl mx-auto px-6 py-8">
          <ErrorDisplay error={appError} onClear={() => setAppError(null)} />

          {/* Fetch packages from blockchain */}
          {wallet.isConnected && contract.isReady && (
            <PackagesFetcher
              account={wallet.account}
              onPackagesLoaded={handlePackagesLoaded}
            />
          )}

          {/* Network status is now shown as toast on wallet connection */}
          {wallet.network && !contract.isReady && (
            <div className="mb-6">
              <NetworkStatus
                network={wallet.network}
                isCorrectNetwork={false}
                onSwitchNetwork={async (chainId: number) => {
                  try {
                    await wallet.switchNetwork(chainId);
                  } catch (error: any) {
                    handleError(error);
                  }
                }}
              />
            </div>
          )}

          {wallet.error && (
            <ErrorDisplay
              error={wallet.error.message || String(wallet.error)}
              onClear={() => {}}
              onRetry={() => {
                if (wallet.connectors && wallet.connectors.length > 0) {
                  handleConnectWallet();
                }
              }}
            />
          )}

          {wallet.loading && <LoadingSpinner message="Connecting to wallet..." />}

          {currentView === 'dashboard' && (
            <DashboardView
              stats={stats}
              recentShipments={shipments}
              onViewShipment={handleViewShipment}
            />
          )}

          {currentView === 'create' && (
            <CreateShipmentForm
              onCreateShipment={handleCreateShipment}
              walletConnected={wallet.isConnected}
              onNavigate={setCurrentView}
            />
          )}

          {currentView === 'packages' && (
            <ShipmentsList
              shipments={shipments}
              onViewDetails={handleViewShipment}
              onRefresh={handleRefresh}
              lastUpdated={lastShipmentsUpdate || undefined}
              isLoading={isLoadingShipments && shipments.length === 0}
            />
          )}
        </main>

        {selectedShipment && (
          <ShipmentDetailModal
            shipment={selectedShipment}
            currentUserAddress={wallet.account || ''}
            onClose={() => setSelectedShipmentId(null)}
            onUpdateStatus={handleUpdateStatus}
            onTransferOwnership={handleTransferOwnership}
            onRefresh={handleRefresh}
          />
        )}

        {/* Offline indicator */}
        {!offlineManager.isCurrentlyOnline() && (
          <div className="fixed bottom-6 right-6 bg-amber-500/10 border-2 border-amber-500/50 rounded-xl p-4 shadow-xl z-50 backdrop-blur-sm">
            <div className="font-bold text-amber-400 mb-1 flex items-center gap-2">
              <span>📡</span> You're offline
            </div>
            <div className="text-sm text-amber-500/80">
              Transactions will be queued when connection is restored
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
