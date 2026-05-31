const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

function createResponse({ status = 200, jsonBody, jsonError } = {}) {
  return {
    status,
    async json() {
      if (jsonError) throw jsonError;
      return jsonBody;
    }
  };
}

function createHarness({ token = null, fetchImpl } = {}) {
  const storage = new Map();
  const toasts = [];
  let renderLoginCount = 0;

  if (token) storage.set('ml_token', token);
  storage.set('ml_user', JSON.stringify({ role: 'ADMIN' }));

  const context = {
    console,
    fetch: fetchImpl,
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    document: {
      getElementById() {
        return {
          className: '',
          textContent: '',
          innerHTML: '',
          disabled: false
        };
      },
      querySelectorAll() {
        return [];
      }
    },
    window: {
      addEventListener() {}
    },
    bootstrap: {
      Toast: {
        getOrCreateInstance() {
          return { show() {} };
        }
      },
      Modal: {
        getOrCreateInstance() {
          return { show() {}, hide() {} };
        }
      }
    },
    Chart: function Chart() {
      return { destroy() {} };
    }
  };

  vm.createContext(context);
  vm.runInContext(appSource, context);

  context.toast = (message, type = 'success') => toasts.push({ message, type });
  context.renderLogin = () => {
    renderLoginCount += 1;
  };

  return {
    api: context.api,
    storage,
    toasts,
    get renderLoginCount() {
      return renderLoginCount;
    }
  };
}

test('api sends GET requests with JSON headers and bearer token', async () => {
  const calls = [];
  const harness = createHarness({
    token: 'abc123',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return createResponse({ jsonBody: { success: true, data: [{ id: 1 }] } });
    }
  });

  const result = await harness.api('/trips');

  assert.deepEqual(result, [{ id: 1 }]);
  assert.equal(calls[0].url, 'http://localhost:8080/metrolink-backend/api/trips');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer abc123');
  assert.equal('body' in calls[0].options, false);
});

test('api serializes POST bodies', async () => {
  const calls = [];
  const harness = createHarness({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return createResponse({ jsonBody: { success: true, data: { token: 'new-token' } } });
    }
  });

  const result = await harness.api('/auth/login', 'POST', { username: 'admin', password: 'admin123' });

  assert.deepEqual(result, { token: 'new-token' });
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.body, JSON.stringify({ username: 'admin', password: 'admin123' }));
});

test('api reports network failures', async () => {
  const networkError = new Error('connect ECONNREFUSED');
  const harness = createHarness({
    fetchImpl: async () => {
      throw networkError;
    }
  });

  await assert.rejects(() => harness.api('/auth/login', 'POST', { username: 'admin' }), networkError);
  assert.deepEqual(harness.toasts, [
    { message: 'Cannot reach server. Is Tomcat running?', type: 'danger' }
  ]);
});

test('api clears session and renders login on 401 responses', async () => {
  const harness = createHarness({
    token: 'expired-token',
    fetchImpl: async () => createResponse({
      status: 401,
      jsonBody: { success: false, message: 'Unauthorized' }
    })
  });

  await assert.rejects(() => harness.api('/trips'), /Unauthorized/);

  assert.equal(harness.storage.has('ml_token'), false);
  assert.equal(harness.storage.has('ml_user'), false);
  assert.equal(harness.renderLoginCount, 1);
});

test('api displays backend JSON error messages', async () => {
  const harness = createHarness({
    fetchImpl: async () => createResponse({
      jsonBody: { success: false, message: 'Invalid credentials' }
    })
  });

  await assert.rejects(() => harness.api('/auth/login', 'POST', { username: 'admin' }), /Invalid credentials/);
  assert.deepEqual(harness.toasts, [
    { message: 'Invalid credentials', type: 'danger' }
  ]);
});

test('api falls back when backend JSON error has no message', async () => {
  const harness = createHarness({
    fetchImpl: async () => createResponse({
      jsonBody: { success: false }
    })
  });

  await assert.rejects(() => harness.api('/auth/login', 'POST', { username: 'admin' }));
  assert.deepEqual(harness.toasts, [
    { message: 'An error occurred', type: 'danger' }
  ]);
});

test('api displays readable server error for non-JSON 500 responses', async () => {
  const harness = createHarness({
    fetchImpl: async () => createResponse({
      status: 500,
      jsonError: new SyntaxError("Unexpected token '<'")
    })
  });

  await assert.rejects(() => harness.api('/auth/login', 'POST', { username: 'admin' }), /Server error 500/);
  assert.deepEqual(harness.toasts, [
    { message: 'Server error 500. Check backend/database configuration.', type: 'danger' }
  ]);
});
