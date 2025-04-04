// commitlint.config.js
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
      'header-min-length': [2, 'always', 10], // level: error, applicable: always, value: 10
    },
  };