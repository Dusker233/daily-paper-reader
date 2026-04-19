const assert = require('node:assert/strict');

global.window = global.window || {};
global.window.__DPR_ENABLE_SECRET_SESSION_TESTS__ = true;
global.window.location = global.window.location || {
  hostname: 'localhost',
  href: 'http://localhost/',
};
const localStorageState = {};
global.window.localStorage = global.window.localStorage || {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(localStorageState, key)
      ? localStorageState[key]
      : null;
  },
  setItem(key, value) {
    localStorageState[key] = String(value);
  },
  removeItem(key) {
    delete localStorageState[key];
  },
};
global.window.crypto = global.window.crypto || {
  getRandomValues(array) {
    return array;
  },
  subtle: {},
};
global.crypto = global.crypto || global.window.crypto;
global.window.requestAnimationFrame = global.window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
global.requestAnimationFrame = global.requestAnimationFrame || global.window.requestAnimationFrame;
global.CustomEvent = global.CustomEvent || function CustomEvent(type, init) {
  this.type = type;
  this.detail = init ? init.detail : undefined;
};
global.document = global.document || {
  readyState: 'loading',
  addEventListener() {},
  dispatchEvent() {},
  getElementById() {
    return null;
  },
  querySelector() {
    return null;
  },
  createElement() {
    return {
      style: {},
      click() {},
      appendChild() {},
      removeChild() {},
      classList: {
        add() {},
        remove() {},
        toggle() {},
      },
    };
  },
  body: {
    appendChild() {},
    removeChild() {},
  },
};

global.fetch = global.fetch || (async () => {
  throw new Error('fetch should not be called in test_secret_session');
});

global.alert = global.alert || (() => {});
global.atob = global.atob || ((value) => Buffer.from(value, 'base64').toString('binary'));
global.btoa = global.btoa || ((value) => Buffer.from(value, 'binary').toString('base64'));

require('../app/secret.session.js');

const {
  dedupePingEntries,
  buildPingEntriesFromProviderDraft,
  resolveRerankSyncState,
  buildSecretSyncOperations,
  verifyGithubTokenForSetup,
  loadSavedPassword,
  savePassword,
  clearPassword,
  clearRuntimeGithubToken,
  loadGithubTokenForSession,
  buildSessionSecretState,
  applySessionSecretState,
  enforceGuestMode,
  buildGithubSecretDraftFromSession,
  saveSummarizeSecretsToGithub,
} = global.window.DPRSecretSession.__test;

function resetSecretSessionState() {
  applySessionSecretState({});
  clearRuntimeGithubToken();
  clearPassword();
}

function testBuildPingEntriesIncludesIndependentRerank() {
  const entries = buildPingEntriesFromProviderDraft({
    providerType: 'openai-compatible',
    chatApiKey: 'sk-chat',
    chatBaseUrl: 'https://api.workflow.example.com/v1',
    chatModels: ['gpt-4.1-mini', 'gpt-4.1'],
    reranker: {
      apiKey: 'sk-rerank',
      baseUrl: 'https://api.rerank.example.com/v1',
      model: 'qwen3-reranker-4b',
    },
  });

  assert.deepEqual(entries, [
    {
      apiKey: 'sk-chat',
      baseUrl: 'https://api.workflow.example.com/v1',
      model: 'gpt-4.1-mini',
    },
    {
      apiKey: 'sk-chat',
      baseUrl: 'https://api.workflow.example.com/v1',
      model: 'gpt-4.1',
    },
    {
      apiKey: 'sk-rerank',
      baseUrl: 'https://api.rerank.example.com/v1',
      model: 'qwen3-reranker-4b',
    },
  ]);
}

function testBuildPingEntriesDedupesWorkflowAndRerankOverlap() {
  const entries = buildPingEntriesFromProviderDraft({
    providerType: 'openai-compatible',
    chatApiKey: 'sk-shared',
    chatBaseUrl: 'https://api.shared.example.com/v1',
    chatModels: ['gpt-4.1-mini'],
    reranker: {
      apiKey: 'sk-shared',
      baseUrl: 'https://api.shared.example.com/v1',
      model: 'gpt-4.1-mini',
    },
  });

  assert.deepEqual(entries, [
    {
      apiKey: 'sk-shared',
      baseUrl: 'https://api.shared.example.com/v1',
      model: 'gpt-4.1-mini',
    },
  ]);
}

function testResolveRerankSyncStateDisablesIncompleteConfig() {
  assert.deepEqual(
    resolveRerankSyncState({
      skipRerank: false,
      rerankerApiKey: 'sk-rerank',
      rerankerBaseUrl: '',
      rerankerModel: 'qwen3-reranker-4b',
    }),
    {
      hasCompleteRerankConfig: false,
      rerankEnabled: false,
      shouldClearRerank: true,
      normalizedSkipRerank: true,
    },
  );
}

function testBuildSecretSyncOperationsClearsRerankSecretsWhenSkipped() {
  const operations = buildSecretSyncOperations({
    baseSecrets: [
      { name: 'WORKFLOW_LLM_API_KEY', value: 'sk-workflow' },
      { name: 'RERANK_ENABLED', value: 'false' },
    ],
    skipRerank: true,
    rerankerApiKey: '',
    rerankerBaseUrl: '',
    rerankerModel: '',
    rerankSecretNames: ['RERANK_API_KEY', 'RERANK_BASE_URL', 'RERANK_MODEL'],
  });

  assert.deepEqual(operations, [
    { type: 'put', name: 'WORKFLOW_LLM_API_KEY', value: 'sk-workflow' },
    { type: 'put', name: 'RERANK_ENABLED', value: 'false' },
    { type: 'delete', name: 'RERANK_API_KEY' },
    { type: 'delete', name: 'RERANK_BASE_URL' },
    { type: 'delete', name: 'RERANK_MODEL' },
  ]);
}

function testBuildSecretSyncOperationsClearsIncompleteRerankSecrets() {
  const operations = buildSecretSyncOperations({
    baseSecrets: [
      { name: 'WORKFLOW_LLM_API_KEY', value: 'sk-workflow' },
      { name: 'RERANK_ENABLED', value: 'false' },
      { name: 'DPR_SKIP_RERANK', value: 'true' },
    ],
    skipRerank: false,
    rerankerApiKey: 'sk-rerank',
    rerankerBaseUrl: '',
    rerankerModel: 'qwen3-reranker-4b',
    rerankSecretNames: ['RERANK_API_KEY', 'RERANK_BASE_URL', 'RERANK_MODEL'],
  });

  assert.deepEqual(operations, [
    { type: 'put', name: 'WORKFLOW_LLM_API_KEY', value: 'sk-workflow' },
    { type: 'put', name: 'RERANK_ENABLED', value: 'false' },
    { type: 'put', name: 'DPR_SKIP_RERANK', value: 'true' },
    { type: 'delete', name: 'RERANK_API_KEY' },
    { type: 'delete', name: 'RERANK_BASE_URL' },
    { type: 'delete', name: 'RERANK_MODEL' },
  ]);
}

function testBuildSecretSyncOperationsKeepsRerankSecretsWhenConfigured() {
  const operations = buildSecretSyncOperations({
    baseSecrets: [
      { name: 'WORKFLOW_LLM_API_KEY', value: 'sk-workflow' },
      { name: 'RERANK_API_KEY', value: 'sk-rerank' },
    ],
    skipRerank: false,
    rerankerApiKey: 'sk-rerank',
    rerankerBaseUrl: 'https://api.rerank.example.com/v1',
    rerankerModel: 'qwen3-reranker-4b',
    rerankSecretNames: ['RERANK_API_KEY', 'RERANK_BASE_URL', 'RERANK_MODEL'],
  });

  assert.deepEqual(operations, [
    { type: 'put', name: 'WORKFLOW_LLM_API_KEY', value: 'sk-workflow' },
    { type: 'put', name: 'RERANK_API_KEY', value: 'sk-rerank' },
  ]);
}

function testPasswordStateStaysInSessionMemoryOnly() {
  localStorageState.dpr_secret_password_v1 = 'legacy-persisted-password';
  clearPassword();

  assert.equal(loadSavedPassword(), '');
  assert.equal(localStorageState.dpr_secret_password_v1, undefined);

  savePassword('Session#Pass1');
  assert.equal(loadSavedPassword(), 'Session#Pass1');
  assert.equal(localStorageState.dpr_secret_password_v1, undefined);

  clearPassword();
  assert.equal(loadSavedPassword(), '');
  assert.equal(localStorageState.dpr_secret_password_v1, undefined);
}

function testEnforceGuestModeClearsDecryptedSecretAndRuntimeToken() {
  global.window.decoded_secret_private = { github: { token: 'ghp_secret' } };
  global.window.DPRSecretSession.setSessionGithubToken('ghp_runtime_demo');
  savePassword('Session#Pass1');

  enforceGuestMode(null, 'test_guest');

  assert.equal(global.window.DPR_ACCESS_MODE, 'guest');
  assert.equal(global.window.decoded_secret_private, undefined);
  assert.equal(global.window.DPR_RUNTIME_GITHUB_TOKEN, undefined);
  assert.equal(loadGithubTokenForSession(), '');
  assert.equal(loadSavedPassword(), '');
}

function testClearRuntimeGithubTokenRemovesGlobalToken() {
  global.window.DPRSecretSession.setSessionGithubToken('ghp_runtime_demo');
  clearRuntimeGithubToken();
  assert.equal(global.window.DPR_RUNTIME_GITHUB_TOKEN, undefined);
  assert.equal(loadGithubTokenForSession(), '');
}

function testBuildSessionSecretStateStripsGithubTokenFromDecodedSecret() {
  const state = buildSessionSecretState({
    github: {
      token: 'ghp_secret',
      login: 'dusker',
    },
    workflowLLM: {
      apiKey: 'sk-workflow',
    },
  });

  assert.deepEqual(state.decodedSecret, {
    github: {
      login: 'dusker',
    },
    workflowLLM: {
      apiKey: 'sk-workflow',
    },
  });
  assert.equal(state.githubToken, 'ghp_secret');
}

function testApplySessionSecretStateMovesGithubTokenToSessionAccessor() {
  global.window.DPRSecretSession.setSessionGithubToken('ghp_runtime_old');
  global.window.decoded_secret_private = {};

  const decodedSecret = applySessionSecretState({
    github: {
      token: 'ghp_session_secret',
      login: 'dusker',
    },
    workflowLLM: {
      apiKey: 'sk-workflow',
    },
  });

  assert.deepEqual(decodedSecret, {
    github: {
      login: 'dusker',
    },
    workflowLLM: {
      apiKey: 'sk-workflow',
    },
  });
  assert.equal(global.window.decoded_secret_private.github.token, undefined);
  assert.equal(global.window.DPR_RUNTIME_GITHUB_TOKEN, undefined);
  assert.equal(loadGithubTokenForSession(), 'ghp_session_secret');
  assert.equal(global.window.DPRSecretSession.getGithubToken(), 'ghp_session_secret');
}

function testBuildGithubSecretDraftFromSessionUsesWorkflowAndRerankConfig() {
  const draft = buildGithubSecretDraftFromSession({
    llmProvider: {
      type: 'openai-compatible',
    },
    workflowLLM: {
      apiKey: 'sk-workflow',
      baseUrl: 'https://api.workflow.example.com/v1/',
      model: 'gpt-4.1-mini',
    },
    rerankerLLM: {
      apiKey: 'sk-rerank',
      baseUrl: 'https://api.rerank.example.com/v1/',
      model: 'qwen3-reranker-4b',
    },
  });

  assert.deepEqual(draft, {
    providerType: 'openai-compatible',
    workflowApiKey: 'sk-workflow',
    workflowBaseUrl: 'https://api.workflow.example.com/v1',
    workflowModel: 'gpt-4.1-mini',
    filterModel: 'gpt-4.1-mini',
    rewriteModel: 'gpt-4.1-mini',
    skipRerank: false,
    rerankerApiKey: 'sk-rerank',
    rerankerBaseUrl: 'https://api.rerank.example.com/v1',
    rerankerModel: 'qwen3-reranker-4b',
  });
}

function testBuildGithubSecretDraftFromSessionHonorsExplicitSkipRerank() {
  const draft = buildGithubSecretDraftFromSession({
    llmProvider: {
      type: 'plato',
      skipRerank: true,
    },
    workflowLLM: {
      apiKey: 'sk-workflow',
      baseUrl: 'https://api.bltcy.ai/v1',
      model: 'gpt-5-chat',
    },
    rerankerLLM: {
      apiKey: 'sk-stale-rerank',
      baseUrl: 'https://api.rerank.example.com/v1/',
      model: 'qwen3-reranker-4b',
    },
  });

  assert.deepEqual(draft, {
    providerType: 'plato',
    workflowApiKey: 'sk-workflow',
    workflowBaseUrl: 'https://api.bltcy.ai/v1',
    workflowModel: 'gpt-5-chat',
    filterModel: 'gemini-3-flash-preview-nothinking',
    rewriteModel: 'gemini-3-flash-preview',
    skipRerank: true,
    rerankerApiKey: '',
    rerankerBaseUrl: '',
    rerankerModel: '',
  });
}

function testBuildGithubSecretDraftFromSessionFallsBackToChatAndDisablesMissingRerank() {
  const draft = buildGithubSecretDraftFromSession({
    chatLLMs: [
      {
        apiKey: 'sk-chat',
        baseUrl: 'https://api.chat.example.com/v1/',
        models: ['gpt-4.1-mini', 'gpt-4.1'],
      },
    ],
    rerankerLLM: {
      enabled: false,
    },
  });

  assert.deepEqual(draft, {
    providerType: 'openai-compatible',
    workflowApiKey: 'sk-chat',
    workflowBaseUrl: 'https://api.chat.example.com/v1',
    workflowModel: 'gpt-4.1-mini',
    filterModel: 'gpt-4.1-mini',
    rewriteModel: 'gpt-4.1-mini',
    skipRerank: true,
    rerankerApiKey: '',
    rerankerBaseUrl: '',
    rerankerModel: '',
  });
}

async function testVerifyGithubTokenForSetupStoresRuntimeTokenForCurrentSession() {
  resetSecretSessionState();
  const responses = [];
  global.fetch = async (url, options = {}) => {
    responses.push({ url, options });
    if (url === 'https://api.github.com/user') {
      return new Response(JSON.stringify({ login: 'dusker' }), {
        status: 200,
        headers: { 'X-OAuth-Scopes': 'repo,workflow,gist' },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  clearRuntimeGithubToken();

  const result = await verifyGithubTokenForSetup('ghp_runtime_demo');

  assert.equal(global.window.DPR_RUNTIME_GITHUB_TOKEN, undefined);
  assert.equal(loadGithubTokenForSession(), 'ghp_runtime_demo');
  assert.equal(result.ok, true);
  assert.equal(result.color, '#28a745');
  assert.match(result.text, /验证成功/);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].options.headers.Authorization, 'token ghp_runtime_demo');
}

async function testVerifyGithubTokenForSetupClearsRuntimeTokenOnFailure() {
  resetSecretSessionState();
  global.fetch = async () => new Response('denied', {
    status: 401,
    headers: { 'X-OAuth-Scopes': 'repo,workflow,gist' },
  });

  global.window.DPRSecretSession.setSessionGithubToken('ghp_stale');

  await assert.rejects(
    () => verifyGithubTokenForSetup('ghp_bad_demo'),
    /HTTP 401/,
  );
  assert.equal(global.window.DPR_RUNTIME_GITHUB_TOKEN, undefined);
  assert.equal(loadGithubTokenForSession(), '');
}

async function testVerifyGithubTokenForSetupClearsRuntimeTokenWhenScopeMissing() {
  resetSecretSessionState();
  global.fetch = async () => new Response(JSON.stringify({ login: 'dusker' }), {
    status: 200,
    headers: { 'X-OAuth-Scopes': 'repo,gist' },
  });

  global.window.DPRSecretSession.setSessionGithubToken('ghp_stale');

  await assert.rejects(
    () => verifyGithubTokenForSetup('ghp_missing_scope'),
    /Token 权限不足/,
  );
  assert.equal(global.window.DPR_RUNTIME_GITHUB_TOKEN, undefined);
  assert.equal(loadGithubTokenForSession(), '');
}

function buildMockSodium() {
  return {
    ready: Promise.resolve(),
    base64_variants: { ORIGINAL: 'ORIGINAL' },
    from_base64(value) {
      return value;
    },
    from_string(value) {
      return value;
    },
    crypto_box_seal(value) {
      return `sealed:${value}`;
    },
    to_base64(value) {
      return `base64:${value}`;
    },
  };
}

async function testSaveSummarizeSecretsToGithubUsesExplicitRepoTarget() {
  const requests = [];
  global.window.sodium = buildMockSodium();
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === 'https://api.github.com/repos/target-owner/target-repo/actions/secrets/public-key') {
      return new Response(JSON.stringify({ key: 'public-key', key_id: 'key-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.startsWith('https://api.github.com/repos/target-owner/target-repo/actions/secrets/')) {
      return new Response('', { status: 201 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const ok = await saveSummarizeSecretsToGithub('ghp_runtime_demo', {
    owner: 'target-owner',
    repo: 'target-repo',
    providerType: 'openai-compatible',
    workflowApiKey: 'sk-workflow',
    workflowBaseUrl: 'https://api.workflow.example.com/v1',
    workflowModel: 'gpt-4.1-mini',
    filterModel: 'gpt-4.1-mini',
    rewriteModel: 'gpt-4.1-mini',
    skipRerank: true,
    rerankerApiKey: '',
    rerankerBaseUrl: '',
    rerankerModel: '',
  });

  assert.equal(ok, true);
  assert.equal(
    requests.some((entry) => entry.url === 'https://api.github.com/user'),
    false,
  );
  assert.equal(
    requests[0].url,
    'https://api.github.com/repos/target-owner/target-repo/actions/secrets/public-key',
  );
  assert.equal(
    requests.every((entry) => entry.url.includes('/repos/target-owner/target-repo/')),
    true,
  );
}

async function testSyncSessionSecretsToGithubUsesExplicitRepoTargetAndRedactsProgressNames() {
  resetSecretSessionState();
  global.window.decoded_secret_private = {
    llmProvider: {
      type: 'openai-compatible',
    },
    workflowLLM: {
      apiKey: 'sk-workflow',
      baseUrl: 'https://api.workflow.example.com/v1',
      model: 'gpt-4.1-mini',
    },
  };
  global.window.sodium = buildMockSodium();
  const requests = [];
  const progressCalls = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === 'https://api.github.com/repos/target-owner/target-repo/actions/secrets/public-key') {
      return new Response(JSON.stringify({ key: 'public-key', key_id: 'key-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.startsWith('https://api.github.com/repos/target-owner/target-repo/actions/secrets/')) {
      return new Response('', { status: 201 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await global.window.DPRSecretSession.syncSessionSecretsToGithub({
    token: 'ghp_runtime_demo',
    owner: 'target-owner',
    repo: 'target-repo',
    onProgress(...args) {
      progressCalls.push(args);
    },
  });

  assert.deepEqual(result, {
    ok: true,
    skipped: false,
  });
  assert.equal(
    requests.some((entry) => entry.url === 'https://api.github.com/user'),
    false,
  );
  assert.equal(
    requests[0].url,
    'https://api.github.com/repos/target-owner/target-repo/actions/secrets/public-key',
  );
  assert.equal(progressCalls.length > 0, true);
  assert.equal(progressCalls.every((args) => args.length === 2), true);
  assert.equal(
    progressCalls.every((args) => typeof args[0] === 'number' && typeof args[1] === 'number'),
    true,
  );
}

(async () => {
  testBuildPingEntriesIncludesIndependentRerank();
  testBuildPingEntriesDedupesWorkflowAndRerankOverlap();
  testResolveRerankSyncStateDisablesIncompleteConfig();
  testBuildSecretSyncOperationsClearsRerankSecretsWhenSkipped();
  testBuildSecretSyncOperationsClearsIncompleteRerankSecrets();
  testBuildSecretSyncOperationsKeepsRerankSecretsWhenConfigured();
  testPasswordStateStaysInSessionMemoryOnly();
  testEnforceGuestModeClearsDecryptedSecretAndRuntimeToken();
  testClearRuntimeGithubTokenRemovesGlobalToken();
  testBuildSessionSecretStateStripsGithubTokenFromDecodedSecret();
  testApplySessionSecretStateMovesGithubTokenToSessionAccessor();
  testBuildGithubSecretDraftFromSessionUsesWorkflowAndRerankConfig();
  testBuildGithubSecretDraftFromSessionHonorsExplicitSkipRerank();
  testBuildGithubSecretDraftFromSessionFallsBackToChatAndDisablesMissingRerank();
  await testVerifyGithubTokenForSetupStoresRuntimeTokenForCurrentSession();
  await testVerifyGithubTokenForSetupClearsRuntimeTokenOnFailure();
  await testVerifyGithubTokenForSetupClearsRuntimeTokenWhenScopeMissing();
  await testSaveSummarizeSecretsToGithubUsesExplicitRepoTarget();
  await testSyncSessionSecretsToGithubUsesExplicitRepoTargetAndRedactsProgressNames();

  console.log('secret session tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
