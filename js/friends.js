document.addEventListener("DOMContentLoaded", async () => {
  await initShell("friends");

  const content = document.getElementById("content");

  content.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">Connections</div>
        <h1>Friends</h1>
        <p class="muted">People you're connected with.</p>
      </div>

      <div class="page-head-actions">
        <span id="friendCount" class="count-pill">— friends</span>
        <a href="users.html" class="btn primary">Find people</a>
      </div>
    </div>

    <section class="card friends-card">
      <div class="section-header">
        <div>
          <h2>Your connections</h2>
          <p class="muted">Start a conversation or manage your friendship.</p>
        </div>
      </div>

      <div id="friends" class="friends-list">
        <div class="loading-state">
          <span class="spinner"></span>
          <span>Loading your friends...</span>
        </div>
      </div>
    </section>
  `;

  await loadFriendsAgain();
});


async function loadFriendsAgain() {
  const container = document.getElementById("friends");

  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <span class="spinner"></span>
      <span>Loading your friends...</span>
    </div>
  `;

  try {
    const friends = await api.get("/friends");
    renderFriends(friends || []);
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <h3>Couldn't load your friends</h3>
        <p>${escapeHtml(error.message || "Something went wrong.")}</p>
        <button class="btn secondary" id="retryFriends">
          Try again
        </button>
      </div>
    `;

    document
      .getElementById("retryFriends")
      ?.addEventListener("click", loadFriendsAgain);
  }
}


function renderFriends(friends) {
  const container = document.getElementById("friends");
  const count = document.getElementById("friendCount");

  if (!container) return;

  if (count) {
    count.textContent = `${friends.length} ${
      friends.length === 1 ? "friend" : "friends"
    }`;
  }

  if (!friends.length) {
    container.innerHTML = `
      <div class="empty-state friends-empty">
        <div class="empty-icon">♡</div>
        <h3>No friends yet</h3>
        <p>
          Once you connect with people, they'll appear here.
          Start by finding a language partner.
        </p>

        <a href="users.html" class="btn primary">
          Find people
        </a>
      </div>
    `;

    return;
  }

  container.innerHTML = friends
    .map(friend => {
      const profile = friend.profile || {};
      const name = profile.displayName || friend.username || "User";

      return `
        <article class="friend-row" data-friendship-id="${escapeHtml(
          friend.friendshipId || ""
        )}">

          <div class="friend-identity">
            <a href="profile-view.html?user=${encodeURIComponent(friend.id)}" aria-label="Open ${escapeHtml(name)} profile">
              ${avatarHtml(profile, "avatar")}
            </a>

            <div class="friend-details">
              <a class="profile-card-link" href="profile-view.html?user=${encodeURIComponent(friend.id)}">
                <strong>${escapeHtml(name)}</strong>
              </a>

              ${
                friend.username
                  ? `<span>@${escapeHtml(friend.username)}</span>`
                  : ""
              }

              ${
                profile.bio
                  ? `<small>${escapeHtml(truncateText(profile.bio, 90))}</small>`
                  : `<small>Language partner</small>`
              }
            </div>
          </div>

          <div class="friend-actions">
            <button
              class="btn secondary"
              type="button"
              data-action="message"
              data-user-id="${escapeHtml(friend.id)}"
            >
              <span>Message</span>
            </button>

            <button
              class="icon-btn danger-icon"
              type="button"
              data-action="remove"
              data-friendship-id="${escapeHtml(friend.friendshipId || "")}"
              title="Remove friend"
              aria-label="Remove ${escapeHtml(name)}"
            >
              ×
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  attachFriendEvents(container);
}


function attachFriendEvents(container) {
  container.querySelectorAll('[data-action="message"]').forEach(button => {
    button.addEventListener("click", () => {
      startChat(button.dataset.userId, button);
    });
  });

  container.querySelectorAll('[data-action="remove"]').forEach(button => {
    button.addEventListener("click", () => {
      removeFriend(button.dataset.friendshipId, button);
    });
  });
}


function truncateText(value, maxLength) {
  if (!value) return "";

  const text = String(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}…`;
}


async function startChat(id, button) {
  if (!id) {
    toast("Unable to start this conversation.");
    return;
  }

  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
  }

  try {
    const chat = await api.post(`/chats/${id}`, {});

    const chatId = chat?.id || chat?.chatId;

    if (!chatId) {
      throw new Error("The conversation could not be created.");
    }

    location.href = `chat.html?chat=${encodeURIComponent(chatId)}`;
  } catch (error) {
    toast(error.message || "Unable to start conversation.");

    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }
}


async function removeFriend(friendshipId, button) {
  if (!friendshipId) {
    toast("Unable to remove this friendship.");
    return;
  }

  const confirmed = confirm(
    "Are you sure you want to remove this friendship?"
  );

  if (!confirmed) {
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
    }

    await api.delete(`/friends/${friendshipId}`);

    const row = document.querySelector(
      `[data-friendship-id="${CSS.escape(friendshipId)}"]`
    );

    if (row) {
      row.classList.add("is-removing");

      setTimeout(() => {
        row.remove();

        const remaining = document.querySelectorAll(
          ".friend-row"
        ).length;

        const count = document.getElementById("friendCount");

        if (count) {
          count.textContent = `${remaining} ${
            remaining === 1 ? "friend" : "friends"
          }`;
        }

        if (remaining === 0) {
          renderFriends([]);
        }
      }, 180);
    }

    toast("Friend removed");
  } catch (error) {
    toast(error.message || "Unable to remove friend.");

    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }
}
