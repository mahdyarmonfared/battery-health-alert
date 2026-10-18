const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sendNotification, playTerminalBell } = require('../src/core/notifier');

describe('BatteryHealth-Alert - Notifier Module', () => {
  it('should safely execute sendNotification without throwing', async () => {
    const res = await sendNotification('Test Title', 'Test Message Content');
    assert.equal(res, true);
  });

  it('should execute playTerminalBell without throwing', () => {
    assert.doesNotThrow(() => {
      playTerminalBell();
    });
  });
});
