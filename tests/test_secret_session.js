const assert = require('node:assert/strict');

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
} = global.window.DPRSecretSession.__test;

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

testBuildPingEntriesIncludesIndependentRerank();
testBuildPingEntriesDedupesWorkflowAndRerankOverlap();
testResolveRerankSyncStateDisablesIncompleteConfig();
testBuildSecretSyncOperationsClearsRerankSecretsWhenSkipped();
testBuildSecretSyncOperationsClearsIncompleteRerankSecrets();
testBuildSecretSyncOperationsKeepsRerankSecretsWhenConfigured();

console.log('secret session tests passed');
