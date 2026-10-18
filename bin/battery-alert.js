#!/usr/bin/env node

/**
 * BatteryHealth-Alert - Binary CLI Entrypoint
 */

const { runCli } = require('../src/cli/runner');

runCli().catch((err) => {
  console.error('\nFatal Error:', err.message || err);
  process.exit(1);
});
