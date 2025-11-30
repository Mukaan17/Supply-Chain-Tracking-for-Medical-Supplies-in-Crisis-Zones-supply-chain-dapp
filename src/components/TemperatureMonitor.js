import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Thermometer, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';
import logger from '../services/logging';

export default function TemperatureMonitor({ packageId, currentTemperature, onUpdate }) {
  const [temperature, setTemperature] = useState(currentTemperature?.toString() || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const contractAddress = useContractAddress();
  const abi = getContractABI();

  const { writeContract, isPending, data: writeData } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: writeData,
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!packageId || !temperature) return;

    const tempValue = parseInt(temperature);
    if (isNaN(tempValue) || tempValue < -50 || tempValue > 50) {
      alert('Temperature must be between -50°C and 50°C');
      return;
    }

    try {
      setIsUpdating(true);
      writeContract({
        address: contractAddress,
        abi,
        functionName: 'updateTemperature',
        args: [BigInt(packageId), tempValue],
      });
      logger.info('Temperature update initiated', { packageId, temperature: tempValue });
    } catch (err) {
      logger.error('Temperature update failed', err);
      alert('Failed to update temperature');
    } finally {
      setIsUpdating(false);
    }
  };

  const getTemperatureStatus = (temp) => {
    if (temp === null || temp === undefined) {
      return { 
        status: 'unknown', 
        bgClass: 'bg-gray-100', 
        textClass: 'text-gray-600', 
        borderClass: 'border-gray-200',
        badgeClass: 'badge-info',
        icon: Thermometer 
      };
    }
    if (temp < 2 || temp > 8) {
      return { 
        status: 'critical', 
        bgClass: 'bg-red-100', 
        textClass: 'text-red-600', 
        borderClass: 'border-red-200',
        badgeClass: 'badge-danger',
        icon: AlertTriangle 
      };
    }
    if (temp < 4 || temp > 6) {
      return { 
        status: 'warning', 
        bgClass: 'bg-amber-100', 
        textClass: 'text-amber-600', 
        borderClass: 'border-amber-200',
        badgeClass: 'badge-warning',
        icon: AlertTriangle 
      };
    }
    return { 
      status: 'normal', 
      bgClass: 'bg-green-100', 
      textClass: 'text-green-600', 
      borderClass: 'border-green-200',
      badgeClass: 'badge-success',
      icon: CheckCircle2 
    };
  };

  const tempStatus = getTemperatureStatus(currentTemperature);
  const StatusIcon = tempStatus.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${tempStatus.bgClass} rounded-lg flex items-center justify-center`}>
          <StatusIcon className={`w-5 h-5 ${tempStatus.textClass}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Temperature Monitoring</h3>
          <p className="text-sm text-gray-500">Track package temperature in real-time</p>
        </div>
      </div>

      {currentTemperature !== null && currentTemperature !== undefined && (
        <div className={`mb-4 p-4 rounded-lg ${tempStatus.bgClass} border-2 ${tempStatus.borderClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Current Temperature</div>
              <div className={`text-3xl font-bold ${tempStatus.textClass.replace('-600', '-700')}`}>
                {currentTemperature}°C
              </div>
            </div>
            <div className={tempStatus.badgeClass}>
              {tempStatus.status.toUpperCase()}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {tempStatus.status === 'normal' && 'Temperature is within safe range (2-8°C)'}
            {tempStatus.status === 'warning' && 'Temperature is approaching limits'}
            {tempStatus.status === 'critical' && 'Temperature is outside safe range!'}
          </div>
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Update Temperature (°C)
          </label>
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            placeholder="Enter temperature (-50 to 50)"
            min="-50"
            max="50"
            step="0.1"
            className="input"
            required
          />
        </div>
        <motion.button
          type="submit"
          disabled={isPending || isConfirming || isUpdating}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary w-full"
        >
          {isPending || isConfirming || isUpdating ? 'Updating...' : 'Update Temperature'}
        </motion.button>
      </form>
    </motion.div>
  );
}

