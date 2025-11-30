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
  // Suppress source map warnings from node_modules
  // Find and modify source-map-loader rule
  const rules = config.module.rules;
  const sourceMapLoaderRule = rules.find(
    rule => rule.enforce === 'pre' && 
    rule.use && 
    rule.use.some && 
    rule.use.some(loader => loader.loader && loader.loader.includes('source-map-loader'))
  );

  if (sourceMapLoaderRule && sourceMapLoaderRule.use) {
    const sourceMapLoader = sourceMapLoaderRule.use.find(
      loader => loader.loader && loader.loader.includes('source-map-loader')
    );
    
    if (sourceMapLoader) {
      // Configure source-map-loader to ignore errors and warnings from node_modules
      sourceMapLoader.options = {
        ...sourceMapLoader.options,
        filterSourceMappingUrl: (source, sourceMap) => {
          // Allow source maps from our own code
          if (!source.includes('node_modules')) {
            return true;
          }
          // Suppress warnings for node_modules
          return false;
        },
      };
    }
  }

  // Alternative: Modify the rule to exclude node_modules entirely
  if (sourceMapLoaderRule) {
    sourceMapLoaderRule.exclude = /node_modules/;
  }

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

