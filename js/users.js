document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;

  await initShell("discover");

  const content = document.getElementById("content");

  content.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">Community</span>
        <h1>Discover people</h1>
        <p class="muted">
          Search for language partners and send a friend request.
        </p>
      </div>
    </div>

    <div class="card search-card">
      <label class="search-field">
        <span class="search-icon">${navIcon("search")}</span>
        <input
          id="userSearch"
          type="search"
          placeholder="Search by name or username..."
          autocomplete="off"
        >
      </label>
    </div>

    <div id="userResults" class="users-grid">
      <div class="card loading-card">
        <div class="spinner"></div>
        <span>Loading people...</span>
      </div>
    </div>
  `;

  const searchInput = document.getElementById("userSearch");

  searchInput.addEventListener(
    "input",
    debounce(() => loadUsers(searchInput.value.trim()), 350)
  );

  await loadUsers();
});


/* ---------------------------------------------------------
   STATE
   Cache who's already a friend / already has a pending
   request so we don't need to re-derive it from three
   different endpoints on every render.
--------------------------------------------------------- */

let knownFriendIds = new Set();
let knownSentRequestIds = new Set();

async function loadRelationships() {
  try {
    const [friends, sent] = await Promise.all([
      api.get("/friends").catch(() => []),
      api.get("/friend-requests/sent").catch(() => [])
    ]);

    knownFriendIds = new Set(
      (friends || []).map(friend => friend.id)
    );

    const sentList = Array.isArray(sent)
      ? sent
      : sent?.data || sent?.items || sent?.content || [];

    knownSentRequestIds = new Set(
      sentList
        .filter(request =>
          String(request?.status || "").toUpperCase() === "PENDING"
        )
        .map(request => request?.receiver?.id)
        .filter(Boolean)
    );
  } catch {
    // Non-fatal: the page still works, it just won't be able to
    // grey out people you've already sent a request to.
  }
}


/* ---------------------------------------------------------
   LOAD / SEARCH USERS
--------------------------------------------------------- */

async function loadUsers(query = "") {
  const results = document.getElementById("userResults");

  if (!results) return;

  results.innerHTML = `
    <div class="card loading-card">
      <div class="spinner"></div>
      <span>${query ? "Searching..." : "Loading people..."}</span>
    </div>
  `;

  try {
    await loadRelationships();

    // NOTE: this assumes a GET /users endpoint that accepts an
    // optional `search` query string. If the backend exposes a
    // different path/param for this, only this one call needs
    // to change.
    const path = query
      ? `/users?search=${encodeURIComponent(query)}`
      : "/users";

    const response = await api.get(path);

    const users = normalizeUsers(response);
    const me = currentUser();

    const filtered = users.filter(user => user.id !== me?.id);

    renderUsers(filtered);
  } catch (error) {
    results.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">!</div>
        <h3>Couldn't load people</h3>
        <p>${escapeHtml(error.message || "Something went wrong.")}</p>
        <button class="btn secondary" id="retryUsers">Try again</button>
      </div>
    `;

    document
      .getElementById("retryUsers")
      ?.addEventListener("click", () => loadUsers(query));
  }
}


function normalizeUsers(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}


/* ---------------------------------------------------------
   RENDER
--------------------------------------------------------- */

function renderUsers(users) {
  const results = document.getElementById("userResults");

  if (!results) return;

  if (!users.length) {
    results.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">◎</div>
        <h3>No one found</h3>
        <p>Try a different name or username.</p>
      </div>
    `;
    return;
  }

  results.innerHTML = users.map(renderUserCard).join("");

  attachUserEvents(results);
}


function renderUserCard(user) {
  const profile = user.profile || {};
  const name = profile.displayName || user.username || "User";

  const isFriend = knownFriendIds.has(user.id);
  const requestSent = knownSentRequestIds.has(user.id);

  let action = `
    <button
      class="btn primary"
      type="button"
      data-action="add"
      data-user-id="${escapeHtml(user.id)}"
    >
      Add friend
    </button>
  `;

  if (isFriend) {
    action = `<span class="muted">Already friends</span>`;
  } else if (requestSent) {
    action = `<span class="muted">Request sent</span>`;
  }

  return `
    <article class="card user-card">
      ${avatarHtml(profile, "avatar lg")}

      <div class="user-card-body">
        <strong>${escapeHtml(name)}</strong>

        ${
          user.username
            ? `<span class="muted">@${escapeHtml(user.username)}</span>`
            : ""
        }

        <div class="language-pair user-card-languages">
          <div class="language-item">
            <span class="language-label">Native</span>
            <strong>${escapeHtml(profile.nativeLanguage || "—")}</strong>
          </div>

          <div class="language-arrow">→</div>

          <div class="language-item">
            <span class="language-label">Learning</span>
            <strong>${escapeHtml(profile.learningLanguage || "—")}</strong>
          </div>
        </div>

        ${
          profile.bio
            ? `<p class="user-card-bio">${escapeHtml(truncate(profile.bio, 110))}</p>`
            : ""
        }
      </div>

      <div class="user-card-actions">
        ${action}
      </div>
    </article>
  `;
}


function truncate(value, max) {
  if (!value) return "";
  const text = String(value);
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}


function attachUserEvents(container) {
  container.querySelectorAll('[data-action="add"]').forEach(button => {
    button.addEventListener("click", () => {
      sendFriendRequest(button.dataset.userId, button);
    });
  });
}


/* ---------------------------------------------------------
   SEND FRIEND REQUEST
--------------------------------------------------------- */

async function sendFriendRequest(userId, button) {
  if (!userId || button.disabled) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Sending...";

  try {
    // NOTE: mirrors the same shape as starting a chat
    // (POST /chats/:id) — adjust if the backend expects a
    // different friend-request creation route.
    await api.post(`/friend-requests/${userId}`, {});

    knownSentRequestIds.add(userId);

    const wrapper = button.closest(".user-card-actions");

    if (wrapper) {
      wrapper.innerHTML = `<span class="muted">Request sent</span>`;
    }

    toast("Friend request sent");
  } catch (error) {
    toast(error.message || "Unable to send friend request.");

    button.disabled = false;
    button.textContent = originalText;
  }
}
