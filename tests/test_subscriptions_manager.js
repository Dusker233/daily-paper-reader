const assert = require('node:assert/strict');

global.window = global.window || {};
global.document = global.document || {
  readyState: 'loading',
  addEventListener() {},
};

require('../app/subscriptions.manager.js');

const manager = global.window.SubscriptionsManager;
const {
  normalizeSubscriptions,
  mergeDraftConfigOntoLatest,
  applyQuickRunRerankDispatchInputs,
} = manager.__test;

function buildJsonResponse(status, body, statusText = '') {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function buildBaseConfig() {
  return {
    supabase_shared: {
      kind: 'supabase',
      enabled: true,
      url: 'https://example.supabase.co',
      anon_key: 'sb_publishable_demo',
      schema: 'public',
    },
    source_backends: {
      arxiv: {
        papers_table: 'arxiv_papers',
        use_vector_rpc: true,
        vector_rpc: 'match_arxiv_papers_exact',
        vector_rpc_exact: 'match_arxiv_papers_exact',
        use_bm25_rpc: true,
        bm25_rpc: 'match_arxiv_papers_bm25',
        sync_table: 'arxiv_sync_status',
        sync_success_value: 'success',
        schema: 'public',
      },
    },
    subscriptions: {
      schema_migration: {
        stage: 'A',
        diff_threshold_pct: 15,
      },
      keyword_recall_mode: 'or',
      intent_profiles: [
        {
          tag: 'GENE',
          description: '遗传学',
          enabled: true,
          paper_sources: ['biorxiv'],
          keywords: [
            {
              keyword: 'genetics',
              query: 'fundamental principles and study of genetics',
            },
          ],
          intent_queries: [
            {
              query: 'latest preprints in genetics',
            },
          ],
        },
      ],
    },
  };
}

function testNormalizeSubscriptionsAddsBiorxivBackend() {
  const normalized = normalizeSubscriptions(buildBaseConfig());
  const backend = normalized.source_backends.biorxiv;

  assert.ok(backend, '应自动补齐 biorxiv backend');
  assert.equal(backend.kind, 'supabase');
  assert.equal(backend.enabled, true);
  assert.equal(backend.url, 'https://example.supabase.co');
  assert.equal(backend.anon_key, 'sb_publishable_demo');
  assert.equal(backend.schema, 'public');
  assert.equal(backend.papers_table, 'biorxiv_papers');
  assert.equal(backend.vector_rpc, 'match_biorxiv_papers_exact');
  assert.equal(backend.vector_rpc_exact, 'match_biorxiv_papers_exact');
  assert.equal(backend.bm25_rpc, 'match_biorxiv_papers_bm25');
}

function testNormalizeSubscriptionsPreservesCustomBiorxivBackendFields() {
  const config = buildBaseConfig();
  config.source_backends.biorxiv = {
    enabled: false,
    papers_table: 'custom_biorxiv_papers',
    bm25_rpc: 'custom_match_biorxiv_papers_bm25',
    extra_flag: 'keep-me',
  };

  const normalized = normalizeSubscriptions(config);
  const backend = normalized.source_backends.biorxiv;

  assert.equal(backend.enabled, false);
  assert.equal(backend.papers_table, 'custom_biorxiv_papers');
  assert.equal(backend.bm25_rpc, 'custom_match_biorxiv_papers_bm25');
  assert.equal(backend.extra_flag, 'keep-me');
  assert.equal(backend.url, 'https://example.supabase.co');
  assert.equal(backend.anon_key, 'sb_publishable_demo');
  assert.equal(backend.vector_rpc, 'match_biorxiv_papers_exact');
  assert.equal(backend.vector_rpc_exact, 'match_biorxiv_papers_exact');
}

function testRunProfileQuickFetchPassesProfileTagToWorkflow() {
  const calls = [];
  global.window.DPRWorkflowRunner = {
    runQuickFetchByDays(days, options) {
      calls.push({ days, options });
    },
  };

  const ok = global.window.SubscriptionsManager.runProfileQuickFetch('GENE', 30, {
    fetchMode: 'skims',
  });

  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].days, 30);
  assert.equal(calls[0].options.fetchMode, 'skims');
  assert.equal(calls[0].options.dispatchInputs.profile_tag, 'GENE');
}

function testRunProfileQuickFetchPreservesExplicitFilterConcurrency() {
  const calls = [];
  global.window.DPRWorkflowRunner = {
    runQuickFetchByDays(days, options) {
      calls.push({ days, options });
    },
  };

  const ok = global.window.SubscriptionsManager.runProfileQuickFetch('GENE', 30, {
    fetchMode: 'skims',
    dispatchInputs: {
      filter_concurrency: '1',
    },
  });

  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.dispatchInputs.profile_tag, 'GENE');
  assert.equal(calls[0].options.dispatchInputs.filter_concurrency, '1');
}

function testApplyQuickRunRerankDispatchInputsDefaultsLocalModel() {
  const out = applyQuickRunRerankDispatchInputs({
    rerankProvider: 'local',
  });

  assert.equal(out.dispatchInputs.rerank_provider, 'local');
  assert.equal(out.dispatchInputs.rerank_model, 'BAAI/bge-reranker-v2-m3');
}

function testApplyQuickRunRerankDispatchInputsStripsModelForNonLocalProvider() {
  const out = applyQuickRunRerankDispatchInputs({
    rerankProvider: 'blt',
    dispatchInputs: {
      rerank_model: 'should-be-removed',
    },
  });

  assert.equal(out.dispatchInputs.rerank_provider, 'blt');
  assert.equal('rerank_model' in out.dispatchInputs, false);
}

function testApplyQuickRunRerankDispatchInputsPreservesExplicitDispatchProviderAndModel() {
  const out = applyQuickRunRerankDispatchInputs({
    rerankProvider: 'blt',
    rerankModel: 'ignored-model',
    dispatchInputs: {
      rerank_provider: 'local',
      rerank_model: 'custom-local-model',
    },
  });

  assert.equal(out.dispatchInputs.rerank_provider, 'local');
  assert.equal(out.dispatchInputs.rerank_model, 'custom-local-model');
}

function testRunProfileQuickFetchIncludesCustomDaysInTipOptions() {
  const calls = [];
  global.window.DPRWorkflowRunner = {
    runQuickFetchByDays(days, options) {
      calls.push({ days, options });
    },
  };

  const ok = global.window.SubscriptionsManager.runProfileQuickFetch('GENE', 17, {
    fetchMode: 'standard',
    rerankProvider: 'local',
  });

  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].days, 17);
  assert.equal(calls[0].options.fetchMode, 'standard');
  assert.equal(calls[0].options.dispatchInputs.profile_tag, 'GENE');
  assert.equal(calls[0].options.dispatchInputs.rerank_provider, 'local');
  assert.equal(calls[0].options.dispatchInputs.rerank_model, 'BAAI/bge-reranker-v2-m3');
}

function testWorkflowRunnerFallbackPreservesFetchModeForCustomDays() {
  global.window.decoded_secret_private = { github: { token: 'demo-token' } };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'https://example.com',
  };
  const elementMap = {};
  const createDomNode = (id = '') => ({
    id,
    innerHTML: '',
    textContent: '',
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  });
  global.document = {
    getElementById(id) {
      return elementMap[id] || null;
    },
    createElement() {
      return createDomNode('');
    },
    body: {
      appendChild(node) {
        if (!node || typeof node !== 'object') return;
        elementMap['dpr-workflow-overlay'] = node;
        ['dpr-workflow-panel', 'dpr-workflow-status', 'dpr-workflow-runs', 'dpr-workflow-recent', 'dpr-workflow-close-btn', 'dpr-workflow-refresh-btn'].forEach((id) => {
          elementMap[id] = createDomNode(id);
        });
      },
    },
  };
  global.requestAnimationFrame = (cb) => cb();

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url === 'https://api.github.com/user') {
      return buildJsonResponse(200, { login: 'demo-user' });
    }
    if (url === 'https://api.github.com/repos/demo-user/daily-paper-reader') {
      return buildJsonResponse(200, { fork: true, default_branch: 'main' });
    }
    if (url.includes('/actions/workflows/daily-paper-reader.yml/runs?per_page=5')) {
      return buildJsonResponse(200, { workflow_runs: [] });
    }
    if (url.includes('/dispatches')) {
      return new Response('', { status: 200, statusText: 'OK' });
    }
    if (url.includes('/actions/workflows/daily-paper-reader.yml/runs?event=workflow_dispatch&per_page=10')) {
      return buildJsonResponse(200, {
        workflow_runs: [
          {
            id: 123,
            run_number: 45,
            status: 'completed',
            conclusion: 'success',
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
    if (url.includes('/actions/runs/123/jobs?per_page=100')) {
      return buildJsonResponse(200, { jobs: [] });
    }
    if (url.includes('/actions/runs/123')) {
      return buildJsonResponse(200, {
        id: 123,
        run_number: 45,
        status: 'completed',
        conclusion: 'success',
        created_at: new Date().toISOString(),
      });
    }
    return buildJsonResponse(200, {});
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  return global.window.DPRWorkflowRunner.runQuickFetchByDays(17, {
    fetchMode: 'standard',
    dispatchInputs: {
      profile_tag: 'GENE',
    },
  }).then(() => {
    const dispatchCall = calls.find((entry) => entry.url.includes('/dispatches'));
    assert.ok(dispatchCall, 'should dispatch workflow');
    const body = JSON.parse(dispatchCall.init.body);
    assert.equal(body.inputs.fetch_days, '17');
    assert.equal(body.inputs.fetch_mode, 'standard');
    assert.equal(body.inputs.filter_concurrency, '2');
    assert.equal(body.inputs.profile_tag, 'GENE');
  });
}

function testMergeDraftConfigOntoLatestPreservesRemoteOnlyProfilesAndLatestCache() {
  const base = buildBaseConfig();
  const draft = buildBaseConfig();
  draft.subscriptions.intent_profiles[0].description = '本地编辑后的描述';
  draft.subscriptions.intent_profiles[0].intent_queries.push({
    query: 'gene regulation preprints',
  });

  const latest = buildBaseConfig();
  latest.top_level = { keep: true };
  latest.subscriptions.intent_profiles[0].description = '远端最新描述';
  latest.subscriptions.intent_profiles[0].keywords[0].embedding_cache = {
    embedding_json: '[0.1,0.2,0.3]',
  };
  latest.subscriptions.intent_profiles.push({
    tag: 'NEW',
    description: '远端独有词条',
    enabled: true,
    paper_sources: ['arxiv'],
    keywords: [{ keyword: 'remote only', query: 'remote only' }],
    intent_queries: [{ query: 'remote query' }],
  });

  const merged = mergeDraftConfigOntoLatest(latest, draft, base);
  const profiles = merged.subscriptions.intent_profiles;
  const geneProfile = profiles.find((item) => item.tag === 'GENE');
  const newProfile = profiles.find((item) => item.tag === 'NEW');

  assert.equal(merged.top_level.keep, true);
  assert.equal(geneProfile.description, '本地编辑后的描述');
  assert.deepEqual(geneProfile.keywords[0].embedding_cache, {
    embedding_json: '[0.1,0.2,0.3]',
  });
  assert.ok(geneProfile.intent_queries.some((item) => item.query === 'gene regulation preprints'));
  assert.equal(newProfile.description, '远端独有词条');
}

function testMergeDraftConfigOntoLatestRespectsLocalProfileDeletion() {
  const base = buildBaseConfig();
  base.subscriptions.intent_profiles.push({
    tag: 'MATH',
    description: '数学',
    enabled: true,
    paper_sources: ['arxiv'],
    keywords: [{ keyword: 'algebra', query: 'algebra' }],
    intent_queries: [{ query: 'algebra preprints' }],
  });

  const draft = buildBaseConfig();
  draft.subscriptions.intent_profiles = [base.subscriptions.intent_profiles[1]];

  const latest = buildBaseConfig();
  latest.subscriptions.intent_profiles.push(base.subscriptions.intent_profiles[1]);
  latest.subscriptions.intent_profiles.push({
    tag: 'NEW',
    description: '远端新增',
    enabled: true,
    paper_sources: ['arxiv'],
    keywords: [{ keyword: 'remote', query: 'remote' }],
    intent_queries: [{ query: 'remote only' }],
  });

  const merged = mergeDraftConfigOntoLatest(latest, draft, base);
  const tags = merged.subscriptions.intent_profiles.map((item) => item.tag).sort();

  assert.deepEqual(tags, ['MATH', 'NEW']);
}

function testMergeDraftConfigOntoLatestKeepsLatestOnlyItemsWithinProfile() {
  const base = buildBaseConfig();
  const draft = buildBaseConfig();
  draft.subscriptions.intent_profiles[0].description = '本地修改';

  const latest = buildBaseConfig();
  latest.subscriptions.intent_profiles[0].keywords.push({
    keyword: 'genomics',
    query: 'genomics',
  });
  latest.subscriptions.intent_profiles[0].intent_queries.push({
    query: 'gene regulation preprints',
  });

  const merged = mergeDraftConfigOntoLatest(latest, draft, base);
  const profile = merged.subscriptions.intent_profiles[0];

  assert.equal(profile.description, '本地修改');
  assert.ok(profile.keywords.some((item) => item.keyword === 'genomics'));
  assert.ok(profile.intent_queries.some((item) => item.query === 'gene regulation preprints'));
}

function testMergeDraftConfigOntoLatestPreservesLatestNonProfileConfig() {
  const base = buildBaseConfig();
  const draft = buildBaseConfig();
  draft.subscriptions.intent_profiles[0].description = '本地修改';

  const latest = buildBaseConfig();
  latest.supabase_shared.url = 'https://latest.supabase.co';
  latest.source_backends.arxiv.extra_flag = 'keep-latest';

  const merged = mergeDraftConfigOntoLatest(latest, draft, base);

  assert.equal(merged.supabase_shared.url, 'https://latest.supabase.co');
  assert.equal(merged.source_backends.arxiv.extra_flag, 'keep-latest');
}

function testMergeDraftConfigOntoLatestUsesStableIdsWhenProfileTagChanges() {
  const base = buildBaseConfig();
  base.subscriptions.intent_profiles[0].id = 'profile-gene';
  base.subscriptions.intent_profiles[0].keywords[0].id = 'kw-genetics';
  base.subscriptions.intent_profiles[0].intent_queries[0].id = 'iq-genetics';

  const draft = buildBaseConfig();
  draft.subscriptions.intent_profiles[0].id = 'profile-gene';
  draft.subscriptions.intent_profiles[0].tag = 'GENOMICS';
  draft.subscriptions.intent_profiles[0].keywords[0].id = 'kw-genetics';
  draft.subscriptions.intent_profiles[0].intent_queries[0].id = 'iq-genetics';

  const latest = buildBaseConfig();
  latest.subscriptions.intent_profiles[0].id = 'profile-gene';
  latest.subscriptions.intent_profiles[0].keywords[0].id = 'kw-genetics';
  latest.subscriptions.intent_profiles[0].keywords[0].embedding_cache = {
    embedding_json: '[0.4,0.5,0.6]',
  };
  latest.subscriptions.intent_profiles[0].intent_queries[0].id = 'iq-genetics';
  latest.subscriptions.intent_profiles[0].intent_queries.push({
    id: 'iq-remote',
    query: 'remote extra intent',
  });

  const merged = mergeDraftConfigOntoLatest(latest, draft, base);
  const profile = merged.subscriptions.intent_profiles[0];

  assert.equal(profile.tag, 'GENOMICS');
  assert.deepEqual(profile.keywords[0].embedding_cache, {
    embedding_json: '[0.4,0.5,0.6]',
  });
  assert.ok(profile.intent_queries.some((item) => item.query === 'remote extra intent'));
}

function testNormalizeSubscriptionsCreatesStableInternalIdsButStripsThemFromOutput() {
  const normalized = normalizeSubscriptions(buildBaseConfig());
  const profile = normalized.subscriptions.intent_profiles[0];

  assert.equal('id' in profile, false);
  assert.equal('id' in profile.keywords[0], false);
  assert.equal('id' in profile.intent_queries[0], false);
}

function testUpdateDraftConfigPreservesInternalIdsAcrossTagEdits() {
  const config = buildBaseConfig();
  config.subscriptions.intent_profiles[0].id = 'profile-gene';
  config.subscriptions.intent_profiles[0].keywords[0].id = 'kw-genetics';
  config.subscriptions.intent_profiles[0].intent_queries[0].id = 'iq-genetics';

  manager.updateDraftConfig(() => config);
  manager.updateDraftConfig((current) => {
    current.subscriptions.intent_profiles[0].tag = 'GENOMICS';
    current.subscriptions.intent_profiles[0].keywords[0].query = 'updated genetics query';
    current.subscriptions.intent_profiles[0].intent_queries[0].query = 'updated genetics intent';
    return current;
  });

  const draft = manager.getDraftConfig();
  const profile = draft.subscriptions.intent_profiles[0];

  assert.equal(profile.id, 'profile-gene');
  assert.equal(profile.tag, 'GENOMICS');
  assert.equal(profile.keywords[0].id, 'kw-genetics');
  assert.equal(profile.keywords[0].query, 'updated genetics query');
  assert.equal(profile.intent_queries[0].id, 'iq-genetics');
  assert.equal(profile.intent_queries[0].query, 'updated genetics intent');
}

async function testSaveDraftConfigUsesLoadedBaseSnapshotAndPersistsInternalIds() {
  const mathProfile = {
    tag: 'MATH',
    description: '数学',
    enabled: true,
    paper_sources: ['arxiv'],
    keywords: [{ keyword: 'algebra', query: 'algebra' }],
    intent_queries: [{ query: 'algebra preprints' }],
  };
  const loaded = buildBaseConfig();
  loaded.subscriptions.intent_profiles.push(mathProfile);

  let savedConfig = null;
  global.window.SubscriptionsSmartQuery = {
    render() {},
    clearPendingDeletedProfileIds() {},
  };
  global.window.SubscriptionsGithubToken = {
    async loadConfig() {
      return { config: loaded };
    },
    async updateConfig(updater) {
      const latest = buildBaseConfig();
      latest.subscriptions.intent_profiles.push(mathProfile);
      latest.subscriptions.intent_profiles.push({
        tag: 'NEW',
        description: '远端新增',
        enabled: true,
        paper_sources: ['arxiv'],
        keywords: [{ keyword: 'remote', query: 'remote' }],
        intent_queries: [{ query: 'remote only' }],
      });
      savedConfig = updater(latest);
      return { content: { sha: 'sha-final' } };
    },
  };

  await manager.loadSubscriptions();
  manager.updateDraftConfig((current) => {
    current.subscriptions.intent_profiles = current.subscriptions.intent_profiles.filter(
      (profile) => profile.tag === 'MATH',
    );
    return current;
  });
  await manager.__test.saveDraftConfig();

  const tags = savedConfig.subscriptions.intent_profiles.map((profile) => profile.tag).sort();
  assert.deepEqual(tags, ['MATH', 'NEW']);
  assert.ok(savedConfig.subscriptions.intent_profiles.every((profile) => 'id' in profile));
  assert.ok(savedConfig.subscriptions.intent_profiles.every((profile) => (
    profile.keywords || []).every((item) => 'id' in item)
  ));
  assert.ok(savedConfig.subscriptions.intent_profiles.every((profile) => (
    profile.intent_queries || []).every((item) => 'id' in item)
  ));

  const reloadedBase = manager.__test.getLoadedBaseConfig();
  const reloadedTags = reloadedBase.subscriptions.intent_profiles.map((profile) => profile.tag).sort();
  assert.deepEqual(reloadedTags, ['MATH', 'NEW']);
}

(async () => {
  testNormalizeSubscriptionsAddsBiorxivBackend();
  testNormalizeSubscriptionsPreservesCustomBiorxivBackendFields();
  testRunProfileQuickFetchPassesProfileTagToWorkflow();
  testRunProfileQuickFetchPreservesExplicitFilterConcurrency();
  testApplyQuickRunRerankDispatchInputsDefaultsLocalModel();
  testApplyQuickRunRerankDispatchInputsStripsModelForNonLocalProvider();
  testApplyQuickRunRerankDispatchInputsPreservesExplicitDispatchProviderAndModel();
  testRunProfileQuickFetchIncludesCustomDaysInTipOptions();
  await testWorkflowRunnerFallbackPreservesFetchModeForCustomDays();
  testMergeDraftConfigOntoLatestPreservesRemoteOnlyProfilesAndLatestCache();
  testMergeDraftConfigOntoLatestRespectsLocalProfileDeletion();
  testMergeDraftConfigOntoLatestKeepsLatestOnlyItemsWithinProfile();
  testMergeDraftConfigOntoLatestPreservesLatestNonProfileConfig();
  testMergeDraftConfigOntoLatestUsesStableIdsWhenProfileTagChanges();
  testNormalizeSubscriptionsCreatesStableInternalIdsButStripsThemFromOutput();
  testUpdateDraftConfigPreservesInternalIdsAcrossTagEdits();
  await testSaveDraftConfigUsesLoadedBaseSnapshotAndPersistsInternalIds();

  console.log('subscriptions manager tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
