const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function createClassList() {
  const values = new Set();
  return {
    add(...tokens) {
      tokens.forEach((token) => values.add(String(token)));
    },
    remove(...tokens) {
      tokens.forEach((token) => values.delete(String(token)));
    },
    toggle(token, force) {
      const normalized = String(token);
      if (force === true) {
        values.add(normalized);
        return true;
      }
      if (force === false) {
        values.delete(normalized);
        return false;
      }
      if (values.has(normalized)) {
        values.delete(normalized);
        return false;
      }
      values.add(normalized);
      return true;
    },
    contains(token) {
      return values.has(String(token));
    },
  };
}

function createStyleDeclaration() {
  return {
    setProperty(name, value) {
      this[name] = value;
    },
  };
}

function createElementFactory(registry) {
  return function createElement(tagName) {
    const listeners = {};
    const style = createStyleDeclaration();
    const element = {
      tagName: String(tagName || 'div').toUpperCase(),
      style,
      dataset: {},
      attributes: {},
      className: '',
      title: '',
      innerHTML: '',
      textContent: '',
      type: '',
      parentNode: null,
      children: [],
      classList: createClassList(),
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        if (child.id) {
          registry[child.id] = child;
        }
        return child;
      },
      removeChild(child) {
        this.children = this.children.filter((item) => item !== child);
        if (child && child.id && registry[child.id] === child) {
          delete registry[child.id];
        }
      },
      addEventListener(type, handler) {
        if (!listeners[type]) {
          listeners[type] = [];
        }
        listeners[type].push(handler);
      },
      dispatchEvent(event) {
        const handlers = listeners[event.type] || [];
        handlers.forEach((handler) => handler.call(this, event));
      },
      setAttribute(name, value) {
        const normalized = String(value);
        this.attributes[name] = normalized;
        if (name.startsWith('data-')) {
          const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          this.dataset[key] = normalized;
        }
      },
      getAttribute(name) {
        if (name === 'id') {
          return this.id || null;
        }
        return Object.prototype.hasOwnProperty.call(this.attributes, name)
          ? this.attributes[name]
          : null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      click() {
        this.dispatchEvent({
          type: 'click',
          preventDefault() {},
          stopPropagation() {},
        });
      },
    };

    let currentId = '';
    Object.defineProperty(element, 'id', {
      enumerable: true,
      configurable: true,
      get() {
        return currentId;
      },
      set(value) {
        const normalized = String(value || '');
        if (currentId && registry[currentId] === element) {
          delete registry[currentId];
        }
        currentId = normalized;
        if (normalized) {
          registry[normalized] = element;
        }
      },
    });

    return element;
  };
}

function createUiEnvironment(options = {}) {
  const registry = {};
  const documentListeners = {};
  const windowListeners = {};
  const mediaListeners = [];
  const localStorageState = {};
  if (options.storedTheme) {
    localStorageState['dpr-theme-preference-v1'] = String(options.storedTheme);
  }

  const createElement = createElementFactory(registry);
  const root = createElement('html');
  const body = createElement('body');
  const sidebarToggle = createElement('button');
  sidebarToggle.className = 'sidebar-toggle';
  body.appendChild(sidebarToggle);

  const document = {
    readyState: 'loading',
    body,
    documentElement: root,
    addEventListener(type, handler) {
      if (!documentListeners[type]) {
        documentListeners[type] = [];
      }
      documentListeners[type].push(handler);
    },
    dispatchEvent(event) {
      const handlers = documentListeners[event.type] || [];
      handlers.forEach((handler) => handler.call(document, event));
    },
    getElementById(id) {
      return registry[id] || null;
    },
    querySelector(selector) {
      if (selector === '.sidebar-toggle') {
        return sidebarToggle;
      }
      return null;
    },
    createElement,
  };

  const mediaQuery = {
    matches: Boolean(options.systemDark),
    addEventListener(type, handler) {
      if (type === 'change') {
        mediaListeners.push(handler);
      }
    },
    addListener(handler) {
      mediaListeners.push(handler);
    },
  };

  const windowObject = {
    document,
    innerWidth: 1280,
    location: {
      hostname: 'example.com',
    },
    localStorage: {
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
    },
    matchMedia() {
      return mediaQuery;
    },
    addEventListener(type, handler) {
      if (!windowListeners[type]) {
        windowListeners[type] = [];
      }
      windowListeners[type].push(handler);
    },
    removeEventListener() {},
    syncSidebarActiveIndicator() {},
    requestAnimationFrame(callback) {
      return callback();
    },
  };

  if (options.enableTests !== false) {
    windowObject.__DPR_ENABLE_UI_LAYOUT_TESTS__ = true;
  }

  global.window = windowObject;
  global.document = document;
  global.location = windowObject.location;
  global.CustomEvent = function CustomEvent(type, init) {
    this.type = type;
    this.detail = init ? init.detail : undefined;
  };
  global.requestAnimationFrame = windowObject.requestAnimationFrame;
  global.getComputedStyle = () => ({
    getPropertyValue(name) {
      if (name === '--sidebar-min-width') return '180';
      if (name === '--sidebar-max-width') return '480';
      return '';
    },
  });

  delete require.cache[require.resolve('../app/ui.layout-and-subscriptions-entry.js')];
  require('../app/ui.layout-and-subscriptions-entry.js');

  return {
    api: windowObject.DPRUILayoutTest,
    document,
    mediaQuery,
    localStorageState,
    root,
    fireDOMContentLoaded() {
      document.dispatchEvent({ type: 'DOMContentLoaded' });
    },
  };
}

function testStoredThemeAppliesImmediately() {
  const env = createUiEnvironment({ storedTheme: 'dark' });

  assert.equal(env.api.readStoredThemePreference(), 'dark');
  assert.equal(env.root.getAttribute('data-theme'), 'dark');
  assert.equal(env.root.dataset.theme, 'dark');
  assert.equal(env.root.style.colorScheme, 'dark');
}

function testSystemThemeFallbackAppliesWithoutStoredPreference() {
  const env = createUiEnvironment({ systemDark: true });

  assert.equal(env.api.resolveTheme(''), 'dark');
  assert.equal(env.root.getAttribute('data-theme'), 'dark');
  assert.equal(env.root.style.colorScheme, 'dark');
}

function testThemeToggleButtonPersistsAndUpdatesState() {
  const env = createUiEnvironment({ storedTheme: 'light' });
  env.fireDOMContentLoaded();

  const btn = env.document.getElementById('custom-theme-toggle-btn');
  const adminBtn = env.document.getElementById('custom-toggle-btn');
  assert.ok(btn, '应创建夜间模式切换按钮');
  assert.ok(adminBtn, '应保留后台管理按钮');
  assert.notEqual(btn, adminBtn, '夜间模式按钮不应覆盖原有后台按钮');
  assert.equal(btn.getAttribute('data-theme-mode'), 'light');
  assert.equal(btn.title, '切换到夜间模式');
  assert.match(btn.className, /custom-theme-toggle-btn/);

  btn.click();

  assert.equal(env.localStorageState[env.api.THEME_STORAGE_KEY], 'dark');
  assert.equal(env.root.getAttribute('data-theme'), 'dark');
  assert.equal(btn.getAttribute('data-theme-mode'), 'dark');
  assert.equal(btn.innerHTML, '☀️');
  assert.equal(btn.title, '切换到浅色模式');
  assert.equal(btn.getAttribute('aria-label'), '切换到浅色模式');
}

function testHandleThemeMediaChangeHonorsExplicitPreference() {
  const env = createUiEnvironment({ storedTheme: 'light', systemDark: false });
  env.mediaQuery.matches = true;

  env.api.handleThemeMediaChange();

  assert.equal(env.root.getAttribute('data-theme'), 'light');
  assert.equal(env.localStorageState[env.api.THEME_STORAGE_KEY], 'light');
}

function testHandleThemeMediaChangeTracksSystemPreferenceWithoutStoredOverride() {
  const env = createUiEnvironment({ systemDark: false });
  env.mediaQuery.matches = true;

  env.api.handleThemeMediaChange();

  assert.equal(env.root.getAttribute('data-theme'), 'dark');
  assert.equal(env.root.style.colorScheme, 'dark');
  assert.equal(env.localStorageState[env.api.THEME_STORAGE_KEY], undefined);
}

function testThemeToggleUsesDedicatedClassInsteadOfSharedMobileHiddenClass() {
  const env = createUiEnvironment({ storedTheme: 'light' });
  env.fireDOMContentLoaded();

  const btn = env.document.getElementById('custom-theme-toggle-btn');
  assert.ok(btn, '应创建夜间模式切换按钮');
  assert.doesNotMatch(btn.className, /(^|\s)custom-toggle-btn(\s|$)/);
  assert.match(btn.className, /(^|\s)custom-theme-toggle-btn(\s|$)/);
}

function testInlineThemeBootstrapMatchesStoredAndSystemPreferences() {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script>\s*\(function \(\) \{([\s\S]*?dpr-theme-preference-v1[\s\S]*?)\}\)\(\);\s*<\/script>/);
  assert.ok(match, '应保留首屏主题初始化脚本');

  const runBootstrap = ({ storedTheme = '', systemDark = false } = {}) => {
    const attributes = {};
    const rootStyle = {};
    const root = {
      style: rootStyle,
      setAttribute(name, value) {
        attributes[name] = String(value);
      },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
      },
    };
    const windowObject = {
      localStorage: {
        getItem(key) {
          return key === 'dpr-theme-preference-v1' && storedTheme ? String(storedTheme) : null;
        },
      },
      matchMedia() {
        return { matches: Boolean(systemDark) };
      },
    };

    const bootstrap = new Function('window', 'document', `${match[1]}`);
    bootstrap(windowObject, { documentElement: root });
    return root;
  };

  const storedDarkRoot = runBootstrap({ storedTheme: 'dark', systemDark: false });
  assert.equal(storedDarkRoot.getAttribute('data-theme'), 'dark');
  assert.equal(storedDarkRoot.style.colorScheme, 'dark');

  const systemDarkRoot = runBootstrap({ storedTheme: '', systemDark: true });
  assert.equal(systemDarkRoot.getAttribute('data-theme'), 'dark');
  assert.equal(systemDarkRoot.style.colorScheme, 'dark');

  const defaultLightRoot = runBootstrap({ storedTheme: '', systemDark: false });
  assert.equal(defaultLightRoot.getAttribute('data-theme'), 'light');
  assert.equal(defaultLightRoot.style.colorScheme, 'light');
}

function testTestHooksStayDisabledWithoutExplicitFlag() {
  const env = createUiEnvironment({ enableTests: false });
  assert.equal(env.api, undefined);
}

testStoredThemeAppliesImmediately();
testSystemThemeFallbackAppliesWithoutStoredPreference();
testThemeToggleButtonPersistsAndUpdatesState();
testHandleThemeMediaChangeHonorsExplicitPreference();
testHandleThemeMediaChangeTracksSystemPreferenceWithoutStoredOverride();
testThemeToggleUsesDedicatedClassInsteadOfSharedMobileHiddenClass();
testInlineThemeBootstrapMatchesStoredAndSystemPreferences();
testTestHooksStayDisabledWithoutExplicitFlag();

