import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';
import logger from '../services/logging';

export default function LocationTracker({ packageId, currentLocation, onUpdate }) {
  const [location, setLocation] = useState(currentLocation || '');
  const [coordinates, setCoordinates] = useState('');
  const contractAddress = useContractAddress();
  const abi = getContractABI();

  const { writeContract, isPending, data: writeData } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: writeData,
  });

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const coords = `${latitude},${longitude}`;
          setCoordinates(coords);
          setLocation(coords);
        },
        (error) => {
          logger.error('Geolocation error', error);
          alert('Unable to get current location');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!packageId || !location) return;

    if (location.length > 200) {
      alert('Location string is too long (max 200 characters)');
      return;
    }

    try {
      writeContract({
        address: contractAddress,
        abi,
        functionName: 'updateLocation',
        args: [BigInt(packageId), location],
      });
      logger.info('Location update initiated', { packageId, location });
      if (onUpdate) onUpdate(location);
    } catch (err) {
      logger.error('Location update failed', err);
      alert('Failed to update location');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shadow-sm">
          <MapPin className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Location Tracking</h3>
          <p className="text-sm text-gray-500">Track package location in real-time</p>
        </div>
      </div>

      {currentLocation && (
        <div className="mb-4 p-4 rounded-lg bg-blue-50 border-2 border-blue-200">
          <div className="text-sm font-medium text-gray-600 mb-1">Current Location</div>
          <div className="text-lg font-mono text-blue-700 font-semibold">{currentLocation}</div>
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Update Location
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter coordinates (lat,lng) or address"
              className="input flex-1"
              required
            />
            <motion.button
              type="button"
              onClick={handleGetCurrentLocation}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
            </motion.button>
          </div>
          {coordinates && (
            <div className="mt-2 text-xs text-gray-500">
              Coordinates: {coordinates}
            </div>
          )}
        </div>
        <motion.button
          type="submit"
          disabled={isPending || isConfirming}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary w-full"
        >
          {isPending || isConfirming ? 'Updating...' : 'Update Location'}
        </motion.button>
      </form>
    </motion.div>
  );
}

