const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getBatteryStatus,
  setSimulationState,
  stepSimulation
} = require('../src/core/battery');

describe('BatteryHealth-Alert - Telemetry Engine', () => {
  it('should return valid telemetry structure', () => {
    const status = getBatteryStatus();
    assert.equal(typeof status, 'object');
    assert.equal(typeof status.percent, 'number');
    assert.ok(status.percent >= 0 && status.percent <= 100);
    assert.equal(typeof status.isCharging, 'boolean');
    assert.equal(typeof status.isAcConnected, 'boolean');
    assert.ok(['charging', 'discharging', 'full', 'unknown'].includes(status.state));
    assert.equal(typeof status.os, 'string');
    assert.ok(status.timestamp);
  });

  it('should support forced simulation mode', () => {
    setSimulationState({ percent: 77, isCharging: true });
    const sim = getBatteryStatus({ forceSimulation: true });

    assert.equal(sim.isSimulated, true);
    assert.equal(sim.percent, 77);
    assert.equal(sim.isCharging, true);
    assert.equal(sim.state, 'charging');
  });

  it('should update simulation state dynamically', () => {
    setSimulationState({ percent: 35, isCharging: false });
    const updated = getBatteryStatus({ forceSimulation: true });

    assert.equal(updated.percent, 35);
    assert.equal(updated.isCharging, false);
    assert.equal(updated.state, 'discharging');
  });

  it('should step simulation forward and wrap boundaries', () => {
    setSimulationState({ percent: 99, isCharging: true });
    stepSimulation(2); // Should cap at 100 and stop charging
    const at100 = getBatteryStatus({ forceSimulation: true });
    assert.equal(at100.percent, 100);
    assert.equal(at100.isCharging, false);

    setSimulationState({ percent: 1, isCharging: false });
    stepSimulation(-2); // Should floor at 0 and switch to charging
    const at0 = getBatteryStatus({ forceSimulation: true });
    assert.equal(at0.percent, 0);
    assert.equal(at0.isCharging, true);
  });
});
