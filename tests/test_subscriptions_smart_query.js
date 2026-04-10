const assert = require('node:assert/strict');

const llmUtils = require('../app/llm-config-utils.js');

function setupModule() {
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

(async () => {
  await testRequestCandidatesUsesConfiguredEndpointAndBearerAuth();
  await testRequestCandidatesUsesConfiguredEndpointAndXApiKeyForMiniMax();
  await testRequestCandidatesFallsBackToChatCompletionsWithoutVersionedPath();
  await testRequestCandidatesSurfacesNetworkFetchFailuresClearly();
  await testRequestCandidatesSurfacesAuthErrorsClearly();
  await testRequestCandidatesSurfacesRateLimitErrorsClearly();
  await testRequestCandidatesDowngradesStructuredOutputErrors();
  await testRequestCandidatesReportsMalformedProviderPayloadClearly();
  console.log('subscriptions smart query tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
