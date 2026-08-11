const APP_NAME = "LanguageBridge";


/* =========================================================
   HTML UTILITIES
   ========================================================= */

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}


function avatarHtml(profile = {}, cls = "avatar") {
  const url = profile?.profilePictureUrl;
  const name = profile?.displayName || profile?.username || "U";
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  if (url) {
    return `
      <img
        class="${cls}"
        src="${escapeHtml(url)}"
        alt="${escapeHtml(name)}"
        loading="lazy"
        decoding="async"
      >
    `;
  }

  return `
    <div
      class="${cls} avatar-fallback"
      aria-label="${escapeHtml(name)}"
    >
      ${escapeHtml(initial)}
    </div>
  `;
}


/* =========================================================
   PERFORMANCE HELPERS
   ========================================================= */

/*
 * Delay invoking `fn` until `wait` ms have passed since the
 * last call. Used to stop search-as-you-type inputs from
 * firing a network request on every keystroke.
 */
function debounce(fn, wait = 300) {
  let timer = null;

  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}


/* =========================================================
   DATE / TIME HELPERS
   ========================================================= */

function fmtDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}


function fmtRelativeDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = Date.now();
  const diff = now - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return "Just now";
  }

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}m ago`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}h ago`;
  }

  if (diff < 7 * day) {
    const days = Math.floor(diff / day);
    return `${days}d ago`;
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
}


/* =========================================================
   USER / AUTH
   ========================================================= */

function currentUser() {
  try {
    const value = localStorage.getItem("currentUser");

    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}


function isAuthenticated() {
  return Boolean(localStorage.getItem("accessToken"));
}


function requireAuth() {
  if (!isAuthenticated()) {
    window.location.replace("login.html");
    return false;
  }

  return true;
}


function logout() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("currentUser");

  window.location.replace("login.html");
}


async function loadMe() {
  const me = await api.get("/auth/me");

  localStorage.setItem(
    "currentUser",
    JSON.stringify(me)
  );

  return me;
}


/* =========================================================
   NAVIGATION
   ========================================================= */

const NAV_ITEMS = [
  {
    id: "home",
    label: "Home",
    href: "index.html",
    icon: "home"
  },
  {
    id: "discover",
    label: "Discover",
    href: "users.html",
    icon: "search"
  },
  {
    id: "friends",
    label: "Friends",
    href: "friends.html",
    icon: "users"
  },
  {
    id: "requests",
    label: "Requests",
    href: "requests.html",
    icon: "user-plus"
  },
  {
    id: "notifications",
    label: "Alerts",
    href: "notifications.html",
    icon: "bell"
  },
  {
    id: "chats",
    label: "Messages",
    href: "chat.html",
    icon: "message"
  },
  {
    id: "profile",
    label: "Profile",
    href: "profile.html",
    icon: "user"
  },
  {
    id: "settings",
    label: "Settings",
    href: "settings.html",
    icon: "settings"
  }
];


function navIcon(icon) {
  const icons = {
    home: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5"/>
        <path d="M5.5 9.5V21h13V9.5"/>
        <path d="M9.5 21v-6h5v6"/>
      </svg>
    `,

    search: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5"/>
        <path d="M20 20l-4.3-4.3"/>
      </svg>
    `,

    users: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3"/>
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
        <path d="M16 5.5a3 3 0 0 1 0 5.8"/>
        <path d="M18 14.5c1.8.8 3 2.6 3 4.5"/>
      </svg>
    `,

    "user-plus": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3"/>
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
        <path d="M19 8v6"/>
        <path d="M16 11h6"/>
      </svg>
    `,

    message: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.4 8.4 0 0 1-4-.9L4 20l1.3-3.3A7.2 7.2 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z"/>
      </svg>
    `,

    bell: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 9a6 6 0 0 0-12 0c0 7-2.5 7.5-2.5 7.5h17S18 16 18 9Z"/>
        <path d="M10 20a2.2 2.2 0 0 0 4 0"/>
      </svg>
    `,

    user: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5"/>
        <path d="M4.5 20c.7-3.4 3.4-5.5 7.5-5.5s6.8 2.1 7.5 5.5"/>
      </svg>
    `,

    settings: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/>
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6v-2.4h.9a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5.5h2.4v.3a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.3V14h-.3a1.7 1.7 0 0 0-1.5 1Z"/>
      </svg>
    `,

    logout: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 5H5v14h5"/>
        <path d="M14 8l4 4-4 4"/>
        <path d="M8 12h10"/>
      </svg>
    `
  };

  return icons[icon] || "";
}


function shell(active = "home") {
  const user = currentUser();

  const displayName =
    user?.profile?.displayName ||
    user?.username ||
    "LanguageBridge user";

  return `
    <div class="app-shell">

      <!-- =========================================
           TOP BAR
           ========================================= -->

      <header class="topbar">

        <div class="topbar-left">

          <button
            type="button"
            class="mobile-menu-btn"
            id="mobileMenuButton"
            aria-label="Open navigation"
            aria-expanded="false"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <a
            class="top-brand"
            href="index.html"
            aria-label="LanguageBridge home"
          >
            <img class="top-mark" src="assets/logo.png" alt="LanguageBridge logo">

            <span class="top-brand-text">
              <strong>Language</strong><span>Bridge</span>
            </span>
          </a>

        </div>


        <div class="top-actions">

          <div class="top-welcome">
            <span class="top-welcome-label">Welcome back</span>
            <strong>${escapeHtml(displayName)}</strong>
          </div>

          <button
            type="button"
            class="btn ghost logout-btn"
            onclick="logout()"
          >
            <span class="btn-icon-svg">${navIcon("logout")}</span>
            <span>Sign out</span>
          </button>

        </div>

      </header>


      <!-- =========================================
           MOBILE OVERLAY
           ========================================= -->

      <div
        class="sidebar-overlay"
        id="sidebarOverlay"
        aria-hidden="true"
      ></div>


      <!-- =========================================
           MAIN LAYOUT
           ========================================= -->

      <div class="layout">

        <!-- =======================================
             SIDEBAR
             ======================================= -->

        <aside
          class="sidebar"
          id="sidebar"
          aria-label="Main navigation"
        >

          <div class="sidebar-inner">

            <div class="sidebar-heading">
              <span>Workspace</span>
            </div>

            <nav class="nav">

              ${NAV_ITEMS.map(item => `
                <a
                  class="nav-link ${active === item.id ? "active" : ""}"
                  href="${item.href}"
                  ${active === item.id ? 'aria-current="page"' : ""}
                >

                  <span class="nav-icon">
                    ${navIcon(item.icon)}
                  </span>

                  <span class="nav-label">
                    ${item.label}
                  </span>

                  ${item.id === "requests"
                    ? `<span class="nav-badge hidden" id="requestBadge"></span>`
                    : ""
                  }

                </a>
              `).join("")}

            </nav>


            <div class="sidebar-divider"></div>


            <div class="sidebar-tip">

              <div class="sidebar-tip-icon">
                ✦
              </div>

              <strong>Practice together</strong>

              <p>
                Connect with people and improve your language naturally.
              </p>

            </div>

          </div>

        </aside>


        <!-- =======================================
             MAIN CONTENT
             ======================================= -->

        <main
          class="content"
          id="content"
          tabindex="-1"
        ></main>


        <!-- =======================================
             RIGHT ACCOUNT PANEL
             ======================================= -->

        <aside class="rightbar">

          <div class="account-card card">

            <div class="account-card-heading">
              <span class="section-title">Your account</span>

              <a
                class="account-settings-link"
                href="settings.html"
                aria-label="Open settings"
                title="Settings"
              >
                ${navIcon("settings")}
              </a>
            </div>


            <div
              id="accountMini"
              class="account-mini"
            >
              <div class="account-loading">
                <span class="spinner"></span>
              </div>
            </div>

          </div>


          <div class="rightbar-note">
            <span class="rightbar-note-dot"></span>
            Your language journey starts with a conversation.
          </div>

        </aside>

      </div>

    </div>
  `;
}


/* =========================================================
   SHELL INITIALIZATION
   ========================================================= */

async function initShell(active = "home") {
  if (!requireAuth()) {
    return false;
  }

  document.body.innerHTML = shell(active);

  setupMobileNavigation();
  setupPageTransitions();

  try {
    /*
     * Use cached user information when available.
     * This prevents an unnecessary /auth/me request every
     * time the user opens another page.
     */
    let me = currentUser();

    if (!me) {
      me = await loadMe();
    }

    renderAccountMini(me);

    // Refresh the cached copy in the background so avatar/bio edits
    // made on another tab/device eventually show up here too, without
    // making every page load wait on the network for it.
    loadMe().then(renderAccountMini).catch(() => {});

    return true;
  } catch (error) {
    console.error("Failed to initialize application shell:", error);

    logout();

    return false;
  }
}


function renderAccountMini(user) {
  const account = document.getElementById("accountMini");

  if (!account) return;

  const profile = user?.profile || {};

  const displayName =
    profile.displayName ||
    user?.username ||
    "User";

  const username = user?.username || "";

  const nativeLanguage =
    profile.nativeLanguage || "";

  const learningLanguage =
    profile.learningLanguage || "";

  account.innerHTML = `
    <a
      class="account-profile"
      href="profile.html"
    >

      ${avatarHtml(profile, "avatar account-avatar")}

      <div class="account-details">

        <strong>
          ${escapeHtml(displayName)}
        </strong>

        ${username ? `<span>@${escapeHtml(username)}</span>` : ""}

      </div>

    </a>


    <div class="language-pair">

      <div class="language-item">
        <span class="language-label">Native</span>
        <strong>${escapeHtml(nativeLanguage || "—")}</strong>
      </div>

      <div class="language-arrow">
        →
      </div>

      <div class="language-item">
        <span class="language-label">Learning</span>
        <strong>${escapeHtml(learningLanguage || "—")}</strong>
      </div>

    </div>


    <a
      href="profile.html"
      class="account-profile-link"
    >
      View profile
      <span>→</span>
    </a>
  `;
}


/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function setupMobileNavigation() {
  const menuButton = document.getElementById("mobileMenuButton");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (!menuButton || !sidebar || !overlay) {
    return;
  }

  const closeMenu = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");

    menuButton.setAttribute("aria-expanded", "false");
    overlay.setAttribute("aria-hidden", "true");

    document.body.classList.remove("menu-open");
  };


  const openMenu = () => {
    sidebar.classList.add("open");
    overlay.classList.add("visible");

    menuButton.setAttribute("aria-expanded", "true");
    overlay.setAttribute("aria-hidden", "false");

    document.body.classList.add("menu-open");
  };


  menuButton.addEventListener("click", () => {
    const isOpen = sidebar.classList.contains("open");

    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });


  overlay.addEventListener("click", closeMenu);


  sidebar.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });


  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}


/* =========================================================
   PAGE TRANSITIONS
   ========================================================= */

function setupPageTransitions() {
  document.addEventListener("click", event => {
    const link = event.target.closest("a");

    if (!link) return;

    const href = link.getAttribute("href");

    if (!href) return;

    if (
      href.startsWith("#") ||
      href.startsWith("http") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      link.target === "_blank"
    ) {
      return;
    }

    document.body.classList.add("page-leaving");
  });
}


/* =========================================================
   TOAST NOTIFICATIONS
   ========================================================= */

function toast(message, type = "default") {
  if (!message) return;

  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";

    document.body.appendChild(container);
  }

  const toastElement = document.createElement("div");

  toastElement.className = `toast toast-${type}`;

  const icon = {
    success: "✓",
    error: "!",
    warning: "!",
    default: "i"
  }[type] || "i";

  toastElement.innerHTML = `
    <span class="toast-icon">
      ${icon}
    </span>

    <span class="toast-message">
      ${escapeHtml(message)}
    </span>

    <button
      type="button"
      class="toast-close"
      aria-label="Close notification"
    >
      ×
    </button>
  `;

  container.appendChild(toastElement);

  requestAnimationFrame(() => {
    toastElement.classList.add("visible");
  });

  const close = () => {
    toastElement.classList.remove("visible");

    setTimeout(() => {
      toastElement.remove();

      if (!container.children.length) {
        container.remove();
      }
    }, 220);
  };

  toastElement
    .querySelector(".toast-close")
    ?.addEventListener("click", close);

  setTimeout(close, 3200);
}


/* =========================================================
   GLOBAL ERROR HELPER
   ========================================================= */

function showError(container, message) {
  if (!container) return;

  container.innerHTML = `
    <div class="card error-state">

      <div class="error-state-icon">
        !
      </div>

      <div>
        <strong>Something went wrong</strong>
        <p>${escapeHtml(message || "Please try again.")}</p>
      </div>

    </div>
  `;
}


/* =========================================================
   BUTTON LOADING STATE
   ========================================================= */

function setButtonLoading(button, loading, loadingText = "Loading...") {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.classList.add("is-loading");

    button.innerHTML = `
      <span class="button-spinner"></span>
      <span>${escapeHtml(loadingText)}</span>
    `;
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");

    button.textContent =
      button.dataset.originalText ||
      "Submit";

    delete button.dataset.originalText;
  }
}
