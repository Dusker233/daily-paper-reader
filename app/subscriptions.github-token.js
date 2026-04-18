// GitHub Token 订阅配置模块
// 负责：本地存储 Token、验证权限、更新按钮与信息区状态

window.SubscriptionsGithubToken = (function () {
  const GITHUB_TOKEN_STORAGE_KEY = 'github_token_data';
  const DEFAULT_GITHUB_REPO = 'daily-paper-reader';
  const DEFAULT_SEED_UPLOAD_BRANCH_PREFIX = 'seed-paper-requests';
  const CONFIG_PATH_CANDIDATES = [
    'config.yaml',
    'docs/config.yaml',
    '../config.yaml',
  ];

  const sanitizeGithubTokenData = (data) => {
    if (!data || typeof data !== 'object') {
      return null;
    }
    const sanitized = {
      verified: data.verified === true,
      login: String(data.login || '').trim(),
      name: String(data.name || '').trim(),
      repo: String(data.repo || '').trim(),
      scopes: Array.isArray(data.scopes)
        ? data.scopes.map((item) => String(item || '').trim()).filter(Boolean)
        : [],
      savedAt: String(data.savedAt || '').trim(),
    };
    if (!sanitized.verified && !sanitized.login && !sanitized.name && !sanitized.repo && !sanitized.scopes.length && !sanitized.savedAt) {
      return null;
    }
    return sanitized;
  };

  const loadSessionGithubToken = () => {
    try {
      const session = window.DPRSecretSession || {};
      if (typeof session.getGithubToken === 'function') {
        const token = String(session.getGithubToken() || '').trim();
        return token || null;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const saveSessionGithubToken = (token) => {
    const normalized = String(token || '').trim();
    try {
      const session = window.DPRSecretSession || {};
      if (typeof session.setSessionGithubToken === 'function') {
        session.setSessionGithubToken(normalized);
      }
    } catch {
      // ignore
    }
  };

  const clearSessionGithubToken = () => {
    saveSessionGithubToken('');
  };

  // 从本地存储加载 GitHub Token 验证结果（不再持久化原始 PAT）
  const loadGithubToken = () => {
    try {
      const tokenData = localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
      if (tokenData) {
        const data = JSON.parse(tokenData);
        const sanitized = sanitizeGithubTokenData(data);
        if (!sanitized) {
          localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
          return null;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'token')) {
          localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, JSON.stringify(sanitized));
        }
        return sanitized;
      }
    } catch (e) {
      console.error('Failed to load GitHub token:', e);
    }
    return null;
  };

  // 保存 GitHub Token 验证结果到本地存储（仅保存非敏感元数据）
  const saveGithubToken = (data) => {
    try {
      const sanitized = sanitizeGithubTokenData(data);
      if (!sanitized) {
        localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
        return;
      }
      localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Failed to save GitHub token:', e);
    }
  };

  // 清除 GitHub Token 数据
  const clearGithubToken = () => {
    clearSessionGithubToken();
    try {
      localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear GitHub token:', e);
    }
  };

  const isValidGithubRepoSegment = (value) => /^[A-Za-z0-9_.-]+$/.test(String(value || '').trim());

  const normalizeGithubRepoSegment = (value, label) => {
    const normalized = String(value || '').trim();
    if (!normalized || !isValidGithubRepoSegment(normalized)) {
      throw new Error(`非法的 GitHub ${label}：${normalized || '<empty>'}`);
    }
    return normalized;
  };

  const isTrustedGithubPagesHost = (host) => /(?:^|\.)github\.io$/i.test(String(host || '').trim());

  const resolveRepoInfoFromPage = (login, currentHref) => {
    const currentUrl = String(currentHref || '');
    const urlObj = new URL(currentUrl);
    const host = String(urlObj.hostname || '').trim();
    if (host === 'localhost' || host === '127.0.0.1') {
      return {
        owner: normalizeGithubRepoSegment(login || '', 'owner'),
        repo: DEFAULT_GITHUB_REPO,
      };
    }
    const githubPagesMatch = currentUrl.match(/https?:\/\/([^.]+)\.github\.io\/([^\/]+)/i);
    if (githubPagesMatch && isTrustedGithubPagesHost(host)) {
      return {
        owner: normalizeGithubRepoSegment(githubPagesMatch[1], 'owner'),
        repo: normalizeGithubRepoSegment(githubPagesMatch[2], 'repo'),
      };
    }
    throw new Error('当前页面不是受信任的 GitHub Pages 或 localhost，无法自动推断可写入仓库。');
  };

  const loadRepoInfoFromConfig = async (login, token, currentHref) => {
    const fallbackOwner = String(login || '').trim();
    const yaml = window.jsyaml || window.jsYaml || window.jsYAML;
    if (!yaml || typeof yaml.load !== 'function') {
      return null;
    }
    let currentHost = '';
    try {
      currentHost = String(new URL(String(currentHref || '')).hostname || '').trim().toLowerCase();
    } catch {
      return null;
    }
    if (!currentHost || currentHost === 'localhost' || currentHost === '127.0.0.1') {
      return null;
    }
    for (const url of CONFIG_PATH_CANDIDATES) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          continue;
        }
        const raw = await res.text();
        const cfg = yaml.load(raw || '') || {};
        const github = cfg && typeof cfg === 'object' ? cfg.github : null;
        if (!github || typeof github !== 'object') {
          continue;
        }
        const owner = String(github.owner || '').trim() || fallbackOwner;
        const repo = String(github.repo || '').trim();
        if (!owner || !repo) {
          continue;
        }
        const normalizedOwner = normalizeGithubRepoSegment(owner, 'owner');
        const normalizedRepo = normalizeGithubRepoSegment(repo, 'repo');
        const pagesRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedRepo)}/pages`,
          {
            headers: {
              Authorization: `token ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );
        if (!pagesRes.ok) {
          continue;
        }
        const pagesData = await pagesRes.json().catch(() => null);
        const cname = String((pagesData && pagesData.cname) || '').trim().toLowerCase();
        if (cname !== currentHost) {
          continue;
        }
        return {
          owner: normalizedOwner,
          repo: normalizedRepo,
        };
      } catch {
        // ignore candidate and continue
      }
    }
    return null;
  };

  // 验证 GitHub Token 并检查权限
  const verifyGithubToken = async (token, options = {}) => {
    const { requireWorkflow = true } = options;
    try {
      // 1. 获取用户信息
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!userRes.ok) {
        throw new Error('Token 无效或已过期');
      }

      const userData = await userRes.json();

      // 2. 检查权限 - 通过响应头的 X-OAuth-Scopes
      const scopes = userRes.headers.get('X-OAuth-Scopes');
      const scopeList = scopes ? scopes.split(',').map((s) => s.trim()) : [];

      const requiredScopes = requireWorkflow ? ['repo', 'workflow', 'gist'] : ['repo', 'gist'];
      const missingScopes = requiredScopes.filter(
        (scope) => !scopeList.includes(scope),
      );

      if (missingScopes.length > 0) {
        // 权限不足时直接返回失败结果，并带上现有权限列表，供 UI 做更友好的展示
        return {
          valid: false,
          error: `Token 权限不足：缺少 ${missingScopes.join(
            ', ',
          )}。请使用 Classic Personal Access Token，并补充所示权限。`,
          scopes: scopeList,
          login: userData.login,
        };
      }

      // 3. 优先从页面环境推断仓库；自定义域名则回退到 config.yaml 的 github 配置
      let pageRepo = null;
      try {
        pageRepo = resolveRepoInfoFromPage(userData.login || '', window.location.href);
      } catch {
        pageRepo = await loadRepoInfoFromConfig(userData.login || '', token, window.location.href);
        if (!pageRepo) {
          throw new Error('当前页面不是受信任的 GitHub Pages 或 localhost，且 config.yaml 未提供有效的 github.repo 配置，无法自动推断可写入仓库。');
        }
      }
      const repoOwner = pageRepo.owner;
      const repoName = pageRepo.repo;

      // 4. 验证 Token 是否有权限访问该仓库
      let defaultBranch = 'main';
      if (repoOwner && repoName) {
        const repoRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}`,
          {
            headers: {
              Authorization: `token ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (!repoRes.ok) {
          throw new Error(
            `无法访问仓库 ${repoOwner}/${repoName}，请确认 Token 权限`,
          );
        }

        const repoData = await repoRes.json();

        if (!repoData.permissions || !repoData.permissions.push) {
          throw new Error(
            `没有仓库 ${repoOwner}/${repoName} 的写入权限`,
          );
        }
        defaultBranch = String(repoData.default_branch || 'main').trim() || 'main';
      }

      return {
        valid: true,
        login: userData.login,
        name: userData.name,
        repo:
          repoOwner && repoName
            ? `${repoOwner}/${repoName}`
            : '未检测到仓库',
        scopes: scopeList,
        defaultBranch,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  };

  // 优先使用密钥会话模块提供的 GitHub Token；旧验证 UI 也通过同一会话 accessor 落到内存态。
  const getTokenForConfig = () => {
    try {
      const session = window.DPRSecretSession || {};
      if (typeof session.getGithubToken === 'function') {
        const token = String(session.getGithubToken() || '').trim();
        if (token) return token;
      }
    } catch {
      // ignore
    }
    return loadSessionGithubToken();
  };

  // 基于 Token 推断仓库 owner/name（复用 verifyGithubToken 的逻辑）
  const resolveRepoInfoFromToken = async (token, requireWorkflow = true) => {
    const result = await verifyGithubToken(token, { requireWorkflow });
    if (!result.valid) {
      throw new Error(
        `GitHub Token 验证失败：${result.error || '原因未知'}`,
      );
    }
    if (!result.repo || !result.repo.includes('/')) {
      throw new Error('无法从 GitHub Token 推断有效的仓库信息');
    }
    const parts = result.repo.split('/');
    const owner = normalizeGithubRepoSegment(parts[0], 'owner');
    const repo = normalizeGithubRepoSegment(parts[1], 'repo');
    return {
      owner,
      repo,
      token,
      defaultBranch: String(result.defaultBranch || 'main').trim() || 'main',
    };
  };

  const resolveExplicitRepoDefaultBranch = async (owner, repo, token) => {
    const normalizedOwner = normalizeGithubRepoSegment(owner, 'owner');
    const normalizedRepo = normalizeGithubRepoSegment(repo, 'repo');
    const normalizedToken = String(token || '').trim();
    if (!normalizedOwner || !normalizedRepo) {
      throw new Error('无法解析目标仓库信息。');
    }
    if (!normalizedToken) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    const repoLabel = `${normalizedOwner}/${normalizedRepo}`;
    try {
      const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedRepo)}`, {
        headers: {
          Authorization: `token ${normalizedToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`无法读取仓库 ${repoLabel} 的默认分支：${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
      }
      const data = await res.json().catch(() => null);
      const defaultBranch = String((data && data.default_branch) || '').trim();
      if (!defaultBranch) {
        throw new Error(`仓库 ${repoLabel} 未返回默认分支信息。`);
      }
      return defaultBranch;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`无法读取仓库 ${repoLabel} 的默认分支。`);
    }
  };

  // 通过 GitHub API 读取 config.yaml（用于保存时获取最新 sha）
  const loadConfigFromGithub = async () => {
    const token = getTokenForConfig();
    if (!token) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    const info = await resolveRepoInfoFromToken(token, false);
    const res = await fetch(
      `https://api.github.com/repos/${info.owner}/${info.repo}/contents/config.yaml`,
      {
        headers: {
          Authorization: `token ${info.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    if (!res.ok) {
      throw new Error('无法读取 config.yaml，请确认文件已存在且 Token 有权限。');
    }
    const data = await res.json();
    const rawBase64 = (data.content || '').replace(/\n/g, '');
    // 使用 UTF-8 解码 base64，避免包含中文时出现乱码
    let content = '';
    try {
      const binary = atob(rawBase64);
      // 兼容旧浏览器：优先使用 TextDecoder，其次使用 escape/decodeURIComponent 方案
      if (window.TextDecoder) {
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        content = new TextDecoder('utf-8').decode(bytes);
      } else {
        // eslint-disable-next-line no-escape
        content = decodeURIComponent(escape(binary));
      }
    } catch (e) {
      console.error('Failed to decode config.yaml content from GitHub:', e);
      content = '';
    }
    const yaml = window.jsyaml || window.jsYaml || window.jsYAML;
    if (!yaml || typeof yaml.load !== 'function') {
      throw new Error('前端缺少 YAML 解析库（js-yaml），无法解析 config.yaml。');
    }
    const cfg = yaml.load(content) || {};
    return { config: cfg, sha: data.sha };
  };

  // 从当前站点相对路径读取 config.yaml（无需 GitHub Token，仅用于前端展示）
  // 注意：GitHub Pages 通常是 https://<user>.github.io/<repo>/，因此不能用绝对路径 /config.yaml（会指向域名根）。
  const loadConfig = async () => {
    try {
      const candidates = [
        'config.yaml',
        'docs/config.yaml',
        '../config.yaml',
      ];

      let lastError = null;
      for (const url of candidates) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) {
            lastError = new Error(`无法读取 ${url}（HTTP ${res.status}）`);
            continue;
          }
          const text = await res.text();
          const yaml = window.jsyaml || window.jsYaml || window.jsYAML;
          if (!yaml || typeof yaml.load !== 'function') {
            throw new Error('前端缺少 YAML 解析库（js-yaml），无法解析 config.yaml。');
          }
          const cfg = yaml.load(text || '') || {};
          return { config: cfg, sha: null, source: url };
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError || new Error('无法读取本地 config.yaml（未知原因）');
    } catch (e) {
      console.error('从站点读取 config.yaml 失败：', e);
      throw e;
    }
  };

  const isShaConflictResponse = (status, text) => {
    const message = String(text || '').toLowerCase();
    if (status === 409) {
      return /sha|blob|conflict/.test(message);
    }
    if (status === 422) {
      return /sha|blob|latest|expected/.test(message);
    }
    return false;
  };

  const toPathSlug = (value, fallback = 'item') => {
    const slug = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || fallback;
  };

  const normalizeRepoWritePath = (value) => String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');

  const isAllowedRepoWritePath = (value) => {
    const normalized = normalizeRepoWritePath(value);
    return /^requests\/seed_papers\/[a-z0-9][a-z0-9-]*\/(?:request\.json|[a-z0-9][a-z0-9-]*\.pdf)$/i.test(normalized);
  };

  const isValidGithubRef = (value) => {
    const normalized = String(value || '').trim();
    return !!normalized
      && /^[A-Za-z0-9._/-]+$/.test(normalized)
      && !normalized.startsWith('/')
      && !normalized.endsWith('/')
      && !normalized.includes('..')
      && !normalized.includes('//');
  };

  const normalizeGithubRef = (value, fallback = 'main') => {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return String(fallback || 'main').trim() || 'main';
    }
    if (!isValidGithubRef(normalized)) {
      throw new Error(`非法的 GitHub ref：${normalized}`);
    }
    return normalized;
  };

  const encodeGithubRefPath = (value) => String(value || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const readRepoGitRef = async (owner, repo, token, ref) => {
    const normalizedOwner = normalizeGithubRepoSegment(owner, 'owner');
    const normalizedRepo = normalizeGithubRepoSegment(repo, 'repo');
    const normalizedToken = String(token || '').trim();
    const normalizedRef = normalizeGithubRef(ref);
    if (!normalizedToken) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    const repoLabel = `${normalizedOwner}/${normalizedRepo}`;
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedRepo)}/git/ref/heads/${encodeGithubRefPath(normalizedRef)}`,
      {
        headers: {
          Authorization: `token ${normalizedToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`无法读取仓库 ${repoLabel} 的分支 ${normalizedRef}：${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
    }
    return res.json().catch(() => null);
  };

  const extractGitRefSha = (data) => String(
    (data && data.object && data.object.sha) || '',
  ).trim();

  const extractRepoFileSha = (data) => String(
    (data && data.fileSha)
    || (data && data.sha)
    || (data && data.content && data.content.sha)
    || '',
  ).trim();

  const createRepoGitRef = async (owner, repo, token, ref, sha) => {
    const normalizedOwner = normalizeGithubRepoSegment(owner, 'owner');
    const normalizedRepo = normalizeGithubRepoSegment(repo, 'repo');
    const normalizedToken = String(token || '').trim();
    const normalizedRef = normalizeGithubRef(ref);
    const normalizedSha = String(sha || '').trim();
    if (!normalizedToken) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    if (!normalizedSha) {
      throw new Error(`无法创建分支 ${normalizedRef}：缺少源提交 sha。`);
    }
    const repoLabel = `${normalizedOwner}/${normalizedRepo}`;
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedRepo)}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${normalizedToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${normalizedRef}`,
          sha: normalizedSha,
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`无法创建仓库 ${repoLabel} 的分支 ${normalizedRef}：${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
    }
    return res.json().catch(() => null);
  };

  const updateRepoGitRef = async (owner, repo, token, ref, sha, force = false) => {
    const normalizedOwner = normalizeGithubRepoSegment(owner, 'owner');
    const normalizedRepo = normalizeGithubRepoSegment(repo, 'repo');
    const normalizedToken = String(token || '').trim();
    const normalizedRef = normalizeGithubRef(ref);
    const normalizedSha = String(sha || '').trim();
    if (!normalizedToken) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    if (!normalizedSha) {
      throw new Error(`无法更新分支 ${normalizedRef}：缺少目标提交 sha。`);
    }
    const repoLabel = `${normalizedOwner}/${normalizedRepo}`;
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedRepo)}/git/refs/heads/${encodeGithubRefPath(normalizedRef)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `token ${normalizedToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: normalizedSha,
          force: force === true,
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`无法更新仓库 ${repoLabel} 的分支 ${normalizedRef}：${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
    }
    return res.json().catch(() => null);
  };

  const buildSeedPaperUploadBranch = ({ requestId, branchPrefix } = {}) => {
    const normalizedRequestId = toPathSlug(requestId, 'seed-paper-request');
    const prefix = normalizeGithubRef(
      branchPrefix || DEFAULT_SEED_UPLOAD_BRANCH_PREFIX,
      DEFAULT_SEED_UPLOAD_BRANCH_PREFIX,
    );
    return normalizeGithubRef(`${prefix}/${normalizedRequestId}`);
  };

  const prepareSeedPaperUploadTarget = async ({
    owner,
    repo,
    token,
    branch,
    requestId,
    branchPrefix,
  } = {}) => {
    const effectiveToken = token || getTokenForConfig();
    if (!effectiveToken) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    const repoInfo = owner && repo
      ? {
          owner: normalizeGithubRepoSegment(owner, 'owner'),
          repo: normalizeGithubRepoSegment(repo, 'repo'),
          token: effectiveToken,
          defaultBranch: await resolveExplicitRepoDefaultBranch(owner, repo, effectiveToken),
        }
      : await resolveRepoInfoFromToken(effectiveToken, false);
    const defaultBranch = normalizeGithubRef(repoInfo.defaultBranch || 'main');
    const uploadBranch = branch
      ? normalizeGithubRef(branch)
      : buildSeedPaperUploadBranch({ requestId, branchPrefix });
    if (uploadBranch === defaultBranch) {
      throw new Error('seed 上传分支不能与默认分支相同。');
    }
    const defaultRef = await readRepoGitRef(repoInfo.owner, repoInfo.repo, effectiveToken, defaultBranch);
    const defaultSha = extractGitRefSha(defaultRef);
    if (!defaultSha) {
      throw new Error(`无法读取仓库 ${repoInfo.owner}/${repoInfo.repo} 默认分支 ${defaultBranch} 的最新提交。`);
    }
    const uploadRef = await readRepoGitRef(repoInfo.owner, repoInfo.repo, effectiveToken, uploadBranch);
    const uploadSha = extractGitRefSha(uploadRef);
    const created = !uploadSha;
    const needsReset = !!uploadSha && uploadSha !== defaultSha;
    if (created) {
      await createRepoGitRef(repoInfo.owner, repoInfo.repo, effectiveToken, uploadBranch, defaultSha);
    } else if (needsReset) {
      await updateRepoGitRef(repoInfo.owner, repoInfo.repo, effectiveToken, uploadBranch, defaultSha, true);
    }
    return {
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      token: effectiveToken,
      defaultBranch,
      branch: uploadBranch,
      ref: uploadBranch,
      sourceSha: defaultSha,
      baseSha: defaultSha,
      created,
    };
  };

  const buildSeedPaperRequestPath = ({ requestId, fileName } = {}) => {
    const normalizedRequestId = toPathSlug(requestId, 'seed-paper-request');
    const rawFileName = String(fileName || 'seed-paper.pdf')
      .trim()
      .replace(/\\/g, '/')
      .split('/')
      .pop() || 'seed-paper.pdf';
    const extensionMatch = rawFileName.match(/\.([a-z0-9]+)$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'pdf';
    const stem = rawFileName.replace(/\.[^.]+$/, '');
    const normalizedFileName = `${toPathSlug(stem, 'seed-paper')}.${extension}`;
    const dirPath = `requests/seed_papers/${normalizedRequestId}`;
    return {
      requestId: normalizedRequestId,
      dirPath,
      requestPath: `${dirPath}/request.json`,
      filePath: `${dirPath}/${normalizedFileName}`,
    };
  };

  const bytesToBase64 = (value) => {
    const bytes = value instanceof Uint8Array
      ? value
      : (value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(0));
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      const chunk = bytes.subarray(offset, offset + 0x8000);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const utf8ToBase64 = (value) => {
    const text = String(value || '');
    if (window.TextEncoder) {
      return bytesToBase64(new TextEncoder().encode(text));
    }
    return btoa(unescape(encodeURIComponent(text)));
  };

  const writeRepoFile = async ({
    owner,
    repo,
    token,
    branch,
    path,
    contentText,
    contentBase64,
    contentBytes,
    sha,
    commitMessage,
  } = {}) => {
    const normalizedPath = normalizeRepoWritePath(path);
    if (!isAllowedRepoWritePath(normalizedPath)) {
      throw new Error(`不允许写入该仓库路径：${normalizedPath || '<empty>'}`);
    }
    const effectiveToken = token || getTokenForConfig();
    if (!effectiveToken) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    const repoInfo = owner && repo
      ? {
          owner: normalizeGithubRepoSegment(owner, 'owner'),
          repo: normalizeGithubRepoSegment(repo, 'repo'),
          token: effectiveToken,
          defaultBranch: branch
            ? normalizeGithubRef(branch)
            : await resolveExplicitRepoDefaultBranch(owner, repo, effectiveToken),
        }
      : await resolveRepoInfoFromToken(effectiveToken, false);

    let encodedContent = '';
    if (typeof contentBase64 === 'string' && contentBase64.trim()) {
      encodedContent = contentBase64.trim();
    } else if (typeof contentText === 'string') {
      encodedContent = utf8ToBase64(contentText);
    } else if (contentBytes instanceof ArrayBuffer) {
      encodedContent = bytesToBase64(contentBytes);
    } else if (ArrayBuffer.isView(contentBytes)) {
      encodedContent = bytesToBase64(
        new Uint8Array(contentBytes.buffer, contentBytes.byteOffset, contentBytes.byteLength),
      );
    } else {
      throw new Error('写入仓库文件失败：缺少文件内容。');
    }

    const resolvedBranch = normalizeGithubRef(branch || repoInfo.defaultBranch || 'main');
    const body = {
      message: String(commitMessage || `chore: add ${normalizedPath}`),
      content: encodedContent,
      branch: resolvedBranch,
    };
    if (sha) {
      body.sha = sha;
    }

    const encodedPath = normalizedPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}/contents/${encodedPath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${repoInfo.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (isShaConflictResponse(res.status, text)) {
        const error = new Error(`写入 ${normalizedPath} 失败：${res.status} ${res.statusText} - ${text}`);
        error.isShaConflict = true;
        throw error;
      }
      throw new Error(`写入 ${normalizedPath} 失败：${res.status} ${res.statusText} - ${text}`);
    }
    const result = await res.json();
    const resultData = result && typeof result === 'object' ? result : {};
    return {
      ...resultData,
      path: normalizedPath,
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      branch: resolvedBranch,
      ref: resolvedBranch,
      fileSha: extractRepoFileSha(resultData),
    };
  };

  const readRepoFile = async ({
    owner,
    repo,
    token,
    path,
    ref,
  } = {}) => {
    const normalizedPath = normalizeRepoWritePath(path);
    if (!isAllowedRepoWritePath(normalizedPath)) {
      throw new Error(`不允许读取该仓库路径：${normalizedPath || '<empty>'}`);
    }
    const effectiveToken = token || getTokenForConfig();
    if (!effectiveToken) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    const repoInfo = owner && repo
      ? {
          owner: normalizeGithubRepoSegment(owner, 'owner'),
          repo: normalizeGithubRepoSegment(repo, 'repo'),
          token: effectiveToken,
          defaultBranch: ref
            ? normalizeGithubRef(ref)
            : await resolveExplicitRepoDefaultBranch(owner, repo, effectiveToken),
        }
      : await resolveRepoInfoFromToken(effectiveToken, false);
    const resolvedRef = normalizeGithubRef(ref || repoInfo.defaultBranch || 'main');
    const encodedPath = normalizedPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    const url = new URL(`https://api.github.com/repos/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}/contents/${encodedPath}`);
    url.searchParams.set('ref', resolvedRef);
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `token ${repoInfo.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`读取 ${normalizedPath} 失败：${res.status} ${res.statusText} - ${text}`);
    }
    const data = await res.json();
    const fileData = data && typeof data === 'object' ? data : {};
    return {
      ...fileData,
      path: normalizedPath,
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      ref: resolvedRef,
      fileSha: extractRepoFileSha(fileData),
    };
  };

  const verifyRepoFilesVisible = async ({
    owner,
    repo,
    token,
    ref,
    paths,
    expectedFiles,
  } = {}) => {
    const list = Array.isArray(paths) ? paths : [];
    const effectiveToken = token || getTokenForConfig();
    if (!effectiveToken) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    const repoInfo = owner && repo
      ? {
          owner: normalizeGithubRepoSegment(owner, 'owner'),
          repo: normalizeGithubRepoSegment(repo, 'repo'),
          token: effectiveToken,
          defaultBranch: ref
            ? normalizeGithubRef(ref)
            : await resolveExplicitRepoDefaultBranch(owner, repo, effectiveToken),
        }
      : await resolveRepoInfoFromToken(effectiveToken, false);
    const effectiveRef = normalizeGithubRef(ref || repoInfo.defaultBranch || 'main');
    const expectedByPath = new Map();
    if (Array.isArray(expectedFiles)) {
      expectedFiles.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const normalizedPath = normalizeRepoWritePath(item.path);
        if (!normalizedPath) return;
        expectedByPath.set(normalizedPath, {
          path: normalizedPath,
          ref: item.ref ? normalizeGithubRef(item.ref, effectiveRef) : effectiveRef,
          fileSha: String(item.fileSha || item.sha || '').trim(),
        });
      });
    }
    const results = await Promise.all(list.map(async (itemPath) => {
      const normalizedPath = normalizeRepoWritePath(itemPath);
      const expected = expectedByPath.get(normalizedPath) || null;
      const file = await readRepoFile({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        token: effectiveToken,
        ref: effectiveRef,
        path: normalizedPath,
      });
      const actualRef = file && file.ref ? file.ref : effectiveRef;
      const actualSha = file && file.fileSha ? String(file.fileSha).trim() : '';
      const matchesExpectedRef = !expected || expected.ref === actualRef;
      const matchesExpectedSha = !expected || !expected.fileSha || expected.fileSha === actualSha;
      return {
        path: normalizedPath,
        exists: !!file,
        ref: actualRef,
        fileSha: actualSha,
        matchesExpectedRef,
        matchesExpectedSha,
      };
    }));
    return {
      ref: effectiveRef,
      files: results,
      allVisible: results.every((item) => item.exists && item.matchesExpectedRef && item.matchesExpectedSha),
    };
  };

  const writeConfigToGithub = async ({ owner, repo, token, contentObject, sha, commitMessage }) => {
    const yaml = window.jsyaml || window.jsYaml || window.jsYAML;
    if (!yaml || typeof yaml.dump !== 'function') {
      throw new Error('前端缺少 YAML 序列化库（js-yaml），无法写入 config.yaml。');
    }
    const newContent = yaml.dump(contentObject || {}, { lineWidth: 120 });
    const body = {
      message: commitMessage,
      content: btoa(unescape(encodeURIComponent(newContent))),
      sha,
    };
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/config.yaml`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (isShaConflictResponse(res.status, text)) {
        const error = new Error(`写入 config.yaml 失败：${res.status} ${res.statusText} - ${text}`);
        error.isShaConflict = true;
        throw error;
      }
      throw new Error(
        `写入 config.yaml 失败：${res.status} ${res.statusText} - ${text}`,
      );
    }
    return res.json();
  };

  // 更新 config.yaml：接收一个 updater(config) 回调，返回新的 config 对象
  const updateConfig = async (updater, commitMessage = 'chore: update config.yaml from dashboard') => {
    const token = getTokenForConfig();
    if (!token) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    const info = await resolveRepoInfoFromToken(token, false);
    let latest = await loadConfigFromGithub();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const current = latest && latest.config ? latest.config : {};
      const next = typeof updater === 'function' ? updater({ ...(current || {}) }) || current : current;
      try {
        return await writeConfigToGithub({
          owner: info.owner,
          repo: info.repo,
          token: info.token,
          contentObject: next,
          sha: latest.sha,
          commitMessage,
        });
      } catch (error) {
        if (!error || !error.isShaConflict || attempt > 0) {
          throw error;
        }
        latest = await loadConfigFromGithub();
      }
    }
    throw new Error('写入 config.yaml 失败：遇到未处理的并发写入冲突。');
  };

  // 使用给定的 config 对象保存到远端 config.yaml（用于“保存”按钮）
  const saveConfig = async (configObject, commitMessage = 'chore: save dashboard config from panel') => {
    const token = getTokenForConfig();
    if (!token) {
      throw new Error('未配置有效的 GitHub Token，请先完成首页的新配置指引。');
    }
    const info = await resolveRepoInfoFromToken(token, false);
    // 仅用于获取当前文件的 sha
    const { sha } = await loadConfigFromGithub();
    const yaml = window.jsyaml || window.jsYaml || window.jsYAML;
    if (!yaml || typeof yaml.dump !== 'function') {
      throw new Error('前端缺少 YAML 序列化库（js-yaml），无法写入 config.yaml。');
    }
    const safeConfig = configObject || {};
    const newContent = yaml.dump(safeConfig, { lineWidth: 120 });
    const body = {
      message: commitMessage,
      content: btoa(unescape(encodeURIComponent(newContent))),
      sha,
    };
    const res = await fetch(
      `https://api.github.com/repos/${info.owner}/${info.repo}/contents/config.yaml`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${info.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `写入 config.yaml 失败：${res.status} ${res.statusText} - ${text}`,
      );
    }
    return res.json();
  };

    const init = (dom) => {
      const {
        githubAuthBtn, // 现在可能为 null，仅用于兼容旧调用
        githubTokenSection,
      githubTokenInput,
      githubTokenToggleBtn,
      githubTokenVerifyBtn,
      githubTokenClearBtn,
      githubTokenMessage,
      githubTokenInfo,
      githubUserName,
      githubRepoName,
    } = dom;

    // 公共：渲染“验证成功”提示信息
    const setTokenMessage = (lines, color = '#666', { boldFirstLine = false } = {}) => {
      if (!githubTokenMessage) return;
      githubTokenMessage.textContent = '';
      const container = document.createElement('div');
      container.style.color = color;
      container.style.fontSize = '12px';
      container.style.lineHeight = '1.6';
      (Array.isArray(lines) ? lines : [lines]).filter((line) => line !== null && line !== undefined && String(line).trim()).forEach((line, index, arr) => {
        const row = document.createElement(index === 0 && boldFirstLine ? 'strong' : 'span');
        row.textContent = String(line);
        container.appendChild(row);
        if (index < arr.length - 1) {
          container.appendChild(document.createElement('br'));
        }
      });
      githubTokenMessage.replaceChildren(container);
    };

    const renderSuccessMessage = (data) => {
      const scopes = Array.isArray(data.scopes) ? data.scopes : [];
      setTokenMessage([
        '✅ 验证成功！',
        `用户: ${data.login || ''}`,
        `仓库: ${data.repo || ''}`,
        `权限: ${scopes.join(', ')}`,
        'Gist 分享: 已开启',
      ], '#28a745', { boldFirstLine: true });
    };

    // 更新登录按钮状态（兼容旧逻辑；若没有按钮则直接忽略）
    const updateAuthButtonStatus = () => {
      if (!githubAuthBtn) return;
      const tokenData = loadGithubToken();
      const sessionToken = loadSessionGithubToken();
      if (tokenData && tokenData.verified && sessionToken) {
        githubAuthBtn.textContent = '登录成功';
        githubAuthBtn.style.background = '#28a745';
        githubAuthBtn.style.color = 'white';
        return;
      }
      if (tokenData && tokenData.verified) {
        githubAuthBtn.textContent = '需重新验证';
        githubAuthBtn.style.background = '#fd7e14';
        githubAuthBtn.style.color = 'white';
        return;
      }
      githubAuthBtn.textContent = '未登录';
      githubAuthBtn.style.background = '#6c757d';
      githubAuthBtn.style.color = 'white';
    };

    // 显示 Token 信息
    const showTokenInfo = (userData) => {
      if (githubTokenInfo && githubUserName && githubRepoName) {
        githubUserName.textContent = userData.login || 'Unknown';
        githubRepoName.textContent = userData.repo || 'Unknown';
        githubTokenInfo.style.display = 'block';
      }
    };

    // 隐藏 Token 信息
    const hideTokenInfo = () => {
      if (githubTokenInfo) {
        githubTokenInfo.style.display = 'none';
      }
    };

    // 登录按钮点击事件 - 旧逻辑（当前已无按钮，这里仅保留兼容）
    if (githubAuthBtn && !githubAuthBtn._bound) {
      githubAuthBtn._bound = true;
      githubAuthBtn.addEventListener('click', () => {
        if (githubTokenSection.style.display === 'none') {
          githubTokenSection.style.display = 'block';

          const tokenData = loadGithubToken();
          const sessionToken = loadSessionGithubToken();
          if (tokenData && tokenData.verified) {
            if (githubTokenInput) {
              githubTokenInput.value = '';
            }
            if (sessionToken) {
              renderSuccessMessage(tokenData);
              showTokenInfo(tokenData);
            } else {
              hideTokenInfo();
              setTokenMessage('当前浏览器会话里没有可用的 GitHub Token，请重新验证。', '#fd7e14');
            }
          }
        } else {
          githubTokenSection.style.display = 'none';
        }
      });
    }

    // Token 可见性切换
    if (githubTokenToggleBtn && !githubTokenToggleBtn._bound) {
      githubTokenToggleBtn._bound = true;
      githubTokenToggleBtn.addEventListener('click', () => {
        if (githubTokenInput.type === 'password') {
          githubTokenInput.type = 'text';
          githubTokenToggleBtn.textContent = '🙈';
        } else {
          githubTokenInput.type = 'password';
          githubTokenToggleBtn.textContent = '👁️';
        }
      });
    }

    // Token 验证并保存
    if (githubTokenVerifyBtn && !githubTokenVerifyBtn._bound) {
      githubTokenVerifyBtn._bound = true;
      githubTokenVerifyBtn.addEventListener('click', async () => {
        const token = githubTokenInput.value.trim();

        if (!token) {
          setTokenMessage('❌ 请输入 GitHub Token', '#dc3545');
          return;
        }

        githubTokenVerifyBtn.disabled = true;
        githubTokenVerifyBtn.textContent = '验证中...';
        setTokenMessage('正在验证 Token...', '#666');
        hideTokenInfo();

        const result = await verifyGithubToken(token);

        if (result.valid) {
          const tokenData = {
            verified: true,
            login: result.login,
            name: result.name,
            repo: result.repo,
            scopes: result.scopes,
            savedAt: new Date().toISOString(),
          };

          saveGithubToken(tokenData);
          saveSessionGithubToken(token);

          renderSuccessMessage(tokenData);

          showTokenInfo(tokenData);
          updateAuthButtonStatus();
          githubTokenInput.value = '';
        } else {
          const lines = [];
          if (result.login && typeof result.login === 'string') {
            lines.push(`用户: ${result.login}`);
          }
          lines.push(
            result.scopes && result.scopes.length
              ? `现有权限: ${result.scopes.join(', ')}`
              : '现有权限: （无）',
          );
          lines.push('当前配置要求使用 Classic PAT，并同时具备 repo、workflow、gist 权限。');
          lines.push(`❌ ${result.error}`);
          setTokenMessage(lines, '#dc3545');
          hideTokenInfo();

          // 验证失败时，如果有顶部按钮，则将其状态改为「验证失败」红色按钮
          if (githubAuthBtn) {
            githubAuthBtn.textContent = '验证失败';
            githubAuthBtn.style.background = '#dc3545';
            githubAuthBtn.style.color = 'white';
          }

          // 同时清除本地已保存的验证结果，避免刷新后仍显示“登录成功”
          clearGithubToken();
        }

        githubTokenVerifyBtn.disabled = false;
        githubTokenVerifyBtn.textContent = '验证并保存';
      });
    }

    // Token 清除
    if (githubTokenClearBtn && !githubTokenClearBtn._bound) {
      githubTokenClearBtn._bound = true;
      githubTokenClearBtn.addEventListener('click', () => {
        if (confirm('确定要清除保存的 GitHub Token 吗？')) {
          clearGithubToken();
          githubTokenInput.value = '';
          setTokenMessage('Token 已清除', '#666');
          hideTokenInfo();
          updateAuthButtonStatus();
        }
      });
    }

    updateAuthButtonStatus();
  };

  return {
    init,
    loadGithubToken,
    loadConfig,
    updateConfig,
    saveConfig,
    writeRepoFile,
    readRepoFile,
    verifyRepoFilesVisible,
    buildSeedPaperRequestPath,
    prepareSeedPaperUploadTarget,
    __test: {
      isShaConflictResponse,
      buildSeedPaperRequestPath,
      isAllowedRepoWritePath,
      normalizeRepoWritePath,
      readRepoFile,
      verifyRepoFilesVisible,
      resolveRepoInfoFromPage,
      resolveRepoInfoFromToken,
      loadRepoInfoFromConfig,
      normalizeGithubRef,
      prepareSeedPaperUploadTarget,
    },
  };
})();
