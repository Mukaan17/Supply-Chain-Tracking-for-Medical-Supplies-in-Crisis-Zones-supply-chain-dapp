/**
 * Gas Estimate Component
 * 
 * Displays gas estimation and allows gas price selection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTransaction } from '../hooks/useTransaction';
import logger from '../services/logging';
import config from '../config';

export default function GasEstimate({ 
  contract, 
  methodName, 
  args = [],
  onGasEstimate,
  showSelector = true,
}) {
  const { estimateGas, getGasPrice } = useTransaction();
  const [rawGasEstimate, setRawGasEstimate] = useState(null); // Raw estimate from contract
  const [gasEstimate, setGasEstimate] = useState(null); // Buffered estimate (for display)
  const [gasPrice, setGasPrice] = useState(null);
  const [gasPriceOption, setGasPriceOption] = useState('standard'); // 'slow', 'standard', 'fast'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [estimatedCost, setEstimatedCost] = useState(null);
  
  // Get gas buffer from config (default 1.2 = 20% buffer)
  const gasBuffer = config.transaction?.gasEstimationBuffer ?? 1.2;

  const updateEstimatedCost = useCallback((estimate, feeData) => {
    if (!estimate || !feeData || !feeData.gasPrice) return;

    try {
      const gasPriceWei = BigInt(feeData.gasPrice.toString());
      const gasLimit = BigInt(estimate.toString());
      const totalCostWei = gasPriceWei * gasLimit;
      
      // Convert to ETH (assuming 18 decimals) - use BigInt division to avoid precision loss
      const ETH_DIVISOR = BigInt(1e18);
      const ethWhole = totalCostWei / ETH_DIVISOR;
      const ethRemainder = totalCostWei % ETH_DIVISOR;
      // Calculate decimal part with precision
      const ethDecimal = Number(ethRemainder) / Number(ETH_DIVISOR);
      const totalCostEth = Number(ethWhole) + ethDecimal;
      
      setEstimatedCost({
        wei: totalCostWei.toString(),
        eth: totalCostEth.toFixed(6),
        usd: null, // Would need price oracle
      });
    } catch (err) {
      logger.error('Failed to calculate cost', err);
    }
  }, []);
  
  // Apply gas buffer to raw estimate
  const applyGasBuffer = useCallback((rawEstimate) => {
    if (!rawEstimate) return null;
    const rawBigInt = BigInt(rawEstimate.toString());
    // Apply buffer: multiply by buffer (e.g., 1.2 = 20% increase)
    // Use integer math: multiply by buffer * 100, then divide by 100
    const bufferMultiplier = Math.round(gasBuffer * 100);
    const buffered = (rawBigInt * BigInt(bufferMultiplier)) / BigInt(100);
    return buffered;
  }, [gasBuffer]);

  const updateGasPrice = useCallback(() => {
    if (!gasPrice || !gasEstimate) return;

    let selectedGasPrice = gasPrice.gasPrice;

    if (gasPrice.maxFeePerGas) {
      // EIP-1559 transaction
      // For EIP-1559, actual cost is min(maxFeePerGas, baseFee + maxPriorityFeePerGas)
      // We use maxFeePerGas as upper bound for estimation
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
        default:
          selectedGasPrice = gasPrice.maxFeePerGas;
          break;
      }
    }

    updateEstimatedCost(gasEstimate, { ...gasPrice, gasPrice: selectedGasPrice });
  }, [gasPrice, gasEstimate, gasPriceOption, updateEstimatedCost]);

  const estimateGasForTransaction = useCallback(async () => {
    if (!contract || !methodName) return;

    setLoading(true);
    setError(null);

    try {
      const rawEstimate = await estimateGas(contract, methodName, ...args);
      setRawGasEstimate(rawEstimate);
      
      // Apply buffer to get safe estimate
      const bufferedEstimate = applyGasBuffer(rawEstimate);
      setGasEstimate(bufferedEstimate);

      // Get current gas price
      if (contract.provider) {
        const feeData = await getGasPrice(contract.provider);
        setGasPrice(feeData);
        // Use buffered estimate for cost calculation
        updateEstimatedCost(bufferedEstimate, feeData);
      }

      if (onGasEstimate) {
        // Pass buffered estimate to callback (this is what should be used for transactions)
        onGasEstimate(bufferedEstimate);
      }

      logger.debug('Gas estimated', {
        method: methodName,
        rawEstimate: rawEstimate.toString(),
        bufferedEstimate: bufferedEstimate?.toString(),
        buffer: gasBuffer,
      });
    } catch (err) {
      logger.error('Gas estimation failed', err);
      setError('Failed to estimate gas. Transaction may fail.');
    } finally {
      setLoading(false);
    }
  }, [contract, methodName, args, onGasEstimate, updateEstimatedCost, estimateGas, getGasPrice, applyGasBuffer, gasBuffer]);

  // Estimate gas when component mounts or dependencies change
  useEffect(() => {
    if (contract && methodName) {
      estimateGasForTransaction();
    }
  }, [contract, methodName, estimateGasForTransaction, applyGasBuffer, gasBuffer]);

  // Update gas price when option changes
  useEffect(() => {
    if (gasPrice) {
      updateGasPrice();
    }
  }, [gasPriceOption, gasPrice, updateGasPrice]);


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
          <strong>Gas Limit (with {Math.round((gasBuffer - 1) * 100)}% buffer):</strong>{' '}
          <span style={{ fontFamily: 'monospace' }}>{formatGas(gasEstimate)} gas</span>
          {rawGasEstimate && rawGasEstimate.toString() !== gasEstimate.toString() && (
            <span style={{ fontSize: '12px', color: '#6c757d', marginLeft: 8 }}>
              (raw: {formatGas(rawGasEstimate)} gas)
            </span>
          )}
        </div>

        {gasPrice && (
          <>
            <div style={{ marginBottom: 4 }}>
              <strong>Gas Price:</strong>{' '}
              <span style={{ fontFamily: 'monospace' }}>
                {gasPrice.maxFeePerGas
                  ? `${(Number(gasPrice.maxFeePerGas) / 1e9).toFixed(2)} Gwei (EIP-1559)`
                  : `${(Number(gasPrice.gasPrice) / 1e9).toFixed(2)} Gwei`}
              </span>
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
            <div style={{ fontSize: '16px', color: '#28a745', fontFamily: 'monospace' }}>
              {estimatedCost.eth} ETH
            </div>
            {estimatedCost.usd && (
              <div style={{ fontSize: '12px', color: '#6c757d', fontFamily: 'monospace' }}>
                ≈ ${estimatedCost.usd} USD
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#6c757d', marginTop: 4, fontFamily: 'monospace' }}>
              ({formatGas(estimatedCost.wei)} wei)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

GasEstimate.propTypes = {
  contract: PropTypes.object,
  methodName: PropTypes.string,
  args: PropTypes.array,
  onGasEstimate: PropTypes.func,
  showSelector: PropTypes.bool,
  network: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
};

