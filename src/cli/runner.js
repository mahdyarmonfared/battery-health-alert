/**
 * BatteryHealth-Alert - CLI Command Runner & Argument Parser
 * Pure Node.js zero-dependency CLI execution logic.
 */

const ansi = require('./ansi');
const { getBatteryStatus, setSimulationState } = require('../core/battery');
const { BatteryGuardian } = require('../core/guardian');
const { sendNotification, playTerminalBell } = require('../core/notifier');

function parseArgs(args) {
  const options = {
    command: null,
    max: 80,
    min: 20,
    critical: 10,
    interval: 5,
    port: 3026,
    simulate: false,
    json: false,
    target: null
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--max') {
      options.max = parseInt(args[++i], 10);
    } else if (arg === '--min') {
      options.min = parseInt(args[++i], 10);
    } else if (arg === '--critical') {
      options.critical = parseInt(args[++i], 10);
    } else if (arg === '--interval' || arg === '-i') {
      options.interval = parseInt(args[++i], 10);
    } else if (arg === '--port' || arg === '-p') {
      options.port = parseInt(args[++i], 10);
    } else if (arg === '--simulate' || arg === '-s') {
      options.simulate = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('-')) {
      // Ignored unknown flags
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    const first = positional[0].toLowerCase();
    if (['status', 'watch', 'simulate', 'ui', 'help', 'version'].includes(first)) {
      options.command = first;
      options.target = positional[1];
    } else {
      options.target = positional[0];
    }
  }

  return options;
}

function printHelp() {
  console.log(ansi.banner());
  console.log(`
${ansi.bold('Usage:')} ${ansi.cyan('battery-alert')} [command] [options]

${ansi.bold('Commands:')}
  ${ansi.cyan('status')} [opts]           Show current battery telemetry & 80/20 assessment (default)
  ${ansi.cyan('watch')} [opts]            Monitor battery in background with native alerts & audio
  ${ansi.cyan('simulate')} <percent>     Simulate a battery charge percentage to test alerts
  ${ansi.cyan('ui')}                      Launch interactive Web Studio dashboard (Port 3026)
  ${ansi.cyan('version')}                 Show BatteryHealth-Alert version
  ${ansi.cyan('help')}                    Display this help message

${ansi.bold('Options:')}
  ${ansi.yellow('--max <n>')}               High charge threshold alert (default: 80%)
  ${ansi.yellow('--min <n>')}               Low charge threshold alert (default: 20%)
  ${ansi.yellow('--critical <n>')}          Critical low battery alert (default: 10%)
  ${ansi.yellow('-i, --interval <sec>')}    Polling frequency in seconds for watch (default: 5)
  ${ansi.yellow('-s, --simulate')}          Force simulation mode (useful on desktop workstations)
  ${ansi.yellow('--json')}                  Output raw machine-readable JSON telemetry
  ${ansi.yellow('-p, --port <n>')}          Port for Web Studio dashboard (default: 3026)

${ansi.bold('Examples:')}
  $ ${ansi.dim('battery-alert')}                         # Print current battery status
  $ ${ansi.dim('battery-alert watch --max 85 --min 25')} # Continuous monitor with custom rules
  $ ${ansi.dim('battery-alert simulate 82')}             # Test 82% overcharge warning
  $ ${ansi.dim('battery-alert ui --port 3026')}          # Open Web Studio dashboard
`);
}

function printStatus(status, assessment) {
  console.log(`\n${ansi.bold(ansi.cyan('─── Battery Telemetry & 80/20 Assessment ───'))}`);
  console.log(`  Charge Level    : ${ansi.batteryMeter(status.percent, status.isCharging)}`);
  console.log(`  Power State     : ${status.isCharging ? ansi.green('Charging (AC Connected)') : (status.isAcConnected ? ansi.cyan('Fully Charged (AC)') : ansi.yellow('Discharging (On Battery)'))}`);
  
  if (status.timeRemainingMin) {
    console.log(`  Est. Runtime    : ${status.timeRemainingMin} minutes remaining`);
  }
  if (status.healthPercent) {
    console.log(`  Battery Health  : ${status.healthPercent}% of factory design capacity`);
  }
  if (status.isSimulated) {
    console.log(`  Telemetry Mode  : ${ansi.yellow('Simulation Mode (No physical battery detected)')}`);
  }

  console.log(`\n${ansi.bold('Longevity Assessment:')}`);
  const badgeType = assessment.level === 'error' ? 'error' : (assessment.level === 'warning' ? 'warning' : 'success');
  console.log(`  ${ansi.badge(assessment.type, badgeType)} ${assessment.message}`);
  console.log(`  ${ansi.dim('Recommendation :')} ${assessment.recommendation}\n`);
}

async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.command === 'help' || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  if (options.command === 'version' || argv.includes('--version') || argv.includes('-v')) {
    const pkg = require('../../package.json');
    console.log(`BatteryHealth-Alert v${pkg.version}`);
    return;
  }

  if (options.command === 'ui') {
    const { startServer } = require('../server/server');
    startServer({ port: options.port });
    return;
  }

  const guardian = new BatteryGuardian({
    maxThreshold: options.max,
    minThreshold: options.min,
    criticalThreshold: options.critical
  });

  if (options.command === 'simulate') {
    const targetPercent = parseInt(options.target || '82', 10);
    const simStatus = setSimulationState({
      percent: targetPercent,
      isCharging: targetPercent >= 50,
      isAcConnected: targetPercent >= 50
    });
    const status = getBatteryStatus({ forceSimulation: true });
    const assessment = guardian.evaluate(status);

    if (options.json) {
      console.log(JSON.stringify({ status, assessment }, null, 2));
      return;
    }

    printStatus(status, assessment);
    if (assessment.alertTriggered) {
      console.log(ansi.bold(ansi.yellow('🔔 Triggering desktop alert notification...')));
      await sendNotification('Battery Longevity Alert', assessment.message);
      playTerminalBell();
    }
    return;
  }

  if (options.command === 'watch') {
    console.log(ansi.banner());
    console.log(`${ansi.bold('Starting BatteryHealth Watcher')} (Polling every ${options.interval}s)`);
    console.log(`Thresholds: Max ${options.max}% | Min ${options.min}% | Critical ${options.critical}%\n`);
    console.log(ansi.dim('Press Ctrl+C to terminate monitor.\n'));

    const poll = async () => {
      const status = getBatteryStatus({ forceSimulation: options.simulate });
      const assessment = guardian.evaluate(status);
      const timeStr = new Date().toLocaleTimeString();

      const line = `[${ansi.dim(timeStr)}] ${ansi.batteryMeter(status.percent, status.isCharging)} | ${status.isCharging ? ansi.green('Charging') : ansi.yellow('Discharging')} | ${assessment.status}`;
      console.log(line);

      if (assessment.alertTriggered) {
        console.log(`\n${ansi.badge('ALERT TRIGGERED', 'error')} ${ansi.bold(assessment.message)}\n`);
        playTerminalBell();
        await sendNotification('Battery Alert', assessment.message);
      }
    };

    await poll();
    setInterval(poll, options.interval * 1000);
    return;
  }

  // Default: status
  const status = getBatteryStatus({ forceSimulation: options.simulate });
  const assessment = guardian.evaluate(status);

  if (options.json) {
    console.log(JSON.stringify({ status, assessment }, null, 2));
    return;
  }

  printStatus(status, assessment);
}

module.exports = {
  parseArgs,
  runCli,
  printHelp,
  printStatus
};
