/**
 * Webpack Configuration Override
 * Suppresses source map warnings from node_modules
 */

module.exports = function override(config, env) {
  // Find and modify source-map-loader to ignore node_modules
  const rules = config.module.rules;
  
  // Find the source-map-loader rule (usually in the 'pre' enforce phase)
  const oneOfRule = rules.find(rule => rule.oneOf);
  
  if (oneOfRule && oneOfRule.oneOf) {
    oneOfRule.oneOf.forEach(rule => {
      if (rule.enforce === 'pre' && rule.use) {
        const useArray = Array.isArray(rule.use) ? rule.use : [rule.use];
        const sourceMapLoaderIndex = useArray.findIndex(loader => {
          if (typeof loader === 'string') {
            return loader.includes('source-map-loader');
          }
          if (typeof loader === 'object' && loader.loader) {
            return loader.loader.includes('source-map-loader');
          }
          return false;
        });

        if (sourceMapLoaderIndex !== -1) {
          // Exclude node_modules from source-map-loader
          rule.exclude = /node_modules/;
          
          // Also configure the loader to ignore errors silently
          const sourceMapLoader = useArray[sourceMapLoaderIndex];
          if (typeof sourceMapLoader === 'object') {
            sourceMapLoader.options = {
              ...sourceMapLoader.options,
              filterSourceMappingUrl: () => false,
            };
          }
        }
      }
    });
  }

  // Also check direct rules
  rules.forEach(rule => {
    if (rule.enforce === 'pre' && rule.use) {
      const useArray = Array.isArray(rule.use) ? rule.use : [rule.use];
      const sourceMapLoaderIndex = useArray.findIndex(loader => {
        if (typeof loader === 'string') {
          return loader.includes('source-map-loader');
        }
        if (typeof loader === 'object' && loader.loader) {
          return loader.loader.includes('source-map-loader');
        }
        return false;
      });

      if (sourceMapLoaderIndex !== -1) {
        // Exclude node_modules
        rule.exclude = /node_modules/;
        
        // Configure loader to ignore errors
        const sourceMapLoader = useArray[sourceMapLoaderIndex];
        if (typeof sourceMapLoader === 'object') {
          sourceMapLoader.options = {
            ...sourceMapLoader.options,
            filterSourceMappingUrl: () => false,
          };
        }
      }
    }
  });

  // Remove source-map-loader warnings by filtering them out
  // This is a more aggressive approach - configure webpack to ignore these warnings
  if (!config.ignoreWarnings) {
    config.ignoreWarnings = [];
  }
  
  // Add regex to ignore source map warnings from node_modules
  config.ignoreWarnings.push(
    /Failed to parse source map/,
    /ENOENT.*node_modules/,
    /source-map-loader/
  );
  
  // Also configure webpack stats to filter warnings
  if (!config.stats) {
    config.stats = {};
  }
  
  // Filter out source map warnings in stats
  if (config.stats.warningsFilter) {
    if (Array.isArray(config.stats.warningsFilter)) {
      config.stats.warningsFilter.push(
        /Failed to parse source map/,
        /ENOENT.*node_modules/
      );
    } else {
      config.stats.warningsFilter = [
        config.stats.warningsFilter,
        /Failed to parse source map/,
        /ENOENT.*node_modules/
      ];
    }
  } else {
    config.stats.warningsFilter = [
      /Failed to parse source map/,
      /ENOENT.*node_modules/
    ];
  }

  return config;
};

