const assert = require('node:assert/strict');

const llmUtils = require('../app/llm-config-utils.js');

function setupModule() {
  chatModalFixture = null;
  activeChatModalDom = null;
  staleChatModalDom = null;

  global.window = {
    DPRLLMConfigUtils: llmUtils,
    decoded_secret_private: {},
    SubscriptionsManager: {
      getDraftConfig() {
        return {};
      },
    },
  };

  global.document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() {
      return null;
    },
    createElement() {
      return {
        style: {},
        appendChild() {},
        removeChild() {},
        addEventListener() {},
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

  global.requestAnimationFrame = global.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
  global.fetch = async () => {
    throw new Error('fetch stub not configured');
  };

  delete require.cache[require.resolve('../app/subscriptions.smart-query.js')];
  require('../app/subscriptions.smart-query.js');

  const testApi = global.window.SubscriptionsSmartQuery && global.window.SubscriptionsSmartQuery.__test;
  assert.ok(testApi, 'subscriptions smart query test hooks should be exposed');
  return testApi;
}

function buildJsonResponse(status, body, statusText = '') {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function buildSuccessResponse(payload) {
  return buildJsonResponse(200, {
    choices: [
      {
        message: {
          content: JSON.stringify(payload),
        },
      },
    ],
  });
}

function buildErrorResponse(status, body, statusText = '') {
  const isJson = typeof body === 'object' && body !== null;
  return new Response(isJson ? JSON.stringify(body) : String(body || ''), {
    status,
    statusText,
    headers: {
      'Content-Type': isJson ? 'application/json' : 'text/plain;charset=utf-8',
    },
  });
}

function captureScheduledTimeouts() {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const pending = [];
  let nextId = 1;

  global.setTimeout = (callback, delay = 0, ...args) => {
    pending.push({
      id: nextId,
      delay: Number(delay) || 0,
      cleared: false,
      run() {
        callback(...args);
      },
    });
    nextId += 1;
    return nextId - 1;
  };

  global.clearTimeout = (id) => {
    const timer = pending.find((entry) => entry.id === id);
    if (timer) timer.cleared = true;
  };

  return {
    flushAll() {
      pending
        .splice(0)
        .sort((left, right) => left.delay - right.delay)
        .forEach((timer) => {
          if (!timer.cleared) timer.run();
        });
    },
    restore() {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    },
  };
}

function createClassList() {
  const values = new Set();
  return {
    add(...names) {
      names.forEach((name) => values.add(name));
    },
    remove(...names) {
      names.forEach((name) => values.delete(name));
    },
    toggle(name, force) {
      if (force === true) {
        values.add(name);
        return true;
      }
      if (force === false) {
        values.delete(name);
        return false;
      }
      if (values.has(name)) {
        values.delete(name);
        return false;
      }
      values.add(name);
      return true;
    },
    contains(name) {
      return values.has(name);
    },
    clear() {
      values.clear();
    },
  };
}

function createChatModalControls() {
  const descInput = { value: '' };
  const tagInput = { value: '' };
  const requiredDescInput = { value: '' };
  const inlineStatus = { textContent: '', style: {} };
  const sendLabel = { textContent: '生成候选' };
  const sendBtn = {
    disabled: false,
    classList: createClassList(),
    querySelector(selector) {
      if (selector === '.dpr-chat-send-label') return sendLabel;
      return null;
    },
  };
  return {
    descInput,
    tagInput,
    requiredDescInput,
    inlineStatus,
    sendBtn,
    sendLabel,
  };
}

let chatModalFixture = null;
let activeChatModalDom = null;
let staleChatModalDom = null;

function installChatModalDom(options = {}) {
  if (!chatModalFixture) {
    const modalPanel = {
      innerHTML: '',
      querySelector(selector) {
        if (selector === '#dpr-chat-inline-status') return activeChatModalDom?.inlineStatus || null;
        if (selector === '[data-action="chat-send"]') return activeChatModalDom?.sendBtn || null;
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
    };
    const modalOverlay = {
      style: {},
      classList: createClassList(),
      addEventListener() {},
    };
    chatModalFixture = {
      modalPanel,
      modalOverlay,
    };
  }

  staleChatModalDom = activeChatModalDom;
  activeChatModalDom = {
    ...createChatModalControls(),
    modalPanel: chatModalFixture.modalPanel,
    modalOverlay: chatModalFixture.modalOverlay,
  };
  activeChatModalDom.descInput.value = options.desc ?? 'symbolic regression papers';
  activeChatModalDom.tagInput.value = options.tag ?? 'SR';
  activeChatModalDom.requiredDescInput.value = options.requiredDesc ?? '';
  activeChatModalDom.modalPanel.innerHTML = '';
  activeChatModalDom.modalOverlay.style = {};
  activeChatModalDom.modalOverlay.classList.clear();

  const elements = {
    'dpr-chat-desc-input': activeChatModalDom.descInput,
    'dpr-chat-tag-input': activeChatModalDom.tagInput,
    'dpr-chat-required-desc': activeChatModalDom.requiredDescInput,
    'dpr-sq-modal-overlay': activeChatModalDom.modalOverlay,
    'dpr-sq-modal-panel': activeChatModalDom.modalPanel,
  };
  activeChatModalDom.elements = elements;
  global.document.getElementById = (id) => elements[id] || null;
  return activeChatModalDom;
}

function getLiveChatModalDom() {
  return activeChatModalDom;
}

function getStaleChatModalDom() {
  return staleChatModalDom;
}

async function assertRejectsMessage(fn, expected) {
  let error = null;
  try {
    await fn();
  } catch (err) {
    error = err;
  }
  assert.ok(error, 'expected function to reject');
  assert.match(String(error.message || error), expected);
}

async function testRequestCandidatesUsesConfiguredEndpointAndBearerAuth() {
  const testApi = setupModule();
  const calls = [];
  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    },
  };
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return buildSuccessResponse({
      keywords: [{ keyword: 'symbolic regression', query: 'symbolic regression' }],
      intent_queries: [{ query: 'symbolic regression methods' }],
    });
  };

  const result = await testApi.requestCandidatesByDesc('SR', 'symbolic regression');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer sk-openai');
  assert.equal('x-api-key' in calls[0].options.headers, false);
  assert.equal(result.keywords[0].keyword, 'symbolic regression');
}

async function testRequestCandidatesUsesConfiguredEndpointAndXApiKeyForMiniMax() {
  const testApi = setupModule();
  const calls = [];
  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-minimax',
      baseUrl: 'https://api.minimaxi.com/v1',
      model: 'MiniMax-M2.5',
    },
  };
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return buildSuccessResponse({
      keywords: [{ keyword: 'sr', query: 'symbolic regression' }],
      intent_queries: [{ query: 'equation discovery' }],
    });
  };

  const result = await testApi.requestCandidatesByDesc('SR', 'equation discovery');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.minimaxi.com/v1/chat/completions');
  assert.equal(calls[0].options.headers['x-api-key'], 'sk-minimax');
  assert.equal('Authorization' in calls[0].options.headers, false);
  assert.equal(result.keywords[0].keyword, 'sr');
}

async function testRequestCandidatesFallsBackToChatCompletionsWithoutVersionedPath() {
  const testApi = setupModule();
  const calls = [];
  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-openai',
      baseUrl: 'https://gateway.example.com',
      model: 'gpt-4.1-mini',
    },
  };
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://gateway.example.com/v1/chat/completions') {
      return buildErrorResponse(404, 'not found', 'Not Found');
    }
    return buildSuccessResponse({
      keywords: [{ keyword: 'fallback', query: 'fallback query' }],
      intent_queries: [{ query: 'fallback intent' }],
    });
  };

  const result = await testApi.requestCandidatesByDesc('SR', 'fallback path');

  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      'https://gateway.example.com/v1/chat/completions',
      'https://gateway.example.com/chat/completions',
    ],
  );
  assert.equal(result.keywords[0].keyword, 'fallback');
}

async function testRequestCandidatesSurfacesNetworkFetchFailuresClearly() {
  const testApi = setupModule();
  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-openai',
      baseUrl: 'https://gateway.example.com',
      model: 'gpt-4.1-mini',
    },
  };
  global.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  await assertRejectsMessage(
    () => testApi.requestCandidatesByDesc('SR', 'network failure'),
    /网络请求失败|Failed to fetch/i,
  );
}

async function testRequestCandidatesSurfacesAuthErrorsClearly() {
  const testApi = setupModule();
  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    },
  };
  global.fetch = async () => buildErrorResponse(401, { error: { message: 'invalid api key' } }, 'Unauthorized');

  await assertRejectsMessage(
    () => testApi.requestCandidatesByDesc('SR', 'auth failure'),
    /401|API Key|密钥|invalid api key/i,
  );
}

async function testRequestCandidatesSurfacesRateLimitErrorsClearly() {
  const testApi = setupModule();
  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    },
  };
  global.fetch = async () => buildErrorResponse(429, { error: { message: 'rate limit exceeded' } }, 'Too Many Requests');

  await assertRejectsMessage(
    () => testApi.requestCandidatesByDesc('SR', 'rate limit'),
    /429|限流|稍后重试|rate limit/i,
  );
}

async function testRequestCandidatesDowngradesStructuredOutputErrors() {
  const testApi = setupModule();
  const calls = [];
  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    },
  };
  global.fetch = async (url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) {
      return buildErrorResponse(400, { error: { message: 'response_format json_object is not supported' } }, 'Bad Request');
    }
    return buildSuccessResponse({
      keywords: [{ keyword: 'fallback-json', query: 'fallback-json' }],
      intent_queries: [{ query: 'fallback-json-intent' }],
    });
  };

  const result = await testApi.requestCandidatesByDesc('SR', 'structured output downgrade');

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].response_format, { type: 'json_object' });
  assert.equal('response_format' in calls[1], false);
  assert.equal(result.keywords[0].keyword, 'fallback-json');
}

async function testRequestCandidatesReportsMalformedProviderPayloadClearly() {
  const testApi = setupModule();
  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    },
  };
  global.fetch = async () => buildJsonResponse(200, {
    choices: [
      {
        message: {
          content: 'not json at all',
        },
      },
    ],
  });

  await assertRejectsMessage(
    () => testApi.requestCandidatesByDesc('SR', 'malformed payload'),
    /合法 JSON|返回格式|模型返回/i,
  );
}

async function testClosingChatModalWhileRequestIsInflightDoesNotThrowOrReuseStaleState() {
  const timers = captureScheduledTimeouts();
  const testApi = setupModule();
  const originalConsoleError = console.error;
  const consoleErrors = [];
  console.error = (...args) => {
    consoleErrors.push(args);
  };

  installChatModalDom();
  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    },
  };

  let resolveFetch;
  global.fetch = async () => new Promise((resolve) => {
    resolveFetch = resolve;
  });

  try {
    testApi.openChatModal({});
    const pendingPromise = testApi.askChatOnce();
    assert.equal(testApi.getModalState().pending, true);

    testApi.closeModal();
    timers.flushAll();
    assert.equal(testApi.getModalState(), null);

    resolveFetch(buildSuccessResponse({
      keywords: [{ keyword: 'symbolic regression', query: 'symbolic regression' }],
      intent_queries: [{ query: 'equation discovery' }],
    }));
    await pendingPromise;

    assert.equal(testApi.getModalState(), null);
    assert.equal(consoleErrors.length, 0);
  } finally {
    console.error = originalConsoleError;
    timers.restore();
  }
}

async function testStaleChatResponseDoesNotOverrideReopenedModalState() {
  const timers = captureScheduledTimeouts();
  const testApi = setupModule();
  const originalConsoleError = console.error;
  const consoleErrors = [];
  console.error = (...args) => {
    consoleErrors.push(args);
  };

  global.window.decoded_secret_private = {
    summarizedLLM: {
      apiKey: 'sk-openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    },
  };

  const resolvers = [];
  global.fetch = async () => new Promise((resolve) => {
    resolvers.push(resolve);
  });

  try {
    installChatModalDom({ desc: 'symbolic regression papers', tag: 'SR' });
    testApi.openChatModal({});
    const firstState = testApi.getModalState();
    const firstPromise = testApi.askChatOnce();
    assert.equal(firstState.pending, true);
    assert.equal(firstState.requestToken, 1);

    testApi.closeModal();
    timers.flushAll();
    assert.equal(testApi.getModalState(), null);

    const reopenedDom = installChatModalDom({ desc: 'graph neural networks', tag: 'GNN' });
    const staleDom = getStaleChatModalDom();
    testApi.openChatModal({});
    const secondState = testApi.getModalState();
    assert.notStrictEqual(secondState, firstState);
    assert.strictEqual(getLiveChatModalDom(), reopenedDom);
    assert.notStrictEqual(staleDom, reopenedDom);
    const secondPromise = testApi.askChatOnce();
    assert.equal(secondState.pending, true);
    assert.equal(secondState.requestToken, 1);
    assert.equal(secondState.requestHistory.length, 0);
    assert.equal(reopenedDom.sendBtn.disabled, true);
    assert.equal(reopenedDom.sendLabel.textContent, '生成中...');
    assert.equal(reopenedDom.inlineStatus.textContent, '正在生成候选，请稍候...');
    assert.equal(reopenedDom.tagInput.value, 'GNN');
    assert.equal(reopenedDom.descInput.value, 'graph neural networks');
    assert.equal(reopenedDom.requiredDescInput.value, '');
    assert.equal(staleDom.sendBtn.disabled, true);
    assert.equal(staleDom.sendLabel.textContent, '生成中...');
    assert.equal(staleDom.inlineStatus.textContent, '正在生成候选，请稍候...');

    resolvers[0](buildSuccessResponse({
      tag: 'SR-AUTO',
      description: 'symbolic regression auto desc',
      keywords: [{ keyword: 'symbolic regression', query: 'symbolic regression' }],
      intent_queries: [{ query: 'equation discovery' }],
    }));
    await firstPromise;

    assert.strictEqual(testApi.getModalState(), secondState);
    assert.equal(secondState.pending, true);
    assert.equal(secondState.requestHistory.length, 0);
    assert.equal(secondState.keywords.some((item) => item.keyword === 'symbolic regression'), false);
    assert.equal(secondState.intent_queries.some((item) => item.query === 'equation discovery'), false);
    assert.equal(reopenedDom.sendBtn.disabled, true);
    assert.equal(reopenedDom.sendLabel.textContent, '生成中...');
    assert.equal(reopenedDom.inlineStatus.textContent, '正在生成候选，请稍候...');
    assert.equal(reopenedDom.tagInput.value, 'GNN');
    assert.equal(reopenedDom.descInput.value, 'graph neural networks');
    assert.equal(reopenedDom.requiredDescInput.value, '');
    assert.equal(staleDom.sendBtn.disabled, true);
    assert.equal(staleDom.sendLabel.textContent, '生成中...');
    assert.equal(staleDom.inlineStatus.textContent, '正在生成候选，请稍候...');
    assert.equal(staleDom.tagInput.value, 'SR');
    assert.equal(staleDom.descInput.value, 'symbolic regression papers');
    assert.equal(staleDom.requiredDescInput.value, '');

    resolvers[1](buildSuccessResponse({
      keywords: [{ keyword: 'graph neural networks', query: 'graph neural networks' }],
      intent_queries: [{ query: 'graph representation learning' }],
    }));
    await secondPromise;

    assert.strictEqual(testApi.getModalState(), secondState);
    assert.equal(secondState.pending, false);
    assert.equal(secondState.requestHistory.length, 1);
    assert.equal(secondState.requestHistory[0].desc, 'graph neural networks');
    assert.ok(secondState.keywords.some((item) => item.keyword === 'graph neural networks'));
    assert.ok(secondState.intent_queries.some((item) => item.query === 'graph representation learning'));
    assert.equal(reopenedDom.sendBtn.disabled, false);
    assert.equal(reopenedDom.sendLabel.textContent, '生成候选');
    assert.equal(reopenedDom.inlineStatus.textContent, '已生成候选（关键词 1 条，意图 1 条）。');
    assert.equal(reopenedDom.tagInput.value, 'GNN');
    assert.equal(reopenedDom.descInput.value, '');
    assert.equal(reopenedDom.requiredDescInput.value, 'graph neural networks');
    assert.equal(staleDom.sendBtn.disabled, true);
    assert.equal(staleDom.sendLabel.textContent, '生成中...');
    assert.equal(staleDom.inlineStatus.textContent, '正在生成候选，请稍候...');
    assert.equal(consoleErrors.length, 0);
  } finally {
    console.error = originalConsoleError;
    timers.restore();
  }
}

function testBuildUniqueProfileTagAvoidsCollidingWithExistingProfiles() {
  const testApi = setupModule();
  let config = {
    subscriptions: {
      intent_profiles: [{ tag: 'SR', description: 'existing' }],
    },
  };
  global.window.SubscriptionsManager = {
    getDraftConfig() {
      return config;
    },
    updateDraftConfig(updater) {
      config = updater(config);
      return config;
    },
  };

  assert.equal(testApi.buildUniqueProfileTag('SR-2026'), 'SR-2');
  assert.equal(testApi.buildUniqueProfileTag('SR', { excludeTag: 'SR' }), 'SR');
}

function testApplyCandidateToProfileCreatesNewProfileWhenTagIsUniquified() {
  const testApi = setupModule();
  let config = {
    subscriptions: {
      intent_profiles: [
        {
          tag: 'SR',
          description: 'existing',
          keywords: [{ keyword: 'existing keyword', query: 'existing keyword' }],
          intent_queries: [{ query: 'existing intent' }],
        },
      ],
    },
  };
  global.window.SubscriptionsManager = {
    getDraftConfig() {
      return config;
    },
    updateDraftConfig(updater) {
      config = updater(config);
      return config;
    },
  };

  const uniqueTag = testApi.buildUniqueProfileTag('SR-2026');
  const ok = testApi.applyCandidateToProfile(uniqueTag, 'new profile', ['arxiv'], {
    keywords: [{ keyword: 'new keyword', query: 'new keyword', _selected: true }],
    intent_queries: [{ query: 'new intent', _selected: true }],
  });

  assert.equal(ok, true);
  assert.deepEqual(
    config.subscriptions.intent_profiles.map((profile) => profile.tag).sort(),
    ['SR', 'SR-2'],
  );

  const existingProfile = config.subscriptions.intent_profiles.find((profile) => profile.tag === 'SR');
  const createdProfile = config.subscriptions.intent_profiles.find((profile) => profile.tag === 'SR-2');
  assert.deepEqual(existingProfile, {
    tag: 'SR',
    description: 'existing',
    keywords: [{ keyword: 'existing keyword', query: 'existing keyword' }],
    intent_queries: [{ query: 'existing intent' }],
  });
  assert.equal(createdProfile.description, 'new profile');
  assert.deepEqual(createdProfile.paper_sources, ['arxiv']);
  assert.deepEqual(createdProfile.keywords, [{ keyword: 'new keyword', keyword_cn: '', query: 'new keyword', embedding_cache: undefined }]);
  assert.deepEqual(createdProfile.intent_queries, [{ query: 'new intent', query_cn: '', embedding_cache: undefined }]);
}

(async () => {
  await testRequestCandidatesUsesConfiguredEndpointAndBearerAuth();
  await testRequestCandidatesUsesConfiguredEndpointAndXApiKeyForMiniMax();
  await testRequestCandidatesFallsBackToChatCompletionsWithoutVersionedPath();
  await testRequestCandidatesSurfacesNetworkFetchFailuresClearly();
  await testRequestCandidatesSurfacesAuthErrorsClearly();
  await testRequestCandidatesSurfacesRateLimitErrorsClearly();
  await testRequestCandidatesDowngradesStructuredOutputErrors();
  await testRequestCandidatesReportsMalformedProviderPayloadClearly();
  await testClosingChatModalWhileRequestIsInflightDoesNotThrowOrReuseStaleState();
  await testStaleChatResponseDoesNotOverrideReopenedModalState();
  testBuildUniqueProfileTagAvoidsCollidingWithExistingProfiles();
  testApplyCandidateToProfileCreatesNewProfileWhenTagIsUniquified();
  console.log('subscriptions smart query tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
