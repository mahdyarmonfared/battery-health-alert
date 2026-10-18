/**
 * BatteryHealth-Alert - ANSI Colors & Battery Meters
 * Pure Node.js zero-dependency terminal styling.
 */

const isColorSupported = !process.env.NO_COLOR && (
  process.stdout.isTTY || process.env.TERM || process.env.COLORTERM
);

function colorize(start, end) {
  return function(text) {
    if (!isColorSupported || text === undefined || text === null) return String(text);
    return `\x1b[${start}m${text}\x1b[${end}m`;
  };
}

const ansi = {
  reset: colorize(0, 0),
  bold: colorize(1, 22),
  dim: colorize(2, 22),
  italic: colorize(3, 23),
  underline: colorize(4, 24),
  
  black: colorize(30, 39),
  red: colorize(31, 39),
  green: colorize(32, 39),
  yellow: colorize(33, 39),
  blue: colorize(34, 39),
  magenta: colorize(35, 39),
  cyan: colorize(36, 39),
  white: colorize(37, 39),
  gray: colorize(90, 39),

  bgRed: colorize(41, 49),
  bgGreen: colorize(42, 49),
  bgYellow: colorize(43, 49),
  bgBlue: colorize(44, 49),
  bgCyan: colorize(46, 49),

  badge(text, type = 'info') {
    switch (type) {
      case 'success': return `${ansi.bgGreen(ansi.black(` ${text} `))}`;
      case 'error': return `${ansi.bgRed(ansi.white(` ${text} `))}`;
      case 'warning': return `${ansi.bgYellow(ansi.black(` ${text} `))}`;
      case 'cyan': return `${ansi.bgCyan(ansi.black(` ${text} `))}`;
      default: return `${ansi.bgBlue(ansi.white(` ${text} `))}`;
    }
  },

  batteryMeter(percent, isCharging = false, length = 20) {
    const clamped = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clamped / 100) * length);
    const empty = length - filled;

    let colorFn = ansi.green;
    if (clamped <= 15) colorFn = ansi.red;
    else if (clamped <= 25) colorFn = ansi.yellow;
    else if (clamped >= 80) colorFn = ansi.cyan;

    const icon = isCharging ? ' ⚡' : ' 🔋';
    const bar = colorFn('█'.repeat(filled)) + ansi.gray('░'.repeat(empty));
    return `[${bar}] ${colorFn(`${clamped}%`)}${icon}`;
  },

  banner() {
    return `
${ansi.bold(ansi.cyan('  ____        _   _                   _   _            _ _   '))}
${ansi.bold(ansi.cyan(' | __ )  __ _| |_| |_ ___ _ __ _   _ | | | | ___  __ _| | |_| |__  '))}
${ansi.bold(ansi.cyan(' |  _ \\ / _` | __| __/ _ \\ \'__| | | || |_| |/ _ \\/ _` | | __| \'_ \\ '))}
${ansi.bold(ansi.cyan(' | |_) | (_| | |_| |_  __/ |  | |_| ||  _  |  __/ (_| | | |_| | | |'))}
${ansi.bold(ansi.cyan(' |____/ \\__,_|\\__|\\__\\___|_|   \\__, ||_| |_|\\___|\\__,_|_|\\__|_| |_|'))}
${ansi.bold(ansi.cyan('                               |___/                               '))}
${ansi.dim(ansi.gray('   Zero-Dependency Smart Battery Telemetry & 80/20 Longevity Guardian'))}
`;
  }
};

module.exports = ansi;
