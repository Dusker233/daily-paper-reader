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

function testLoadGithubTokenForGistUsesSecretSessionAccessor() {
  global.window.DPRSecretSession = {
    getGithubToken() {
      return 'ghp_secret_session';
    },
  };
  global.window.DPR_RUNTIME_GITHUB_TOKEN = 'ghp_runtime_demo';

  assert.equal(loadGithubTokenForGist(), 'ghp_secret_session');
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

testNormalizeSafeUrlRejectsJavascriptAndDataUrls();
testResolveDocsAssetUrlAllowsRepoAssetsOnly();
testParseFiguresMetaFiltersUnsafeEntries();
testRenderPaperFromMetaOmitsUnsafePdfLinks();
testRenderPaperFromMetaIncludesSafePdfLinksAndFiltersUnsafeFigures();
testLoadGithubTokenForGistUsesSecretSessionAccessor();
testDocsifyPluginTestHooksStayDisabledWithoutExplicitFlag();

console.log('docsify plugin tests passed');
