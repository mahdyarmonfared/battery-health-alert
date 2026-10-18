/**
 * BatteryHealth-Alert - Web Studio Client Application
 * Real-time battery telemetry, 80/20 guardian visualizer & Web Audio synthesizer.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const batteryLiquid = document.getElementById('batteryLiquid');
  const batteryPercent = document.getElementById('batteryPercent');
  const batteryIconBolt = document.getElementById('batteryIconBolt');
  const batteryStateBadge = document.getElementById('batteryStateBadge');

  const statPowerSource = document.getElementById('statPowerSource');
  const statRuntime = document.getElementById('statRuntime');
  const statHealth = document.getElementById('statHealth');
  const statPlatform = document.getElementById('statPlatform');

  const assessmentBanner = document.getElementById('assessmentBanner');
  const assessmentIcon = document.getElementById('assessmentIcon');
  const assessmentTitle = document.getElementById('assessmentTitle');
  const assessmentMsg = document.getElementById('assessmentMsg');
  const assessmentRec = document.getElementById('assessmentRec');

  const maxThresholdInput = document.getElementById('maxThresholdInput');
  const maxThresholdVal = document.getElementById('maxThresholdVal');
  const minThresholdInput = document.getElementById('minThresholdInput');
  const minThresholdVal = document.getElementById('minThresholdVal');

  const testAlertBtn = document.getElementById('testAlertBtn');
  const testBeepBtn = document.getElementById('testBeepBtn');
  const audioToggleBtn = document.getElementById('audioToggleBtn');

  const simModeToggle = document.getElementById('simModeToggle');
  const simControlsContainer = document.getElementById('simControlsContainer');
  const simSlider = document.getElementById('simSlider');
  const simSliderVal = document.getElementById('simSliderVal');
  const simChargingCheckbox = document.getElementById('simChargingCheckbox');
  const simPresetBtns = document.querySelectorAll('.btn-sim');

  const toast = document.getElementById('toast');

  let audioEnabled = true;
  let isSimulationActive = false;
  let previousAlertType = null;

  // Web Audio Context for zero-dependency synthesized audio alarms
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
  }

  function playWebAudioAlarm(frequency = 880, type = 'sine', duration = 0.3) {
    if (!audioEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      // Double beep effect
      osc.frequency.setValueAtTime(frequency * 1.25, audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
      console.warn('Web Audio alarm playback warning:', err);
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  audioToggleBtn.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    audioToggleBtn.textContent = audioEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    showToast(audioEnabled ? 'Audio alarms enabled' : 'Audio alarms muted');
  });

  testBeepBtn.addEventListener('click', () => {
    initAudio();
    playWebAudioAlarm(880, 'triangle', 0.4);
    showToast('Synthetic alarm tone played!');
  });

  testAlertBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'BatteryHealth-Alert Notification',
          message: 'This is a test notification from your 80/20 battery health guardian.'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('System desktop alert dispatched!');
      }
    } catch {
      showToast('Alert dispatched!');
    }
  });

  // Threshold adjustments
  async function updateThresholds() {
    const max = parseInt(maxThresholdInput.value, 10);
    const min = parseInt(minThresholdInput.value, 10);
    maxThresholdVal.textContent = `${max}%`;
    minThresholdVal.textContent = `${min}%`;

    try {
      await fetch('/api/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max, min })
      });
      fetchBatteryData();
    } catch (err) {
      console.error('Failed to update thresholds:', err);
    }
  }

  maxThresholdInput.addEventListener('input', updateThresholds);
  minThresholdInput.addEventListener('input', updateThresholds);

  // Simulation Controls
  simModeToggle.addEventListener('change', () => {
    isSimulationActive = simModeToggle.checked;
    if (isSimulationActive) {
      simControlsContainer.classList.remove('disabled');
      triggerSimulationUpdate();
    } else {
      simControlsContainer.classList.add('disabled');
      fetchBatteryData();
    }
  });

  async function triggerSimulationUpdate() {
    const percent = parseInt(simSlider.value, 10);
    const isCharging = simChargingCheckbox.checked;
    simSliderVal.textContent = `${percent}%`;

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent, isCharging, isAcConnected: isCharging })
      });
      const data = await res.json();
      if (data.success) {
        renderBatteryState(data.status, data.assessment);
      }
    } catch (err) {
      console.error('Simulation update error:', err);
    }
  }

  simSlider.addEventListener('input', triggerSimulationUpdate);
  simChargingCheckbox.addEventListener('change', triggerSimulationUpdate);

  simPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      simSlider.value = btn.getAttribute('data-sim-percent');
      simChargingCheckbox.checked = btn.getAttribute('data-sim-charging') === 'true';
      triggerSimulationUpdate();
    });
  });

  // Battery Telemetry Polling
  async function fetchBatteryData() {
    try {
      const url = `/api/battery${isSimulationActive ? '?simulate=true' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        renderBatteryState(data.status, data.assessment);
      }
    } catch (err) {
      console.error('Battery fetch error:', err);
    }
  }

  function renderBatteryState(status, assessment) {
    const percent = Math.max(0, Math.min(100, status.percent));
    batteryPercent.textContent = `${percent}%`;
    batteryLiquid.style.height = `${percent}%`;

    // Dynamic gradient color depending on percentage
    if (percent <= 15) {
      batteryLiquid.style.background = 'linear-gradient(180deg, #ef4444, #b91c1c)';
      batteryLiquid.style.boxShadow = '0 0 25px rgba(239, 68, 68, 0.6)';
    } else if (percent <= 25) {
      batteryLiquid.style.background = 'linear-gradient(180deg, #f59e0b, #d97706)';
      batteryLiquid.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.5)';
    } else if (percent >= 80) {
      batteryLiquid.style.background = 'linear-gradient(180deg, #06b6d4, #0284c7)';
      batteryLiquid.style.boxShadow = '0 0 25px rgba(6, 182, 212, 0.6)';
    } else {
      batteryLiquid.style.background = 'linear-gradient(180deg, #10b981, #059669)';
      batteryLiquid.style.boxShadow = '0 0 25px rgba(16, 185, 129, 0.5)';
    }

    // Charging icon & state badge
    if (status.isCharging) {
      batteryIconBolt.classList.add('charging');
      batteryStateBadge.textContent = 'CHARGING (AC)';
      batteryStateBadge.style.color = '#f59e0b';
      statPowerSource.textContent = 'AC Adapter (Charging)';
      statPowerSource.className = 'telemetry-val highlight-yellow';
    } else if (status.isAcConnected) {
      batteryIconBolt.classList.remove('charging');
      batteryStateBadge.textContent = 'PLUGGED IN (FULL)';
      batteryStateBadge.style.color = '#06b6d4';
      statPowerSource.textContent = 'AC Power (Fully Charged)';
      statPowerSource.className = 'telemetry-val highlight-cyan';
    } else {
      batteryIconBolt.classList.remove('charging');
      batteryStateBadge.textContent = 'ON BATTERY';
      batteryStateBadge.style.color = '#94a3b8';
      statPowerSource.textContent = 'Battery (Discharging)';
      statPowerSource.className = 'telemetry-val';
    }

    // Runtime
    if (status.timeRemainingMin) {
      statRuntime.textContent = `${status.timeRemainingMin} mins`;
    } else {
      statRuntime.textContent = status.isCharging ? 'Calculating...' : 'AC Connected';
    }

    // Health
    if (status.healthPercent) {
      statHealth.textContent = `${status.healthPercent}%`;
    } else {
      statHealth.textContent = 'Healthy (Good)';
    }

    // Platform
    statPlatform.textContent = status.isSimulated 
      ? `Simulated (${status.os})` 
      : `Native (${status.os})`;

    // Assessment Banner
    assessmentTitle.textContent = assessment.type.replace(/_/g, ' ');
    assessmentMsg.textContent = assessment.message;
    assessmentRec.textContent = `💡 Recommendation: ${assessment.recommendation}`;

    assessmentBanner.className = 'assessment-banner';
    if (assessment.level === 'error') {
      assessmentBanner.classList.add('banner-critical');
      assessmentIcon.textContent = '🚨';
    } else if (assessment.level === 'warning') {
      assessmentBanner.classList.add('banner-warning');
      assessmentIcon.textContent = '⚡';
    } else {
      assessmentBanner.classList.add('banner-info');
      assessmentIcon.textContent = '🛡️';
    }

    // Audio alarm trigger
    if (assessment.alertTriggered && assessment.type !== previousAlertType) {
      previousAlertType = assessment.type;
      if (assessment.level === 'error') {
        playWebAudioAlarm(660, 'sawtooth', 0.5);
      } else {
        playWebAudioAlarm(880, 'triangle', 0.35);
      }
    } else if (!assessment.alertTriggered) {
      previousAlertType = null;
    }
  }

  // Initial fetch and regular polling interval
  fetchBatteryData();
  setInterval(() => {
    if (!isSimulationActive) {
      fetchBatteryData();
    }
  }, 2500);
});
