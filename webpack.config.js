/**
 * @Author: Mukhil Sundararaj
 * @Date:   2025-11-25 17:38:28
 * @Last Modified by:   Mukhil Sundararaj
 * @Last Modified time: 2025-11-25 17:41:08
 */
/**
 * Custom Webpack Configuration
 * 
 * Extends Create React App's webpack config for optimization.
 */

const path = require('path');

module.exports = function override(config, env) {
  // Production optimizations
  if (env === 'production') {
    // Enable source maps for debugging (can be disabled for smaller bundles)
    config.devtool = 'source-map';

    // Optimize chunk splitting
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common chunk
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      },
    };
  }

  // Add alias for easier imports
  config.resolve.alias = {
    ...config.resolve.alias,
    '@': path.resolve(__dirname, 'src'),
    '@components': path.resolve(__dirname, 'src/components'),
    '@services': path.resolve(__dirname, 'src/services'),
    '@utils': path.resolve(__dirname, 'src/utils'),
    '@hooks': path.resolve(__dirname, 'src/hooks'),
    '@config': path.resolve(__dirname, 'src/config'),
  };

  return config;
};

