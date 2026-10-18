/**
 * BatteryHealth-Alert - Core Aggregator
 */

const {
  getBatteryStatus,
  setSimulationState,
  stepSimulation,
  simulatedState
} = require('./battery');

const {
  BatteryGuardian,
  defaultGuardian
} = require('./guardian');

const {
  sendNotification,
  playTerminalBell
} = require('./notifier');

module.exports = {
  getBatteryStatus,
  setSimulationState,
  stepSimulation,
  simulatedState,
  BatteryGuardian,
  defaultGuardian,
  sendNotification,
  playTerminalBell
};
