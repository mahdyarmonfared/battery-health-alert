/**
 * BatteryHealth-Alert - 80/20 Battery Longevity Guardian Engine
 * Evaluates lithium-ion charge levels against the 80/20 health rule
 * and produces debounced, actionable health recommendations.
 */

class BatteryGuardian {
  constructor(options = {}) {
    this.maxThreshold = options.maxThreshold || 80;
    this.minThreshold = options.minThreshold || 20;
    this.criticalThreshold = options.criticalThreshold || 10;

    // Track previous alert type to prevent repetitive notifications
    this.lastTriggeredType = null;
  }

  setThresholds({ max, min, critical }) {
    if (typeof max === 'number') this.maxThreshold = max;
    if (typeof min === 'number') this.minThreshold = min;
    if (typeof critical === 'number') this.criticalThreshold = critical;
  }

  evaluate(batteryStatus) {
    const { percent, isCharging, isAcConnected } = batteryStatus;

    let status = 'ok';
    let type = 'NORMAL';
    let level = 'info';
    let message = `Battery is operating within optimal longevity range (${percent}%).`;
    let recommendation = 'No action required.';
    let alertTriggered = false;

    // 1. Critical Low (< criticalThreshold)
    if (percent <= this.criticalThreshold && !isCharging) {
      status = 'critical';
      type = 'CRITICAL_LOW';
      level = 'error';
      message = `CRITICAL: Battery dropped to ${percent}%! Plug in charger immediately.`;
      recommendation = 'Connect AC power immediately to prevent sudden OS shutdown.';
    }
    // 2. Deep Discharge Warning (<= minThreshold)
    else if (percent <= this.minThreshold && !isCharging) {
      status = 'plug_recommended';
      type = 'DEEP_DISCHARGE_RISK';
      level = 'warning';
      message = `Battery at ${percent}%! Connect charger to avoid deep discharge strain.`;
      recommendation = 'Plug in your charger to stay above the 20% degradation threshold.';
    }
    // 3. Overcharge / High Charge Warning (>= maxThreshold while charging)
    else if (percent >= this.maxThreshold && (isCharging || isAcConnected)) {
      status = 'unplug_recommended';
      type = 'OVERCHARGE_RISK';
      level = 'warning';
      message = `Target reached: ${percent}%! Unplug charger to preserve battery longevity.`;
      recommendation = 'Unplug your charger to prevent electrolyte degradation and high-voltage stress.';
    }

    // Determine if an alert should trigger (state changed from previous check)
    if (type !== 'NORMAL' && type !== this.lastTriggeredType) {
      alertTriggered = true;
      this.lastTriggeredType = type;
    } else if (type === 'NORMAL') {
      this.lastTriggeredType = null;
    }

    return {
      status,
      type,
      level,
      message,
      recommendation,
      alertTriggered,
      thresholds: {
        max: this.maxThreshold,
        min: this.minThreshold,
        critical: this.criticalThreshold
      },
      evaluatedAt: new Date().toISOString()
    };
  }
}

// Global singleton instance for CLI and server
const defaultGuardian = new BatteryGuardian();

module.exports = {
  BatteryGuardian,
  defaultGuardian
};
