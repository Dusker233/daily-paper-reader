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

function buildSuccessResponse(payload) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify(payload),
            },
          },
        ],
      };
    },
    async text() {
      return '';
    },
  };
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
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        async json() {
          return {};
        },
        async text() {
          return 'not found';
        },
      };
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

(async () => {
  await testRequestCandidatesUsesConfiguredEndpointAndBearerAuth();
  await testRequestCandidatesUsesConfiguredEndpointAndXApiKeyForMiniMax();
  await testRequestCandidatesFallsBackToChatCompletionsWithoutVersionedPath();
  console.log('subscriptions smart query tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
