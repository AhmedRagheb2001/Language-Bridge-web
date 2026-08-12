document.addEventListener("DOMContentLoaded", async () => {
  await initShell("discover");

  const content = document.getElementById("content");
  const userId = new URLSearchParams(location.search).get("user");

  if (!content) return;

  content.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">Profile</span>
        <h1>Language partner</h1>
        <p class="muted">Full profile, posts, and connection status.</p>
      </div>
      <a href="users.html" class="btn secondary">Back to Discover</a>
    </div>

    <section class="profile-card card">
      <div class="profile-cover"></div>
      <div class="profile-body">
        <div id="profileMain" class="loading-state">
          <span class="spinner"></span>
          <span>Loading profile...</span>
        </div>
        <div id="profileInfo"></div>
      </div>
    </section>

    <section class="profile-posts-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Activity</span>
          <h2>Posts</h2>
        </div>
        <span id="postCount" class="count-pill">— posts</span>
      </div>
      <div id="posts" class="stack"></div>
    </section>
  `;

  if (!userId) {
    showProfileError("No profile was selected.");
    return;
  }

  await loadProfilePage(userId);
});


async function loadProfilePage(userId) {
  connectPresenceSocket(userId);

  try {
    const [profileResponse, postsResponse, relationship] = await Promise.all([
      api.get(`/users/${encodeURIComponent(userId)}/profile`),
      api.get(`/users/${encodeURIComponent(userId)}/posts`).catch(() => []),
      loadRelationship(userId)
    ]);

    const profile = profileResponse?.profileFound || profileResponse?.profile || profileResponse;

    renderPublicProfile(profile, userId, relationship);
    renderPublicPosts(postsResponse || [], profile, userId);
  } catch (error) {
    showProfileError(error.message || "Unable to load this profile.");
  }
}


/* =========================================================
   LIVE PRESENCE (ONLINE / OFFLINE)
   -----------------------------------------------------------
   Connects a Socket.IO socket purely to ask whether the
   viewed user is online. No chat room is joined — we just
   emit "presence:get" and listen for "presence:update".
   ========================================================= */

let presenceSocket = null;
let viewedUserId = null;
let latestPresence = null; /* null = unknown, true/false = known */


function connectPresenceSocket(userId) {
  if (!userId) return;

  // Re-opening the same page (e.g. after accepting a request)
  // should not stack multiple sockets.
  if (presenceSocket) {
    presenceSocket.disconnect();
    presenceSocket = null;
  }

  if (typeof io !== "function") {
    console.warn(
      "Socket.IO client failed to load; live presence unavailable."
    );
    return;
  }

  viewedUserId = String(userId);

  let base = String(API_BASE || "");

  if (base.endsWith("/api/v1")) {
    base = base.slice(0, -"/api/v1".length);
  }

  base = base.replace(/\/+$/, "");

  presenceSocket = io(base, {
    path: "/api/socket-io/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: {
      token: localStorage.getItem("accessToken") || null
    },
    autoConnect: true
  });

  presenceSocket.on("connect", () => {
    presenceSocket.emit("presence:get", {
      userId: viewedUserId
    });
  });

  presenceSocket.on("presence:update", payload => {
    const id =
      payload?.userId ||
      payload?.user_id ||
      payload?.id;

    if (id == null || String(id) !== String(viewedUserId)) {
      return;
    }

    const online =
      payload?.online ??
      payload?.isOnline ??
      String(payload?.status || "").toUpperCase() === "ONLINE";

    updateProfilePresence(Boolean(online));
  });

  presenceSocket.on("connect_error", () => {
    // Non-fatal: the profile still loads, the status just
    // stays undetermined until a successful connection.
  });
}


function updateProfilePresence(online) {
  latestPresence = online;

  const dot = document.querySelector("#profilePresence .online-dot");
  const label = document.getElementById("profilePresenceLabel");

  if (!dot || !label) return;

  if (online === null) {
    dot.classList.add("offline");
    label.textContent = "Language partner";
    return;
  }

  dot.classList.toggle("offline", !online);
  label.textContent = online ? "Online" : "Offline";
}


async function loadRelationship(userId) {
  const [friends, sent, received] = await Promise.all([
    api.get("/friends").catch(() => []),
    api.get("/friend-requests/sent").catch(() => []),
    api.get("/friend-requests/received").catch(() => [])
  ]);

  const friend = (friends || []).find(item => String(item.id) === String(userId));
  if (friend) return { type: "friend", friendshipId: friend.friendshipId };

  const sentRequest = normalizeRequests(sent).find(request =>
    String(request?.receiver?.id || request?.receiverId || request?.receiver_id) === String(userId) &&
    String(request?.status || "PENDING").toUpperCase() === "PENDING"
  );
  if (sentRequest) return { type: "sent", requestId: requestId(sentRequest) };

  const receivedRequest = normalizeRequests(received).find(request =>
    String(request?.sender?.id || request?.senderId || request?.sender_id) === String(userId) &&
    String(request?.status || "PENDING").toUpperCase() === "PENDING"
  );
  if (receivedRequest) return { type: "received", requestId: requestId(receivedRequest) };

  return { type: "none" };
}


function normalizeRequests(response) {
  if (Array.isArray(response)) return response;
  return response?.sentRequests || response?.receivedRequests || response?.friendRequests || response?.requests || response?.data || response?.items || response?.content || [];
}


function requestId(request) {
  return request?.id || request?.requestId || request?.friendRequestId;
}


function renderPublicProfile(profile, userId, relationship) {
  const main = document.getElementById("profileMain");
  const info = document.getElementById("profileInfo");
  if (!main || !info) return;

  const displayName = profile?.displayName || "LanguageBridge user";

  const presOnline = latestPresence;
  const presClass = presOnline === true ? "" : "offline";
  const presLabel =
    presOnline === null
      ? "Language partner"
      : (presOnline ? "Online" : "Offline");

  main.classList.remove("loading-state");
  main.innerHTML = `
    <div class="profile-identity">
      <div class="profile-avatar-wrap">
        ${avatarHtml(profile || {}, "avatar profile-avatar")}
      </div>
      <div class="profile-heading">
        <h2>${escapeHtml(displayName)}</h2>
        <div class="profile-handle" id="profilePresence">
          <span class="online-dot ${presClass}"></span>
          <span id="profilePresenceLabel">${presLabel}</span>
        </div>
      </div>
      <div class="profile-detail-actions">
        ${relationshipAction(userId, relationship)}
      </div>
    </div>
  `;

  info.innerHTML = `
    <div class="profile-info-grid">
      <div class="profile-bio">
        <span class="profile-label">Bio</span>
        <p>${escapeHtml(profile?.bio || "No bio yet.")}</p>
      </div>
      <div class="language-pair">
        <div class="language-item">
          <span class="profile-label">Native language</span>
          <strong>${escapeHtml(formatLanguage(profile?.nativeLanguage))}</strong>
        </div>
        <div class="language-arrow">→</div>
        <div class="language-item">
          <span class="profile-label">Learning</span>
          <strong>${escapeHtml(formatLanguage(profile?.learningLanguage))}</strong>
        </div>
      </div>
    </div>
  `;

  main.querySelectorAll("[data-profile-action]").forEach(button => {
    button.addEventListener("click", () => handleRelationshipAction(userId, button));
  });
}


function relationshipAction(userId, relationship) {
  if (relationship.type === "friend") {
    return `<button class="btn primary" data-profile-action="message" data-user-id="${escapeHtml(userId)}">Message</button>`;
  }

  if (relationship.type === "sent") {
    return `<span class="count-pill">Request sent</span>`;
  }

  if (relationship.type === "received") {
    return `
      <button class="btn primary" data-profile-action="accept" data-request-id="${escapeHtml(relationship.requestId)}">Accept</button>
      <button class="btn danger" data-profile-action="reject" data-request-id="${escapeHtml(relationship.requestId)}">Reject</button>
    `;
  }

  return `<button class="btn primary" data-profile-action="add" data-user-id="${escapeHtml(userId)}">Add friend</button>`;
}


async function handleRelationshipAction(userId, button) {
  const action = button.dataset.profileAction;
  const requestIdValue = button.dataset.requestId;
  button.disabled = true;

  try {
    if (action === "message") {
      const chat = await api.post(`/chats/${encodeURIComponent(userId)}`, {});
      const chatId = chat?.id || chat?.chatId;
      if (!chatId) throw new Error("The conversation could not be opened.");
      location.href = `chat.html?chat=${encodeURIComponent(chatId)}`;
      return;
    }

    if (action === "add") {
      await api.post(`/friend-requests/${encodeURIComponent(userId)}`, {});
      toast("Friend request sent");
    } else {
      await api.patch(`/friend-requests/${encodeURIComponent(requestIdValue)}/${action}`, {});
      toast(action === "accept" ? "Friend request accepted" : "Friend request rejected");
    }

    await loadProfilePage(userId);
  } catch (error) {
    toast(error.message || "Unable to update this profile.");
    button.disabled = false;
  }
}


function renderPublicPosts(posts, profile, userId) {
  const container = document.getElementById("posts");
  const count = document.getElementById("postCount");
  if (!container) return;

  if (count) count.textContent = `${posts.length} ${posts.length === 1 ? "post" : "posts"}`;

  if (!posts.length) {
    container.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">✦</div>
        <h3>No posts yet</h3>
        <p>This profile has not shared anything yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map(post => `
    <article class="card post profile-post clickable-card" onclick="location.href='post.html?post=${encodeURIComponent(post.id)}'">
      <div class="post-mini-author">
        ${avatarHtml(profile || {}, "avatar sm")}
        <div>
          <strong>${escapeHtml(profile?.displayName || "User")}</strong>
          <span>${fmtDate(post.createdAt)}</span>
        </div>
      </div>
      <h3>${escapeHtml(post.title || "Untitled post")}</h3>
      ${post.content ? `<p>${escapeHtml(post.content)}</p>` : ""}
      ${post.postPictureUrl ? `<div class="post-media"><img class="post-image" src="${escapeHtml(post.postPictureUrl)}" alt="" loading="lazy"></div>` : ""}
    </article>
  `).join("");
}


function showProfileError(message) {
  const main = document.getElementById("profileMain");
  if (!main) return;
  main.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">!</div>
      <h3>Couldn't load profile</h3>
      <p>${escapeHtml(message)}</p>
      <a class="btn secondary" href="users.html">Back to Discover</a>
    </div>
  `;
}


function formatLanguage(language) {
  if (!language) return "—";
  return String(language).toLowerCase().replace(/^\w/, char => char.toUpperCase());
}
