import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import logger from '../services/logging';

export default function NetworkStatus({ network, isCorrectNetwork, onSwitchNetwork }) {
  const [isSwitching, setIsSwitching] = useState(false);

  if (!network) return null;

  // Handle both string (network name) and object (full network config)
  const networkName = typeof network === 'string' ? network : (network?.name || '');
  const networkChainId = typeof network === 'object' ? network?.chainId : null;
  
  // Check if it's Sepolia by name or chainId (11155111)
  const isSepolia = networkName.toLowerCase().includes('sepolia') || 
                    networkChainId === 11155111 || 
                    isCorrectNetwork;

  const handleSwitchNetwork = async () => {
    if (!onSwitchNetwork) return;
    
    setIsSwitching(true);
    try {
      await onSwitchNetwork('sepolia');
    } catch (error) {
      logger.error('Network switch failed', error);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-4 border-2 ${
        isSepolia 
          ? 'bg-success-50 border-success-200' 
          : 'bg-warning-50 border-warning-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          isSepolia ? 'bg-success-100' : 'bg-warning-100'
        }`}>
          {isSepolia ? (
            <CheckCircle2 className="w-6 h-6 text-success-700" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-warning-700" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h3 className={`font-bold text-lg ${
              isSepolia ? 'text-success-900' : 'text-warning-900'
            }`}>
              Network Status
            </h3>
            {!isSepolia && onSwitchNetwork && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSwitchNetwork}
                disabled={isSwitching}
                className="btn btn-primary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                {isSwitching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Switching...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Switch Network
                  </>
                )}
              </motion.button>
            )}
          </div>
          
          <div className={`text-sm ${
            isSepolia ? 'text-success-800' : 'text-warning-800'
          }`}>
            <div className="mb-1">
              <span className="font-semibold">Current Network:</span>{' '}
              <span className="font-mono font-bold">{networkName}</span>
              {networkChainId && (
                <span className="ml-2 text-xs opacity-75">
                  (Chain ID: {networkChainId})
                </span>
              )}
            </div>
            
            {isSepolia ? (
              <div className="mt-3 p-3 bg-white/60 rounded-lg border border-success-200">
                <div className="flex items-center gap-2 text-success-900 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Connected to Sepolia testnet. You can now create and track packages.</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-white/60 rounded-lg border border-warning-200">
                <div className="text-warning-900">
                  <div className="font-medium mb-1">⚠️ Network Mismatch</div>
                  <div className="text-xs">
                    This dApp requires Sepolia testnet (Chain ID: 11155111) for proper functionality.
                    Please switch your network to continue.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

NetworkStatus.propTypes = {
  network: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  isCorrectNetwork: PropTypes.bool,
  onSwitchNetwork: PropTypes.func,
};
