/**
 * Gas Estimate Component
 * 
 * Displays gas estimation and allows gas price selection.
 */

import React, { useState, useEffect } from 'react';
import { useTransaction } from '../hooks/useTransaction';
import logger from '../services/logging';

export default function GasEstimate({ 
  contract, 
  methodName, 
  args = [],
  onGasEstimate,
  showSelector = true,
}) {
  const { estimateGas, getGasPrice } = useTransaction();
  const [gasEstimate, setGasEstimate] = useState(null);
  const [gasPrice, setGasPrice] = useState(null);
  const [gasPriceOption, setGasPriceOption] = useState('standard'); // 'slow', 'standard', 'fast'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [estimatedCost, setEstimatedCost] = useState(null);

  // Estimate gas when component mounts or dependencies change
  useEffect(() => {
    if (contract && methodName) {
      estimateGasForTransaction();
    }
  }, [contract, methodName, JSON.stringify(args)]);

  // Update gas price when option changes
  useEffect(() => {
    if (gasPrice) {
      updateGasPrice();
    }
  }, [gasPriceOption, gasPrice]);

  const estimateGasForTransaction = async () => {
    if (!contract || !methodName) return;

    setLoading(true);
    setError(null);

    try {
      const estimate = await estimateGas(contract, methodName, ...args);
      setGasEstimate(estimate);

      // Get current gas price
      if (contract.provider) {
        const feeData = await getGasPrice(contract.provider);
        setGasPrice(feeData);
        updateEstimatedCost(estimate, feeData);
      }

      if (onGasEstimate) {
        onGasEstimate(estimate);
      }

      logger.debug('Gas estimated', {
        method: methodName,
        gasEstimate: estimate.toString(),
      });
    } catch (err) {
      logger.error('Gas estimation failed', err);
      setError('Failed to estimate gas. Transaction may fail.');
    } finally {
      setLoading(false);
    }
  };

  const updateGasPrice = () => {
    if (!gasPrice || !gasEstimate) return;

    let selectedGasPrice = gasPrice.gasPrice;

    if (gasPrice.maxFeePerGas) {
      // EIP-1559 transaction
      switch (gasPriceOption) {
        case 'slow':
          selectedGasPrice = gasPrice.maxFeePerGas * BigInt(80) / BigInt(100); // 80% of max
          break;
        case 'standard':
          selectedGasPrice = gasPrice.maxFeePerGas;
          break;
        case 'fast':
          selectedGasPrice = gasPrice.maxFeePerGas * BigInt(120) / BigInt(100); // 120% of max
          break;
      }
    }

    updateEstimatedCost(gasEstimate, { ...gasPrice, gasPrice: selectedGasPrice });
  };

  const updateEstimatedCost = (estimate, feeData) => {
    if (!estimate || !feeData || !feeData.gasPrice) return;

    try {
      const gasPriceWei = BigInt(feeData.gasPrice.toString());
      const gasLimit = BigInt(estimate.toString());
      const totalCostWei = gasPriceWei * gasLimit;
      
      // Convert to ETH (assuming 18 decimals)
      const totalCostEth = Number(totalCostWei) / 1e18;
      
      setEstimatedCost({
        wei: totalCostWei.toString(),
        eth: totalCostEth.toFixed(6),
        usd: null, // Would need price oracle
      });
    } catch (err) {
      logger.error('Failed to calculate cost', err);
    }
  };

  const formatGas = (gas) => {
    if (!gas) return 'N/A';
    return gas.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  if (loading && !gasEstimate) {
    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 4,
        padding: 12,
        marginTop: 8,
      }}>
        <div style={{ color: '#6c757d' }}>⏳ Estimating gas...</div>
      </div>
    );
  }

  if (error && !gasEstimate) {
    return (
      <div style={{
        backgroundColor: '#f8d7da',
        border: '1px solid #f5c6cb',
        borderRadius: 4,
        padding: 12,
        marginTop: 8,
        color: '#721c24',
      }}>
        ⚠️ {error}
      </div>
    );
  }

  if (!gasEstimate) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: 4,
      padding: 12,
      marginTop: 8,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <strong style={{ color: '#2c3e50' }}>⛽ Gas Estimate</strong>
        <button
          onClick={estimateGasForTransaction}
          disabled={loading}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #ccc',
            padding: '2px 8px',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
          }}
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      <div style={{ fontSize: '14px', color: '#495057' }}>
        <div style={{ marginBottom: 4 }}>
          <strong>Gas Limit:</strong> {formatGas(gasEstimate)} gas
        </div>

        {gasPrice && (
          <>
            <div style={{ marginBottom: 4 }}>
              <strong>Gas Price:</strong>{' '}
              {gasPrice.maxFeePerGas
                ? `${(Number(gasPrice.maxFeePerGas) / 1e9).toFixed(2)} Gwei (EIP-1559)`
                : `${(Number(gasPrice.gasPrice) / 1e9).toFixed(2)} Gwei`}
            </div>

            {showSelector && gasPrice.maxFeePerGas && (
              <div style={{ marginBottom: 8 }}>
                <label style={{ marginRight: 8, fontSize: '12px' }}>Speed:</label>
                <select
                  value={gasPriceOption}
                  onChange={(e) => setGasPriceOption(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    fontSize: '12px',
                  }}
                >
                  <option value="slow">🐢 Slow</option>
                  <option value="standard">⚡ Standard</option>
                  <option value="fast">🚀 Fast</option>
                </select>
              </div>
            )}
          </>
        )}

        {estimatedCost && (
          <div style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: 'white',
            borderRadius: 4,
            border: '1px solid #dee2e6',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Estimated Cost:</div>
            <div style={{ fontSize: '16px', color: '#28a745' }}>
              {estimatedCost.eth} ETH
            </div>
            {estimatedCost.usd && (
              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                ≈ ${estimatedCost.usd} USD
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

