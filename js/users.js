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
          Browse language profiles and send a friend request.
        </p>
      </div>
    </div>

    <div class="card search-card">
      <div class="discover-filters">
        <label class="search-field">
          <span class="search-icon">${navIcon("search")}</span>
          <input
            id="userSearch"
            type="search"
            placeholder="Search by name or language..."
            autocomplete="off"
          >
        </label>

        <select id="nativeFilter" aria-label="Filter by native language">
          <option value="">Any native</option>
          ${languageFilterOptions()}
        </select>

        <select id="learningFilter" aria-label="Filter by learning language">
          <option value="">Any learning</option>
          ${languageFilterOptions()}
        </select>
      </div>
    </div>

    <div id="userResults" class="users-grid stagger">
      <div class="card loading-card">
        <div class="spinner"></div>
        <span>Loading people...</span>
      </div>
    </div>
  `;

  const searchInput = document.getElementById("userSearch");
  const nativeFilter = document.getElementById("nativeFilter");
  const learningFilter = document.getElementById("learningFilter");

  const reloadProfiles = debounce(() => loadProfiles({
    query: searchInput.value.trim(),
    nativeLanguage: nativeFilter.value,
    learningLanguage: learningFilter.value
  }), 250);

  searchInput.addEventListener("input", reloadProfiles);
  nativeFilter.addEventListener("change", reloadProfiles);
  learningFilter.addEventListener("change", reloadProfiles);

  await loadProfiles();
});


/* ---------------------------------------------------------
   STATE
   Cache who's already a friend / already has a pending
   request so we don't need to re-derive it from three
   different endpoints on every render.
--------------------------------------------------------- */

let knownFriendIds = new Set();
let knownSentRequests = new Map();
let knownReceivedRequests = new Map();

async function loadRelationships() {
  try {
    const [friends, sent, received] = await Promise.all([
      api.get("/friends").catch(() => []),
      api.get("/friend-requests/sent").catch(() => []),
      api.get("/friend-requests/received").catch(() => [])
    ]);

    knownFriendIds = new Set(
      (friends || []).map(friend => String(friend.id))
    );

    knownSentRequests = mapRequestsByUser(normalizeRequestList(sent), "receiver");
    knownReceivedRequests = mapRequestsByUser(normalizeRequestList(received), "sender");
  } catch {
    // Non-fatal: the page still works, it just won't be able to
    // grey out people you've already sent a request to.
  }
}


/* ---------------------------------------------------------
   LOAD / SEARCH PROFILES
--------------------------------------------------------- */

async function loadProfiles(filters = {}) {
  const query = typeof filters === "string" ? filters : filters.query || "";
  const nativeLanguage = typeof filters === "string" ? "" : filters.nativeLanguage || "";
  const learningLanguage = typeof filters === "string" ? "" : filters.learningLanguage || "";
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

    const response = await api.get("/profiles");

    const profiles = normalizeProfiles(response);
    const me = currentUser();

    const filtered = profiles
      .filter(profile => String(profile.userId) !== String(me?.id))
      .filter(profile => matchesProfileSearch(profile, query))
      .filter(profile => !nativeLanguage || String(profile.nativeLanguage || "") === nativeLanguage)
      .filter(profile => !learningLanguage || String(profile.learningLanguage || "") === learningLanguage);

    renderProfiles(filtered);
  } catch (error) {
    results.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">!</div>
        <h3>Couldn't load profiles</h3>
        <p>${escapeHtml(error.message || "Something went wrong.")}</p>
        <button class="btn secondary" id="retryUsers">Try again</button>
      </div>
    `;

    document
      .getElementById("retryUsers")
      ?.addEventListener("click", () => loadProfiles({ query, nativeLanguage, learningLanguage }));
  }
}


function normalizeRequestList(response) {
  if (Array.isArray(response)) return response;
  return response?.sentRequests ||
    response?.receivedRequests ||
    response?.friendRequests ||
    response?.requests ||
    response?.data ||
    response?.items ||
    response?.content ||
    [];
}


function mapRequestsByUser(requests, side) {
  const entries = requests
    .filter(request => String(request?.status || "PENDING").toUpperCase() === "PENDING")
    .map(request => {
      const user = request?.[side] || {};
      const userId = user.id || request?.[`${side}Id`] || request?.[`${side}_id`];
      const requestId = request?.id || request?.requestId || request?.friendRequestId;
      return userId && requestId ? [String(userId), String(requestId)] : null;
    })
    .filter(Boolean);

  return new Map(entries);
}


function languageFilterOptions() {
  return ["ENGLISH", "SPANISH", "FRENCH", "ARABIC", "TURKISH"]
    .map(language => `<option value="${language}">${formatLanguageName(language)}</option>`)
    .join("");
}


function formatLanguageName(language) {
  return String(language || "")
    .toLowerCase()
    .replace(/^\w/, char => char.toUpperCase());
}


function normalizeProfiles(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.allProfiles)) return response.allProfiles;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}


function matchesProfileSearch(profile, query) {
  if (!query) return true;

  const needle = query.toLowerCase();
  const values = [
    profile.displayName,
    profile.bio,
    profile.nativeLanguage,
    profile.learningLanguage,
    profile.user?.username
  ];

  return values.some(value =>
    String(value || "").toLowerCase().includes(needle)
  );
}


/* ---------------------------------------------------------
   RENDER
--------------------------------------------------------- */

function renderProfiles(profiles) {
  const results = document.getElementById("userResults");

  if (!results) return;

  if (!profiles.length) {
    results.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">◎</div>
        <h3>No profiles found</h3>
        <p>Try a different name or language.</p>
      </div>
    `;
    return;
  }

  results.innerHTML = profiles.map(renderProfileCard).join("");

  attachUserEvents(results);
}


function renderProfileCard(profile) {
  const userId = profile.userId || profile.user?.id;
  const name = profile.displayName || profile.user?.username || "User";
  const username = profile.user?.username || "";

  const isFriend = knownFriendIds.has(String(userId));
  const sentRequestId = knownSentRequests.get(String(userId));
  const receivedRequestId = knownReceivedRequests.get(String(userId));

  let action = userId ? `
    <button
      class="btn primary"
      type="button"
      data-action="add"
      data-user-id="${escapeHtml(userId)}"
    >
      Add friend
    </button>
  ` : `<span class="muted">Profile unavailable</span>`;

  if (isFriend) {
    action = `<span class="muted">Already friends</span>`;
  } else if (sentRequestId) {
    action = `<span class="muted">Request sent</span>`;
  } else if (receivedRequestId) {
    action = `
      <button class="btn primary" type="button" data-action="accept" data-request-id="${escapeHtml(receivedRequestId)}">Accept</button>
      <button class="btn danger" type="button" data-action="reject" data-request-id="${escapeHtml(receivedRequestId)}">Reject</button>
    `;
  }

  return `
    <article class="card user-card">
      <a href="profile-view.html?user=${encodeURIComponent(userId || "")}" aria-label="Open ${escapeHtml(name)} profile">
        ${avatarHtml(profile, "avatar lg")}
      </a>

      <div class="user-card-body">
        <a class="profile-card-link" href="profile-view.html?user=${encodeURIComponent(userId || "")}">
          <strong>${escapeHtml(name)}</strong>
        </a>

        ${
          username
            ? `<span class="muted">@${escapeHtml(username)}</span>`
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

  container.querySelectorAll('[data-action="accept"], [data-action="reject"]').forEach(button => {
    button.addEventListener("click", () => respondToRequest(button.dataset.requestId, button.dataset.action, button));
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

    knownSentRequests.set(String(userId), "pending");

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


async function respondToRequest(requestId, action, button) {
  if (!requestId || button.disabled) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = action === "accept" ? "Accepting..." : "Rejecting...";

  try {
    await api.patch(`/friend-requests/${encodeURIComponent(requestId)}/${action}`, {});
    toast(action === "accept" ? "Friend request accepted" : "Friend request rejected");
    await loadProfiles({
      query: document.getElementById("userSearch")?.value.trim() || "",
      nativeLanguage: document.getElementById("nativeFilter")?.value || "",
      learningLanguage: document.getElementById("learningFilter")?.value || ""
    });
  } catch (error) {
    toast(error.message || "Unable to update friend request.");
    button.disabled = false;
    button.textContent = originalText;
  }
}
