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
global.window.decoded_secret_private = {};
global.window.DPRSecretSession = {
  getGithubToken() {
    return 'ghp_demo';
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
  init,
  updateConfig,
  loadGithubToken,
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

async function testWriteRepoFileEncodesUtf8TextAndHonorsPath() {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === 'https://api.github.com/user') {
      return createJsonResponse(200, { login: 'dusker' }, { 'X-OAuth-Scopes': 'repo,gist' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { permissions: { push: true } });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/request.json') {
      return createJsonResponse(200, { content: { sha: 'sha-request' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  await global.window.SubscriptionsGithubToken.writeRepoFile({
    path: 'requests/seed_papers/demo/request.json',
    contentText: '{"title":"论文"}',
    commitMessage: 'test write request',
  });

  const putCall = calls.find((entry) => entry.options && entry.options.method === 'PUT');
  assert.ok(putCall, 'should issue PUT request');
  const body = JSON.parse(putCall.options.body);
  assert.equal(body.message, 'test write request');
  assert.equal(Buffer.from(body.content, 'base64').toString('utf8'), '{"title":"论文"}');
}

async function testWriteRepoFileUsesSecretSessionGithubToken() {
  const calls = [];
  global.window.decoded_secret_private = {};
  global.window.DPR_RUNTIME_GITHUB_TOKEN = '';
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'ghp_secret_session';
    },
  };
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === 'https://api.github.com/user') {
      assert.equal(options.headers.Authorization, 'token ghp_secret_session');
      return createJsonResponse(200, { login: 'dusker' }, { 'X-OAuth-Scopes': 'repo,gist' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { permissions: { push: true }, default_branch: 'main' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/request.json') {
      return createJsonResponse(200, { content: { sha: 'sha-request' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  await global.window.SubscriptionsGithubToken.writeRepoFile({
    path: 'requests/seed_papers/demo/request.json',
    contentText: '{"title":"session"}',
    commitMessage: 'test secret session token',
  });

  const putCall = calls.find((entry) => entry.options && entry.options.method === 'PUT');
  assert.ok(putCall, 'should issue PUT request');
  assert.equal(putCall.options.headers.Authorization, 'token ghp_secret_session');
}

async function testWriteRepoFileReturnsResolvedRefMetadata() {
  global.fetch = async (url, options = {}) => {
    if (url === 'https://api.github.com/user') {
      return createJsonResponse(200, { login: 'dusker' }, { 'X-OAuth-Scopes': 'repo,gist' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { permissions: { push: true }, default_branch: 'feature-seed' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/request.json') {
      return createJsonResponse(200, { content: { sha: 'sha-request' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await global.window.SubscriptionsGithubToken.writeRepoFile({
    path: 'requests/seed_papers/demo/request.json',
    contentText: '{"title":"论文"}',
    commitMessage: 'test metadata',
  });

  assert.equal(result.owner, 'dusker');
  assert.equal(result.repo, 'daily-paper-reader');
  assert.equal(result.branch, 'feature-seed');
  assert.equal(result.ref, 'feature-seed');
  assert.equal(result.path, 'requests/seed_papers/demo/request.json');
}

async function testVerifyRepoFilesVisibleChecksAllPathsOnSameRef() {
  const seenUrls = [];
  global.fetch = async (url, options = {}) => {
    seenUrls.push({ url, options });
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/paper.pdf?ref=feature-seed') {
      return createJsonResponse(200, { path: 'requests/seed_papers/demo/paper.pdf', sha: 'sha-pdf' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(200, { path: 'requests/seed_papers/demo/request.json', sha: 'sha-request' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.verifyRepoFilesVisible({
    owner: 'dusker',
    repo: 'daily-paper-reader',
    token: 'ghp_demo',
    ref: 'feature-seed',
    paths: [
      'requests/seed_papers/demo/paper.pdf',
      'requests/seed_papers/demo/request.json',
    ],
  });

  assert.equal(result.ref, 'feature-seed');
  assert.equal(result.allVisible, true);
  assert.deepEqual(result.files, [
    {
      path: 'requests/seed_papers/demo/paper.pdf',
      exists: true,
      ref: 'feature-seed',
    },
    {
      path: 'requests/seed_papers/demo/request.json',
      exists: true,
      ref: 'feature-seed',
    },
  ]);
}

async function testVerifyRepoFilesVisibleReportsMissingFile() {
  global.fetch = async (url) => {
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/paper.pdf?ref=feature-seed') {
      return createJsonResponse(200, { path: 'requests/seed_papers/demo/paper.pdf', sha: 'sha-pdf' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(404, { message: 'Not Found' }, { statusText: 'Not Found' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.verifyRepoFilesVisible({
    owner: 'dusker',
    repo: 'daily-paper-reader',
    token: 'ghp_demo',
    ref: 'feature-seed',
    paths: [
      'requests/seed_papers/demo/paper.pdf',
      'requests/seed_papers/demo/request.json',
    ],
  });

  assert.equal(result.allVisible, false);
  assert.deepEqual(result.files, [
    {
      path: 'requests/seed_papers/demo/paper.pdf',
      exists: true,
      ref: 'feature-seed',
    },
    {
      path: 'requests/seed_papers/demo/request.json',
      exists: false,
      ref: 'feature-seed',
    },
  ]);
}

async function testReadRepoFileUsesExplicitRepoDefaultBranchWhenRefMissing() {
  global.fetch = async (url) => {
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { default_branch: 'feature-seed' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(200, { path: 'requests/seed_papers/demo/request.json', sha: 'sha-request' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.readRepoFile({
    owner: 'dusker',
    repo: 'daily-paper-reader',
    token: 'ghp_demo',
    path: 'requests/seed_papers/demo/request.json',
  });

  assert.equal(result.ref, 'feature-seed');
  assert.equal(result.path, 'requests/seed_papers/demo/request.json');
}

async function testVerifyRepoFilesVisibleUsesResolvedDefaultBranchWhenRefMissing() {
  global.fetch = async (url) => {
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { default_branch: 'feature-seed' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/paper.pdf?ref=feature-seed') {
      return createJsonResponse(200, { path: 'requests/seed_papers/demo/paper.pdf', sha: 'sha-pdf' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(200, { path: 'requests/seed_papers/demo/request.json', sha: 'sha-request' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.verifyRepoFilesVisible({
    owner: 'dusker',
    repo: 'daily-paper-reader',
    token: 'ghp_demo',
    paths: [
      'requests/seed_papers/demo/paper.pdf',
      'requests/seed_papers/demo/request.json',
    ],
  });

  assert.equal(result.ref, 'feature-seed');
  assert.deepEqual(result.files, [
    {
      path: 'requests/seed_papers/demo/paper.pdf',
      exists: true,
      ref: 'feature-seed',
    },
    {
      path: 'requests/seed_papers/demo/request.json',
      exists: true,
      ref: 'feature-seed',
    },
  ]);
}

async function testVerifyRepoFilesVisibleFallsBackToTokenResolvedRepo() {
  global.fetch = async (url) => {
    if (url === 'https://api.github.com/user') {
      return createJsonResponse(200, { login: 'dusker' }, { 'X-OAuth-Scopes': 'repo,gist' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { permissions: { push: true }, default_branch: 'feature-seed' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/paper.pdf?ref=feature-seed') {
      return createJsonResponse(200, { path: 'requests/seed_papers/demo/paper.pdf', sha: 'sha-pdf' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/requests/seed_papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(200, { path: 'requests/seed_papers/demo/request.json', sha: 'sha-request' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.verifyRepoFilesVisible({
    token: 'ghp_demo',
    paths: [
      'requests/seed_papers/demo/paper.pdf',
      'requests/seed_papers/demo/request.json',
    ],
  });

  assert.equal(result.ref, 'feature-seed');
  assert.equal(result.allVisible, true);
}

function testResolveRepoInfoFromPageAcceptsTrustedGithubPagesAndLocalhost() {
  assert.deepEqual(
    __test.resolveRepoInfoFromPage('dusker', 'https://dusker.github.io/daily-paper-reader/#/'),
    { owner: 'dusker', repo: 'daily-paper-reader' },
  );
  assert.deepEqual(
    __test.resolveRepoInfoFromPage('dusker', 'http://localhost:3000/'),
    { owner: 'dusker', repo: 'daily-paper-reader' },
  );
}

function testResolveRepoInfoFromPageRejectsUntrustedHost() {
  assert.throws(
    () => __test.resolveRepoInfoFromPage('dusker', 'https://mirror.example.com/daily-paper-reader/'),
    /受信任的 GitHub Pages 或 localhost/u,
  );
}

function testNormalizeGithubRefRejectsInvalidValue() {
  assert.equal(__test.normalizeGithubRef('feature-seed'), 'feature-seed');
  assert.throws(
    () => __test.normalizeGithubRef('../bad'),
    /非法的 GitHub ref/u,
  );
}

function testBuildSeedPaperRequestPathNormalizesSegments() {
  const result = __test.buildSeedPaperRequestPath({
    requestId: '  Demo Run  ',
    fileName: 'My Seed Paper.PDF',
  });

  assert.equal(result.requestId, 'demo-run');
  assert.equal(result.dirPath, 'requests/seed_papers/demo-run');
  assert.equal(result.requestPath, 'requests/seed_papers/demo-run/request.json');
  assert.equal(result.filePath, 'requests/seed_papers/demo-run/my-seed-paper.pdf');
}

function testLoadGithubTokenDropsPersistedPatAndKeepsMetadata() {
  const calls = [];
  global.window.localStorage = {
    getItem(key) {
      calls.push(['get', key]);
      return JSON.stringify({
        token: 'ghp_should_not_persist',
        verified: true,
        login: 'dusker',
        repo: 'dusker/daily-paper-reader',
        scopes: ['repo', 'workflow', 'gist'],
        savedAt: '2026-04-15T00:00:00.000Z',
      });
    },
    setItem(key, value) {
      calls.push(['set', key, JSON.parse(value)]);
    },
    removeItem(key) {
      calls.push(['remove', key]);
    },
  };
  global.localStorage = global.window.localStorage;

  const data = loadGithubToken();

  assert.equal(data.token, undefined);
  assert.equal(data.verified, true);
  assert.equal(data.login, 'dusker');
  const setCall = calls.find((entry) => entry[0] === 'set');
  assert.ok(setCall, 'should rewrite legacy localStorage payload');
  assert.equal('token' in setCall[2], false);
}

function testInitRequiresLiveSessionTokenForSuccessButton() {
  global.window.localStorage = {
    getItem() {
      return JSON.stringify({
        verified: true,
        login: 'dusker',
        repo: 'dusker/daily-paper-reader',
        scopes: ['repo', 'workflow', 'gist'],
        savedAt: '2026-04-15T00:00:00.000Z',
      });
    },
    setItem() {},
    removeItem() {},
  };
  global.localStorage = global.window.localStorage;
  global.window.DPRSecretSession = {
    getGithubToken() {
      return '';
    },
  };

  const githubAuthBtn = {
    textContent: '',
    style: {},
    addEventListener() {},
  };

  init({
    githubAuthBtn,
    githubTokenSection: { style: { display: 'none' } },
    githubTokenInput: { value: '', type: 'password' },
    githubTokenToggleBtn: null,
    githubTokenVerifyBtn: null,
    githubTokenClearBtn: null,
    githubTokenMessage: null,
    githubTokenInfo: null,
    githubUserName: null,
    githubRepoName: null,
  });

  assert.equal(githubAuthBtn.textContent, '需重新验证');
  assert.equal(githubAuthBtn.style.background, '#fd7e14');
  assert.equal(githubAuthBtn.style.color, 'white');
}

function testInitShowsSuccessButtonWhenSessionTokenExists() {
  global.window.localStorage = {
    getItem() {
      return JSON.stringify({
        verified: true,
        login: 'dusker',
        repo: 'dusker/daily-paper-reader',
        scopes: ['repo', 'workflow', 'gist'],
        savedAt: '2026-04-15T00:00:00.000Z',
      });
    },
    setItem() {},
    removeItem() {},
  };
  global.localStorage = global.window.localStorage;
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'ghp_live_session';
    },
  };

  const githubAuthBtn = {
    textContent: '',
    style: {},
    addEventListener() {},
  };

  init({
    githubAuthBtn,
    githubTokenSection: { style: { display: 'none' } },
    githubTokenInput: { value: '', type: 'password' },
    githubTokenToggleBtn: null,
    githubTokenVerifyBtn: null,
    githubTokenClearBtn: null,
    githubTokenMessage: null,
    githubTokenInfo: null,
    githubUserName: null,
    githubRepoName: null,
  });

  assert.equal(githubAuthBtn.textContent, '登录成功');
  assert.equal(githubAuthBtn.style.background, '#28a745');
  assert.equal(githubAuthBtn.style.color, 'white');
}

(async () => {
  await testUpdateConfigReloadsAndRetriesOnShaConflict();
  testIsShaConflictResponseRecognizesGitHub409();
  await testWriteRepoFileEncodesUtf8TextAndHonorsPath();
  await testWriteRepoFileUsesSecretSessionGithubToken();
  await testWriteRepoFileReturnsResolvedRefMetadata();
  await testVerifyRepoFilesVisibleChecksAllPathsOnSameRef();
  await testVerifyRepoFilesVisibleReportsMissingFile();
  await testReadRepoFileUsesExplicitRepoDefaultBranchWhenRefMissing();
  await testVerifyRepoFilesVisibleUsesResolvedDefaultBranchWhenRefMissing();
  await testVerifyRepoFilesVisibleFallsBackToTokenResolvedRepo();
  testResolveRepoInfoFromPageAcceptsTrustedGithubPagesAndLocalhost();
  testResolveRepoInfoFromPageRejectsUntrustedHost();
  testNormalizeGithubRefRejectsInvalidValue();
  testBuildSeedPaperRequestPathNormalizesSegments();
  testLoadGithubTokenDropsPersistedPatAndKeepsMetadata();
  testInitRequiresLiveSessionTokenForSuccessButton();
  testInitShowsSuccessButtonWhenSessionTokenExists();
  console.log('subscriptions github token tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
