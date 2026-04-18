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
    const raw = String(text || '').trim();
    if (!raw) return {};
    if (raw.startsWith('{')) {
      return JSON.parse(raw);
    }
    const repoMatch = raw.match(/repo:\s*([^\n]+)/);
    const ownerMatch = raw.match(/owner:\s*([^\n]+)/);
    return {
      github: {
        owner: ownerMatch ? ownerMatch[1].trim().replace(/^['"]|['"]$/g, '') : '',
        repo: repoMatch ? repoMatch[1].trim().replace(/^['"]|['"]$/g, '') : '',
      },
    };
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
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/request.json') {
      return createJsonResponse(200, { content: { sha: 'sha-request' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  await global.window.SubscriptionsGithubToken.writeRepoFile({
    path: 'archive/seed-papers/demo/request.json',
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
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/request.json') {
      return createJsonResponse(200, { content: { sha: 'sha-request' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  await global.window.SubscriptionsGithubToken.writeRepoFile({
    path: 'archive/seed-papers/demo/request.json',
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
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/request.json') {
      return createJsonResponse(200, { content: { sha: 'sha-request' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await global.window.SubscriptionsGithubToken.writeRepoFile({
    path: 'archive/seed-papers/demo/request.json',
    contentText: '{"title":"论文"}',
    commitMessage: 'test metadata',
  });

  assert.equal(result.owner, 'dusker');
  assert.equal(result.repo, 'daily-paper-reader');
  assert.equal(result.branch, 'feature-seed');
  assert.equal(result.ref, 'feature-seed');
  assert.equal(result.path, 'archive/seed-papers/demo/request.json');
}

async function testPrepareSeedPaperUploadTargetUsesDefaultBranchWithoutCreatingRequestBranch() {
  const seenUrls = [];
  global.fetch = async (url, options = {}) => {
    seenUrls.push({ url, options });
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { default_branch: 'main' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/git/ref/heads/main') {
      return createJsonResponse(200, { object: { sha: 'sha-main' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.prepareSeedPaperUploadTarget({
    owner: 'dusker',
    repo: 'daily-paper-reader',
    token: 'ghp_demo',
    requestId: 'Demo Request',
  });

  assert.equal(result.defaultBranch, 'main');
  assert.equal(result.branch, 'main');
  assert.equal(result.ref, 'main');
  assert.equal(result.requestId, 'demo-request');
  assert.equal(result.baseSha, 'sha-main');
  assert.equal(result.sourceSha, 'sha-main');
  assert.equal(result.created, false);
  assert.ok(seenUrls.some((entry) => entry.url.endsWith('/git/ref/heads/main')));
  assert.equal(seenUrls.some((entry) => entry.url.endsWith('/git/refs') && entry.options.method === 'POST'), false);
  assert.equal(seenUrls.some((entry) => entry.url.includes('/git/ref/heads/main/demo-request')), false);
}

async function testPrepareSeedPaperUploadTargetFallsBackToTokenResolvedRepo() {
  global.fetch = async (url, options = {}) => {
    if (url === 'https://api.github.com/user') {
      return createJsonResponse(200, { login: 'dusker' }, { 'X-OAuth-Scopes': 'repo,gist' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { permissions: { push: true }, default_branch: 'main' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/git/ref/heads/main') {
      return createJsonResponse(200, { object: { sha: 'sha-main' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.prepareSeedPaperUploadTarget({
    token: 'ghp_demo',
    requestId: 'demo-request',
  });

  assert.equal(result.owner, 'dusker');
  assert.equal(result.repo, 'daily-paper-reader');
  assert.equal(result.defaultBranch, 'main');
  assert.equal(result.branch, 'main');
  assert.equal(result.ref, 'main');
  assert.equal(result.created, false);
}

async function testVerifyRepoFilesVisibleRejectsShaMismatch() {
  global.fetch = async (url) => {
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/paper.pdf?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/paper.pdf', sha: 'sha-stale-pdf' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/request.json', sha: 'sha-request' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.verifyRepoFilesVisible({
    owner: 'dusker',
    repo: 'daily-paper-reader',
    token: 'ghp_demo',
    ref: 'feature-seed',
    paths: [
      'archive/seed-papers/demo/paper.pdf',
      'archive/seed-papers/demo/request.json',
    ],
    expectedFiles: [
      { path: 'archive/seed-papers/demo/paper.pdf', ref: 'feature-seed', fileSha: 'sha-pdf' },
      { path: 'archive/seed-papers/demo/request.json', ref: 'feature-seed', fileSha: 'sha-request' },
    ],
  });

  assert.equal(result.allVisible, false);
  assert.deepEqual(result.files, [
    {
      path: 'archive/seed-papers/demo/paper.pdf',
      exists: true,
      ref: 'feature-seed',
      fileSha: 'sha-stale-pdf',
      matchesExpectedRef: true,
      matchesExpectedSha: false,
    },
    {
      path: 'archive/seed-papers/demo/request.json',
      exists: true,
      ref: 'feature-seed',
      fileSha: 'sha-request',
      matchesExpectedRef: true,
      matchesExpectedSha: true,
    },
  ]);
}

async function testVerifyRepoFilesVisibleChecksAllPathsOnSameRef() {
  const seenUrls = [];
  global.fetch = async (url, options = {}) => {
    seenUrls.push({ url, options });
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/paper.pdf?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/paper.pdf', sha: 'sha-pdf' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/request.json', sha: 'sha-request' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.verifyRepoFilesVisible({
    owner: 'dusker',
    repo: 'daily-paper-reader',
    token: 'ghp_demo',
    ref: 'feature-seed',
    paths: [
      'archive/seed-papers/demo/paper.pdf',
      'archive/seed-papers/demo/request.json',
    ],
    expectedFiles: [
      { path: 'archive/seed-papers/demo/paper.pdf', ref: 'feature-seed', fileSha: 'sha-pdf' },
      { path: 'archive/seed-papers/demo/request.json', ref: 'feature-seed', fileSha: 'sha-request' },
    ],
  });

  assert.equal(result.ref, 'feature-seed');
  assert.equal(result.allVisible, true);
  assert.deepEqual(result.files, [
    {
      path: 'archive/seed-papers/demo/paper.pdf',
      exists: true,
      ref: 'feature-seed',
      fileSha: 'sha-pdf',
      matchesExpectedRef: true,
      matchesExpectedSha: true,
    },
    {
      path: 'archive/seed-papers/demo/request.json',
      exists: true,
      ref: 'feature-seed',
      fileSha: 'sha-request',
      matchesExpectedRef: true,
      matchesExpectedSha: true,
    },
  ]);
}

async function testVerifyRepoFilesVisibleReportsMissingFile() {
  global.fetch = async (url) => {
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/paper.pdf?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/paper.pdf', sha: 'sha-pdf' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/request.json?ref=feature-seed') {
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
      'archive/seed-papers/demo/paper.pdf',
      'archive/seed-papers/demo/request.json',
    ],
    expectedFiles: [
      { path: 'archive/seed-papers/demo/paper.pdf', ref: 'feature-seed', fileSha: 'sha-pdf' },
      { path: 'archive/seed-papers/demo/request.json', ref: 'feature-seed', fileSha: 'sha-request' },
    ],
  });

  assert.equal(result.allVisible, false);
  assert.deepEqual(result.files, [
    {
      path: 'archive/seed-papers/demo/paper.pdf',
      exists: true,
      ref: 'feature-seed',
      fileSha: 'sha-pdf',
      matchesExpectedRef: true,
      matchesExpectedSha: true,
    },
    {
      path: 'archive/seed-papers/demo/request.json',
      exists: false,
      ref: 'feature-seed',
      fileSha: '',
      matchesExpectedRef: true,
      matchesExpectedSha: false,
    },
  ]);
}

async function testReadRepoFileUsesExplicitRepoDefaultBranchWhenRefMissing() {
  global.fetch = async (url) => {
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { default_branch: 'feature-seed' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/request.json', sha: 'sha-request' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.readRepoFile({
    owner: 'dusker',
    repo: 'daily-paper-reader',
    token: 'ghp_demo',
    path: 'archive/seed-papers/demo/request.json',
  });

  assert.equal(result.ref, 'feature-seed');
  assert.equal(result.path, 'archive/seed-papers/demo/request.json');
}

async function testVerifyRepoFilesVisibleUsesResolvedDefaultBranchWhenRefMissing() {
  global.fetch = async (url) => {
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader') {
      return createJsonResponse(200, { default_branch: 'feature-seed' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/paper.pdf?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/paper.pdf', sha: 'sha-pdf' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/request.json', sha: 'sha-request' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.verifyRepoFilesVisible({
    owner: 'dusker',
    repo: 'daily-paper-reader',
    token: 'ghp_demo',
    paths: [
      'archive/seed-papers/demo/paper.pdf',
      'archive/seed-papers/demo/request.json',
    ],
  });

  assert.equal(result.ref, 'feature-seed');
  assert.deepEqual(result.files, [
    {
      path: 'archive/seed-papers/demo/paper.pdf',
      exists: true,
      ref: 'feature-seed',
      fileSha: 'sha-pdf',
      matchesExpectedRef: true,
      matchesExpectedSha: true,
    },
    {
      path: 'archive/seed-papers/demo/request.json',
      exists: true,
      ref: 'feature-seed',
      fileSha: 'sha-request',
      matchesExpectedRef: true,
      matchesExpectedSha: true,
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
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/paper.pdf?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/paper.pdf', sha: 'sha-pdf' });
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/contents/archive/seed-papers/demo/request.json?ref=feature-seed') {
      return createJsonResponse(200, { path: 'archive/seed-papers/demo/request.json', sha: 'sha-request' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.verifyRepoFilesVisible({
    token: 'ghp_demo',
    paths: [
      'archive/seed-papers/demo/paper.pdf',
      'archive/seed-papers/demo/request.json',
    ],
    expectedFiles: [
      { path: 'archive/seed-papers/demo/paper.pdf', ref: 'feature-seed', fileSha: 'sha-pdf' },
      { path: 'archive/seed-papers/demo/request.json', ref: 'feature-seed', fileSha: 'sha-request' },
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

async function testResolveRepoInfoFromTokenUsesCustomDomainConfig() {
  global.window.location.href = 'https://mirror.example.com/#/';
  global.fetch = async (url, options = {}) => {
    if (url === 'https://api.github.com/user') {
      return createJsonResponse(200, { login: 'dusker' }, { 'X-OAuth-Scopes': 'repo,gist' });
    }
    if (url === 'config.yaml') {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get() { return null; } },
        async json() {
          throw new Error('json not expected');
        },
        async text() {
          return 'github:\n  owner: org-mirror\n  repo: mirror-repo\n';
        },
      };
    }
    if (url === 'https://api.github.com/repos/org-mirror/mirror-repo/pages') {
      return createJsonResponse(200, { cname: 'mirror.example.com' });
    }
    if (url === 'https://api.github.com/repos/org-mirror/mirror-repo') {
      return createJsonResponse(200, { permissions: { push: true }, default_branch: 'main' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.resolveRepoInfoFromToken('ghp_demo', false);

  assert.equal(result.owner, 'org-mirror');
  assert.equal(result.repo, 'mirror-repo');
  assert.equal(result.defaultBranch, 'main');
}

async function testResolveRepoInfoFromTokenDiscoversCustomDomainRepoWhenConfigOwnerBlank() {
  const calls = [];
  global.window.location.href = 'https://mirror.example.com/#/';
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === 'https://api.github.com/user') {
      return createJsonResponse(200, { login: 'dusker' }, { 'X-OAuth-Scopes': 'repo,gist' });
    }
    if (url === 'config.yaml') {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get() { return null; } },
        async json() {
          throw new Error('json not expected');
        },
        async text() {
          return "github:\n  owner: ''\n  repo: daily-paper-reader\n";
        },
      };
    }
    if (url === 'https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member') {
      return createJsonResponse(200, [
        { name: 'daily-paper-reader', owner: { login: 'dusker' } },
        { name: 'daily-paper-reader', owner: { login: 'Dusker233' } },
      ]);
    }
    if (url === 'https://api.github.com/repos/dusker/daily-paper-reader/pages') {
      return createJsonResponse(200, { cname: 'other.example.com' });
    }
    if (url === 'https://api.github.com/repos/Dusker233/daily-paper-reader/pages') {
      return createJsonResponse(200, { cname: 'mirror.example.com' });
    }
    if (url === 'https://api.github.com/repos/Dusker233/daily-paper-reader') {
      return createJsonResponse(200, { permissions: { push: true }, default_branch: 'main' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await __test.resolveRepoInfoFromToken('ghp_demo', false);

  assert.equal(result.owner, 'Dusker233');
  assert.equal(result.repo, 'daily-paper-reader');
  assert.equal(result.defaultBranch, 'main');
  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member'), true);
  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/repos/Dusker233/daily-paper-reader'), true);
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
  assert.equal(result.dirPath, 'archive/seed-papers/demo-run');
  assert.equal(result.requestPath, 'archive/seed-papers/demo-run/request.json');
  assert.equal(result.filePath, 'archive/seed-papers/demo-run/my-seed-paper.pdf');
  assert.equal(result.rankedRelatedPath, 'archive/seed-papers/demo-run/ranked-related.json');
}

function testIsAllowedRepoWritePathRejectsLegacySeedRequestPaths() {
  assert.equal(__test.isAllowedRepoWritePath('archive/seed-papers/demo-run/request.json'), true);
  assert.equal(__test.isAllowedRepoWritePath('archive/seed-papers/demo-run/ranked-related.json'), true);
  assert.equal(__test.isAllowedRepoWritePath('requests/seed_papers/demo-run/request.json'), false);
  assert.equal(__test.isAllowedRepoWritePath('../archive/seed-papers/demo-run/request.json'), false);
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
  await testPrepareSeedPaperUploadTargetUsesDefaultBranchWithoutCreatingRequestBranch();
  await testPrepareSeedPaperUploadTargetFallsBackToTokenResolvedRepo();
  await testVerifyRepoFilesVisibleRejectsShaMismatch();
  await testVerifyRepoFilesVisibleChecksAllPathsOnSameRef();
  await testVerifyRepoFilesVisibleReportsMissingFile();
  await testReadRepoFileUsesExplicitRepoDefaultBranchWhenRefMissing();
  await testVerifyRepoFilesVisibleUsesResolvedDefaultBranchWhenRefMissing();
  await testVerifyRepoFilesVisibleFallsBackToTokenResolvedRepo();
  await testResolveRepoInfoFromTokenUsesCustomDomainConfig();
  await testResolveRepoInfoFromTokenDiscoversCustomDomainRepoWhenConfigOwnerBlank();
  testResolveRepoInfoFromPageAcceptsTrustedGithubPagesAndLocalhost();
  testResolveRepoInfoFromPageRejectsUntrustedHost();
  testNormalizeGithubRefRejectsInvalidValue();
  testBuildSeedPaperRequestPathNormalizesSegments();
  testIsAllowedRepoWritePathRejectsLegacySeedRequestPaths();
  testLoadGithubTokenDropsPersistedPatAndKeepsMetadata();
  testInitRequiresLiveSessionTokenForSuccessButton();
  testInitShowsSuccessButtonWhenSessionTokenExists();
  console.log('subscriptions github token tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
