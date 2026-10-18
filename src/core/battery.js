/**
 * BatteryHealth-Alert - Core Battery Telemetry Module
 * Zero-dependency cross-platform battery status reader (Windows, Linux, macOS)
 * with robust simulation fallback for desktops and CI testing environments.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// In-memory simulation state (for desktops/VMs/tests)
let simulatedState = {
  percent: 78,
  isCharging: true,
  isAcConnected: true,
  state: 'charging',
  timeRemainingMin: 45,
  healthPercent: 94
};

/**
 * Configure simulation state manually (for testing or desktop preview).
 */
function setSimulationState(newState = {}) {
  const merged = {
    ...simulatedState,
    ...newState
  };
  if (newState.isCharging !== undefined && !newState.state) {
    merged.state = merged.isCharging ? (merged.percent === 100 ? 'full' : 'charging') : 'discharging';
    merged.isAcConnected = merged.isCharging;
  }
  simulatedState = merged;
  return simulatedState;
}

/**
 * Step simulation forward (useful for demo animations or testing alarms).
 */
function stepSimulation(deltaPercent = 1) {
  let nextPercent = simulatedState.percent + deltaPercent;
  let nextCharging = simulatedState.isCharging;

  if (nextPercent >= 100) {
    nextPercent = 100;
    nextCharging = false;
  } else if (nextPercent <= 0) {
    nextPercent = 0;
    nextCharging = true;
  }

  simulatedState.percent = nextPercent;
  simulatedState.isCharging = nextCharging;
  simulatedState.isAcConnected = nextCharging;
  simulatedState.state = nextCharging ? (nextPercent === 100 ? 'full' : 'charging') : 'discharging';
  simulatedState.timeRemainingMin = nextCharging ? Math.round((100 - nextPercent) * 1.5) : Math.round(nextPercent * 2.2);

  return simulatedState;
}

/**
 * Reads battery telemetry on Windows via PowerShell CIM query.
 */
function readWindowsBattery() {
  const psCmd = `
    $b = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1 EstimatedChargeRemaining, BatteryStatus, EstimatedRunTime, DesignCapacity, FullChargeCapacity;
    $ac = (Get-CimInstance -Namespace root\\WMI -ClassName BatteryStatus -ErrorAction SilentlyContinue).PowerOnline;
    if ($b) {
      [PSCustomObject]@{
        HasBattery = $true
        Percent = $b.EstimatedChargeRemaining
        BatteryStatus = $b.BatteryStatus
        RunTime = $b.EstimatedRunTime
        DesignCap = $b.DesignCapacity
        FullCap = $b.FullChargeCapacity
        PowerOnline = if ($ac -ne $null) { [bool]$ac } else { ($b.BatteryStatus -eq 2 -or $b.BatteryStatus -eq 6 -or $b.BatteryStatus -eq 7) }
      } | ConvertTo-Json -Compress
    } else {
      '{"HasBattery":false}'
    }
  `.replace(/\r?\n\s+/g, ' ');

  try {
    const raw = execSync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, {
      encoding: 'utf8',
      timeout: 4000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();

    const data = JSON.parse(raw);
    if (!data || !data.HasBattery) return null;

    const percent = Math.max(0, Math.min(100, data.Percent || 0));
    const isAcConnected = Boolean(data.PowerOnline);
    // Win32_Battery BatteryStatus: 2=AC/Charging, 3=Fully Charged, 6,7,8,9=Charging
    const isCharging = [2, 6, 7, 8, 9].includes(data.BatteryStatus) || (isAcConnected && percent < 100);
    const state = percent === 100 && isAcConnected ? 'full' : (isCharging ? 'charging' : 'discharging');

    // RunTime is in minutes (71582788 indicates AC connected or calculating)
    let timeRemainingMin = null;
    if (data.RunTime && data.RunTime < 20000 && !isCharging) {
      timeRemainingMin = data.RunTime;
    }

    let healthPercent = null;
    if (data.DesignCap && data.FullCap && data.DesignCap > 0) {
      healthPercent = Math.min(100, Math.round((data.FullCap / data.DesignCap) * 100));
    }

    return {
      hasBattery: true,
      isSimulated: false,
      percent,
      isCharging,
      isAcConnected,
      state,
      timeRemainingMin,
      healthPercent,
      os: 'win32',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return null;
  }
}

/**
 * Reads battery telemetry on Linux via /sys/class/power_supply.
 */
function readLinuxBattery() {
  const basePath = '/sys/class/power_supply';
  if (!fs.existsSync(basePath)) return null;

  try {
    const devices = fs.readdirSync(basePath);
    const batDevice = devices.find(d => d.startsWith('BAT'));
    if (!batDevice) return null;

    const devDir = path.join(basePath, batDevice);
    const readVal = (file) => {
      const f = path.join(devDir, file);
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : null;
    };

    const capacityStr = readVal('capacity');
    if (!capacityStr) return null;

    const percent = parseInt(capacityStr, 10);
    const status = (readVal('status') || '').toLowerCase(); // 'charging', 'discharging', 'full'
    const isCharging = status === 'charging';
    const isAcConnected = isCharging || status === 'full';

    let healthPercent = null;
    const energyFull = parseFloat(readVal('energy_full') || readVal('charge_full'));
    const energyFullDesign = parseFloat(readVal('energy_full_design') || readVal('charge_full_design'));
    if (energyFull && energyFullDesign && energyFullDesign > 0) {
      healthPercent = Math.min(100, Math.round((energyFull / energyFullDesign) * 100));
    }

    return {
      hasBattery: true,
      isSimulated: false,
      percent,
      isCharging,
      isAcConnected,
      state: status === 'full' ? 'full' : (isCharging ? 'charging' : 'discharging'),
      timeRemainingMin: null,
      healthPercent,
      os: 'linux',
      timestamp: new Date().toISOString()
    };
  } catch {
    return null;
  }
}

/**
 * Reads battery telemetry on macOS via pmset.
 */
function readMacBattery() {
  try {
    const raw = execSync('pmset -g batt', {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const match = /InternalBattery-\d+\s+(\d+)%;\s+([a-zA-Z\s]+);/i.exec(raw);
    if (!match) return null;

    const percent = parseInt(match[1], 10);
    const statusStr = match[2].toLowerCase();
    const isCharging = statusStr.includes('charging') && !statusStr.includes('discharging');
    const isAcConnected = raw.includes("Now drawing from 'AC Power'");
    const state = percent === 100 && isAcConnected ? 'full' : (isCharging ? 'charging' : 'discharging');

    return {
      hasBattery: true,
      isSimulated: false,
      percent,
      isCharging,
      isAcConnected,
      state,
      timeRemainingMin: null,
      healthPercent: null,
      os: 'darwin',
      timestamp: new Date().toISOString()
    };
  } catch {
    return null;
  }
}

/**
 * Gets real battery status or falls back to simulation mode.
 * 
 * @param {Object} [options]
 * @param {boolean} [options.forceSimulation=false]
 * @returns {Object} Battery telemetry
 */
function getBatteryStatus(options = {}) {
  if (options.forceSimulation) {
    return {
      hasBattery: true,
      isSimulated: true,
      ...simulatedState,
      os: os.platform(),
      timestamp: new Date().toISOString()
    };
  }

  const platform = os.platform();
  let realTelemetry = null;

  if (platform === 'win32') {
    realTelemetry = readWindowsBattery();
  } else if (platform === 'linux') {
    realTelemetry = readLinuxBattery();
  } else if (platform === 'darwin') {
    realTelemetry = readMacBattery();
  }

  if (realTelemetry) {
    return realTelemetry;
  }

  // Fallback to simulation mode if system lacks battery (e.g. desktop workstation)
  return {
    hasBattery: false,
    isSimulated: true,
    ...simulatedState,
    os: platform,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  getBatteryStatus,
  setSimulationState,
  stepSimulation,
  simulatedState
};
