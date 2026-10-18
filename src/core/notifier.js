/**
 * BatteryHealth-Alert - Zero-Dependency System Notifier
 * Cross-platform desktop notifications & terminal audio alerts
 * without any external npm packages.
 */

const { exec } = require('child_process');
const os = require('os');

/**
 * Sends a native system notification.
 */
function sendNotification(title, message) {
  return new Promise((resolve) => {
    const platform = os.platform();
    const cleanTitle = (title || 'Battery Alert').replace(/["`$]/g, '');
    const cleanMsg = (message || '').replace(/["`$]/g, '');

    if (platform === 'win32') {
      // Windows PowerShell Notification
      const psScript = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
        $textNodes = $template.GetElementsByTagName('text');
        $textNodes.Item(0).AppendChild($template.CreateTextNode('${cleanTitle}')) > $null;
        $textNodes.Item(1).AppendChild($template.CreateTextNode('${cleanMsg}')) > $null;
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template);
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('BatteryHealth-Alert').Show($toast);
      `.replace(/\r?\n\s+/g, ' ');

      exec(`powershell -NoProfile -Command "${psScript}"`, { timeout: 4000 }, (err) => {
        if (err) {
          // Fallback: PowerShell MsgBox or terminal sound
          playTerminalBell();
        }
        resolve(true);
      });
    } else if (platform === 'darwin') {
      // macOS AppleScript Notification
      const script = `display notification "${cleanMsg}" with title "${cleanTitle}" sound name "Ping"`;
      exec(`osascript -e '${script}'`, { timeout: 3000 }, () => resolve(true));
    } else if (platform === 'linux') {
      // Linux notify-send
      exec(`notify-send "${cleanTitle}" "${cleanMsg}" --urgency=critical`, { timeout: 3000 }, () => {
        playTerminalBell();
        resolve(true);
      });
    } else {
      playTerminalBell();
      resolve(true);
    }
  });
}

/**
 * Plays ASCII terminal alert bell.
 */
function playTerminalBell() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x07');
  }
}

module.exports = {
  sendNotification,
  playTerminalBell
};
