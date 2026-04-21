const assert = require('node:assert/strict');

global.window = global.window || {};
global.window.jsyaml = global.window.jsyaml || {
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
};
global.window.jsYaml = global.window.jsyaml;
global.window.jsYAML = global.window.jsyaml;
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
  runQuickFetch,
  buildSeedPaperRequestPayload,
  isPdfFile,
  hasPdfSignature,
  getMaxSeedPaperBytes,
  setSeedSubmissionStateForTest,
  setQuickFetchSubmissionStateForTest,
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

async function testRunProfileQuickFetchPassesProfileTagToWorkflow() {
  const calls = [];
  global.window.DPRWorkflowRunner = {
    async runQuickFetchByDays(days, options) {
      calls.push({ days, options });
    },
  };

  const ok = await global.window.SubscriptionsManager.runProfileQuickFetch('GENE', 30, {
    fetchMode: 'skims',
  });

  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].days, 30);
  assert.equal(calls[0].options.fetchMode, 'skims');
  assert.equal(calls[0].options.dispatchInputs.profile_tag, 'GENE');
}

async function testRunProfileQuickFetchPreservesExplicitFilterConcurrency() {
  const calls = [];
  global.window.DPRWorkflowRunner = {
    async runQuickFetchByDays(days, options) {
      calls.push({ days, options });
    },
  };

  const ok = await global.window.SubscriptionsManager.runProfileQuickFetch('GENE', 30, {
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

async function testRunProfileQuickFetchIncludesCustomDaysInTipOptions() {
  const calls = [];
  global.window.DPRWorkflowRunner = {
    async runQuickFetchByDays(days, options) {
      calls.push({ days, options });
    },
  };

  const ok = await global.window.SubscriptionsManager.runProfileQuickFetch('GENE', 17, {
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

async function testRunProfileQuickFetchReturnsFalseWhenWorkflowDispatchFails() {
  const originalConsoleError = console.error;
  global.window.DPRWorkflowRunner = {
    async runQuickFetchByDays() {
      throw new Error('dispatch failed');
    },
  };

  try {
    console.error = () => {};
    const ok = await global.window.SubscriptionsManager.runProfileQuickFetch('GENE', 7, {
      fetchMode: 'skims',
    });
    assert.equal(ok, false);
  } finally {
    console.error = originalConsoleError;
  }
}

async function testRunQuickFetchShowsPendingStateUntilDispatchResolves() {
  const msgEl = {
    textContent: '',
    style: {},
  };
  let resolveDispatch = null;
  const calls = [];
  global.window.DPRWorkflowRunner = {
    runQuickFetchByDays(days, options) {
      calls.push({ days, options });
      return new Promise((resolve) => {
        resolveDispatch = resolve;
      });
    },
  };

  const pendingRun = runQuickFetch(12, msgEl, '已发起 12 天速览抓取任务（rerank: blt）。', {
    fetchMode: 'skims',
    rerankProvider: 'blt',
  });
  await Promise.resolve();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].days, 12);
  assert.equal(msgEl.textContent, '正在发起快速抓取任务...');
  assert.equal(msgEl.style.color, '#666');

  resolveDispatch();
  const ok = await pendingRun;

  assert.equal(ok, true);
  assert.equal(msgEl.textContent, '已发起 12 天速览抓取任务（rerank: blt）。');
  assert.equal(msgEl.style.color, '#080');
}

async function testRunQuickFetchRejectsReentryWhileDispatchIsPending() {
  const msgEl = {
    textContent: '',
    style: {},
  };
  let resolveDispatch = null;
  let callCount = 0;
  global.window.DPRWorkflowRunner = {
    runQuickFetchByDays() {
      callCount += 1;
      return new Promise((resolve) => {
        resolveDispatch = resolve;
      });
    },
  };

  const firstRun = runQuickFetch(12, msgEl, '已发起 12 天速览抓取任务（rerank: blt）。', {
    fetchMode: 'skims',
    rerankProvider: 'blt',
  });
  await Promise.resolve();

  const secondOk = await runQuickFetch(12, msgEl, '已发起 12 天速览抓取任务（rerank: blt）。', {
    fetchMode: 'skims',
    rerankProvider: 'blt',
  });

  assert.equal(secondOk, false);
  assert.equal(callCount, 1);
  assert.equal(msgEl.textContent, '快速抓取任务提交中，请稍候。');
  assert.equal(msgEl.style.color, '#666');

  resolveDispatch();
  const firstOk = await firstRun;

  assert.equal(firstOk, true);
  assert.equal(callCount, 1);
  assert.equal(msgEl.textContent, '已发起 12 天速览抓取任务（rerank: blt）。');
  assert.equal(msgEl.style.color, '#080');
}

async function testRunQuickFetchReturnsFalseWhileSubmissionLockIsSet() {
  const msgEl = {
    textContent: '',
    style: {},
  };
  global.window.DPRWorkflowRunner = {
    runQuickFetchByDays() {
      throw new Error('should not dispatch while quick fetch is locked');
    },
  };

  setQuickFetchSubmissionStateForTest(true);
  try {
    const ok = await runQuickFetch(12, msgEl, 'ignored', {
      fetchMode: 'skims',
      rerankProvider: 'blt',
    });

    assert.equal(ok, false);
    assert.equal(msgEl.textContent, '快速抓取任务提交中，请稍候。');
    assert.equal(msgEl.style.color, '#666');
  } finally {
    setQuickFetchSubmissionStateForTest(false);
  }
}

function testBuildSeedPaperRequestPayloadNormalizesFields() {
  const payload = buildSeedPaperRequestPayload({
    fileName: '  Test Paper.pdf ',
    relatedCount: '0',
    selectedTags: [' GENE ', '', 'GENE', 'MATH '],
    mode: 'DEEP',
    notes: '  focus on methods  ',
    sourcePath: 'archive/seed-papers/demo/seed.pdf',
  });

  assert.equal(payload.file_name, 'Test Paper.pdf');
  assert.equal(payload.related_count, 1);
  assert.deepEqual(payload.selected_tags, ['GENE', 'MATH']);
  assert.equal(payload.mode, 'deep');
  assert.equal(payload.notes, 'focus on methods');
  assert.equal(payload.source_path, 'archive/seed-papers/demo/seed.pdf');
}

function testBuildSeedPaperRequestPayloadDefaultsToSkimAndMaxCap() {
  const payload = buildSeedPaperRequestPayload({
    fileName: 'seed.pdf',
    relatedCount: '999',
    selectedTags: 'GENE',
    mode: 'weird',
  });

  assert.equal(payload.related_count, 20);
  assert.deepEqual(payload.selected_tags, ['GENE']);
  assert.equal(payload.mode, 'skim');
}

function testIsPdfFileRequiresPdfExtension() {
  assert.equal(isPdfFile({ name: 'paper.pdf', type: '' }), true);
  assert.equal(isPdfFile({ name: 'paper.pdf', type: 'application/pdf' }), true);
  assert.equal(isPdfFile({ name: 'paper.tmp', type: 'application/pdf' }), false);
  assert.equal(isPdfFile({ name: 'paper.txt', type: 'text/plain' }), false);
}

function testHasPdfSignatureRequiresPdfMagicBytes() {
  assert.equal(hasPdfSignature(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), true);
  assert.equal(hasPdfSignature(new ArrayBuffer(0)), false);
  assert.equal(hasPdfSignature(Uint8Array.from([0x50, 0x44, 0x46, 0x2d])), false);
  assert.equal(hasPdfSignature(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x20])), false);
}

async function testRunSeedPaperDiscoveryRejectsDuplicateSubmission() {
  setSeedSubmissionStateForTest(true);
  global.window.DPRWorkflowRunner = {
    runSeedPaperWorkflow() {
      throw new Error('should not run while submission is locked');
    },
  };
  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      throw new Error('should not build path while submission is locked');
    },
    writeRepoFile() {
      throw new Error('should not write while submission is locked');
    },
  };

  try {
    const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
      file: { name: 'paper.pdf', type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(0) },
    });
    assert.equal(ok, false);
  } finally {
    setSeedSubmissionStateForTest(false);
  }
}

async function testRunSeedPaperDiscoveryRejectsNonPdfFileBeforeUpload() {
  let writeAttempts = 0;
  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      throw new Error('should not derive repo path for non-pdf file');
    },
    async writeRepoFile() {
      writeAttempts += 1;
    },
  };
  global.window.DPRWorkflowRunner = {
    async runSeedPaperWorkflow() {
      throw new Error('should not dispatch workflow for non-pdf file');
    },
  };

  const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
    file: {
      name: 'notes.txt',
      type: 'text/plain',
      async arrayBuffer() {
        return new ArrayBuffer(4);
      },
    },
  });

  assert.equal(ok, false);
  assert.equal(writeAttempts, 0);
}

async function testRunSeedPaperDiscoveryRejectsOversizedPdfBeforeUpload() {
  let writeAttempts = 0;
  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      throw new Error('should not derive repo path for oversized pdf');
    },
    async writeRepoFile() {
      writeAttempts += 1;
    },
  };
  global.window.DPRWorkflowRunner = {
    async runSeedPaperWorkflow() {
      throw new Error('should not dispatch workflow for oversized pdf');
    },
  };

  const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
    file: {
      name: 'paper.pdf',
      type: 'application/pdf',
      size: getMaxSeedPaperBytes() + 1,
      async arrayBuffer() {
        return Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer;
      },
    },
  });

  assert.equal(ok, false);
  assert.equal(writeAttempts, 0);
}

async function testRunSeedPaperDiscoveryRejectsFakePdfBytesBeforeUpload() {
  let writeAttempts = 0;
  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      return {
        requestId: 'demo-request',
        requestPath: 'archive/seed-papers/demo-request/request.json',
        filePath: 'archive/seed-papers/demo-request/paper.pdf',
      };
    },
    async writeRepoFile() {
      writeAttempts += 1;
    },
    async verifyRepoFilesVisible() {
      throw new Error('should not verify fake pdf bytes');
    },
  };
  global.window.DPRWorkflowRunner = {
    async runSeedPaperWorkflow() {
      throw new Error('should not dispatch workflow for fake pdf bytes');
    },
  };

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
      file: {
        name: 'paper.pdf',
        type: 'application/pdf',
        async arrayBuffer() {
          return Uint8Array.from([0x6e, 0x6f, 0x74, 0x2d, 0x70, 0x64, 0x66]).buffer;
        },
      },
    });

    assert.equal(ok, false);
    assert.equal(writeAttempts, 0);
  } finally {
    console.error = originalConsoleError;
  }
}

async function testRunSeedPaperDiscoveryVerifiesFilesBeforeDispatch() {
  const callSequence = [];
  const uploadTargets = [];
  const writes = [];
  const verifications = [];
  const workflowCalls = [];
  const secretSyncCalls = [];
  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      return {
        requestId: 'demo-request',
        requestPath: 'archive/seed-papers/demo-request/request.json',
        filePath: 'archive/seed-papers/demo-request/paper.pdf',
      };
    },
    async prepareSeedPaperUploadTarget(options) {
      callSequence.push('prepare');
      uploadTargets.push(options);
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        token: 'demo-token',
        branch: 'main',
        ref: 'main',
      };
    },
    async writeRepoFile(options) {
      callSequence.push(`write:${options.path.endsWith('.pdf') ? 'pdf' : 'request'}`);
      writes.push(options);
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        branch: 'main',
        ref: 'main',
        path: options.path,
        fileSha: options.path.endsWith('.pdf') ? 'sha-pdf' : 'sha-request',
      };
    },
    async verifyRepoFilesVisible(options) {
      callSequence.push('verify');
      verifications.push(options);
      return {
        ref: 'main',
        allVisible: true,
        files: [
          { path: 'archive/seed-papers/demo-request/paper.pdf', exists: true, ref: 'main', fileSha: 'sha-pdf', matchesExpectedRef: true, matchesExpectedSha: true },
          { path: 'archive/seed-papers/demo-request/request.json', exists: true, ref: 'main', fileSha: 'sha-request', matchesExpectedRef: true, matchesExpectedSha: true },
        ],
      };
    },
  };
  global.window.DPRSecretSession = {
    async syncSessionSecretsToGithub(options) {
      callSequence.push('sync');
      secretSyncCalls.push(options);
      return {
        ok: true,
        skipped: false,
      };
    },
  };
  global.window.DPRWorkflowRunner = {
    async runSeedPaperWorkflow(options) {
      callSequence.push('dispatch');
      workflowCalls.push(options);
    },
  };

  const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
    file: {
      name: 'paper.pdf',
      type: 'application/pdf',
      size: 1024,
      async arrayBuffer() {
        return Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]).buffer;
      },
    },
    relatedCount: '3',
    mode: 'deep',
  });

  assert.equal(ok, true);
  // Verifies archive files before dispatch, then polls for docs visibility after dispatch
  const verifyBeforeDispatchIdx = callSequence.indexOf('verify');
  const dispatchIdx = callSequence.indexOf('dispatch');
  assert.ok(verifyBeforeDispatchIdx !== -1 && verifyBeforeDispatchIdx < dispatchIdx, 'archive files should be verified before dispatch');
  // After dispatch, there should be additional verification for docs visibility polling
  assert.ok(callSequence.lastIndexOf('verify') > dispatchIdx, 'docs visibility should be polled after dispatch');
  assert.deepEqual(uploadTargets, [
    {
      requestId: 'demo-request',
    },
  ]);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, 'archive/seed-papers/demo-request/paper.pdf');
  assert.equal(writes[1].path, 'archive/seed-papers/demo-request/request.json');
  assert.equal(writes[1].branch, 'main');
  // verifications[0] is for archive files (before dispatch)
  // verifications[1] is for docs visibility polling (after dispatch)
  assert.equal(verifications.length, 2, 'should have 2 verifications: archive pre-dispatch and docs post-dispatch');
  assert.equal(verifications[0].owner, 'dusker');
  assert.equal(verifications[0].repo, 'daily-paper-reader');
  assert.deepEqual(verifications[0].paths, [
    'archive/seed-papers/demo-request/paper.pdf',
    'archive/seed-papers/demo-request/request.json',
  ]);
  assert.equal(verifications[0].expectedFiles.length, 2);
  // verifications[1] is for docs visibility polling
  assert.equal(verifications[1].paths[0], 'docs/seed-papers/demo-request/index.md');
  assert.equal(verifications[1].paths[1], 'docs/seed-papers/demo-request/seed-paper.md');
  assert.equal(verifications[1].ref, 'main');
  assert.equal(secretSyncCalls.length, 1);
  assert.equal(secretSyncCalls[0].owner, 'dusker');
  assert.equal(secretSyncCalls[0].repo, 'daily-paper-reader');
  assert.equal(typeof secretSyncCalls[0].onProgress, 'function');
  assert.deepEqual(workflowCalls, [
    {
      requestId: 'demo-request',
      requestPath: 'archive/seed-papers/demo-request/request.json',
      seedMode: 'deep',
    },
  ]);
}

async function testRunSeedPaperDiscoveryPollsForPublishedPageAndNavigatesOnSuccess() {
  global.window.SubscriptionsManager.__test.setTestPollIntervalMs(50);
  const callSequence = [];
  let pollCount = 0;
  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      return {
        requestId: 'demo-request',
        requestPath: 'archive/seed-papers/demo-request/request.json',
        filePath: 'archive/seed-papers/demo-request/paper.pdf',
      };
    },
    async prepareSeedPaperUploadTarget() {
      callSequence.push('prepare');
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        token: 'demo-token',
        branch: 'main',
        ref: 'main',
      };
    },
    async writeRepoFile(options) {
      callSequence.push(`write:${options.path.endsWith('.pdf') ? 'pdf' : 'request'}`);
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        branch: 'main',
        ref: 'main',
        path: options.path,
        fileSha: options.path.endsWith('.pdf') ? 'sha-pdf' : 'sha-request',
      };
    },
    async verifyRepoFilesVisible(options) {
      pollCount += 1;
      callSequence.push(`poll:${pollCount}`);
      // Simulate docs/seed-papers visibility check
      if (options.paths && options.paths.some((p) => p.startsWith('docs/seed-papers'))) {
        if (pollCount < 3) {
          return { ref: 'main', allVisible: false, files: [] };
        }
        return { ref: 'main', allVisible: true, files: [] };
      }
      return { ref: 'main', allVisible: true, files: [] };
    },
  };
  global.window.DPRSecretSession = {
    async syncSessionSecretsToGithub() {
      callSequence.push('sync');
      return { ok: true, skipped: false };
    },
  };
  global.window.DPRWorkflowRunner = {
    async runSeedPaperWorkflow() {
      callSequence.push('dispatch');
    },
  };

  let finalHash = '';
  const originalLocation = global.window.location;
  global.window.location = {
    ...originalLocation,
    hash: '',
    get hash() { return finalHash; },
    set hash(val) { finalHash = val; },
  };

  try {
    const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
      file: {
        name: 'paper.pdf',
        type: 'application/pdf',
        size: 1024,
        async arrayBuffer() {
          return Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]).buffer;
        },
      },
    });

    assert.equal(ok, true);
    assert.ok(callSequence.includes('dispatch'), 'workflow should be dispatched');
    assert.ok(
      callSequence.some((c) => c.startsWith('poll:')),
      'should poll for docs/seed-papers visibility',
    );
    assert.equal(
      finalHash,
      '#/seed-papers/demo-request/index',
      'should navigate to seed page after docs become visible',
    );
  } finally {
    global.window.location = originalLocation;
    global.window.SubscriptionsManager.__test.setTestPollIntervalMs(null);
  }
}

// NOTE: testRunSeedPaperDiscoveryShowsTimeoutMessageWhenPageNotPublished uses
// setTestPollIntervalMs(50) to avoid real wall-clock delays during tests.
async function testRunSeedPaperDiscoveryShowsTimeoutMessageWhenPageNotPublished() {
  global.window.SubscriptionsManager.__test.setTestPollIntervalMs(50);
  try {
    global.window.SubscriptionsGithubToken = {
      buildSeedPaperRequestPath() {
        return {
          requestId: 'demo-request',
          requestPath: 'archive/seed-papers/demo-request/request.json',
          filePath: 'archive/seed-papers/demo-request/paper.pdf',
        };
      },
      async prepareSeedPaperUploadTarget() {
        return {
          owner: 'dusker',
          repo: 'daily-paper-reader',
          token: 'demo-token',
          branch: 'main',
          ref: 'main',
        };
      },
      async writeRepoFile(options) {
        return {
          owner: 'dusker',
          repo: 'daily-paper-reader',
          branch: 'main',
          ref: 'main',
          path: options.path,
          fileSha: 'sha-demo',
        };
      },
      async verifyRepoFilesVisible(options) {
        // First call is for archive files (must succeed to continue to dispatch)
        // Subsequent calls are for docs visibility polling (all return false for timeout test)
        if (options.paths && options.paths.some((p) => p.startsWith('archive/'))) {
          return { ref: 'main', allVisible: true, files: [] };
        }
        // Simulate all docs polls returning false (page not published)
        return { ref: 'main', allVisible: false, files: [] };
      },
    };
    global.window.DPRSecretSession = {
      async syncSessionSecretsToGithub() {
        return { ok: true, skipped: false };
      },
    };
    global.window.DPRWorkflowRunner = {
      async runSeedPaperWorkflow() {
        // No-op
      },
    };

    let finalHash = '';
    const originalLocation = global.window.location;
    global.window.location = {
      ...originalLocation,
      hash: '',
      get hash() { return finalHash; },
      set hash(val) { finalHash = val; },
    };

    let msgText = '';
    const msgEl = {
      get textContent() { return msgText; },
      set textContent(val) { msgText = val; },
      style: {},
    };

    try {
      const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
        file: {
          name: 'paper.pdf',
          type: 'application/pdf',
          size: 1024,
          async arrayBuffer() {
            return Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]).buffer;
          },
        },
      }, msgEl);

      assert.equal(ok, true);
      assert.equal(
        finalHash,
        '',
        'should NOT navigate when page is not published within timeout',
      );
      // seedPageUrl is `#/seed-papers/demo-request/index`, so timeout message should include full hash path
      assert.ok(
        msgText.includes('#/seed-papers/demo-request/index') || msgText.includes('页面已提交'),
        'timeout message should include seed page path',
      );
    } finally {
      global.window.location = originalLocation;
      global.window.SubscriptionsManager.__test.setTestPollIntervalMs(null);
    }
  } finally {
    // Always reset test poll interval
    global.window.SubscriptionsManager.__test.setTestPollIntervalMs(null);
  }
}

async function testRunSeedPaperDiscoveryStopsWhenUploadedFilesAreNotVisible() {
  const workflowCalls = [];
  const verifications = [];
  const secretSyncCalls = [];
  global.window.DPRSecretSession = {
    async syncSessionSecretsToGithub(options) {
      secretSyncCalls.push(options);
      return {
        ok: true,
        skipped: false,
      };
    },
  };
  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      return {
        requestId: 'demo-request',
        requestPath: 'archive/seed-papers/demo-request/request.json',
        filePath: 'archive/seed-papers/demo-request/paper.pdf',
      };
    },
    async prepareSeedPaperUploadTarget() {
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        branch: 'main',
        ref: 'main',
      };
    },
    async writeRepoFile(options) {
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        branch: 'main',
        ref: 'main',
        path: options.path,
        fileSha: options.path.endsWith('.pdf') ? 'sha-pdf' : 'sha-request',
      };
    },
    async verifyRepoFilesVisible(options) {
      verifications.push(options);
      return {
        ref: 'main',
        allVisible: false,
        files: [
          { path: 'archive/seed-papers/demo-request/paper.pdf', exists: true, ref: 'main', fileSha: 'sha-pdf', matchesExpectedRef: true, matchesExpectedSha: true },
          { path: 'archive/seed-papers/demo-request/request.json', exists: false, ref: 'main', fileSha: '', matchesExpectedRef: true, matchesExpectedSha: false },
        ],
      };
    },
  };
  global.window.DPRWorkflowRunner = {
    async runSeedPaperWorkflow(options) {
      workflowCalls.push(options);
    },
  };

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
      file: {
        name: 'paper.pdf',
        type: 'application/pdf',
        size: 1024,
        async arrayBuffer() {
          return Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]).buffer;
        },
      },
    });

    assert.equal(ok, false);
    assert.equal(secretSyncCalls.length, 1);
    assert.deepEqual(workflowCalls, []);
    assert.deepEqual(verifications, [
      {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        paths: [
          'archive/seed-papers/demo-request/paper.pdf',
          'archive/seed-papers/demo-request/request.json',
        ],
        expectedFiles: [
          {
            path: 'archive/seed-papers/demo-request/paper.pdf',
            ref: 'main',
            fileSha: 'sha-pdf',
          },
          {
            path: 'archive/seed-papers/demo-request/request.json',
            ref: 'main',
            fileSha: 'sha-request',
          },
        ],
      },
    ]);
  } finally {
    console.error = originalConsoleError;
  }
}

async function testRunSeedPaperDiscoveryContinuesWhenSessionSecretSyncIsSkipped() {
  const callSequence = [];
  const writes = [];
  const verifications = [];
  const workflowCalls = [];
  const secretSyncCalls = [];
  global.window.DPRSecretSession = {
    async syncSessionSecretsToGithub(options) {
      callSequence.push('sync');
      secretSyncCalls.push(options);
      return {
        ok: false,
        skipped: true,
        reason: 'missing_workflow_config',
      };
    },
  };
  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      return {
        requestId: 'demo-request',
        requestPath: 'archive/seed-papers/demo-request/request.json',
        filePath: 'archive/seed-papers/demo-request/paper.pdf',
      };
    },
    async prepareSeedPaperUploadTarget() {
      callSequence.push('prepare');
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        token: 'demo-token',
        branch: 'main',
        ref: 'main',
      };
    },
    async writeRepoFile(options) {
      callSequence.push(`write:${options.path.endsWith('.pdf') ? 'pdf' : 'request'}`);
      writes.push(options);
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        branch: 'main',
        ref: 'main',
        path: options.path,
        fileSha: options.path.endsWith('.pdf') ? 'sha-pdf' : 'sha-request',
      };
    },
    async verifyRepoFilesVisible(options) {
      callSequence.push('verify');
      verifications.push(options);
      return {
        ref: 'main',
        allVisible: true,
        files: [],
      };
    },
  };
  global.window.DPRWorkflowRunner = {
    async runSeedPaperWorkflow(options) {
      callSequence.push('dispatch');
      workflowCalls.push(options);
    },
  };

  const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
    file: {
      name: 'paper.pdf',
      type: 'application/pdf',
      size: 1024,
      async arrayBuffer() {
        return Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]).buffer;
      },
    },
    relatedCount: '3',
    mode: 'deep',
  });

  assert.equal(ok, true);
  // Verifies archive files before dispatch, then polls for docs visibility after dispatch
  const verifyBeforeDispatchIdx = callSequence.indexOf('verify');
  const dispatchIdx = callSequence.indexOf('dispatch');
  assert.ok(verifyBeforeDispatchIdx !== -1 && verifyBeforeDispatchIdx < dispatchIdx, 'archive files should be verified before dispatch');
  // After dispatch, there should be additional verification for docs visibility polling
  assert.ok(callSequence.lastIndexOf('verify') > dispatchIdx, 'docs visibility should be polled after dispatch');
  assert.equal(secretSyncCalls.length, 1);
  assert.equal(secretSyncCalls[0].token, 'demo-token');
  assert.equal(secretSyncCalls[0].owner, 'dusker');
  assert.equal(secretSyncCalls[0].repo, 'daily-paper-reader');
  assert.equal(writes.length, 2);
  // This test also has the polling verification after dispatch
  assert.ok(verifications.length >= 1, 'should have at least 1 verification for archive files');
  assert.deepEqual(workflowCalls, [
    {
      requestId: 'demo-request',
      requestPath: 'archive/seed-papers/demo-request/request.json',
      seedMode: 'deep',
    },
  ]);
}

async function testRunSeedPaperDiscoveryFailsClosedOnUnexpectedSecretSyncResult() {
  const callSequence = [];
  const writes = [];
  const workflowCalls = [];
  const secretSyncCalls = [];
  global.window.DPRSecretSession = {
    async syncSessionSecretsToGithub(options) {
      callSequence.push('sync');
      secretSyncCalls.push(options);
      return {
        ok: false,
        skipped: false,
      };
    },
  };
  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      return {
        requestId: 'demo-request',
        requestPath: 'archive/seed-papers/demo-request/request.json',
        filePath: 'archive/seed-papers/demo-request/paper.pdf',
      };
    },
    async prepareSeedPaperUploadTarget() {
      callSequence.push('prepare');
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        token: 'demo-token',
        branch: 'main',
        ref: 'main',
      };
    },
    async writeRepoFile(options) {
      callSequence.push(`write:${options.path}`);
      writes.push(options);
      return {
        owner: 'dusker',
        repo: 'daily-paper-reader',
        branch: 'main',
        ref: 'main',
      };
    },
    async verifyRepoFilesVisible() {
      callSequence.push('verify');
      return {
        ref: 'main',
        allVisible: true,
        files: [],
      };
    },
  };
  global.window.DPRWorkflowRunner = {
    async runSeedPaperWorkflow(options) {
      callSequence.push('dispatch');
      workflowCalls.push(options);
    },
  };

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
      file: {
        name: 'paper.pdf',
        type: 'application/pdf',
        size: 1024,
        async arrayBuffer() {
          return Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]).buffer;
        },
      },
      relatedCount: '3',
      mode: 'deep',
    });

    assert.equal(ok, false);
    assert.deepEqual(callSequence, ['prepare', 'sync']);
    assert.equal(secretSyncCalls.length, 1);
    assert.equal(secretSyncCalls[0].token, 'demo-token');
    assert.equal(secretSyncCalls[0].owner, 'dusker');
    assert.equal(secretSyncCalls[0].repo, 'daily-paper-reader');
    assert.equal(writes.length, 0);
    assert.deepEqual(workflowCalls, []);
  } finally {
    console.error = originalConsoleError;
  }
}

async function testRunSeedPaperDiscoveryDispatchesTrustedWorkflowWithoutRequestRefInput() {
  global.window.decoded_secret_private = {};
  const secretSyncCalls = [];
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
    async syncSessionSecretsToGithub(options) {
      secretSyncCalls.push(options);
      return {
        ok: true,
        skipped: false,
      };
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const defaultBranch = 'feature-seed';
  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url === 'https://api.github.com/user') {
      return buildJsonResponse(200, { login: 'demo-user' });
    }
    if (url === 'https://api.github.com/repos/demo-user/daily-paper-reader') {
      return buildJsonResponse(200, { fork: true, default_branch: defaultBranch });
    }
    if (url.includes('/actions/workflows/seed-paper-related.yml/runs?per_page=5')) {
      return buildJsonResponse(200, { workflow_runs: [] });
    }
    if (url.includes('/dispatches')) {
      return new Response('', { status: 200, statusText: 'OK' });
    }
    if (url.includes('/actions/workflows/seed-paper-related.yml/runs?event=workflow_dispatch&per_page=10')) {
      return buildJsonResponse(200, {
        workflow_runs: [
          {
            id: 901,
            run_number: 77,
            status: 'completed',
            conclusion: 'success',
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
    if (url.includes('/actions/runs/901/jobs?per_page=100')) {
      return buildJsonResponse(200, { jobs: [] });
    }
    if (url.includes('/actions/runs/901')) {
      return buildJsonResponse(200, {
        id: 901,
        run_number: 77,
        status: 'completed',
        conclusion: 'success',
        created_at: new Date().toISOString(),
      });
    }
    if (url.includes('/actions/workflows/seed-paper-related.yml/runs?per_page=12')) {
      return buildJsonResponse(200, { workflow_runs: [] });
    }
    return buildJsonResponse(200, {});
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  global.window.SubscriptionsGithubToken = {
    buildSeedPaperRequestPath() {
      return {
        requestId: 'demo-request',
        requestPath: 'archive/seed-papers/demo-request/request.json',
        filePath: 'archive/seed-papers/demo-request/paper.pdf',
      };
    },
    async prepareSeedPaperUploadTarget() {
      return {
        owner: 'demo-user',
        repo: 'daily-paper-reader',
        branch: defaultBranch,
        ref: defaultBranch,
      };
    },
    async writeRepoFile(options) {
      return {
        owner: 'demo-user',
        repo: 'daily-paper-reader',
        branch: defaultBranch,
        ref: defaultBranch,
        path: options.path,
        fileSha: options.path.endsWith('.pdf') ? 'sha-pdf' : 'sha-request',
      };
    },
    async verifyRepoFilesVisible(options) {
      assert.deepEqual(options, {
        owner: 'demo-user',
        repo: 'daily-paper-reader',
        paths: [
          'archive/seed-papers/demo-request/paper.pdf',
          'archive/seed-papers/demo-request/request.json',
        ],
        expectedFiles: [
          {
            path: 'archive/seed-papers/demo-request/paper.pdf',
            ref: defaultBranch,
            fileSha: 'sha-pdf',
          },
          {
            path: 'archive/seed-papers/demo-request/request.json',
            ref: defaultBranch,
            fileSha: 'sha-request',
          },
        ],
      });
      return {
        ref: defaultBranch,
        allVisible: true,
        files: [
          { path: 'archive/seed-papers/demo-request/paper.pdf', exists: true, ref: defaultBranch, fileSha: 'sha-pdf', matchesExpectedRef: true, matchesExpectedSha: true },
          { path: 'archive/seed-papers/demo-request/request.json', exists: true, ref: defaultBranch, fileSha: 'sha-request', matchesExpectedRef: true, matchesExpectedSha: true },
        ],
      };
    },
  };

  const ok = await global.window.SubscriptionsManager.runSeedPaperDiscovery({
    file: {
      name: 'paper.pdf',
      type: 'application/pdf',
      size: 1024,
      async arrayBuffer() {
        return Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]).buffer;
      },
    },
    relatedCount: '3',
    mode: 'deep',
  });

  assert.equal(ok, true);
  const dispatchCall = calls.find((entry) => entry.url.includes('/dispatches'));
  assert.ok(dispatchCall, 'should dispatch seed workflow after upload verification');
  const body = JSON.parse(dispatchCall.init.body);
  assert.equal(body.ref, defaultBranch);
  assert.equal(body.inputs.request_id, 'demo-request');
  assert.equal(body.inputs.request_path, 'archive/seed-papers/demo-request/request.json');
  assert.equal(body.inputs.seed_mode, 'deep');
  assert.equal('request_ref' in body.inputs, false);
  assert.equal(secretSyncCalls.length, 1);
}

function setupWorkflowRunnerDom() {
  const elementMap = {};
  const createClassList = (initial = []) => {
    const classes = new Set(initial);
    return {
      add(...names) {
        names.filter(Boolean).forEach((name) => classes.add(name));
      },
      remove(...names) {
        names.filter(Boolean).forEach((name) => classes.delete(name));
      },
      toggle(name, force) {
        if (!name) return false;
        if (force === true) {
          classes.add(name);
          return true;
        }
        if (force === false) {
          classes.delete(name);
          return false;
        }
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      },
      contains(name) {
        return classes.has(name);
      },
    };
  };
  const createDomNode = (id = '', attributes = {}) => {
    let innerHTML = '';
    const listeners = {};
    const attrs = { ...attributes };
    const node = {
      id,
      textContent: '',
      style: {},
      _recentButtons: [],
      _bound: false,
      classList: createClassList(),
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
      async click() {
        if (typeof listeners.click === 'function') {
          return listeners.click();
        }
        return undefined;
      },
      getAttribute(name) {
        return attrs[name] || '';
      },
      setAttribute(name, value) {
        attrs[name] = String(value);
      },
      querySelector(selector) {
        if (selector === '.dpr-wf-recent-block') {
          return innerHTML.includes('dpr-wf-recent-block') ? {} : null;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '.dpr-wf-recent-item') {
          return node._recentButtons;
        }
        if (selector === '.dpr-wf-recent-item.is-active') {
          return node._recentButtons.filter((button) => button.classList.contains('is-active'));
        }
        return [];
      },
    };
    Object.defineProperty(node, 'innerHTML', {
      get() {
        return innerHTML;
      },
      set(value) {
        innerHTML = String(value || '');
        if (id !== 'dpr-workflow-recent') {
          return;
        }
        const matches = Array.from(
          innerHTML.matchAll(/<button class="([^"]*dpr-wf-recent-item[^"]*)" data-run-id="([^"]+)"/g),
        );
        node._recentButtons = matches.map((match) => {
          const button = createDomNode('', { 'data-run-id': match[2] });
          match[1].split(/\s+/).filter(Boolean).forEach((name) => button.classList.add(name));
          return button;
        });
      },
    });
    return node;
  };
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
  return elementMap;
}

function createWorkflowRunnerFetchStub(calls, options = {}) {
  const {
    runId = 123,
    runStatus = 'completed',
    runConclusion = 'success',
    recentRunStatus = runStatus,
    recentRunConclusion = runConclusion,
    repoOwner = 'demo-user',
    repoName = 'daily-paper-reader',
    userLogin = 'demo-user',
    configGithub = null,
    accessibleRepos = null,
  } = options;
  const repoCandidates = Array.isArray(accessibleRepos) && accessibleRepos.length
    ? accessibleRepos
    : [{ owner: repoOwner, name: repoName, cname: 'mirror.example.com', fork: true, defaultBranch: 'main' }];
  const findRepoCandidate = (owner, name) => repoCandidates.find(
    (entry) => entry && entry.owner === owner && entry.name === name,
  );
  return async (url, init = {}) => {
    calls.push({ url, init });
    if (url === 'https://api.github.com/user') {
      return buildJsonResponse(200, { login: userLogin });
    }
    if (url === 'https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member') {
      return buildJsonResponse(200, repoCandidates.map((entry) => ({
        name: entry.name,
        owner: { login: entry.owner },
      })));
    }
    if (url === 'config.yaml' || url === 'docs/config.yaml' || url === '../config.yaml') {
      if (!configGithub) {
        return buildJsonResponse(404, { message: 'Not Found' }, 'Not Found');
      }
      return new Response(`github:\n  owner: '${configGithub.owner || ''}'\n  repo: '${configGithub.repo || ''}'\n`, {
        status: 200,
        headers: {
          'Content-Type': 'text/yaml',
        },
      });
    }
    const pagesMatch = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/pages$/);
    if (pagesMatch) {
      const owner = decodeURIComponent(pagesMatch[1]);
      const name = decodeURIComponent(pagesMatch[2]);
      const repo = findRepoCandidate(owner, name);
      if (!repo) {
        return buildJsonResponse(404, { message: 'Not Found' }, 'Not Found');
      }
      return buildJsonResponse(200, { cname: repo.cname || 'mirror.example.com' });
    }
    const repoMatch = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)$/);
    if (repoMatch) {
      const owner = decodeURIComponent(repoMatch[1]);
      const name = decodeURIComponent(repoMatch[2]);
      const repo = findRepoCandidate(owner, name);
      if (!repo) {
        return buildJsonResponse(404, { message: 'Not Found' }, 'Not Found');
      }
      return buildJsonResponse(200, {
        fork: repo.fork !== undefined ? repo.fork : true,
        default_branch: repo.defaultBranch || 'main',
      });
    }
    if (url.includes('/actions/workflows/daily-paper-reader.yml/runs?per_page=5')) {
      return buildJsonResponse(200, { workflow_runs: [] });
    }
    if (url.includes('/actions/workflows/daily-paper-reader.yml/runs?per_page=12')) {
      return buildJsonResponse(200, {
        workflow_runs: [
          {
            id: runId,
            run_number: 45,
            status: recentRunStatus,
            conclusion: recentRunConclusion,
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
    if (url.includes('/dispatches')) {
      return new Response('', { status: 200, statusText: 'OK' });
    }
    if (url.includes('/actions/workflows/daily-paper-reader.yml/runs?event=workflow_dispatch&per_page=10')) {
      return buildJsonResponse(200, {
        workflow_runs: [
          {
            id: runId,
            run_number: 45,
            status: recentRunStatus,
            conclusion: recentRunConclusion,
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
    if (url.includes(`/actions/runs/${runId}/jobs?per_page=100`)) {
      return buildJsonResponse(200, { jobs: [] });
    }
    if (url.includes(`/actions/runs/${runId}`)) {
      return buildJsonResponse(200, {
        id: runId,
        run_number: 45,
        status: runStatus,
        conclusion: runConclusion,
        created_at: new Date().toISOString(),
      });
    }
    return buildJsonResponse(200, {});
  };
}

async function withWorkflowRunnerIntervalCapture(run) {
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const intervalCalls = [];
  global.setInterval = (...args) => {
    intervalCalls.push(args);
    return { fake: true };
  };
  global.clearInterval = () => {};
  try {
    await run(intervalCalls);
  } finally {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
  return intervalCalls;
}

async function flushAsyncWork(iterations = 3) {
  for (let i = 0; i < iterations; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function testWorkflowRunnerDoesNotStartPollingForCompletedRun() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = createWorkflowRunnerFetchStub(calls, 123);

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  const intervalCalls = await withWorkflowRunnerIntervalCapture(async () => {
    await global.window.DPRWorkflowRunner.runQuickFetchByDays(17, {
      fetchMode: 'standard',
      dispatchInputs: {
        profile_tag: 'GENE',
      },
    });
  });

  assert.equal(intervalCalls.length, 0);
}

async function setupWorkflowRunnerWithRecentRun(fetchOptions = {}) {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: fetchOptions.href || 'http://localhost:3000/',
  };
  const dom = setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = createWorkflowRunnerFetchStub(calls, fetchOptions);

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  await withWorkflowRunnerIntervalCapture(async () => {
    await global.window.DPRWorkflowRunner.runQuickFetchByDays(17, {
      fetchMode: 'standard',
      dispatchInputs: {
        profile_tag: 'GENE',
      },
    });
  });
  await flushAsyncWork();

  const recentEl = dom['dpr-workflow-recent'];
  const recentButtons = recentEl.querySelectorAll('.dpr-wf-recent-item');
  assert.ok(recentButtons.length > 0, 'should render recent workflow buttons');

  return {
    dom,
    calls,
    recentButtons,
  };
}

async function testWorkflowRunnerDoesNotStartPollingWhenSelectingCompletedRecentRun() {
  const { recentButtons } = await setupWorkflowRunnerWithRecentRun({ runId: 321 });

  const intervalCalls = await withWorkflowRunnerIntervalCapture(async () => {
    await recentButtons[0].click();
  });

  assert.equal(intervalCalls.length, 0);
}

async function testWorkflowRunnerTrustedGithubPagesUsesPageRepo() {
  const { calls } = await setupWorkflowRunnerWithRecentRun({
    href: 'https://dusker.github.io/daily-paper-reader/#/',
    repoOwner: 'dusker',
    repoName: 'daily-paper-reader',
  });

  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/repos/dusker/daily-paper-reader'), true);
  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/repos/demo-user/daily-paper-reader'), false);
}

async function testWorkflowRunnerCustomDomainUsesConfigRepo() {
  const { calls } = await setupWorkflowRunnerWithRecentRun({
    href: 'https://mirror.example.com/#/',
    userLogin: 'demo-user',
    repoOwner: 'mirror-owner',
    repoName: 'mirror-repo',
    configGithub: {
      owner: 'mirror-owner',
      repo: 'mirror-repo',
    },
  });

  assert.equal(calls.some((entry) => entry.url === 'config.yaml'), true);
  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/repos/mirror-owner/mirror-repo'), true);
  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/repos/demo-user/daily-paper-reader'), false);
}

async function testWorkflowRunnerCustomDomainDiscoversRepoWhenConfigOwnerBlank() {
  const { calls } = await setupWorkflowRunnerWithRecentRun({
    href: 'https://mirror.example.com/#/',
    userLogin: 'demo-user',
    configGithub: {
      owner: '',
      repo: 'daily-paper-reader',
    },
    accessibleRepos: [
      {
        owner: 'demo-user',
        name: 'daily-paper-reader',
        cname: 'other.example.com',
      },
      {
        owner: 'Dusker233',
        name: 'daily-paper-reader',
        cname: 'mirror.example.com',
      },
    ],
  });

  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member'), true);
  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/repos/Dusker233/daily-paper-reader/pages'), true);
  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/repos/Dusker233/daily-paper-reader'), true);
  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/repos/demo-user/daily-paper-reader'), false);
}

async function testWorkflowRunnerOpenDoesNotFetchExtraRecentRunInputs() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  global.fetch = async (url, init = {}) => {
    if (url === 'https://api.github.com/user') {
      return buildJsonResponse(200, { login: 'demo-user' });
    }
    if (url === 'https://api.github.com/repos/demo-user/daily-paper-reader') {
      return buildJsonResponse(200, { fork: true, default_branch: 'main' });
    }
    if (url.includes('/actions/workflows/daily-paper-reader.yml/runs?per_page=12')) {
      return buildJsonResponse(200, {
        workflow_runs: [
          {
            id: 321,
            run_number: 45,
            status: 'completed',
            conclusion: 'success',
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
    if (url.includes('/actions/workflows/sync.yml/runs?per_page=12')
      || url.includes('/actions/workflows/reset-content.yml/runs?per_page=12')
      || url.includes('/actions/workflows/seed-paper-related.yml/runs?per_page=12')) {
      return buildJsonResponse(200, { workflow_runs: [] });
    }
    if (url.includes('/actions/runs/321')) {
      throw new Error(`unexpected run detail fetch: ${url}`);
    }
    return buildJsonResponse(200, {});
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  global.window.DPRWorkflowRunner.open();
  await flushAsyncWork();
}

async function testWorkflowRunnerStartsPollingForActiveDispatchRun() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = createWorkflowRunnerFetchStub(calls, {
    runId: 456,
    runStatus: 'in_progress',
    runConclusion: '',
    recentRunStatus: 'in_progress',
    recentRunConclusion: '',
  });

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  const intervalCalls = await withWorkflowRunnerIntervalCapture(async () => {
    await global.window.DPRWorkflowRunner.runQuickFetchByDays(17, {
      fetchMode: 'standard',
      dispatchInputs: {
        profile_tag: 'GENE',
      },
    });
  });

  assert.equal(intervalCalls.length, 1);
}

async function testWorkflowRunnerStartsPollingWhenSelectingActiveRecentRun() {
  const { recentButtons } = await setupWorkflowRunnerWithRecentRun({
    runId: 654,
    runStatus: 'in_progress',
    runConclusion: '',
    recentRunStatus: 'in_progress',
    recentRunConclusion: '',
  });

  const intervalCalls = await withWorkflowRunnerIntervalCapture(async () => {
    await recentButtons[0].click();
  });

  assert.equal(intervalCalls.length, 1);
}

async function testWorkflowRunnerRunSeedPaperWorkflowIncludesValidatedRequestInputs() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url === 'https://api.github.com/user') {
      return buildJsonResponse(200, { login: 'demo-user' });
    }
    if (url === 'https://api.github.com/repos/demo-user/daily-paper-reader') {
      return buildJsonResponse(200, { fork: true, default_branch: 'main' });
    }
    if (url.includes('/actions/workflows/seed-paper-related.yml/runs?per_page=5')) {
      return buildJsonResponse(200, { workflow_runs: [] });
    }
    if (url.includes('/dispatches')) {
      return new Response('', { status: 200, statusText: 'OK' });
    }
    if (url.includes('/actions/workflows/seed-paper-related.yml/runs?event=workflow_dispatch&per_page=10')) {
      return buildJsonResponse(200, {
        workflow_runs: [
          {
            id: 789,
            run_number: 11,
            status: 'completed',
            conclusion: 'success',
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
    if (url.includes('/actions/runs/789/jobs?per_page=100')) {
      return buildJsonResponse(200, { jobs: [] });
    }
    if (url.includes('/actions/runs/789')) {
      return buildJsonResponse(200, {
        id: 789,
        run_number: 11,
        status: 'completed',
        conclusion: 'success',
        created_at: new Date().toISOString(),
      });
    }
    if (url.includes('/actions/workflows/seed-paper-related.yml/runs?per_page=12')) {
      return buildJsonResponse(200, { workflow_runs: [] });
    }
    return buildJsonResponse(200, {});
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  await global.window.DPRWorkflowRunner.runSeedPaperWorkflow({
    requestId: 'demo-request',
    requestPath: 'archive/seed-papers/demo-request/request.json',
    seedMode: 'deep',
  }, {
    related_limit: '5',
    request_id: 'override-request',
    request_path: '../evil.json',
    seed_mode: 'skim',
  });

  const dispatchCall = calls.find((entry) => entry.url.includes('/dispatches'));
  assert.ok(dispatchCall, 'should dispatch seed workflow');
  const body = JSON.parse(dispatchCall.init.body);
  assert.equal(body.ref, 'main');
  assert.equal(body.inputs.request_id, 'demo-request');
  assert.equal(body.inputs.request_path, 'archive/seed-papers/demo-request/request.json');
  assert.equal('request_ref' in body.inputs, false);
  assert.equal(body.inputs.seed_mode, 'deep');
  assert.equal(body.inputs.related_limit, '5');
}

async function testWorkflowRunnerRunSeedPaperWorkflowRejectsInvalidRequestPath() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return buildJsonResponse(200, {});
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  await assert.rejects(
    () => global.window.DPRWorkflowRunner.runSeedPaperWorkflow({
      requestId: 'demo-request',
      requestPath: '../request.json',
      seedMode: 'deep',
    }),
    /非法的 seed request_path/u,
  );
  assert.equal(calls.length, 0);
}

async function testWorkflowRunnerRunSeedPaperWorkflowRejectsLegacyRequestPath() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return buildJsonResponse(200, {});
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  await assert.rejects(
    () => global.window.DPRWorkflowRunner.runSeedPaperWorkflow({
      requestId: 'demo-request',
      requestPath: 'requests/seed_papers/demo-request/request.json',
      seedMode: 'deep',
    }),
    /非法的 seed request_path/u,
  );
  assert.equal(calls.some((entry) => entry.url.includes('/dispatches')), false);
}

async function testWorkflowRunnerRunSeedPaperWorkflowRejectsMismatchedRequestPath() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return buildJsonResponse(200, {});
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  await assert.rejects(
    () => global.window.DPRWorkflowRunner.runSeedPaperWorkflow({
      requestId: 'demo-request',
      requestPath: 'archive/seed-papers/other-request/request.json',
      seedMode: 'deep',
    }),
    /seed request_path 与 request_id 不匹配/u,
  );
  assert.equal(calls.some((entry) => entry.url.includes('/dispatches')), false);
}

async function testWorkflowRunnerRunSeedPaperWorkflowRejectsMissingRequestPath() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return buildJsonResponse(200, {});
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  await assert.rejects(
    () => global.window.DPRWorkflowRunner.runSeedPaperWorkflow({
      requestId: 'demo-request',
      seedMode: 'deep',
    }),
    /缺少 seed request_path/u,
  );
  assert.equal(calls.some((entry) => entry.url.includes('/dispatches')), false);
}

async function testWorkflowRunnerRejectsCustomDomainWithoutConfig() {
  await flushAsyncWork();
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'https://mirror.example.com/daily-paper-reader/',
  };
  const dom = setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url === 'https://api.github.com/user') {
      return buildJsonResponse(200, { login: 'demo-user' });
    }
    if (url === 'config.yaml' || url === 'docs/config.yaml' || url === '../config.yaml') {
      return buildJsonResponse(404, { message: 'Not Found' }, 'Not Found');
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  await global.window.DPRWorkflowRunner.runSeedPaperWorkflow({
    requestId: 'demo-request',
    requestPath: 'archive/seed-papers/demo-request/request.json',
    seedMode: 'deep',
  });

  assert.equal(calls.some((entry) => entry.url === 'https://api.github.com/user'), true);
  assert.equal(calls.some((entry) => entry.url === 'config.yaml'), true);
  assert.equal(calls.some((entry) => entry.url.includes('/dispatches')), false);
  assert.match(dom['dpr-workflow-status'].textContent, /无法推断目标仓库/u);
}

function testWorkflowRunnerFallbackPreservesFetchModeForCustomDays() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'demo-token';
    },
  };
  global.window.localStorage = {
    getItem() {
      return '';
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

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

async function testWorkflowRunnerIgnoresPersistedPatFallback() {
  let localStorageReads = 0;
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return '';
    },
  };
  global.window.DPR_RUNTIME_GITHUB_TOKEN = '';
  global.window.localStorage = {
    getItem() {
      localStorageReads += 1;
      return JSON.stringify({ token: 'ghp_legacy_should_not_be_used' });
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return buildJsonResponse(200, {});
  };

  delete require.cache[require.resolve('../app/workflows.runner.js')];
  require('../app/workflows.runner.js');

  await global.window.DPRWorkflowRunner.runQuickFetchByDays(17, {
    fetchMode: 'standard',
    dispatchInputs: {
      profile_tag: 'GENE',
    },
  });

  assert.equal(localStorageReads, 0);
  assert.equal(calls.length, 0);
}

function testWorkflowRunnerUsesSecretSessionGithubToken() {
  global.window.decoded_secret_private = {};
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'ghp_secret_session';
    },
  };
  global.window.DPR_RUNTIME_GITHUB_TOKEN = '';
  global.window.localStorage = {
    getItem() {
      throw new Error('should not read localStorage fallback');
    },
  };
  global.window.location = {
    href: 'http://localhost:3000/',
  };
  setupWorkflowRunnerDom();

  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url === 'https://api.github.com/user') {
      assert.equal(init.headers.Authorization, 'token ghp_secret_session');
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
      return buildJsonResponse(200, { workflow_runs: [] });
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
    assert.ok(dispatchCall, 'should dispatch workflow with secret session token');
    assert.equal(dispatchCall.init.headers.Authorization, 'token ghp_secret_session');
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
  await testWorkflowRunnerDoesNotStartPollingForCompletedRun();
  await testWorkflowRunnerDoesNotStartPollingWhenSelectingCompletedRecentRun();
  await testWorkflowRunnerTrustedGithubPagesUsesPageRepo();
  await testWorkflowRunnerCustomDomainUsesConfigRepo();
  await testWorkflowRunnerCustomDomainDiscoversRepoWhenConfigOwnerBlank();
  await testWorkflowRunnerOpenDoesNotFetchExtraRecentRunInputs();
  await testWorkflowRunnerStartsPollingForActiveDispatchRun();
  await testWorkflowRunnerStartsPollingWhenSelectingActiveRecentRun();
  await testWorkflowRunnerRunSeedPaperWorkflowIncludesValidatedRequestInputs();
  await testWorkflowRunnerRunSeedPaperWorkflowRejectsInvalidRequestPath();
  await testWorkflowRunnerRunSeedPaperWorkflowRejectsLegacyRequestPath();
  await testWorkflowRunnerRunSeedPaperWorkflowRejectsMismatchedRequestPath();
  await testWorkflowRunnerRunSeedPaperWorkflowRejectsMissingRequestPath();
  await testWorkflowRunnerRejectsCustomDomainWithoutConfig();
  await testRunProfileQuickFetchPassesProfileTagToWorkflow();
  await testRunProfileQuickFetchPreservesExplicitFilterConcurrency();
  testApplyQuickRunRerankDispatchInputsDefaultsLocalModel();
  testApplyQuickRunRerankDispatchInputsStripsModelForNonLocalProvider();
  testApplyQuickRunRerankDispatchInputsPreservesExplicitDispatchProviderAndModel();
  await testRunProfileQuickFetchIncludesCustomDaysInTipOptions();
  await testRunProfileQuickFetchReturnsFalseWhenWorkflowDispatchFails();
  await testRunQuickFetchShowsPendingStateUntilDispatchResolves();
  await testRunQuickFetchRejectsReentryWhileDispatchIsPending();
  await testRunQuickFetchReturnsFalseWhileSubmissionLockIsSet();
  testBuildSeedPaperRequestPayloadNormalizesFields();
  testBuildSeedPaperRequestPayloadDefaultsToSkimAndMaxCap();
  testIsPdfFileRequiresPdfExtension();
  testHasPdfSignatureRequiresPdfMagicBytes();
  await testRunSeedPaperDiscoveryRejectsDuplicateSubmission();
  await testRunSeedPaperDiscoveryRejectsNonPdfFileBeforeUpload();
  await testRunSeedPaperDiscoveryRejectsOversizedPdfBeforeUpload();
  await testRunSeedPaperDiscoveryRejectsFakePdfBytesBeforeUpload();
  await testRunSeedPaperDiscoveryVerifiesFilesBeforeDispatch();
  await testRunSeedPaperDiscoveryStopsWhenUploadedFilesAreNotVisible();
  await testRunSeedPaperDiscoveryPollsForPublishedPageAndNavigatesOnSuccess();
  await testRunSeedPaperDiscoveryShowsTimeoutMessageWhenPageNotPublished();
  await testRunSeedPaperDiscoveryContinuesWhenSessionSecretSyncIsSkipped();
  await testRunSeedPaperDiscoveryFailsClosedOnUnexpectedSecretSyncResult();
  await testRunSeedPaperDiscoveryDispatchesTrustedWorkflowWithoutRequestRefInput();
  await testWorkflowRunnerFallbackPreservesFetchModeForCustomDays();
  await testWorkflowRunnerIgnoresPersistedPatFallback();
  await testWorkflowRunnerUsesSecretSessionGithubToken();
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
