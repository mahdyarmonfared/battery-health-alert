const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const { createServer, isPathSafe } = require('../src/server/server');

describe('BatteryHealth-Alert - Web Studio Server', () => {
  let server;
  let serverPort;

  before(async () => {
    server = createServer();
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    serverPort = server.address().port;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('isPathSafe', () => {
    const base = path.resolve('src/ui');

    it('should allow paths inside base directory', () => {
      assert.equal(isPathSafe(base, path.join(base, 'index.html')), true);
      assert.equal(isPathSafe(base, path.join(base, 'style.css')), true);
    });

    it('should block paths outside base directory', () => {
      assert.equal(isPathSafe(base, path.resolve(base, '../server/server.js')), false);
      assert.equal(isPathSafe(base, path.resolve(base, '../../package.json')), false);
    });
  });

  function makeRequest(pathname, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: serverPort,
        path: pathname,
        method: options.method || 'GET',
        headers: options.headers || {}
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        });
      });

      req.on('error', reject);
      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  describe('REST Endpoints', () => {
    it('OPTIONS /api/battery should handle CORS preflight', async () => {
      const res = await makeRequest('/api/battery', { method: 'OPTIONS' });
      assert.equal(res.statusCode, 204);
      assert.equal(res.headers['access-control-allow-origin'], '*');
    });

    it('GET /api/battery should return current telemetry and assessment', async () => {
      const res = await makeRequest('/api/battery');
      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
      assert.ok(data.status);
      assert.ok(data.assessment);
      assert.equal(typeof data.status.percent, 'number');
    });

    it('GET /api/battery?simulate=true should return simulated status', async () => {
      const res = await makeRequest('/api/battery?simulate=true');
      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
      assert.equal(data.status.isSimulated, true);
    });

    it('POST /api/thresholds should update alert limits', async () => {
      const res = await makeRequest('/api/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { max: 85, min: 25, critical: 12 }
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
      assert.equal(data.thresholds.max, 85);
      assert.equal(data.thresholds.min, 25);
    });

    it('POST /api/simulate should update simulated battery state', async () => {
      const res = await makeRequest('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { percent: 14, isCharging: false }
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
      assert.equal(data.status.percent, 14);
      assert.equal(data.status.isCharging, false);
      assert.equal(data.assessment.status, 'plug_recommended');
    });

    it('POST /api/test-alert should dispatch test notification', async () => {
      const res = await makeRequest('/api/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { title: 'Battery Test', message: 'Hello from test suite' }
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
    });
  });

  describe('Static Asset Serving', () => {
    it('GET / should serve index.html', async () => {
      const res = await makeRequest('/');
      assert.equal(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/html/);
      assert.ok(res.body.includes('BatteryHealth-Alert'));
    });

    it('GET /style.css should serve CSS', async () => {
      const res = await makeRequest('/style.css');
      assert.equal(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/css/);
    });

    it('GET /app.js should serve JavaScript', async () => {
      const res = await makeRequest('/app.js');
      assert.equal(res.statusCode, 200);
      assert.match(res.headers['content-type'], /application\/javascript/);
    });

    it('GET /not-found-xyz.html should return 404', async () => {
      const res = await makeRequest('/not-found-xyz.html');
      assert.equal(res.statusCode, 404);
    });

    it('Path traversal attempt should return 403 Forbidden', async () => {
      const res = await makeRequest('/../../package.json');
      assert.equal(res.statusCode, 403);
    });
  });
});
