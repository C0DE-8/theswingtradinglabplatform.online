(function (window) {
  "use strict";

  const API_ROOT = "https://api.theswingtradinglabplatform.online/api";
  const USER_BASE = `${API_ROOT}/users`;
  const ADMIN_BASE = `${API_ROOT}/admin`;

  const USER_TOKEN_KEY = "swing_trading_lab_platform_token";
  const ADMIN_TOKEN_KEY = "swing_trading_lab_platform_admin_token";
  const USER_KEY = "swing_trading_lab_platform_user";
  const ADMIN_KEY = "swing_trading_lab_platform_admin";

  function token(key) {
    return window.localStorage.getItem(key) || "";
  }

  function authHeaders(key) {
    const value = token(key);
    return value ? { Authorization: `Bearer ${value}` } : {};
  }

  function createClient(baseURL, tokenKey, options) {
    const config = options || {};
    return window.axios.create({
      baseURL,
      timeout: config.timeout || 25000,
      headers: {
        ...authHeaders(tokenKey),
        ...(config.headers || {}),
      },
    });
  }

  function url(baseURL, path) {
    const cleanPath = String(path || "").replace(/^\/+/, "");
    return `${baseURL}/${cleanPath}`;
  }

  window.SwayApi = {
    root: API_ROOT,
    userBase: USER_BASE,
    adminBase: ADMIN_BASE,
    userTokenKey: USER_TOKEN_KEY,
    adminTokenKey: ADMIN_TOKEN_KEY,
    userKey: USER_KEY,
    adminKey: ADMIN_KEY,
    token,
    authHeaders,
    userHeaders: () => authHeaders(USER_TOKEN_KEY),
    adminHeaders: () => authHeaders(ADMIN_TOKEN_KEY),
    userClient: (options) => createClient(USER_BASE, USER_TOKEN_KEY, options),
    adminClient: (options) => createClient(ADMIN_BASE, ADMIN_TOKEN_KEY, options),
    userUrl: (path) => url(USER_BASE, path),
    adminUrl: (path) => url(ADMIN_BASE, path),
  };
})(window);
