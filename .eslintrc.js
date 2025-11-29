/**
 * @Author: Mukhil Sundararaj
 * @Date:   2025-11-25 17:38:24
 * @Last Modified by:   Mukhil Sundararaj
 * @Last Modified time: 2025-11-25 17:44:55
 */
module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
  ],
  rules: {
    // Security-focused rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-unsafe-innerHTML': 'warn',
    
    // Prevent console.log in production
    'no-console': process.env.NODE_ENV === 'production' ? ['error', { allow: ['warn', 'error'] }] : 'warn',
    
    // Code quality
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'prefer-const': 'warn',
    'no-var': 'error',
    
    // React specific
    'react/prop-types': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
  },
  overrides: [
    {
      files: ['*.test.js', '*.test.jsx'],
      env: {
        jest: true,
      },
    },
  ],
};

