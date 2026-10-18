const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { BatteryGuardian } = require('../src/core/guardian');

describe('BatteryHealth-Alert - 80/20 Guardian Engine', () => {
  it('should evaluate 50% discharging as normal operating health', () => {
    const guardian = new BatteryGuardian();
    const result = guardian.evaluate({ percent: 50, isCharging: false, isAcConnected: false });

    assert.equal(result.status, 'ok');
    assert.equal(result.type, 'NORMAL');
    assert.equal(result.level, 'info');
    assert.equal(result.alertTriggered, false);
  });

  it('should trigger OVERCHARGE_RISK when percent >= 80% while charging', () => {
    const guardian = new BatteryGuardian({ maxThreshold: 80 });
    const result = guardian.evaluate({ percent: 82, isCharging: true, isAcConnected: true });

    assert.equal(result.status, 'unplug_recommended');
    assert.equal(result.type, 'OVERCHARGE_RISK');
    assert.equal(result.level, 'warning');
    assert.equal(result.alertTriggered, true);
    assert.match(result.recommendation, /Unplug your charger/i);
  });

  it('should trigger DEEP_DISCHARGE_RISK when percent <= 20% on battery', () => {
    const guardian = new BatteryGuardian({ minThreshold: 20 });
    const result = guardian.evaluate({ percent: 18, isCharging: false, isAcConnected: false });

    assert.equal(result.status, 'plug_recommended');
    assert.equal(result.type, 'DEEP_DISCHARGE_RISK');
    assert.equal(result.level, 'warning');
    assert.equal(result.alertTriggered, true);
    assert.match(result.recommendation, /Plug in your charger/i);
  });

  it('should trigger CRITICAL_LOW when percent <= 10% on battery', () => {
    const guardian = new BatteryGuardian({ criticalThreshold: 10 });
    const result = guardian.evaluate({ percent: 8, isCharging: false, isAcConnected: false });

    assert.equal(result.status, 'critical');
    assert.equal(result.type, 'CRITICAL_LOW');
    assert.equal(result.level, 'error');
    assert.equal(result.alertTriggered, true);
  });

  it('should debounce alerts and avoid spamming on consecutive checks', () => {
    const guardian = new BatteryGuardian({ maxThreshold: 80 });
    const r1 = guardian.evaluate({ percent: 85, isCharging: true, isAcConnected: true });
    assert.equal(r1.alertTriggered, true);

    const r2 = guardian.evaluate({ percent: 86, isCharging: true, isAcConnected: true });
    assert.equal(r2.alertTriggered, false, 'Second check of same alert type should not re-trigger');
  });

  it('should allow dynamic threshold reconfiguration', () => {
    const guardian = new BatteryGuardian();
    guardian.setThresholds({ max: 85, min: 25, critical: 15 });

    assert.equal(guardian.maxThreshold, 85);
    assert.equal(guardian.minThreshold, 25);
    assert.equal(guardian.criticalThreshold, 15);

    // 82% charging should be OK with max=85
    const r = guardian.evaluate({ percent: 82, isCharging: true, isAcConnected: true });
    assert.equal(r.status, 'ok');
  });
});
