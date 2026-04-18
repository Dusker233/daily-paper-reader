// 订阅管理总模块（智能 Query）
// 负责：
// 1) 维护本地草稿配置
// 2) 统一渲染 intent_profiles
// 3) 保存前仅保留 intent_profiles

window.SubscriptionsManager = (function () {
  const MAX_KEYWORDS_PER_PROFILE = 6;
  const MAX_INTENT_QUERIES_PER_PROFILE = 4;
  let overlay = null;
  let panel = null;
  let saveBtn = null;
  let closeBtn = null;
  let msgEl = null;
  let quickRunDaysSelect = null;
  let quickRunModeSelect = null;
  let quickRunRerankSelect = null;
  let quickRunRunBtn = null;
  let quickRunOpenWorkflowPanelBtn = null;
  let quickRunSeedFileInput = null;
  let quickRunSeedCountInput = null;
  let quickRunSeedModeSelect = null;
  let quickRunSeedTagsInput = null;
  let quickRunSeedNotesInput = null;
  let quickRunSeedRunBtn = null;
  let quickRunConferenceBtn = null;
  let quickRunYearSelect = null;
  let quickRunConferenceSelect = null;
  let quickRunMsgEl = null;
  let resetContentBtn = null;
  let resetContentMsgEl = null;

  let draftConfig = null;
  let loadedBaseConfig = null;
  let hasUnsavedChanges = false;
  let isSavingDraftConfig = false;
  let isSubmittingSeedPaper = false;

  const defaultPromptTemplate = [
    'You are a retrieval planning assistant.',
    '标签 (Tag): {{TAG}}',
    '中文描述 (Description): {{USER_DESCRIPTION}}',
    'Retrieval context: {{RETRIEVAL_CONTEXT}}',
    '',
    'Return JSON only:',
    '{',
    '  "tag": "optional tag suggestion (for user convenience)",',
    '  "description": "optional Chinese description (for user convenience)",',
    '  "keywords": [',
    '    {',
      '      "keyword": "short keyword phrase for BM25 recall",',
      '      "query": "semantic rewrite for this keyword",',
      '      "keyword_cn": "中文直译（可选）",',
    '    },',
    '  ],',
    '  "intent_queries": [',
    '    {',
      '      "query": "intent-oriented semantic query 1",',
      '      "query_cn": "中文直译（可选）",',
    '    },',
    '    {',
      '      "query": "intent-oriented semantic query 2",',
      '      "query_cn": "中文直译（可选）",',
    '    }',
    '  ],',
    '}',
    'Requirements:',
    '1) keywords: output 5-12 objects; each item must include keyword and query, keyword_cn optional.',
    '2) keywords are used for recall and should be atomic phrases (prefer 1-3 core words).',
    '3) Avoid coupling core terms (e.g., "symbolic regression", "reinforcement learning", "genetic programming", "Transformer") with extra qualifiers into one keyword. Keep core terms atomic in keyword and use query for full intent.',
    '4) Suggested example:',
    '   {"keyword":"symbolic regression","query":"deep symbolic regression methods","keyword_cn":"符号回归","query_cn":"符号回归深度方法"},',
    '   {"keyword":"reinforcement learning","query":"policy gradient symbolic regression","keyword_cn":"强化学习","query_cn":"策略梯度在符号回归中的应用"},',
    '   {"keyword":"MCTS","query":"MCTS for symbolic regression"}',
    '5) intent_queries: output 1-4 actionable intent queries. Each item should include query and optional query_cn.',
    '6) Do not output extra fields like must_have / optional / exclude / rewrite_for_embedding / must_have.',
    '7) Return pure JSON only, no explanations.',
    '8) Tag suggestion should be concise, preferably under 6 characters.',
  ].join('\n');

  const QUICK_RUN_CONFERENCES = [
    'ACL',
    'AAAI',
    'COLING',
    'EMNLP',
    'ICCV',
    'ICLR',
    'ICML',
    'IJCAI',
    'NeurIPS',
    'SIGIR',
  ];
  const QUICK_RUN_DEFAULT_DAYS = '10';
  const QUICK_RUN_DEFAULT_FETCH_MODE = 'skims';
  const QUICK_RUN_DEFAULT_RERANK_PROVIDER = 'blt';
  const SEED_PAPER_DEFAULT_RELATED_COUNT = 5;
  const SEED_PAPER_MAX_RELATED_COUNT = 20;

  const normalizeText = (v) => String(v || '').trim();
  const normalizeSourceKey = (v) => normalizeText(v).toLowerCase();
  const toStableId = (value) => {
    const text = normalizeText(value).toLowerCase();
    const slug = text
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();
    return slug || 'item';
  };
  const buildInternalId = (prefix, currentId, seed, fallback) => {
    const existing = normalizeText(currentId);
    if (existing) return toStableId(existing);
    return `${prefix}-${toStableId(seed || fallback || prefix)}`;
  };

  const cloneDeep = (obj) => {
    try {
      return JSON.parse(JSON.stringify(obj || {}));
    } catch {
      return obj || {};
    }
  };

  const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

  const PAPER_SOURCE_ORDER = [
    'arxiv',
    'biorxiv',
    'medrxiv',
    'chemrxiv',
    'neurips',
    'iclr',
    'icml',
    'acl',
    'emnlp',
    'aaai',
  ];
  const DEFAULT_LOCAL_RERANK_MODEL = 'BAAI/bge-reranker-v2-m3';
  const VISIBLE_PAPER_SOURCES = PAPER_SOURCE_ORDER.slice();
  const SOURCE_BACKEND_DEFAULTS = {
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
    biorxiv: {
      papers_table: 'biorxiv_papers',
      use_vector_rpc: true,
      vector_rpc: 'match_biorxiv_papers_exact',
      vector_rpc_exact: 'match_biorxiv_papers_exact',
      use_bm25_rpc: true,
      bm25_rpc: 'match_biorxiv_papers_bm25',
      schema: 'public',
    },
    medrxiv: {
      papers_table: 'medrxiv_papers',
      use_vector_rpc: true,
      vector_rpc: 'match_medrxiv_papers_exact',
      vector_rpc_exact: 'match_medrxiv_papers_exact',
      use_bm25_rpc: true,
      bm25_rpc: 'match_medrxiv_papers_bm25',
      schema: 'public',
    },
    chemrxiv: {
      papers_table: 'chemrxiv_papers',
      use_vector_rpc: true,
      vector_rpc: 'match_chemrxiv_papers_exact',
      vector_rpc_exact: 'match_chemrxiv_papers_exact',
      use_bm25_rpc: true,
      bm25_rpc: 'match_chemrxiv_papers_bm25',
      schema: 'public',
    },
    neurips: {
      papers_table: 'neurips_openreview_papers',
      use_vector_rpc: true,
      vector_rpc: 'match_neurips_openreview_papers_exact',
      vector_rpc_exact: 'match_neurips_openreview_papers_exact',
      use_bm25_rpc: true,
      bm25_rpc: 'match_neurips_openreview_papers_bm25',
      schema: 'public',
    },
    iclr: {
      papers_table: 'iclr_openreview_papers',
      use_vector_rpc: true,
      vector_rpc: 'match_iclr_openreview_papers_exact',
      vector_rpc_exact: 'match_iclr_openreview_papers_exact',
      use_bm25_rpc: true,
      bm25_rpc: 'match_iclr_openreview_papers_bm25',
      schema: 'public',
    },
    icml: {
      papers_table: 'icml_openreview_papers',
      use_vector_rpc: true,
      vector_rpc: 'match_icml_openreview_papers_exact',
      vector_rpc_exact: 'match_icml_openreview_papers_exact',
      use_bm25_rpc: true,
      bm25_rpc: 'match_icml_openreview_papers_bm25',
      schema: 'public',
    },
    acl: {
      papers_table: 'acl_papers',
      use_vector_rpc: true,
      vector_rpc: 'match_acl_papers_exact',
      vector_rpc_exact: 'match_acl_papers_exact',
      use_bm25_rpc: true,
      bm25_rpc: 'match_acl_papers_bm25',
      schema: 'public',
    },
    emnlp: {
      papers_table: 'emnlp_papers',
      use_vector_rpc: true,
      vector_rpc: 'match_emnlp_papers_exact',
      vector_rpc_exact: 'match_emnlp_papers_exact',
      use_bm25_rpc: true,
      bm25_rpc: 'match_emnlp_papers_bm25',
      schema: 'public',
    },
    aaai: {
      papers_table: 'aaai_papers',
      use_vector_rpc: true,
      vector_rpc: 'match_aaai_papers_exact',
      vector_rpc_exact: 'match_aaai_papers_exact',
      use_bm25_rpc: true,
      bm25_rpc: 'match_aaai_papers_bm25',
      schema: 'public',
    },
  };

  const filterVisiblePaperSources = (values) => {
    const visible = new Set(VISIBLE_PAPER_SOURCES);
    return (Array.isArray(values) ? values : []).filter((value) => visible.has(normalizeSourceKey(value)));
  };

  const getAvailablePaperSources = (config) => {
    const cfg = config && typeof config === 'object' ? config : {};
    const rawBackends = cfg.source_backends && typeof cfg.source_backends === 'object'
      ? cfg.source_backends
      : {};
    const seen = new Set();
    const out = [];
    const pushSource = (key, definition, fallbackEnabled = true) => {
      const normalized = normalizeSourceKey(key);
      if (!normalized || seen.has(normalized)) return;
      const enabled = isPlainObject(definition)
        ? definition.enabled !== false
        : fallbackEnabled;
      if (!enabled) return;
      seen.add(normalized);
      out.push(normalized);
    };
    pushSource('arxiv', rawBackends.arxiv, true);
    Object.keys(rawBackends || {}).forEach((key) => {
      pushSource(key, rawBackends[key], true);
    });
    if (window.DPR_RUNTIME_SOURCE_BACKENDS && typeof window.DPR_RUNTIME_SOURCE_BACKENDS === 'object') {
      Object.keys(window.DPR_RUNTIME_SOURCE_BACKENDS || {}).forEach((key) => {
        pushSource(key, window.DPR_RUNTIME_SOURCE_BACKENDS[key], true);
      });
    }
    const visibleOut = filterVisiblePaperSources(out);
    visibleOut.sort((a, b) => {
      const idxA = PAPER_SOURCE_ORDER.indexOf(a);
      const idxB = PAPER_SOURCE_ORDER.indexOf(b);
      const rankA = idxA >= 0 ? idxA : Number.MAX_SAFE_INTEGER;
      const rankB = idxB >= 0 ? idxB : Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });
    return visibleOut;
  };

  const normalizePaperSources = (values, options = {}) => {
    const fallbackToArxiv = options.fallbackToArxiv !== false;
    const rawList = Array.isArray(values)
      ? values
      : (typeof values === 'string' && values ? [values] : []);
    const seen = new Set();
    const out = [];
    rawList.forEach((value) => {
      const key = normalizeSourceKey(value);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(key);
    });
    const visibleOut = filterVisiblePaperSources(out);
    if (!visibleOut.length && fallbackToArxiv) {
      return ['arxiv'];
    }
    return visibleOut;
  };

  const mergeDefinedFields = (base, override) => {
    const next = { ...(isPlainObject(base) ? base : {}) };
    if (!isPlainObject(override)) return next;
    Object.keys(override).forEach((key) => {
      const value = override[key];
      if (value === undefined) return;
      next[key] = value;
    });
    return next;
  };

  const buildDefaultSourceBackend = (sourceKey, config) => {
    const normalizedKey = normalizeSourceKey(sourceKey);
    const defaults = SOURCE_BACKEND_DEFAULTS[normalizedKey];
    if (!defaults) return null;

    const cfg = isPlainObject(config) ? config : {};
    const shared = isPlainObject(cfg.supabase_shared) ? cfg.supabase_shared : {};
    const legacy = isPlainObject(cfg.supabase) ? cfg.supabase : {};

    let base = {
      kind: normalizeText(shared.kind || legacy.kind || 'supabase') || 'supabase',
      enabled: shared.enabled !== false && legacy.enabled !== false,
      url: normalizeText(shared.url || legacy.url || ''),
      anon_key: normalizeText(shared.anon_key || legacy.anon_key || ''),
      schema: normalizeText(shared.schema || legacy.schema || defaults.schema || 'public') || 'public',
    };

    if (normalizedKey === 'arxiv') {
      base = mergeDefinedFields(base, {
        enabled: Object.prototype.hasOwnProperty.call(legacy, 'enabled') ? legacy.enabled !== false : undefined,
        papers_table: normalizeText(legacy.papers_table || ''),
        use_vector_rpc: Object.prototype.hasOwnProperty.call(legacy, 'use_vector_rpc') ? legacy.use_vector_rpc !== false : undefined,
        vector_rpc: normalizeText(legacy.vector_rpc || ''),
        vector_rpc_exact: normalizeText(legacy.vector_rpc_exact || legacy.vector_rpc || ''),
        use_bm25_rpc: Object.prototype.hasOwnProperty.call(legacy, 'use_bm25_rpc') ? legacy.use_bm25_rpc !== false : undefined,
        bm25_rpc: normalizeText(legacy.bm25_rpc || ''),
        sync_table: normalizeText(legacy.sync_table || ''),
        sync_success_value: normalizeText(legacy.sync_success_value || ''),
      });
    }

    return mergeDefinedFields(defaults, base);
  };

  const ensureSourceBackendsForProfiles = (config) => {
    const next = isPlainObject(config) ? config : {};
    const subs = isPlainObject(next.subscriptions) ? next.subscriptions : {};
    const profiles = Array.isArray(subs.intent_profiles) ? subs.intent_profiles : [];
    const existingBackends = isPlainObject(next.source_backends) ? next.source_backends : {};
    const mergedBackends = cloneDeep(existingBackends);
    let changed = !isPlainObject(next.source_backends);

    profiles.forEach((profile) => {
      if (!isPlainObject(profile)) return;
      const fallbackToArxiv = !Object.prototype.hasOwnProperty.call(profile, 'paper_sources');
      const paperSources = normalizePaperSources(profile.paper_sources, { fallbackToArxiv });
      paperSources.forEach((sourceKey) => {
        const template = buildDefaultSourceBackend(sourceKey, next);
        if (!template) return;
        const current = isPlainObject(mergedBackends[sourceKey]) ? mergedBackends[sourceKey] : {};
        const merged = mergeDefinedFields(template, current);
        const before = JSON.stringify(current);
        const after = JSON.stringify(merged);
        if (before !== after) {
          mergedBackends[sourceKey] = merged;
          changed = true;
        }
      });
    });

    if (changed) {
      next.source_backends = mergedBackends;
    }
    return next;
  };

  const normalizeKeywordItem = (item) => {
    if (typeof item === 'string') {
      const text = normalizeText(item);
      if (!text) return null;
      return {
        keyword: text,
        keyword_cn: '',
        query: text,
      };
    }
    if (!item || typeof item !== 'object') return null;

    const keyword = normalizeText(item.keyword || item.expr || item.text || '');
    if (!keyword) return null;
    const query = normalizeText(
      item.query ||
        item.rewrite ||
        item.rewrite_for_embedding ||
        item.text ||
        item.keyword ||
        '',
    );
    const keywordCn = normalizeText(item.keyword_cn || item.keyword_zh || item.zh || '');
    const currentId = normalizeText(item.id || '');

    return {
      ...(currentId ? { id: currentId } : {}),
      keyword,
      keyword_cn: keywordCn,
      query: query || keyword,
      embedding_cache:
        item.embedding_cache && typeof item.embedding_cache === 'object'
          ? cloneDeep(item.embedding_cache)
          : undefined,
    };
  };

  const dedupeKeywords = (items) => {
    const list = Array.isArray(items) ? items : [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const key = normalizeText(item.keyword || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };

  const normalizeIntentQueryItem = (item) => {
    if (typeof item === 'string') {
      const query = normalizeText(item);
      if (!query) return null;
      return {
        query,
        query_cn: '',
        enabled: true,
        source: 'manual',
      };
    }
    if (!item || typeof item !== 'object') return null;

    const query = normalizeText(item.query || item.text || item.keyword || item.expr || '');
    if (!query) return null;
    const queryCn = normalizeText(item.query_cn || item.query_zh || item.zh || item.note || '');
    const currentId = normalizeText(item.id || '');

    return {
      ...(currentId ? { id: currentId } : {}),
      query,
      query_cn: queryCn,
      enabled: item.enabled !== false,
      source: normalizeText(item.source || 'manual'),
      note: normalizeText(item.note || ''),
      embedding_cache:
        item.embedding_cache && typeof item.embedding_cache === 'object'
          ? cloneDeep(item.embedding_cache)
          : undefined,
    };
  };

  const normalizeIntentQueries = (items) => {
    const list = Array.isArray(items) ? items : [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
      const normalized = normalizeIntentQueryItem(item);
      if (!normalized) continue;
      const key = normalizeText(normalized.query).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
    return out;
  };

  const fillQuickRunOptions = (yearSelectEl, confSelectEl) => {
    if (yearSelectEl && !yearSelectEl._dprQuickRunOptionsFilled) {
      yearSelectEl._dprQuickRunOptionsFilled = true;
      const currentYear = new Date().getFullYear();
      for (let y = currentYear; y >= currentYear - 8; y -= 1) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = String(y);
        yearSelectEl.appendChild(opt);
      }
    }

    if (confSelectEl && !confSelectEl._dprQuickRunOptionsFilled) {
      confSelectEl._dprQuickRunOptionsFilled = true;
      QUICK_RUN_CONFERENCES.forEach((name) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        confSelectEl.appendChild(opt);
      });
    }
  };

  const refreshQuickRunButtons = () => {
    const blocked = hasUnsavedChanges;
    const seedBlocked = blocked || isSubmittingSeedPaper;
    [
      quickRunDaysSelect,
      quickRunModeSelect,
      quickRunRerankSelect,
      quickRunRunBtn,
    ].forEach((control) => {
      if (!control) return;
      control.disabled = blocked;
      if (control.classList && typeof control.classList.toggle === 'function') {
        control.classList.toggle('chat-quick-run-item--disabled', blocked);
      }
      control.title = blocked
        ? '请先点击“保存”后再发起快速抓取。'
        : (control.getAttribute('data-default-title') || control.textContent || '');
    });
    [
      quickRunSeedFileInput,
      quickRunSeedCountInput,
      quickRunSeedModeSelect,
      quickRunSeedTagsInput,
      quickRunSeedNotesInput,
      quickRunSeedRunBtn,
    ].forEach((control) => {
      if (!control) return;
      control.disabled = seedBlocked;
      if (control.classList && typeof control.classList.toggle === 'function') {
        control.classList.toggle('chat-quick-run-item--disabled', seedBlocked);
      }
      control.title = blocked
        ? '请先点击“保存”后再上传种子论文。'
        : (isSubmittingSeedPaper
          ? '种子论文请求提交中，请稍候。'
          : (control.getAttribute('data-default-title') || control.textContent || ''));
    });
    if (blocked && quickRunMsgEl) {
      quickRunMsgEl.textContent = '检测到未保存修改，请先保存后再发起快速抓取。';
      quickRunMsgEl.style.color = '#c00';
    }
  };

  const setQuickRunMessage = (text, color) => {
    if (quickRunMsgEl) {
      quickRunMsgEl.textContent = text || '';
      quickRunMsgEl.style.color = color || '#666';
    }
    if (msgEl && msgEl !== quickRunMsgEl) {
      msgEl.textContent = text || '';
      msgEl.style.color = color || '#666';
    }
  };

  const normalizeQuickRunDays = (value) => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return QUICK_RUN_DEFAULT_DAYS;
    return String(Math.min(30, Math.max(1, parsed)));
  };

  const normalizeQuickRunFetchMode = (value) => {
    const mode = normalizeText(value).toLowerCase();
    if (mode === 'standard' || mode === 'skims') {
      return mode;
    }
    return QUICK_RUN_DEFAULT_FETCH_MODE;
  };

  const normalizeQuickRunRerankProvider = (value) => {
    const provider = normalizeText(value).toLowerCase();
    if (provider === 'local' || provider === 'blt' || provider === 'none') {
      return provider;
    }
    return '';
  };

  const applyQuickRunRerankDispatchInputs = (runOptions) => {
    const options = isPlainObject(runOptions) ? cloneDeep(runOptions) : {};
    const dispatchInputs = isPlainObject(options.dispatchInputs) ? { ...options.dispatchInputs } : {};
    const explicitProvider = normalizeQuickRunRerankProvider(dispatchInputs.rerank_provider);
    const explicitModel = normalizeText(dispatchInputs.rerank_model || '');
    const provider = explicitProvider || normalizeQuickRunRerankProvider(options.rerankProvider);
    if (!provider) {
      if (Object.keys(dispatchInputs).length) {
        options.dispatchInputs = dispatchInputs;
      } else {
        delete options.dispatchInputs;
      }
      return options;
    }

    options.dispatchInputs = {
      ...dispatchInputs,
      rerank_provider: provider,
    };
    if (provider === 'local') {
      options.dispatchInputs.rerank_model = explicitModel || normalizeText(options.rerankModel || '') || DEFAULT_LOCAL_RERANK_MODEL;
    } else if (Object.prototype.hasOwnProperty.call(options.dispatchInputs, 'rerank_model')) {
      delete options.dispatchInputs.rerank_model;
    }
    return options;
  };

  const normalizeSeedPaperRelatedCount = (value) => {
    const raw = normalizeText(value);
    if (!raw) {
      return SEED_PAPER_DEFAULT_RELATED_COUNT;
    }
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return SEED_PAPER_DEFAULT_RELATED_COUNT;
    }
    return Math.min(SEED_PAPER_MAX_RELATED_COUNT, Math.max(1, parsed));
  };

  const normalizeSeedPaperMode = (value) => {
    const mode = normalizeText(value).toLowerCase();
    if (mode === 'skim' || mode === 'deep' || mode === 'both') {
      return mode;
    }
    return 'skim';
  };

  const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const MAX_SEED_PAPER_BYTES = 50 * 1024 * 1024;

  const isPdfFile = (file) => {
    if (!file || typeof file !== 'object') {
      return false;
    }
    const fileName = normalizeText(file.name || '').toLowerCase();
    if (!fileName.endsWith('.pdf')) {
      return false;
    }
    const fileType = normalizeText(file.type || '').toLowerCase();
    return !fileType || fileType === 'application/pdf';
  };

  const hasPdfSignature = (bufferLike) => {
    if (!bufferLike || typeof bufferLike !== 'object') {
      return false;
    }
    const view = bufferLike instanceof Uint8Array
      ? bufferLike
      : bufferLike instanceof ArrayBuffer
        ? new Uint8Array(bufferLike)
        : ArrayBuffer.isView(bufferLike)
          ? new Uint8Array(bufferLike.buffer, bufferLike.byteOffset, bufferLike.byteLength)
          : null;
    if (!view || view.length < PDF_MAGIC_BYTES.length) {
      return false;
    }
    return PDF_MAGIC_BYTES.every((byte, index) => view[index] === byte);
  };

  const normalizeSeedPaperTags = (value) => {
    const items = Array.isArray(value)
      ? value
      : String(value || '').split(/[,\n]/);
    const seen = new Set();
    const out = [];
    items.forEach((item) => {
      const normalized = normalizeText(item);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      out.push(normalized);
    });
    return out;
  };

  const buildSeedPaperRequestPayload = (requestOptions) => {
    const options = isPlainObject(requestOptions) ? cloneDeep(requestOptions) : {};
    return {
      file_name: normalizeText(options.fileName || options.file_name || ''),
      source_path: normalizeText(options.sourcePath || options.source_path || ''),
      related_count: normalizeSeedPaperRelatedCount(options.relatedCount || options.related_count),
      selected_tags: normalizeSeedPaperTags(options.selectedTags || options.selected_tags),
      mode: normalizeSeedPaperMode(options.mode),
      notes: normalizeText(options.notes || ''),
      created_at: normalizeText(options.createdAt || options.created_at) || new Date().toISOString(),
    };
  };

  const runSeedPaperDiscovery = async (requestOptions, msgEl) => {
    if (isSubmittingSeedPaper) {
      setQuickRunMessage('种子论文请求正在提交中，请勿重复点击。', '#666');
      return false;
    }
    if (hasUnsavedChanges) {
      const text = '检测到未保存修改，请先点击“保存”后再上传种子论文。';
      setQuickRunMessage(text, '#c00');
      return false;
    }
    if (!window.SubscriptionsGithubToken || typeof window.SubscriptionsGithubToken.buildSeedPaperRequestPath !== 'function' || typeof window.SubscriptionsGithubToken.prepareSeedPaperUploadTarget !== 'function' || typeof window.SubscriptionsGithubToken.writeRepoFile !== 'function' || typeof window.SubscriptionsGithubToken.verifyRepoFilesVisible !== 'function') {
      setQuickRunMessage('GitHub 仓库写入能力未加载，无法提交种子论文请求。', '#c00');
      return false;
    }
    if (!window.DPRWorkflowRunner || typeof window.DPRWorkflowRunner.runSeedPaperWorkflow !== 'function') {
      setQuickRunMessage('工作流触发器未加载到当前页面。', '#c00');
      return false;
    }

    const file = requestOptions && requestOptions.file;
    if (!file || typeof file.arrayBuffer !== 'function') {
      setQuickRunMessage('请先选择要上传的 PDF 文件。', '#c00');
      return false;
    }
    if (!isPdfFile(file)) {
      setQuickRunMessage('仅支持上传 PDF 文件，请重新选择。', '#c00');
      return false;
    }
    if (Number(file.size || 0) > MAX_SEED_PAPER_BYTES) {
      setQuickRunMessage('上传的 PDF 过大，请控制在 50MB 以内。', '#c00');
      return false;
    }

    const pathInfo = window.SubscriptionsGithubToken.buildSeedPaperRequestPath({
      requestId: requestOptions.requestId || `${Date.now()}`,
      fileName: file.name || 'seed-paper.pdf',
    });
    const payload = buildSeedPaperRequestPayload({
      ...requestOptions,
      fileName: file.name,
      sourcePath: pathInfo.filePath,
    });

    try {
      isSubmittingSeedPaper = true;
      if (quickRunSeedRunBtn) {
        quickRunSeedRunBtn.disabled = true;
      }
      setQuickRunMessage('正在上传种子论文请求...', '#666');
      const fileBuffer = await file.arrayBuffer();
      if (!hasPdfSignature(fileBuffer)) {
        throw new Error('上传文件内容不是有效的 PDF。');
      }
      const uploadTarget = await window.SubscriptionsGithubToken.prepareSeedPaperUploadTarget({
        requestId: pathInfo.requestId,
      });
      if (window.DPRSecretSession && typeof window.DPRSecretSession.syncSessionSecretsToGithub === 'function') {
        setQuickRunMessage('正在同步当前会话的 GitHub Secrets...', '#666');
        const syncResult = await window.DPRSecretSession.syncSessionSecretsToGithub({
          token: uploadTarget && uploadTarget.token ? uploadTarget.token : undefined,
          owner: uploadTarget && uploadTarget.owner ? uploadTarget.owner : undefined,
          repo: uploadTarget && uploadTarget.repo ? uploadTarget.repo : undefined,
          onProgress: (current, total) => {
            setQuickRunMessage(`(${current}/${total}) 正在同步 GitHub Secrets...`, '#666');
          },
        });
        if (syncResult && syncResult.skipped === true) {
          setQuickRunMessage('当前会话未提供可复用的 LLM 配置，正在继续使用仓库中已有的 GitHub Secrets 上传请求。', '#666');
        } else if (!syncResult || syncResult.ok !== true) {
          throw new Error('当前会话 GitHub Secrets 同步失败，请稍后重试。');
        } else {
          setQuickRunMessage('正在上传种子论文请求...', '#666');
        }
      }
      const pdfWrite = await window.SubscriptionsGithubToken.writeRepoFile({
        owner: uploadTarget && uploadTarget.owner ? uploadTarget.owner : undefined,
        repo: uploadTarget && uploadTarget.repo ? uploadTarget.repo : undefined,
        branch: uploadTarget && uploadTarget.branch ? uploadTarget.branch : undefined,
        path: pathInfo.filePath,
        contentBytes: fileBuffer,
        commitMessage: `chore: add seed paper upload ${pathInfo.requestId}`,
      });
      const requestWrite = await window.SubscriptionsGithubToken.writeRepoFile({
        owner: uploadTarget && uploadTarget.owner ? uploadTarget.owner : undefined,
        repo: uploadTarget && uploadTarget.repo ? uploadTarget.repo : undefined,
        path: pathInfo.requestPath,
        contentText: JSON.stringify(payload, null, 2),
        commitMessage: `chore: add seed paper request ${pathInfo.requestId}`,
        branch: pdfWrite && pdfWrite.branch ? pdfWrite.branch : (uploadTarget && uploadTarget.branch ? uploadTarget.branch : undefined),
      });
      const requestRef = String(
        (requestWrite && (requestWrite.ref || requestWrite.branch))
        || (pdfWrite && (pdfWrite.ref || pdfWrite.branch))
        || '',
      ).trim();
      const repoVisibility = await window.SubscriptionsGithubToken.verifyRepoFilesVisible({
        owner: requestWrite && requestWrite.owner ? requestWrite.owner : undefined,
        repo: requestWrite && requestWrite.repo ? requestWrite.repo : undefined,
        ref: requestRef,
        paths: [pathInfo.filePath, pathInfo.requestPath],
        expectedFiles: [
          {
            path: pathInfo.filePath,
            ref: pdfWrite && (pdfWrite.ref || pdfWrite.branch) ? (pdfWrite.ref || pdfWrite.branch) : requestRef,
            fileSha: pdfWrite && pdfWrite.fileSha ? pdfWrite.fileSha : '',
          },
          {
            path: pathInfo.requestPath,
            ref: requestWrite && (requestWrite.ref || requestWrite.branch) ? (requestWrite.ref || requestWrite.branch) : requestRef,
            fileSha: requestWrite && requestWrite.fileSha ? requestWrite.fileSha : '',
          },
        ],
      });
      if (!repoVisibility || repoVisibility.allVisible !== true) {
        throw new Error('种子论文文件上传后暂未在 archive 目录可见，请稍后重试。');
      }
      await window.DPRWorkflowRunner.runSeedPaperWorkflow({
        requestId: pathInfo.requestId,
        requestPath: pathInfo.requestPath,
        seedMode: payload.mode,
      });
      const finalTip = `已提交种子论文请求（${payload.related_count} 篇，模式：${payload.mode}）。`;
      if (msgEl) {
        msgEl.textContent = finalTip;
        msgEl.style.color = '#080';
      }
      setQuickRunMessage(finalTip, '#080');
      return true;
    } catch (error) {
      console.error(error);
      const text = `提交种子论文请求失败：${error && error.message ? error.message : '未知错误'}`;
      if (msgEl) {
        msgEl.textContent = text;
        msgEl.style.color = '#c00';
      }
      setQuickRunMessage(text, '#c00');
      return false;
    } finally {
      isSubmittingSeedPaper = false;
      refreshQuickRunButtons();
    }
  };

  const runQuickFetch = (days, msgEl, tipText, runOptions) => {
    if (hasUnsavedChanges) {
      const text = '检测到未保存修改，请先点击“保存”后再发起快速抓取。';
      if (msgEl) {
        msgEl.textContent = text;
        msgEl.style.color = '#c00';
      }
      setQuickRunMessage(text, '#c00');
      return false;
    }
    if (!window.DPRWorkflowRunner || typeof window.DPRWorkflowRunner.runQuickFetchByDays !== 'function') {
      const text = '工作流触发器未加载到当前页面。';
      if (msgEl) {
        msgEl.textContent = text;
        msgEl.style.color = '#c00';
      }
      setQuickRunMessage(text, '#c00');
      return false;
    }
    const options = applyQuickRunRerankDispatchInputs(runOptions);
    window.DPRWorkflowRunner.runQuickFetchByDays(days, options);
    const finalTip = (typeof tipText === 'string' ? tipText : null) || `已发起 ${days} 天内抓取任务。`;
    if (msgEl) {
      msgEl.textContent = finalTip;
      msgEl.style.color = '#080';
    }
    setQuickRunMessage(finalTip, '#080');
    return true;
  };

  const runProfileQuickFetch = (profileTag, days, runOptions) => {
    const normalizedTag = normalizeText(profileTag);
    if (!normalizedTag) {
      setQuickRunMessage('词条标签为空，无法发起单词条抓取。', '#c00');
      return false;
    }
    const options = applyQuickRunRerankDispatchInputs(runOptions);
    const dispatchInputs = isPlainObject(options.dispatchInputs) ? options.dispatchInputs : {};
    options.dispatchInputs = {
      ...dispatchInputs,
      profile_tag: normalizedTag,
    };
    const fetchMode = normalizeText(options.fetchMode).toLowerCase();
    const modeText = fetchMode === 'standard'
      ? `${days} 天精读抓取任务`
      : (fetchMode === 'skims' ? `${days} 天速览抓取任务` : `${days} 天抓取任务`);
    const tip = `已发起词条「${normalizedTag}」的${modeText}。`;
    return runQuickFetch(days, quickRunMsgEl || msgEl, tip, options);
  };

  const runQuickConferencePlaceholder = (yearSelectEl, confSelectEl, msgEl) => {
    const year = (yearSelectEl && yearSelectEl.value) || '';
    const conf = String((confSelectEl && confSelectEl.value) || '').trim();
    if (!year || !conf) {
      if (msgEl) {
        msgEl.textContent = '请先选择年份和会议名。';
        msgEl.style.color = '#c00';
      }
      return;
    }
    if (msgEl) {
      msgEl.textContent = `${year} ${conf} 的会议论文抓取功能暂未接入。`;
      msgEl.style.color = '#c90';
    }
  };

  const runResetContent = (msgEl) => {
    if (String(window.DPR_ACCESS_MODE || '') !== 'full') {
      if (msgEl) {
        msgEl.textContent = '未检测到完整登录权限，危险操作未开启。';
        msgEl.style.color = '#c00';
      }
      return;
    }

    const confirmText = window.prompt(
      '危险操作：该操作会将 docs 备份为 docs_backup_xxx 后恢复为 docs_init，并清空 archive。输入「RESET_ALL」确认。',
    );
    if (confirmText !== 'RESET_ALL') {
      if (msgEl) {
        msgEl.textContent = '已取消危险操作。';
        msgEl.style.color = '#666';
      }
      return;
    }

    if (!window.DPRWorkflowRunner || typeof window.DPRWorkflowRunner.runWorkflowByKey !== 'function') {
      if (msgEl) {
        msgEl.textContent = '工作流触发器未加载到当前页面。';
        msgEl.style.color = '#c00';
      }
      return;
    }

    window.DPRWorkflowRunner.runWorkflowByKey('reset-content');
    if (msgEl) {
      msgEl.textContent = '已发起删除并重置任务，已触发工作流。';
      msgEl.style.color = '#080';
    }
  };

  const normalizeProfiles = (subs, availableSources) => {
    const profiles = Array.isArray(subs.intent_profiles) ? subs.intent_profiles : [];
    return profiles
      .map((p, idx) => {
        if (!p || typeof p !== 'object') return null;
        const tag = normalizeText(p.tag) || toStableId(p.description || `profile-${idx + 1}`);
        const description = normalizeText(p.description || '');
        const enabled = p.enabled !== false;
        const fallbackToArxiv = !Object.prototype.hasOwnProperty.call(p, 'paper_sources');
        const paperSources = normalizePaperSources(p.paper_sources, { fallbackToArxiv });
        const keywordRules = (Array.isArray(p.keywords) ? p.keywords : []).map(normalizeKeywordItem).filter(Boolean);
        const normalizedKeywords = dedupeKeywords(keywordRules);
        const normalizedIntentQueries = normalizeIntentQueries(p.intent_queries);
        if (!keywordRules.length && !normalizedKeywords.length && !normalizedIntentQueries.length) {
          return null;
        }

        const result = {
          id: buildInternalId('profile', p.id, tag, description || `profile-${idx + 1}`),
          tag,
          description,
          enabled,
          paper_sources: paperSources,
          keywords: normalizedKeywords.map((item, keywordIdx) => ({
            ...item,
            id: buildInternalId('kw', item.id, item.keyword, `${tag}-kw-${keywordIdx + 1}`),
          })),
          intent_queries: normalizedIntentQueries.map((item, intentIdx) => ({
            ...item,
            id: buildInternalId('iq', item.id, item.query, `${tag}-iq-${intentIdx + 1}`),
          })),
          updated_at: normalizeText(p.updated_at) || new Date().toISOString(),
        };
        if ('paused' in p) {
          result.paused = !!p.paused;
        }
        return result;
      })
      .filter(Boolean);
  };

  const validateIntentProfiles = (config) => {
    const cfg = ensureSourceBackendsForProfiles(cloneDeep(config || {}));
    const subs = (cfg && cfg.subscriptions) || {};
    const availableSources = getAvailablePaperSources(cfg);
    const profiles = Array.isArray(subs.intent_profiles) ? subs.intent_profiles : [];
    for (let idx = 0; idx < profiles.length; idx += 1) {
      const profile = profiles[idx];
      if (!profile || typeof profile !== 'object') continue;
      const tag = normalizeText(profile.tag) || `词条${idx + 1}`;
      const fallbackToArxiv = !Object.prototype.hasOwnProperty.call(profile, 'paper_sources');
      const paperSources = normalizePaperSources(profile.paper_sources, { fallbackToArxiv });
      const keywords = dedupeKeywords(
        (Array.isArray(profile.keywords) ? profile.keywords : [])
          .map(normalizeKeywordItem)
          .filter(Boolean),
      );
      const intentQueries = normalizeIntentQueries(profile.intent_queries);
      if (!paperSources.length) {
        return `词条「${tag}」至少需要 1 个论文源。`;
      }
      const unknownSources = paperSources.filter((item) => !availableSources.includes(item));
      if (unknownSources.length) {
        return `词条「${tag}」包含未配置的论文源：${unknownSources.join(', ')}。`;
      }
      if (!keywords.length) {
        return `词条「${tag}」至少需要 1 条关键词。`;
      }
      if (keywords.length > MAX_KEYWORDS_PER_PROFILE) {
        return `词条「${tag}」的关键词最多只能保留 ${MAX_KEYWORDS_PER_PROFILE} 条。`;
      }
      if (!intentQueries.length) {
        return `词条「${tag}」至少需要 1 条意图Query。`;
      }
      if (intentQueries.length > MAX_INTENT_QUERIES_PER_PROFILE) {
        return `词条「${tag}」的意图Query 最多只能保留 ${MAX_INTENT_QUERIES_PER_PROFILE} 条。`;
      }
    }
    return '';
  };

  const stripIntentProfileIds = (config) => {
    const next = cloneDeep(config || {});
    if (!next || typeof next !== 'object') return next;
    const subscriptions = next.subscriptions;
    if (!subscriptions || typeof subscriptions !== 'object') return next;
    const profiles = Array.isArray(subscriptions.intent_profiles) ? subscriptions.intent_profiles : [];
    if (!profiles.length) return next;

    subscriptions.intent_profiles = profiles
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        const profile = cloneDeep(p) || {};
        delete profile.id;

        if (Array.isArray(profile.keywords)) {
          profile.keywords = profile.keywords
            .filter((k) => k && typeof k === 'object')
            .map((k) => {
              const keyword = cloneDeep(k);
              delete keyword.id;
              return keyword;
            });
        }

        if (Array.isArray(profile.intent_queries)) {
          profile.intent_queries = profile.intent_queries
            .filter((item) => item && typeof item === 'object')
            .map((item) => {
              const intentQuery = cloneDeep(item);
              delete intentQuery.id;
              return intentQuery;
            });
        }

        return profile;
      });

    next.subscriptions = subscriptions;
    return next;
  };

  const migrateLegacyToProfilesIfNeeded = (subs) => {
    const existingProfiles = normalizeProfiles(subs);
    if (existingProfiles.length > 0) {
      subs.intent_profiles = existingProfiles;
    } else {
      subs.intent_profiles = [];
    }
    delete subs.keywords;
    delete subs.llm_queries;
    return subs;
  };

  const normalizeSubscriptions = (config, options = {}) => {
    const next = cloneDeep(config || {});
    if (!next.subscriptions) next.subscriptions = {};
    const subs = next.subscriptions;

    migrateLegacyToProfilesIfNeeded(subs);
    subs.intent_profiles = normalizeProfiles(subs, getAvailablePaperSources(next));

    if (!subs.schema_migration || typeof subs.schema_migration !== 'object') {
      subs.schema_migration = {};
    }
    if (!normalizeText(subs.schema_migration.stage)) {
      subs.schema_migration.stage = 'A';
    }
    if (!normalizeText(subs.schema_migration.diff_threshold_pct)) {
      subs.schema_migration.diff_threshold_pct = 15;
    }

    if (!normalizeText(subs.keyword_recall_mode)) {
      subs.keyword_recall_mode = 'or';
    }

    next.subscriptions = subs;
    ensureSourceBackendsForProfiles(next);
    return options.stripInternalIds === false ? next : stripIntentProfileIds(next);
  };

  const normalizeDraftConfig = (config) => normalizeSubscriptions(config, { stripInternalIds: false });

  const getProfileMergeKey = (profile, index = 0) => {
    if (!isPlainObject(profile)) return `__missing__:${index}`;
    const id = normalizeText(profile.id).toLowerCase();
    if (id) return `id:${id}`;
    const tag = normalizeText(profile.tag).toLowerCase();
    if (tag) return `tag:${tag}`;
    const description = normalizeText(profile.description).toLowerCase();
    if (description) return `description:${description}`;
    return `index:${index}`;
  };

  const getKeywordMergeKey = (item, index = 0) => {
    if (typeof item === 'string') {
      const keyword = normalizeText(item).toLowerCase();
      return keyword ? `keyword:${keyword}` : `index:${index}`;
    }
    if (!isPlainObject(item)) return `index:${index}`;
    const id = normalizeText(item.id).toLowerCase();
    if (id) return `id:${id}`;
    const keyword = normalizeText(item.keyword || item.expr || item.text || '').toLowerCase();
    return keyword ? `keyword:${keyword}` : `index:${index}`;
  };

  const getIntentQueryMergeKey = (item, index = 0) => {
    if (typeof item === 'string') {
      const query = normalizeText(item).toLowerCase();
      return query ? `query:${query}` : `index:${index}`;
    }
    if (!isPlainObject(item)) return `index:${index}`;
    const id = normalizeText(item.id).toLowerCase();
    if (id) return `id:${id}`;
    const query = normalizeText(item.query || item.text || item.keyword || item.expr || '').toLowerCase();
    return query ? `query:${query}` : `index:${index}`;
  };

  const mergeProfileItems = (latestItems, draftItems, baseItems, getKey) => {
    const latestList = Array.isArray(latestItems) ? latestItems : [];
    const draftList = Array.isArray(draftItems) ? draftItems : [];
    const baseList = Array.isArray(baseItems) ? baseItems : [];
    const latestMap = new Map(latestList.map((item, idx) => [getKey(item, idx), item]));
    const draftMap = new Map(draftList.map((item, idx) => [getKey(item, idx), item]));
    const baseMap = new Map(baseList.map((item, idx) => [getKey(item, idx), item]));
    const deletedKeys = new Set();
    baseMap.forEach((_item, key) => {
      if (!draftMap.has(key)) {
        deletedKeys.add(key);
      }
    });

    const mergedItems = draftList.map((item, idx) => {
      if (!isPlainObject(item)) return item;
      const latestItem = latestMap.get(getKey(item, idx));
      if (!isPlainObject(latestItem)) return item;
      return {
        ...cloneDeep(latestItem),
        ...item,
      };
    });

    latestList.forEach((item, idx) => {
      const key = getKey(item, idx);
      if (draftMap.has(key) || deletedKeys.has(key)) return;
      mergedItems.push(cloneDeep(item));
    });
    return mergedItems;
  };

  const mergeProfileEntry = (latestProfile, draftProfile, baseProfile) => {
    const latest = isPlainObject(latestProfile) ? cloneDeep(latestProfile) : {};
    const draft = isPlainObject(draftProfile) ? cloneDeep(draftProfile) : {};
    const base = isPlainObject(baseProfile) ? cloneDeep(baseProfile) : {};
    const merged = {
      ...latest,
      ...draft,
    };

    if (Object.prototype.hasOwnProperty.call(draft, 'keywords')) {
      merged.keywords = mergeProfileItems(latest.keywords, draft.keywords, base.keywords, getKeywordMergeKey);
    }

    if (Object.prototype.hasOwnProperty.call(draft, 'intent_queries')) {
      merged.intent_queries = mergeProfileItems(
        latest.intent_queries,
        draft.intent_queries,
        base.intent_queries,
        getIntentQueryMergeKey,
      );
    }

    return merged;
  };

  const mergeDraftConfigOntoLatest = (latestConfig, draftConfigValue, baseConfigValue) => {
    const latest = normalizeDraftConfig(latestConfig || {});
    const draft = normalizeDraftConfig(draftConfigValue || {});
    const base = normalizeDraftConfig(baseConfigValue || {});

    const merged = cloneDeep(latest);

    const latestSubs = isPlainObject(latest.subscriptions) ? latest.subscriptions : {};
    const draftSubs = isPlainObject(draft.subscriptions) ? draft.subscriptions : {};
    const baseSubs = isPlainObject(base.subscriptions) ? base.subscriptions : {};
    const mergedSubs = {
      ...latestSubs,
    };

    const latestProfiles = Array.isArray(latestSubs.intent_profiles) ? latestSubs.intent_profiles : [];
    const draftProfiles = Array.isArray(draftSubs.intent_profiles) ? draftSubs.intent_profiles : [];
    const baseProfiles = Array.isArray(baseSubs.intent_profiles) ? baseSubs.intent_profiles : [];

    const latestMap = new Map(latestProfiles.map((profile, idx) => [getProfileMergeKey(profile, idx), profile]));
    const baseMap = new Map(baseProfiles.map((profile, idx) => [getProfileMergeKey(profile, idx), profile]));
    const draftMap = new Map(draftProfiles.map((profile, idx) => [getProfileMergeKey(profile, idx), profile]));

    const deletedKeys = new Set();
    baseMap.forEach((_profile, key) => {
      if (!draftMap.has(key)) {
        deletedKeys.add(key);
      }
    });

    const outProfiles = [];
    draftProfiles.forEach((profile, idx) => {
      const key = getProfileMergeKey(profile, idx);
      outProfiles.push(mergeProfileEntry(latestMap.get(key), profile, baseMap.get(key)));
    });
    latestProfiles.forEach((profile, idx) => {
      const key = getProfileMergeKey(profile, idx);
      if (draftMap.has(key) || deletedKeys.has(key)) return;
      outProfiles.push(cloneDeep(profile));
    });

    if (Object.prototype.hasOwnProperty.call(draftSubs, 'schema_migration')) {
      mergedSubs.schema_migration = cloneDeep(draftSubs.schema_migration);
    }
    if (Object.prototype.hasOwnProperty.call(draftSubs, 'keyword_recall_mode')) {
      mergedSubs.keyword_recall_mode = draftSubs.keyword_recall_mode;
    }
    mergedSubs.intent_profiles = outProfiles;
    merged.subscriptions = mergedSubs;
    return normalizeDraftConfig(merged);
  };

  const setMessage = (text, color) => {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = color || '#666';
  };

  const ensureOverlay = () => {
    if (overlay && panel) return;
    overlay = document.getElementById('arxiv-search-overlay');
    if (overlay) {
      panel = document.getElementById('arxiv-search-panel');
      return;
    }

    overlay = document.createElement('div');
    overlay.id = 'arxiv-search-overlay';
    overlay.innerHTML = `
      <div id="arxiv-search-panel">
        <div id="arxiv-search-panel-header">
          <div style="font-weight:600;">后台管理</div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button id="arxiv-config-save-btn" class="arxiv-tool-btn" style="padding:2px 10px; background:#2e7d32; color:white;">保存</button>
            <button id="arxiv-open-secret-setup-btn" class="arxiv-tool-btn" style="padding:2px 10px;">密钥配置</button>
            <button id="arxiv-search-close-btn" class="arxiv-tool-btn" style="padding:2px 6px;">关闭</button>
          </div>
        </div>

        <div id="arxiv-search-panel-body">
          <div id="arxiv-search-panel-main">
            <div id="dpr-smart-query-section" class="arxiv-pane dpr-smart-pane">
              <div class="dpr-display-card">
                <div id="dpr-sq-display" class="dpr-sq-display"></div>
              </div>

              <div class="dpr-input-card">
                <div class="dpr-inline-row">
                  <button id="dpr-sq-open-chat-btn" class="arxiv-tool-btn" style="background:#2e7d32; color:#fff;">新增</button>
                </div>
              </div>
            </div>

            <div id="dpr-smart-msg" style="font-size:12px; color:#666; margin-top:10px;">提示：修改后点击「保存」才会写入 config.yaml。</div>
          </div>

          <div id="arxiv-search-quick-run-divider" aria-hidden="true"></div>

          <div id="arxiv-search-quick-run-side">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
              <div class="chat-quick-run-title" style="margin:0;">快速抓取</div>
              <button id="arxiv-admin-open-workflow-panel-btn" class="arxiv-tool-btn" type="button" style="padding:2px 8px;">打开工作流面板</button>
            </div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-quick-run-days-select">抓取天数</label>
              <select id="arxiv-admin-quick-run-days-select">
                ${Array.from({ length: 30 }, (_, idx) => idx + 1)
                  .map((value) => `<option value="${value}"${value === 10 ? ' selected' : ''}>${value} 天</option>`)
                  .join('')}
              </select>
            </div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-quick-run-mode-select">阅读粒度</label>
              <select id="arxiv-admin-quick-run-mode-select">
                <option value="skims" selected>速览</option>
                <option value="standard">精读</option>
              </select>
            </div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-quick-run-rerank-select">Rerank</label>
              <select id="arxiv-admin-quick-run-rerank-select">
                <option value="blt" selected>blt</option>
                <option value="local">local</option>
                <option value="none">none</option>
              </select>
            </div>
            <button id="arxiv-admin-quick-run-run-btn" class="chat-quick-run-run-btn" type="button">立即运行</button>
            <div class="chat-quick-run-divider" aria-hidden="true"></div>
            <div class="chat-quick-run-title">上传论文关联发现（v1）</div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-seed-paper-file-input">种子论文 PDF</label>
              <input id="arxiv-admin-seed-paper-file-input" type="file" accept="application/pdf" />
            </div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-seed-paper-count-input">关联篇数</label>
              <input id="arxiv-admin-seed-paper-count-input" type="number" min="1" max="20" value="5" />
            </div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-seed-paper-mode-select">阅读模式</label>
              <select id="arxiv-admin-seed-paper-mode-select">
                <option value="skim" selected>仅速览</option>
                <option value="deep">仅精读</option>
                <option value="both">速览 + 精读</option>
              </select>
            </div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-seed-paper-tags-input">关联标签</label>
              <input id="arxiv-admin-seed-paper-tags-input" type="text" placeholder="例如：LLM, Agents" />
            </div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-seed-paper-notes-input">备注</label>
              <textarea id="arxiv-admin-seed-paper-notes-input" rows="3" placeholder="可选：补充关注方向"></textarea>
            </div>
            <button id="arxiv-admin-seed-paper-run-btn" class="chat-quick-run-run-btn" type="button">上传并运行</button>
            <div class="chat-quick-run-divider" aria-hidden="true"></div>
            <div class="chat-quick-run-title">会议论文（暂未接入）</div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-quick-run-year-select">年份</label>
              <select id="arxiv-admin-quick-run-year-select" disabled>
                <option value="">选择年份</option>
              </select>
            </div>
            <div class="chat-quick-run-row">
              <label for="arxiv-admin-quick-run-conference-select">会议名</label>
              <select id="arxiv-admin-quick-run-conference-select" disabled>
                <option value="">选择会议名</option>
              </select>
            </div>
            <button
              id="arxiv-admin-quick-run-conference-run-btn"
              class="chat-quick-run-run-btn chat-quick-run-item--disabled"
              type="button"
              disabled
            >
              运行
            </button>
            <div id="arxiv-admin-quick-run-msg" class="chat-quick-run-msg"></div>

            <div class="chat-quick-run-divider" aria-hidden="true"></div>
            <div class="chat-quick-run-title">危险操作</div>
            <button
              id="arxiv-admin-reset-content-btn"
              class="chat-quick-run-run-btn"
              type="button"
              style="background:#c62828; color:#fff; border-color:#b71c1c;"
            >
              删除所有
            </button>
            <div id="arxiv-admin-reset-content-msg" class="chat-quick-run-msg"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    panel = document.getElementById('arxiv-search-panel');

    saveBtn = document.getElementById('arxiv-config-save-btn');
    closeBtn = document.getElementById('arxiv-search-close-btn');
    msgEl = document.getElementById('dpr-smart-msg');

    const reloadAll = () => {
      renderFromDraft();
    };

    if (window.SubscriptionsSmartQuery) {
      window.SubscriptionsSmartQuery.attach({
        displayListEl: document.getElementById('dpr-sq-display'),
        openChatBtn: document.getElementById('dpr-sq-open-chat-btn'),
        msgEl,
        reloadAll,
      });
    }

    bindBaseEvents();
  };

  const renderFromDraft = () => {
    const cfg = draftConfig || {};
    const subs = (cfg && cfg.subscriptions) || {};
    const profiles = Array.isArray(subs.intent_profiles) ? subs.intent_profiles : [];
    if (window.SubscriptionsSmartQuery && window.SubscriptionsSmartQuery.render) {
      window.SubscriptionsSmartQuery.render(profiles);
    }
    if (window.SubscriptionsSmartQuery && window.SubscriptionsSmartQuery.clearPendingDeletedProfileIds) {
      window.SubscriptionsSmartQuery.clearPendingDeletedProfileIds();
    }
  };

  const loadSubscriptions = async () => {
    try {
      if (!window.SubscriptionsGithubToken || !window.SubscriptionsGithubToken.loadConfig) {
        throw new Error('SubscriptionsGithubToken.loadConfig 不可用');
      }
      const { config } = await window.SubscriptionsGithubToken.loadConfig();
      const normalizedConfig = normalizeDraftConfig(config || {});
      loadedBaseConfig = cloneDeep(normalizedConfig);
      draftConfig = cloneDeep(normalizedConfig);
      hasUnsavedChanges = false;
      refreshQuickRunButtons();
      if (window.SubscriptionsSmartQuery && window.SubscriptionsSmartQuery.clearPendingDeletedProfileIds) {
        window.SubscriptionsSmartQuery.clearPendingDeletedProfileIds();
      }
      renderFromDraft();
      setMessage('已加载配置，可开始编辑。', '#666');
    } catch (e) {
      console.error(e);
      setMessage('加载配置失败，请确认 GitHub Token 可用。', '#c00');
    }
  };

  const saveDraftConfig = async () => {
    if (isSavingDraftConfig) {
      setMessage('正在保存中，请稍后...', '#666');
      return;
    }
    if (!window.SubscriptionsGithubToken || typeof window.SubscriptionsGithubToken.updateConfig !== 'function') {
      setMessage('当前无法保存配置，请先完成 GitHub 登录。', '#c00');
      return;
    }
    if (!draftConfig) {
      setMessage('配置尚未加载完成，请先等待配置读取完成后再试。', '#c00');
      return;
    }
    try {
      isSavingDraftConfig = true;
      if (saveBtn) {
        saveBtn.disabled = true;
      }
      const toSave = normalizeDraftConfig(draftConfig || {});
      const validationError = validateIntentProfiles(toSave);
      if (validationError) {
        setMessage(validationError, '#c00');
        return;
      }
      setMessage('正在保存配置...', '#666');
      const baseDraft = cloneDeep(loadedBaseConfig || {});
      let savedConfig = null;
      await window.SubscriptionsGithubToken.updateConfig(
        (latestConfig) => {
          savedConfig = mergeDraftConfigOntoLatest(latestConfig, toSave, baseDraft);
          return savedConfig;
        },
        'chore: save smart query config from dashboard',
      );
      loadedBaseConfig = cloneDeep(savedConfig || toSave);
      draftConfig = cloneDeep(savedConfig || toSave);
      hasUnsavedChanges = false;
      refreshQuickRunButtons();
      if (window.SubscriptionsSmartQuery && window.SubscriptionsSmartQuery.clearPendingDeletedProfileIds) {
        window.SubscriptionsSmartQuery.clearPendingDeletedProfileIds();
      }
      setMessage('配置已保存。', '#080');
    } catch (e) {
      console.error(e);
      const msg = e && e.message ? e.message : '未知错误';
      setMessage(`保存配置失败：${msg}`.slice(0, 180), '#c00');
    } finally {
      isSavingDraftConfig = false;
      if (saveBtn) {
        saveBtn.disabled = false;
      }
    }
  };

  const reallyCloseOverlay = () => {
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  };

  const closeOverlay = () => {
    if (hasUnsavedChanges) {
      const ok = window.confirm('检测到未保存修改，确认直接关闭并丢弃本地草稿吗？');
      if (!ok) return;
      if (window.SubscriptionsSmartQuery && window.SubscriptionsSmartQuery.clearPendingDeletedProfileIds) {
        window.SubscriptionsSmartQuery.clearPendingDeletedProfileIds();
      }
      draftConfig = null;
      loadedBaseConfig = null;
      hasUnsavedChanges = false;
      refreshQuickRunButtons();
    }
    reallyCloseOverlay();
  };

  const openOverlay = () => {
    ensureOverlay();
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('show');
      });
    });

    if (draftConfig) {
      renderFromDraft();
    } else {
      loadSubscriptions();
    }
  };

  const bindBaseEvents = () => {
    if (closeBtn && !closeBtn._bound) {
      closeBtn._bound = true;
      closeBtn.addEventListener('click', closeOverlay);
    }

    if (overlay && !overlay._boundClick) {
      overlay._boundClick = true;
      overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) closeOverlay();
      });
    }

    if (saveBtn && !saveBtn._bound) {
      saveBtn._bound = true;
      saveBtn.addEventListener('click', saveDraftConfig);
    }

    const secretBtn = document.getElementById('arxiv-open-secret-setup-btn');
    if (secretBtn && !secretBtn._bound) {
      secretBtn._bound = true;
      secretBtn.addEventListener('click', () => {
        try {
          if (window.DPRSecretSetup && window.DPRSecretSetup.openStep2) {
            window.DPRSecretSetup.openStep2();
          } else {
            alert('当前页面尚未加载密钥配置向导脚本，请刷新后重试。');
          }
        } catch (e) {
          console.error(e);
        }
      });
    }

    quickRunDaysSelect = document.getElementById('arxiv-admin-quick-run-days-select');
    quickRunModeSelect = document.getElementById('arxiv-admin-quick-run-mode-select');
    quickRunRerankSelect = document.getElementById('arxiv-admin-quick-run-rerank-select');
    quickRunRunBtn = document.getElementById('arxiv-admin-quick-run-run-btn');
    quickRunOpenWorkflowPanelBtn = document.getElementById('arxiv-admin-open-workflow-panel-btn');
    quickRunSeedFileInput = document.getElementById('arxiv-admin-seed-paper-file-input');
    quickRunSeedCountInput = document.getElementById('arxiv-admin-seed-paper-count-input');
    quickRunSeedModeSelect = document.getElementById('arxiv-admin-seed-paper-mode-select');
    quickRunSeedTagsInput = document.getElementById('arxiv-admin-seed-paper-tags-input');
    quickRunSeedNotesInput = document.getElementById('arxiv-admin-seed-paper-notes-input');
    quickRunSeedRunBtn = document.getElementById('arxiv-admin-seed-paper-run-btn');
    quickRunConferenceBtn = document.getElementById(
      'arxiv-admin-quick-run-conference-run-btn',
    );
    quickRunYearSelect = document.getElementById('arxiv-admin-quick-run-year-select');
    quickRunConferenceSelect = document.getElementById(
      'arxiv-admin-quick-run-conference-select',
    );
    quickRunMsgEl = document.getElementById('arxiv-admin-quick-run-msg');
    resetContentBtn = document.getElementById('arxiv-admin-reset-content-btn');
    resetContentMsgEl = document.getElementById('arxiv-admin-reset-content-msg');
    if (quickRunYearSelect) {
      quickRunYearSelect.disabled = true;
    }
    if (quickRunConferenceSelect) {
      quickRunConferenceSelect.disabled = true;
    }
    if (quickRunConferenceBtn) {
      quickRunConferenceBtn.disabled = true;
      quickRunConferenceBtn.classList.add('chat-quick-run-item--disabled');
      quickRunConferenceBtn.title = '会议论文抓取功能暂未接入';
    }
    fillQuickRunOptions(quickRunYearSelect, quickRunConferenceSelect);
    [
      quickRunDaysSelect,
      quickRunModeSelect,
      quickRunRerankSelect,
      quickRunRunBtn,
      quickRunSeedFileInput,
      quickRunSeedCountInput,
      quickRunSeedModeSelect,
      quickRunSeedTagsInput,
      quickRunSeedNotesInput,
      quickRunSeedRunBtn,
    ].forEach((control) => {
      if (!control) return;
      if (!control.dataset.defaultTitle) {
        control.setAttribute('data-default-title', control.textContent || control.getAttribute('placeholder') || '');
      }
    });
    refreshQuickRunButtons();

    if (quickRunRunBtn && !quickRunRunBtn._bound) {
      quickRunRunBtn._bound = true;
      quickRunRunBtn.addEventListener('click', () => {
        const days = normalizeQuickRunDays(quickRunDaysSelect && quickRunDaysSelect.value);
        const fetchMode = normalizeQuickRunFetchMode(quickRunModeSelect && quickRunModeSelect.value);
        const rerankProvider = normalizeQuickRunRerankProvider(quickRunRerankSelect && quickRunRerankSelect.value) || QUICK_RUN_DEFAULT_RERANK_PROVIDER;
        const modeText = fetchMode === 'standard' ? '精读' : '速览';
        runQuickFetch(
          days,
          quickRunMsgEl,
          `已发起 ${days} 天${modeText}抓取任务（rerank: ${rerankProvider}）。`,
          { fetchMode, rerankProvider },
        );
      });
    }

    if (quickRunOpenWorkflowPanelBtn && !quickRunOpenWorkflowPanelBtn._bound) {
      quickRunOpenWorkflowPanelBtn._bound = true;
      quickRunOpenWorkflowPanelBtn.addEventListener('click', () => {
        try {
          if (window.DPRWorkflowRunner && typeof window.DPRWorkflowRunner.open === 'function') {
            window.DPRWorkflowRunner.open();
            return;
          }
        } catch (e) {
          console.error(e);
        }
        if (quickRunMsgEl) {
          quickRunMsgEl.textContent = '工作流触发面板未加载，请刷新页面后重试。';
          quickRunMsgEl.style.color = '#c00';
        }
      });
    }

    if (quickRunSeedRunBtn && !quickRunSeedRunBtn._bound) {
      quickRunSeedRunBtn._bound = true;
      quickRunSeedRunBtn.addEventListener('click', () => {
        const file = quickRunSeedFileInput && quickRunSeedFileInput.files && quickRunSeedFileInput.files[0]
          ? quickRunSeedFileInput.files[0]
          : null;
        runSeedPaperDiscovery({
          file,
          relatedCount: quickRunSeedCountInput && quickRunSeedCountInput.value,
          mode: quickRunSeedModeSelect && quickRunSeedModeSelect.value,
          selectedTags: quickRunSeedTagsInput && quickRunSeedTagsInput.value,
          notes: quickRunSeedNotesInput && quickRunSeedNotesInput.value,
        }, quickRunMsgEl);
      });
    }

    if (quickRunConferenceBtn && !quickRunConferenceBtn._bound) {
      quickRunConferenceBtn._bound = true;
      quickRunConferenceBtn.addEventListener('click', () => {
        runQuickConferencePlaceholder(
          quickRunYearSelect,
          quickRunConferenceSelect,
          quickRunMsgEl,
        );
      });
    }

    if (resetContentBtn && !resetContentBtn._bound) {
      resetContentBtn._bound = true;
      resetContentBtn.addEventListener('click', () => {
        runResetContent(resetContentMsgEl);
      });
    }

  };

  const init = () => {
    const run = () => {
      ensureOverlay();
      document.addEventListener('ensure-arxiv-ui', () => {
        ensureOverlay();
      });
      if (!document._arxivLoadSubscriptionsEventBound) {
        document._arxivLoadSubscriptionsEventBound = true;
        document.addEventListener('load-arxiv-subscriptions', () => {
          ensureOverlay();
          loadSubscriptions();
          openOverlay();
        });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  };

  return {
    init,
    openOverlay,
    closeOverlay,
    loadSubscriptions,
    markConfigDirty: () => {
      hasUnsavedChanges = true;
      refreshQuickRunButtons();
    },
    updateDraftConfig: (updater) => {
      const base = draftConfig || {};
      const next = typeof updater === 'function' ? updater(cloneDeep(base)) || base : base;
      draftConfig = normalizeDraftConfig(next);
      hasUnsavedChanges = true;
      refreshQuickRunButtons();
    },
    getDraftConfig: () => cloneDeep(draftConfig || {}),
    validateDraftConfig: () => validateIntentProfiles(draftConfig || {}),
    runProfileQuickFetch: (profileTag, days, runOptions) => runProfileQuickFetch(profileTag, days, runOptions),
    runSeedPaperDiscovery: (requestOptions, targetMsgEl) => runSeedPaperDiscovery(requestOptions, targetMsgEl),
    __test: {
      normalizeSubscriptions: (config) => normalizeSubscriptions(config),
      normalizeDraftConfig: (config) => normalizeDraftConfig(config),
      ensureSourceBackendsForProfiles: (config) => ensureSourceBackendsForProfiles(cloneDeep(config || {})),
      buildDefaultSourceBackend: (sourceKey, config) => buildDefaultSourceBackend(sourceKey, cloneDeep(config || {})),
      normalizePaperSources: (values, options) => normalizePaperSources(values, options),
      mergeDraftConfigOntoLatest: (latestConfig, draftConfigValue, baseConfigValue) => mergeDraftConfigOntoLatest(latestConfig, draftConfigValue, baseConfigValue),
      applyQuickRunRerankDispatchInputs: (runOptions) => applyQuickRunRerankDispatchInputs(runOptions),
      buildSeedPaperRequestPayload: (requestOptions) => buildSeedPaperRequestPayload(requestOptions),
      isPdfFile: (file) => isPdfFile(file),
      hasPdfSignature: (bufferLike) => hasPdfSignature(bufferLike),
      getMaxSeedPaperBytes: () => MAX_SEED_PAPER_BYTES,
      setSeedSubmissionStateForTest: (value) => {
        isSubmittingSeedPaper = !!value;
      },
      saveDraftConfig: () => saveDraftConfig(),
      getLoadedBaseConfig: () => cloneDeep(loadedBaseConfig || {}),
    },
  };
})();
