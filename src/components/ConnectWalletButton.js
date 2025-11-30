import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, X, CheckCircle2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export default function ConnectWalletButton({ account, connectors, onConnect, isLoading }) {
  const [isOpen, setIsOpen] = useState(false);
  const short = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '');
  
  const handleConnect = (connectorId) => {
    onConnect(connectorId);
    setIsOpen(false);
  };
  
  if (account) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-center"
      >
        <div className="bg-white rounded-xl shadow-md border-2 border-success-200 p-4 flex items-center gap-3 bg-gradient-to-r from-success-50 to-success-100">
          <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-success-700" />
          </div>
          <div>
            <div className="text-sm font-semibold text-success-900">Wallet Connected</div>
            <div className="text-xs text-success-700 font-mono font-medium">{short(account)}</div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isLoading}
          className="btn btn-primary flex items-center gap-2 text-lg px-6 py-3"
        >
          <Wallet className="w-5 h-5" />
          {isLoading ? 'Connecting...' : 'Connect Wallet'}
        </motion.button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md z-50 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-2xl font-bold text-neutral-900">
              Connect Wallet
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-neutral-600 mb-6">
            Choose a wallet to connect to the supply chain tracking system
          </Dialog.Description>

          <div className="space-y-3">
            {connectors && connectors.length > 0 ? (
              connectors.map((connector) => (
                <motion.button
                  key={connector.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleConnect(connector.id)}
                  className="w-full p-4 border-2 border-neutral-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-left flex items-center gap-3 hover:shadow-md"
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center shadow-sm">
                    <Wallet className="w-6 h-6 text-primary-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900">{connector.name}</div>
                    <div className="text-sm text-neutral-500">{connector.id}</div>
                  </div>
                </motion.button>
              ))
            ) : (
              <div className="text-center py-8 text-neutral-500">
                No wallets available. Please install a wallet extension.
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-200">
            <p className="text-xs text-neutral-500 text-center">
              By connecting, you agree to use the supply chain tracking system responsibly.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
