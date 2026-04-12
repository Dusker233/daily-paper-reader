const assert = require('node:assert/strict');

function createJsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: headers.statusText || '',
    headers: {
      get(name) {
        return headers[name] || headers[name.toLowerCase()] || null;
      },
    },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

global.window = global.window || {};
global.window.location = global.window.location || {
  hostname: 'localhost',
  href: 'http://localhost/',
};
global.window.localStorage = global.window.localStorage || {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};
global.localStorage = global.localStorage || global.window.localStorage;
global.window.jsyaml = {
  load(text) {
    return JSON.parse(text || '{}');
  },
  dump(value) {
    return JSON.stringify(value);
  },
};
global.window.jsYaml = global.window.jsyaml;
global.window.jsYAML = global.window.jsyaml;
global.window.decoded_secret_private = {
  github: {
    token: 'ghp_demo',
  },
};
global.atob = global.atob || ((value) => Buffer.from(value, 'base64').toString('binary'));
global.btoa = global.btoa || ((value) => Buffer.from(value, 'binary').toString('base64'));
global.unescape = global.unescape || ((value) => value);
global.escape = global.escape || ((value) => value);

global.fetch = async () => {
  throw new Error('fetch mock not installed');
};

require('../app/subscriptions.github-token.js');

const {
  updateConfig,
  __test,
} = global.window.SubscriptionsGithubToken;

async function testUpdateConfigReloadsAndRetriesOnShaConflict() {
  const putBodies = [];
  let loadCount = 0;

  global.fetch = async (url, options = {}) => {
    if (url === 'https://api.github.com/user') {
      return createJsonResponse(200, { login: 'dusker' }, { 'X-OAuth-Scopes': 'repo,gist' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { permissions: { push: true } });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/config.yaml' && (!options.method || options.method === 'GET')) {
      loadCount += 1;
      const current = loadCount === 1
        ? { subscriptions: { intent_profiles: [{ tag: 'GENE', description: 'base' }] } }
        : {
            top_level: { keep: true },
            subscriptions: {
              intent_profiles: [
                { tag: 'GENE', description: 'remote latest', keywords: [{ keyword: 'genetics', query: 'genetics', embedding_cache: { embedding_json: '[0.1,0.2,0.3]' } }] },
                { tag: 'NEW', description: 'remote only' },
              ],
            },
          };
      const content = Buffer.from(JSON.stringify(current), 'utf8').toString('base64');
      return createJsonResponse(200, { sha: `sha-${loadCount}`, content });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/config.yaml' && options.method === 'PUT') {
      const body = JSON.parse(options.body);
      putBodies.push(body);
      if (putBodies.length === 1) {
        return createJsonResponse(409, { message: 'sha does not match latest blob' }, { statusText: 'Conflict' });
      }
      return createJsonResponse(200, { content: { sha: 'sha-final' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await updateConfig((current) => {
    const next = current || {};
    if (!next.subscriptions) next.subscriptions = {};
    next.subscriptions.intent_profiles = [{ tag: 'GENE', description: 'local draft' }];
    return next;
  }, 'test save');

  assert.equal(putBodies.length, 2);
  assert.equal(putBodies[0].sha, 'sha-1');
  assert.equal(putBodies[1].sha, 'sha-2');
  const retriedConfig = JSON.parse(Buffer.from(putBodies[1].content, 'base64').toString('utf8'));
  assert.equal(retriedConfig.top_level.keep, true);
  assert.deepEqual(retriedConfig.subscriptions.intent_profiles, [{ tag: 'GENE', description: 'local draft' }]);
  assert.deepEqual(result, { content: { sha: 'sha-final' } });
}

function testIsShaConflictResponseRecognizesGitHub409() {
  assert.equal(__test.isShaConflictResponse(409, 'sha does not match latest blob'), true);
  assert.equal(__test.isShaConflictResponse(422, 'file is at 123 but expected 456'), true);
  assert.equal(__test.isShaConflictResponse(500, 'internal error'), false);
}

(async () => {
  await testUpdateConfigReloadsAndRetriesOnShaConflict();
  testIsShaConflictResponseRecognizesGitHub409();
  console.log('subscriptions github token tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
