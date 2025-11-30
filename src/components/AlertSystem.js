import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';
import logger from '../services/logging';

const ALERT_LEVELS = {
  0: { 
    name: 'None', 
    bgClass: 'bg-gray-100', 
    textClass: 'text-gray-600', 
    borderClass: 'border-gray-200',
    icon: CheckCircle2 
  },
  1: { 
    name: 'Warning', 
    bgClass: 'bg-amber-100', 
    textClass: 'text-amber-600', 
    borderClass: 'border-amber-200',
    icon: AlertTriangle 
  },
  2: { 
    name: 'Critical', 
    bgClass: 'bg-red-100', 
    textClass: 'text-red-600', 
    borderClass: 'border-red-200',
    icon: XCircle 
  },
};

export default function AlertSystem({ packageId, currentAlertLevel, onAlertRaised }) {
  const [alertLevel, setAlertLevel] = useState('1');
  const [reason, setReason] = useState('');
  const contractAddress = useContractAddress();
  const abi = getContractABI();

  const { writeContract, isPending, data: writeData } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: writeData,
  });

  const handleRaiseAlert = async (e) => {
    e.preventDefault();
    if (!packageId || !reason.trim()) return;

    if (reason.length > 500) {
      alert('Reason is too long (max 500 characters)');
      return;
    }

    try {
      writeContract({
        address: contractAddress,
        abi,
        functionName: 'raiseAlert',
        args: [BigInt(packageId), parseInt(alertLevel), reason],
      });
      logger.info('Alert raised', { packageId, level: alertLevel, reason });
      if (onAlertRaised) onAlertRaised(parseInt(alertLevel), reason);
      setReason('');
    } catch (err) {
      logger.error('Failed to raise alert', err);
      alert('Failed to raise alert');
    }
  };

  const currentAlert = currentAlertLevel !== null && currentAlertLevel !== undefined 
    ? ALERT_LEVELS[currentAlertLevel] 
    : ALERT_LEVELS[0];
  const CurrentIcon = currentAlert.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${currentAlert.bgClass} rounded-lg flex items-center justify-center`}>
          <CurrentIcon className={`w-5 h-5 ${currentAlert.textClass}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Emergency Alerts</h3>
          <p className="text-sm text-gray-500">Raise alerts for critical issues</p>
        </div>
      </div>

      {currentAlertLevel !== null && currentAlertLevel !== undefined && currentAlertLevel !== 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mb-4 p-4 rounded-lg ${currentAlert.bgClass.replace('-100', '-50')} border-2 ${currentAlert.borderClass}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CurrentIcon className={`w-5 h-5 ${currentAlert.textClass}`} />
            <div className={`font-semibold ${currentAlert.textClass.replace('-600', '-800')}`}>
              {currentAlert.name} Alert Active
            </div>
          </div>
          <div className="text-sm text-gray-700">
            This package has an active {currentAlert.name.toLowerCase()} alert.
          </div>
        </motion.div>
      )}

      <form onSubmit={handleRaiseAlert} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Alert Level
          </label>
          <select
            value={alertLevel}
            onChange={(e) => setAlertLevel(e.target.value)}
            className="input"
            required
          >
            <option value="1">Warning</option>
            <option value="2">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the issue..."
            rows={3}
            className="input"
            required
            maxLength={500}
          />
          <div className="mt-1 text-xs text-gray-500">
            {reason.length}/500 characters
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={isPending || isConfirming}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`btn btn-${parseInt(alertLevel) === 2 ? 'danger' : 'warning'} w-full`}
        >
          {isPending || isConfirming ? 'Raising Alert...' : `Raise ${ALERT_LEVELS[parseInt(alertLevel)].name} Alert`}
        </motion.button>
      </form>
    </motion.div>
  );
}

