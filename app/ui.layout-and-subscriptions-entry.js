// 全局 UI 行为：布局 + 订阅入口按钮
// 1. API Base：区分本地开发与线上部署
(function() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.API_BASE_URL = 'http://127.0.0.1:8008';
  } else {
    window.API_BASE_URL = '';
  }
})();

// 2. 侧边栏宽度拖拽脚本
(function() {
  function setupSidebarResizer() {
    // 统一“微宽屏 + 窄屏”为同一套逻辑：<1024 时为覆盖式 sidebar，不提供拖拽调宽
    if (window.innerWidth < 1024) return;
    if (document.getElementById('sidebar-resizer')) return;

    var resizer = document.createElement('div');
    resizer.id = 'sidebar-resizer';
    document.body.appendChild(resizer);

    var dragging = false;

    resizer.addEventListener('mousedown', function (e) {
      dragging = true;
      document.body.classList.add('sidebar-resizing');
      e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var styles = getComputedStyle(document.documentElement);
      var min =
        parseInt(styles.getPropertyValue('--sidebar-min-width')) || 180;
      var max =
        parseInt(styles.getPropertyValue('--sidebar-max-width')) || 480;
      var newWidth = e.clientX;
      if (newWidth < min) newWidth = min;
      if (newWidth > max) newWidth = max;
      document.documentElement.style.setProperty(
        '--sidebar-width',
        newWidth + 'px',
      );
      // 同步更新选中区域的阴影宽度
      if (window.syncSidebarActiveIndicator) {
        window.syncSidebarActiveIndicator({ animate: false });
      }
    });

    window.addEventListener('mouseup', function () {
      dragging = false;
      document.body.classList.remove('sidebar-resizing');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSidebarResizer);
  } else {
    setupSidebarResizer();
  }

  var resizeTimer = null;
  // 侧边栏自动展开/收起的阈值（与 docsify-plugin.js 中的 SIDEBAR_AUTO_COLLAPSE_WIDTH 保持一致）
  var SIDEBAR_COLLAPSE_THRESHOLD = 1024;
  // 记录上一次的窗口宽度状态，避免重复触发
  var lastWasWide = window.innerWidth >= SIDEBAR_COLLAPSE_THRESHOLD;

  // 页面加载时根据屏幕宽度设置 sidebar 初始状态
  function initSidebarState() {
    var body = document.body;
    if (window.innerWidth < SIDEBAR_COLLAPSE_THRESHOLD) {
      // 小屏幕默认收起 sidebar：沿用 Docsify 原生语义，`close` 表示展开，不使用 `close` 表示收起
      if (body.classList.contains('close')) {
        body.classList.remove('close');
      }
    }
  }

  // 在 DOM 加载完成后初始化 sidebar 状态
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarState);
  } else {
    initSidebarState();
  }

  window.addEventListener('resize', function () {
    var resizer = document.getElementById('sidebar-resizer');
    if (window.innerWidth < 1024) {
      if (resizer) resizer.style.display = 'none';
    } else {
      if (resizer) {
        resizer.style.display = 'block';
      } else {
        setupSidebarResizer();
      }
    }

    // 根据窗口宽度自动同步 sidebar 展开/收起状态
    // 桌面：body.close = 收起；移动端（<1024）：body.close = 展开（沿用 Docsify 原生语义）
    var isWide = window.innerWidth >= SIDEBAR_COLLAPSE_THRESHOLD;
    var body = document.body;
    if (isWide !== lastWasWide) {
      if (isWide) {
        // 窗口变宽，自动展开 sidebar（移除 close 类）
        if (body.classList.contains('close')) {
          body.classList.remove('close');
        }
      } else {
        // 窗口变窄，沿用 Docsify 移动端语义：默认不使用 close 表示收起状态
        if (body.classList.contains('close')) {
          body.classList.remove('close');
        }
      }
      lastWasWide = isWide;
    }

    // 即时同步选中区域的尺寸
    if (window.syncSidebarActiveIndicator) {
      window.syncSidebarActiveIndicator({ animate: false });
    }

    // 为窗口调整过程加上 dpr-resizing，禁用输入框/底部条的过渡，让动画更跟手
    document.body.classList.add('dpr-resizing');
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(function () {
      document.body.classList.remove('dpr-resizing');
      resizeTimer = null;
    }, 150);
  });
})();

// 3. 全局主题：夜间模式切换 + 本地持久化
(function() {
  var THEME_STORAGE_KEY = 'dpr-theme-preference-v1';
  var THEME_LIGHT = 'light';
  var THEME_DARK = 'dark';
  var themeMediaListenerInstalled = false;

  function normalizeThemePreference(value) {
    var normalized = String(value || '').trim().toLowerCase();
    if (normalized === THEME_DARK || normalized === THEME_LIGHT) {
      return normalized;
    }
    return '';
  }

  function readStoredThemePreference() {
    try {
      if (!window.localStorage || typeof window.localStorage.getItem !== 'function') {
        return '';
      }
      return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch (error) {
      return '';
    }
  }

  function writeStoredThemePreference(theme) {
    var normalized = normalizeThemePreference(theme);
    try {
      if (!window.localStorage) return;
      if (!normalized) {
        if (typeof window.localStorage.removeItem === 'function') {
          window.localStorage.removeItem(THEME_STORAGE_KEY);
        }
        return;
      }
      if (typeof window.localStorage.setItem === 'function') {
        window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
      }
    } catch (error) {
    }
  }

  function getThemeMediaQuery() {
    try {
      if (typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)');
      }
    } catch (error) {
    }
    return null;
  }

  function resolveTheme(preferredTheme) {
    var explicitTheme = normalizeThemePreference(preferredTheme) || readStoredThemePreference();
    if (explicitTheme) {
      return explicitTheme;
    }
    var mediaQuery = getThemeMediaQuery();
    if (mediaQuery && mediaQuery.matches) {
      return THEME_DARK;
    }
    return THEME_LIGHT;
  }

  function applyTheme(theme) {
    var resolved = normalizeThemePreference(theme) || THEME_LIGHT;
    var root = document.documentElement;
    if (!root) {
      return resolved;
    }
    if (typeof root.setAttribute === 'function') {
      root.setAttribute('data-theme', resolved);
    }
    if (root.dataset) {
      root.dataset.theme = resolved;
    }
    if (!root.style) {
      root.style = {};
    }
    root.style.colorScheme = resolved;
    return resolved;
  }

  function updateThemeToggleButton(theme) {
    var btn = document.getElementById('custom-theme-toggle-btn');
    if (!btn) return;
    var resolved = normalizeThemePreference(theme) || resolveTheme();
    var nextIsDark = resolved !== THEME_DARK;
    btn.innerHTML = resolved === THEME_DARK ? '☀️' : '🌙';
    btn.title = nextIsDark ? '切换到夜间模式' : '切换到浅色模式';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-theme-mode', resolved);
  }

  function syncTheme(preferredTheme) {
    var resolved = resolveTheme(preferredTheme);
    applyTheme(resolved);
    updateThemeToggleButton(resolved);
    return resolved;
  }

  function toggleThemePreference() {
    var nextTheme = resolveTheme() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    writeStoredThemePreference(nextTheme);
    return syncTheme(nextTheme);
  }

  function handleThemeMediaChange() {
    if (readStoredThemePreference()) {
      return;
    }
    syncTheme('');
  }

  function installThemeMediaListener() {
    if (themeMediaListenerInstalled) {
      return;
    }
    var mediaQuery = getThemeMediaQuery();
    if (!mediaQuery) {
      return;
    }
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleThemeMediaChange);
      themeMediaListenerInstalled = true;
      return;
    }
    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleThemeMediaChange);
      themeMediaListenerInstalled = true;
    }
  }

  function createThemeToggleButton() {
    if (document.getElementById('custom-theme-toggle-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'custom-theme-toggle-btn';
    btn.className = 'custom-theme-toggle-btn';
    btn.type = 'button';
    btn.innerHTML = '🌙';
    btn.title = '切换到夜间模式';
    btn.setAttribute('aria-label', btn.title);

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleThemePreference();
    });

    document.body.appendChild(btn);
    updateThemeToggleButton(resolveTheme());
  }

  function initThemeToggleButton() {
    if (!document.body || typeof document.body.appendChild !== 'function') {
      setTimeout(initThemeToggleButton, 100);
      return;
    }
    createThemeToggleButton();
    syncTheme();
    installThemeMediaListener();
  }

  syncTheme();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggleButton);
  } else {
    initThemeToggleButton();
  }

  if (typeof window !== 'undefined' && window.__DPR_ENABLE_UI_LAYOUT_TESTS__ === true) {
    window.DPRUILayoutTest = {
      normalizeThemePreference: normalizeThemePreference,
      readStoredThemePreference: readStoredThemePreference,
      writeStoredThemePreference: writeStoredThemePreference,
      resolveTheme: resolveTheme,
      applyTheme: applyTheme,
      syncTheme: syncTheme,
      toggleThemePreference: toggleThemePreference,
      handleThemeMediaChange: handleThemeMediaChange,
      createThemeToggleButton: createThemeToggleButton,
      updateThemeToggleButton: updateThemeToggleButton,
      getThemeMediaQuery: getThemeMediaQuery,
      THEME_STORAGE_KEY: THEME_STORAGE_KEY,
      THEME_LIGHT: THEME_LIGHT,
      THEME_DARK: THEME_DARK,
    };
  }
})();

// 4. 自定义订阅管理入口按钮脚本（左下角 📚）
(function() {
  function createCustomButton() {
    if (document.getElementById('custom-toggle-btn')) return;

    var sidebarToggle = document.querySelector('.sidebar-toggle');
    if (!sidebarToggle) {
      setTimeout(createCustomButton, 100);
      return;
    }

    var btn = document.createElement('button');
    btn.id = 'custom-toggle-btn';
    btn.className = 'custom-toggle-btn';
    btn.innerHTML = '⚙️';
    btn.title = '后台管理';

    btn.addEventListener('click', function () {
      var event = new CustomEvent('ensure-arxiv-ui');
      document.dispatchEvent(event);

      setTimeout(function () {
        var loadEvent = new CustomEvent('load-arxiv-subscriptions');
        document.dispatchEvent(loadEvent);

        var overlay = document.getElementById('arxiv-search-overlay');
        if (overlay) {
          overlay.style.display = 'flex';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              overlay.classList.add('show');
            });
          });
        }
      }, 100);
    });

    document.body.appendChild(btn);
  }

  // 左下角保留一个独立触发函数，暂不自动挂载按钮（防止重复入口）
  function createQuickRunButton() {
    if (document.getElementById('custom-quick-run-btn')) return;

    function requestQuickRunPanel() {
      window.__dprQuickRunOpenRequested = true;

      if (window.PrivateDiscussionChat && typeof window.PrivateDiscussionChat.openQuickRunPanel === 'function') {
        const opened = window.PrivateDiscussionChat.openQuickRunPanel();
        if (opened) {
          window.__dprQuickRunOpenRequested = false;
          return;
        }
      }

      if (window.DPRWorkflowRunner && typeof window.DPRWorkflowRunner.open === 'function') {
        window.__dprQuickRunOpenRequested = false;
        window.DPRWorkflowRunner.open();
        return;
      }

      var event = new CustomEvent('dpr-open-quick-run');
      document.dispatchEvent(event);
    }

    var quickBtn = document.createElement('button');
    quickBtn.id = 'custom-quick-run-btn';
    quickBtn.className = 'custom-toggle-btn custom-quick-run-btn';
    quickBtn.innerHTML = '🚀';
    quickBtn.title = '快速抓取';
    quickBtn.setAttribute('aria-label', '快速抓取');

    quickBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      requestQuickRunPanel();
    });

    document.body.appendChild(quickBtn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createCustomButton);
  } else {
    createCustomButton();
  }
})();
