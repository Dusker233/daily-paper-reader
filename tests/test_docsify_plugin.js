const assert = require('node:assert/strict');

function createHookRecorder() {
  return {
    beforeEach(handler) {
      this.beforeEachHandler = handler;
    },
    doneEach(handler) {
      this.doneEachHandler = handler;
    },
  };
}

global.window = global.window || {};
global.window.location = global.window.location || {
  hash: '',
  replace() {},
};
global.window.innerWidth = global.window.innerWidth || 1280;
global.window.matchMedia = global.window.matchMedia || (() => ({ matches: false }));
global.window.addEventListener = global.window.addEventListener || (() => {});
global.window.removeEventListener = global.window.removeEventListener || (() => {});
global.window.scrollTo = global.window.scrollTo || (() => {});
global.window.requestAnimationFrame = global.window.requestAnimationFrame || ((cb) => cb());
global.requestAnimationFrame = global.requestAnimationFrame || global.window.requestAnimationFrame;
global.window.$docsify = {
  basePath: 'docs/',
  plugins: [],
};
global.window.__DPR_ENABLE_DOCSIFY_PLUGIN_TESTS__ = true;
global.window.DPRSecretSession = {
  getGithubToken() {
    return '';
  },
};
global.window.marked = {
  setOptions() {},
  getDefaults() {
    return {};
  },
};
global.document = global.document || {
  querySelectorAll() {
    return [];
  },
  querySelector() {
    return null;
  },
  getElementById() {
    return null;
  },
  addEventListener() {},
  dispatchEvent() {},
  body: {
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
  },
  head: {
    appendChild() {},
    removeChild() {},
  },
  createElement() {
    return {
      style: {},
      classList: {
        add() {},
        remove() {},
        toggle() {},
      },
      appendChild() {},
      removeChild() {},
      addEventListener() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    };
  },
  documentElement: {
    clientWidth: 1280,
    style: {
      setProperty() {},
    },
  },
  body: {
    appendChild() {},
    removeChild() {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
  },
};
global.fetch = global.fetch || (async () => ({ ok: false, text: async () => '' }));
global.CustomEvent = global.CustomEvent || function CustomEvent(type, init) {
  this.type = type;
  this.detail = init ? init.detail : undefined;
};

delete require.cache[require.resolve('../app/docsify-plugin.js')];
require('../app/docsify-plugin.js');

const pluginFactory = global.window.$docsify.plugins[0];
assert.equal(typeof pluginFactory, 'function', 'docsify plugin should register itself');
pluginFactory(createHookRecorder(), {
  route: {
    file: 'docs/README.md',
    path: '/README.md',
  },
});

const {
  normalizeSafeUrl,
  resolveDocsAssetUrl,
  parseFiguresMeta,
  renderPaperFromMeta,
  loadGithubTokenForGist,
} = global.window.DPRDocsifyPluginTest;

function testNormalizeSafeUrlRejectsJavascriptAndDataUrls() {
  assert.equal(normalizeSafeUrl('javascript:alert(1)'), '');
  assert.equal(normalizeSafeUrl('data:text/html;base64,PHNjcmlwdA=='), '');
}

function testResolveDocsAssetUrlAllowsRepoAssetsOnly() {
  assert.equal(resolveDocsAssetUrl('assets/figures/demo.png'), 'docs/assets/figures/demo.png');
  assert.equal(resolveDocsAssetUrl('docs/assets/figures/demo.png'), 'docs/assets/figures/demo.png');
  assert.equal(resolveDocsAssetUrl('../assets/figures/demo.png'), '');
  assert.equal(resolveDocsAssetUrl('javascript:alert(1)'), '');
}

function testParseFiguresMetaFiltersUnsafeEntries() {
  const figures = parseFiguresMeta({
    figures_json: JSON.stringify([
      { url: 'assets/figures/safe.png', caption: 'safe' },
      { url: 'javascript:alert(1)', caption: 'bad-script' },
      { url: 'data:image/png;base64,abcd', caption: 'bad-data' },
      { url: 'https://example.com/remote.png', caption: 'remote' },
    ]),
  });

  assert.deepEqual(
    figures.map((item) => item.url),
    ['docs/assets/figures/safe.png'],
  );
}

function testRenderPaperFromMetaOmitsUnsafePdfLinks() {
  const html = renderPaperFromMeta({
    title: 'Demo Paper',
    authors: 'Alice, Bob',
    date: '2026-04-15',
    pdf: 'javascript:alert(1)',
  });

  assert.equal(html.includes('paper-meta-link'), false);
  assert.equal(html.includes('javascript:alert(1)'), false);
}

function testRenderPaperFromMetaIncludesSafePdfLinksAndFiltersUnsafeFigures() {
  const html = renderPaperFromMeta({
    title: 'Demo Paper',
    authors: 'Alice, Bob',
    date: '2026-04-15',
    pdf: 'https://example.com/paper.pdf',
    figures_json: JSON.stringify([
      { url: 'assets/figures/safe.png', caption: 'safe' },
      { url: 'javascript:alert(1)', caption: 'bad' },
    ]),
  });

  assert.ok(html.includes('https://example.com/paper.pdf'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes('docs/assets/figures/safe.png'));
  assert.equal(html.includes('javascript:alert(1)'), false);
}

function testRenderPaperFromMetaRendersKeyFindingsAndLimitations() {
  const html = renderPaperFromMeta({
    title: 'Demo Paper',
    authors: 'Alice, Bob',
    date: '2026-04-15',
    pdf: 'https://example.com/paper.pdf',
    motivation: '研究动机描述',
    method: '方法描述',
    result: '结果描述',
    conclusion: '结论描述',
    key_findings: ['第一个关键发现', '第二个关键发现', '第三个关键发现'],
    limitations: '主要局限性描述。',
  });

  assert.ok(html.includes('paper-glance-section'), 'glance section rendered');
  assert.ok(html.includes('Key Findings'), 'Key Findings label rendered');
  assert.ok(html.includes('Limitations'), 'Limitations label rendered');
  assert.ok(html.includes('第一个关键发现'), 'first key finding rendered');
  assert.ok(html.includes('第二个关键发现'), 'second key finding rendered');
  assert.ok(html.includes('第三个关键发现'), 'third key finding rendered');
  assert.ok(html.includes('主要局限性描述。'), 'limitations content rendered');
}

function testRenderPaperFromMetaRendersKeyFindingsAsListItems() {
  const html = renderPaperFromMeta({
    title: 'Demo Paper',
    authors: 'Alice, Bob',
    date: '2026-04-15',
    pdf: 'https://example.com/paper.pdf',
    key_findings: ['Finding A', 'Finding B'],
    limitations: 'Limitation text.',
  });

  // Each bullet should appear as a separate div
  assert.ok(html.includes('Finding A'), 'first bullet rendered');
  assert.ok(html.includes('Finding B'), 'second bullet rendered');
}

function testLoadGithubTokenForGistUsesSecretSessionAccessor() {
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'ghp_secret_session';
    },
  };
  global.window.DPR_RUNTIME_GITHUB_TOKEN = 'ghp_runtime_demo';

  assert.equal(loadGithubTokenForGist(), 'ghp_secret_session');
}

function testDocsifyPluginDoneEachPublishesCurrentRouteGlobals() {
  global.window.location.hash = '#/202604/16/paper123';
  let initPaperId = '';
  let initRouteFile = '';
  global.window.PrivateDiscussionChat = {
    initForPage(paperId, routeFile) {
      initPaperId = paperId;
      initRouteFile = routeFile;
    },
  };

  const hook = createHookRecorder();
  pluginFactory(hook, {
    route: {
      file: '202604/16/paper123.md',
      path: '/202604/16/paper123.md',
    },
  });

  assert.equal(typeof hook.doneEachHandler, 'function');
  hook.doneEachHandler();

  assert.deepEqual(global.window.__DPR_CURRENT_ROUTE, {
    file: '202604/16/paper123.md',
    path: '/202604/16/paper123.md',
  });
  assert.equal(global.window.__DPR_CURRENT_ROUTE_FILE, '202604/16/paper123.md');
  assert.equal(initPaperId, '202604/16/paper123');
  assert.equal(initRouteFile, '202604/16/paper123.md');

  delete global.window.PrivateDiscussionChat;
}

function testDocsifyPluginTestHooksStayDisabledWithoutExplicitFlag() {
  global.window.$docsify = {
    basePath: 'docs/',
    plugins: [],
  };
  global.window.DPRSecretSession = {
    getGithubToken() {
      return '';
    },
  };
  delete global.window.__DPR_ENABLE_DOCSIFY_PLUGIN_TESTS__;
  delete global.window.DPRDocsifyPluginTest;

  delete require.cache[require.resolve('../app/docsify-plugin.js')];
  require('../app/docsify-plugin.js');
  const disabledPluginFactory = global.window.$docsify.plugins[0];
  disabledPluginFactory(createHookRecorder(), {
    route: {
      file: 'docs/README.md',
      path: '/README.md',
    },
  });

  assert.equal(global.window.DPRDocsifyPluginTest, undefined);
}

function testAppCssKeepsMarkdownKatexDisplayScrollable() {
  const fs = require('node:fs');
  const path = require('node:path');
  const cssPath = path.join(__dirname, '..', 'app', 'app.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(
    css,
    /\.markdown-section \.katex-display \{[\s\S]*?overflow-x: auto;[\s\S]*?overflow-y: hidden;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.markdown-section \.katex-display > \.katex \{[\s\S]*?white-space: nowrap;[\s\S]*?\}/,
  );
}

function testAppCssKeepsSidebarPaperItemsReadableInDarkMode() {
  const fs = require('node:fs');
  const path = require('node:path');
  const cssPath = path.join(__dirname, '..', 'app', 'app.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(
    css,
    /\.sidebar-nav \.dpr-sidebar-link-line \{[\s\S]*?color: var\(--dpr-sidebar-link-muted\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.sidebar-nav li\.sidebar-paper-item:hover \.dpr-sidebar-link-line,[\s\S]*?\.sidebar-nav li\.active > a \.dpr-sidebar-link-line \{[\s\S]*?color: var\(--dpr-sidebar-link-active\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.sidebar-nav \.dpr-sidebar-tag \{[\s\S]*?color: var\(--dpr-sidebar-tag-text\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.sidebar-nav \.dpr-sidebar-tag-keyword \{[\s\S]*?background-color: var\(--dpr-sidebar-tag-keyword-bg\);[\s\S]*?color: var\(--dpr-sidebar-tag-keyword-text\);[\s\S]*?border: 1px solid var\(--dpr-sidebar-tag-keyword-border\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.sidebar-nav \.dpr-sidebar-tag-query \{[\s\S]*?background-color: var\(--dpr-sidebar-tag-query-bg\);[\s\S]*?color: var\(--dpr-sidebar-tag-query-text\);[\s\S]*?border: 1px solid var\(--dpr-sidebar-tag-query-border\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.sidebar-nav \.dpr-sidebar-tag-paper \{[\s\S]*?background-color: var\(--dpr-sidebar-tag-paper-bg\);[\s\S]*?color: var\(--dpr-sidebar-tag-paper-text\);[\s\S]*?border: 1px solid var\(--dpr-sidebar-tag-paper-border\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.sidebar-nav \.dpr-sidebar-tag-other \{[\s\S]*?background: var\(--dpr-sidebar-tag-other-bg\);[\s\S]*?color: var\(--dpr-sidebar-tag-other-text\);[\s\S]*?border: 1px solid var\(--dpr-sidebar-tag-other-border\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.sidebar-nav \.dpr-sidebar-tag-score \.dpr-stars-bg \{[\s\S]*?color: var\(--dpr-sidebar-stars-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.sidebar-nav \.dpr-sidebar-tag-score \.dpr-stars-fill \{[\s\S]*?color: var\(--dpr-sidebar-stars-fill\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /html\[data-theme='dark'\] \.sidebar-nav li\.sidebar-paper-item:not\(\.sidebar-paper-good\):not\(\.sidebar-paper-bad\):not\(\.sidebar-paper-blue\):not\(\.sidebar-paper-orange\)::before \{[\s\S]*?background-color: var\(--dpr-hover-bg\) !important;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /html\[data-theme='dark'\] \.sidebar-nav \.dpr-sidebar-active-indicator:not\(\.is-good\):not\(\.is-bad\):not\(\.is-blue\):not\(\.is-orange\) \{[\s\S]*?background-color: var\(--dpr-hover-strong-bg\) !important;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /:root \{[\s\S]*?--dpr-sidebar-tag-keyword-bg:[\s\S]*?--dpr-sidebar-stars-fill:[\s\S]*?\}/,
  );
  assert.match(
    css,
    /html\[data-theme='dark'\] \{[\s\S]*?--dpr-sidebar-tag-keyword-bg:[\s\S]*?--dpr-sidebar-stars-fill:[\s\S]*?\}/,
  );
}

function testAppCssUsesThemeTokensForOverlayPanels() {
  const fs = require('node:fs');
  const path = require('node:path');
  const cssPath = path.join(__dirname, '..', 'app', 'app.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(
    css,
    /#dpr-workflow-panel \{[\s\S]*?background: var\(--dpr-panel-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#dpr-workflow-header \{[\s\S]*?border-bottom: 1px solid var\(--dpr-panel-border\);[\s\S]*?background: var\(--dpr-panel-bg-soft\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-workflow-surface \{[\s\S]*?color: var\(--dpr-text\);[\s\S]*?border: 1px solid var\(--dpr-panel-border\);[\s\S]*?background: var\(--dpr-panel-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-wf-card \{[\s\S]*?border: 1px solid var\(--dpr-panel-border\);[\s\S]*?background: var\(--dpr-panel-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-wf-recent-item:hover \{[\s\S]*?background: var\(--dpr-hover-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-wf-recent-item\.is-active \{[\s\S]*?background: var\(--dpr-hover-strong-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-wf-substeps \{[\s\S]*?border: 1px dashed var\(--dpr-panel-border\);[\s\S]*?background: var\(--dpr-panel-bg-soft\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.chat-quick-run-item:hover \{[\s\S]*?background: var\(--dpr-hover-bg\);[\s\S]*?border-color: var\(--dpr-interactive-border-hover\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.chat-quick-run-modal-panel \{[\s\S]*?background: var\(--dpr-panel-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.chat-quick-run-title \{[\s\S]*?color: var\(--dpr-text-strong\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.chat-quick-run-row label \{[\s\S]*?color: var\(--dpr-text-muted\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.secret-gate-modal \{[\s\S]*?background: var\(--dpr-panel-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.secret-gate-btn\.primary \{[\s\S]*?background: var\(--dpr-primary-button-bg\);[\s\S]*?border-color: var\(--dpr-primary-button-border\);[\s\S]*?color: var\(--dpr-primary-button-text\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /html\[data-theme='dark'\] \.secret-gate-btn\.primary:hover:not\(:disabled\) \{[\s\S]*?background: var\(--dpr-primary-button-hover-bg\) !important;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.thinking-container-live \{[\s\S]*?border-left: 3px solid var\(--dpr-panel-border\);[\s\S]*?color: var\(--dpr-text-muted\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.thinking-toggle-live \{[\s\S]*?border: 1px solid var\(--dpr-panel-border\);[\s\S]*?background: var\(--dpr-panel-bg-soft\);[\s\S]*?color: var\(--dpr-text-muted\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.thinking-content-live \{[\s\S]*?white-space: pre-wrap;[\s\S]*?margin-top: 4px;[\s\S]*?\}/,
  );
}

function testAppCssUsesThemeTokensForHomeCardsAndSearchPanels() {
  const fs = require('node:fs');
  const path = require('node:path');
  const cssPath = path.join(__dirname, '..', 'app', 'app.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(
    css,
    /\.markdown-section \.dpr-home-notice-card \{[\s\S]*?border: 1px solid var\(--dpr-home-notice-border\);[\s\S]*?background: var\(--dpr-home-notice-bg\);[\s\S]*?box-shadow: var\(--dpr-home-notice-shadow\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.markdown-section \.dpr-home-notice-card::before,[\s\S]*?\.markdown-section \.dpr-home-notice-card::after \{[\s\S]*?var\(--dpr-home-notice-wave-strong\)[\s\S]*?var\(--dpr-home-notice-wave-soft\)[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.markdown-section \.dpr-home-notice-title \{[\s\S]*?color: var\(--dpr-home-notice-title\) !important;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.markdown-section \.dpr-home-notice-list li \{[\s\S]*?color: var\(--dpr-home-notice-text\) !important;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.markdown-section \.dpr-home-notice-list a \{[\s\S]*?color: var\(--dpr-home-notice-link\) !important;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.markdown-section \.dpr-home-promo-card \{[\s\S]*?border: 1px solid var\(--dpr-home-promo-border\);[\s\S]*?background: var\(--dpr-home-promo-bg\);[\s\S]*?box-shadow: var\(--dpr-home-promo-shadow\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.markdown-section \.dpr-home-promo-card::before,[\s\S]*?\.markdown-section \.dpr-home-promo-card::after \{[\s\S]*?var\(--dpr-home-promo-wave-strong\)[\s\S]*?var\(--dpr-home-promo-wave-soft\)[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.markdown-section \.dpr-home-promo-title \{[\s\S]*?color: var\(--dpr-home-promo-title\) !important;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.markdown-section \.dpr-home-promo-list li \{[\s\S]*?color: var\(--dpr-home-promo-text\) !important;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-search-panel \{[\s\S]*?background: var\(--dpr-panel-bg\);[\s\S]*?box-shadow: var\(--dpr-panel-shadow\);[\s\S]*?color: var\(--dpr-text\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-keywords-pane \{[\s\S]*?background: var\(--dpr-sidebar-tag-keyword-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-zotero-pane \{[\s\S]*?background: var\(--dpr-sidebar-tag-query-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-search-section \{[\s\S]*?background: var\(--dpr-sidebar-tag-paper-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-keywords-list::-webkit-scrollbar-track \{[\s\S]*?background: var\(--dpr-overlay-scrollbar-track\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-keywords-list::-webkit-scrollbar-thumb \{[\s\S]*?background: var\(--dpr-overlay-scrollbar-thumb\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-keywords-list::-webkit-scrollbar-thumb:hover \{[\s\S]*?background: var\(--dpr-overlay-scrollbar-thumb-hover\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#zotero-list::-webkit-scrollbar-track \{[\s\S]*?background: var\(--dpr-overlay-scrollbar-track\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#zotero-list::-webkit-scrollbar-thumb \{[\s\S]*?background: var\(--dpr-overlay-scrollbar-thumb\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#zotero-list::-webkit-scrollbar-thumb:hover \{[\s\S]*?background: var\(--dpr-overlay-scrollbar-thumb-hover\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-search-panel::-webkit-scrollbar-track \{[\s\S]*?background: var\(--dpr-overlay-scrollbar-track\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-search-panel::-webkit-scrollbar-thumb \{[\s\S]*?background: var\(--dpr-overlay-scrollbar-thumb\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /#arxiv-search-panel::-webkit-scrollbar-thumb:hover \{[\s\S]*?background: var\(--dpr-overlay-scrollbar-thumb-hover\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-modal-list \{[\s\S]*?background: var\(--dpr-panel-bg-soft\);[\s\S]*?border: 1px solid var\(--dpr-panel-border\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-chat-round \{[\s\S]*?border: 1px solid var\(--dpr-panel-border\);[\s\S]*?background: var\(--dpr-panel-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-chat-send-btn \{[\s\S]*?background: var\(--dpr-primary-action-bg\) !important;[\s\S]*?color: var\(--dpr-primary-action-text\) !important;[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-cloud-item \{[\s\S]*?border: 1px solid var\(--dpr-panel-border\);[\s\S]*?background: var\(--dpr-panel-bg\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-cloud-item\.selected \{[\s\S]*?border-color: var\(--dpr-selected-success-border\);[\s\S]*?background: var\(--dpr-selected-success-bg\);[\s\S]*?box-shadow: var\(--dpr-selected-success-shadow\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /\.dpr-pick-card\.selected \{[\s\S]*?border-color: var\(--dpr-selected-success-border\);[\s\S]*?background: var\(--dpr-selected-success-bg\);[\s\S]*?box-shadow: var\(--dpr-selected-success-shadow\);[\s\S]*?\}/,
  );
  assert.match(
    css,
    /:root \{[\s\S]*?--dpr-home-notice-border:[\s\S]*?--dpr-primary-action-bg:[\s\S]*?--dpr-selected-success-bg:[\s\S]*?\}/,
  );
  assert.match(
    css,
    /html\[data-theme='dark'\] \{[\s\S]*?--dpr-home-notice-border:[\s\S]*?--dpr-primary-action-bg:[\s\S]*?--dpr-selected-success-bg:[\s\S]*?--dpr-primary-button-bg:[\s\S]*?--dpr-overlay-scrollbar-track:[\s\S]*?\}/,
  );
  assert.match(
    css,
    /:root \{[\s\S]*?--dpr-home-notice-border:[\s\S]*?--dpr-primary-action-bg:[\s\S]*?--dpr-selected-success-bg:[\s\S]*?--dpr-primary-button-bg:[\s\S]*?--dpr-overlay-scrollbar-track:[\s\S]*?\}/,
  );
}

testNormalizeSafeUrlRejectsJavascriptAndDataUrls();
testResolveDocsAssetUrlAllowsRepoAssetsOnly();
testParseFiguresMetaFiltersUnsafeEntries();
testRenderPaperFromMetaOmitsUnsafePdfLinks();
testRenderPaperFromMetaIncludesSafePdfLinksAndFiltersUnsafeFigures();
testLoadGithubTokenForGistUsesSecretSessionAccessor();
testDocsifyPluginDoneEachPublishesCurrentRouteGlobals();
testDocsifyPluginTestHooksStayDisabledWithoutExplicitFlag();
testAppCssKeepsMarkdownKatexDisplayScrollable();
testAppCssKeepsSidebarPaperItemsReadableInDarkMode();
testAppCssUsesThemeTokensForOverlayPanels();
testAppCssUsesThemeTokensForHomeCardsAndSearchPanels();

console.log('docsify plugin tests passed');
