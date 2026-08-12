const API_BASE =
  localStorage.getItem("lb_api_base") ||
  "https://language-bridge.onrender.com/api/v1";

const api = {
  async request(path, options = {}) {
    const token = localStorage.getItem("accessToken");
    const headers = new Headers(options.headers || {});

    if (token) headers.set("Authorization", `Bearer ${token}`);

    const isForm = options.body instanceof FormData;

    if (!isForm && options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    let res;

    try {
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (networkError) {
      const err = new Error(
        "Couldn't reach the server. Check your connection and try again."
      );
      err.status = 0;
      err.cause = networkError;
      throw err;
    }

    if (res.status === 401 && !options._retry) {
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        try {
          const refresh = await fetch(`${API_BASE}/auth/refresh-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken })
          });

          if (refresh.ok) {
            const data = await refresh.json();

            localStorage.setItem("accessToken", data.accessToken);

            // Some backends rotate the refresh token on every use;
            // persist the new one when it comes back, otherwise the
            // next refresh would be attempted with a stale/invalid token.
            if (data.refreshToken) {
              localStorage.setItem("refreshToken", data.refreshToken);
            }

            // Update Socket.IO auth token if socket exists
            if (typeof updateAppSocketAuth === "function") {
              updateAppSocketAuth();
            }

            return api.request(path, { ...options, _retry: true });
          }
        } catch {
          // fall through to session-expired handling below
        }
      }

      // Refresh didn't happen or failed: the session really is over.
      // Clear stale tokens and send the user back to sign in instead of
      // silently re-throwing a 401 that every page has to guess about.
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("currentUser");

      if (!location.pathname.endsWith("login.html")) {
        location.replace("login.html");
      }

      const err = new Error("Your session has expired. Please sign in again.");
      err.status = 401;
      throw err;
    }

    const text = await res.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!res.ok) {
      const message =
        data.errorMessage ||
        data.errorMeassge ||
        data.message ||
        data.title ||
        `Request failed (${res.status})`;

      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  get(path) {
    return this.request(path);
  },

  post(path, body) {
    return this.request(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  patch(path, body) {
    return this.request(path, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  delete(path) {
    return this.request(path, { method: "DELETE" });
  }
};
