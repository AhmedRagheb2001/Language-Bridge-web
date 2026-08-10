document.addEventListener("DOMContentLoaded", async () => {
  await initShell("chats");

  const content = document.getElementById("content");

  content.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">CONVERSATIONS</span>
        <h1>Messages</h1>
        <p class="muted">Practice, connect, and keep the conversation going.</p>
      </div>

      <a href="users.html" class="btn secondary">Find people</a>
    </div>

    <div class="chat-layout">
      <section class="card chat-list-panel">
        <div class="chat-list-header">
          <div>
            <h2>Your chats</h2>
            <p class="muted">Recent conversations</p>
          </div>
        </div>

        <div id="chatList" class="chat-list">
          <div class="loader">
            <span class="loader-spinner"></span>
            Loading conversations...
          </div>
        </div>
      </section>

      <section class="card chat-window">
        <div id="chatHeader" class="chat-header">
          <div class="chat-placeholder">
            <div class="chat-placeholder-icon">💬</div>
            <div>
              <strong>Select a conversation</strong>
              <p class="muted">Choose a chat to start messaging.</p>
            </div>
          </div>
        </div>

        <div id="messages" class="messages">
          <div class="empty">
            Your messages will appear here.
          </div>
        </div>

        <form id="composer" class="composer">
          <input
            name="content"
            type="text"
            placeholder="Write a message..."
            autocomplete="off"
            disabled
          >

          <button
            class="btn primary"
            type="submit"
            disabled
          >
            Send
          </button>
        </form>
      </section>
    </div>
  `;

  try {
    const chats = await api.get("/chats");

    renderChats(chats);

    const chatId = new URLSearchParams(location.search).get("chat");

    if (chatId) {
      await openChat(chatId);
    }
  } catch (error) {
    const chatList = document.getElementById("chatList");

    if (chatList) {
      chatList.innerHTML = `
        <div class="empty">
          <strong>Couldn't load conversations</strong>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn secondary" onclick="location.reload()">
            Try again
          </button>
        </div>
      `;
    }
  }
});


function renderChats(chats = []) {
  const chatList = document.getElementById("chatList");

  if (!chatList) return;

  if (!chats.length) {
    chatList.innerHTML = `
      <div class="empty chat-empty">
        <div class="empty-icon">💬</div>
        <strong>No conversations yet</strong>
        <p>Become friends with someone and start a conversation.</p>
        <a href="users.html" class="btn secondary">Find people</a>
      </div>
    `;

    return;
  }

  chatList.innerHTML = chats.map(chat => {
    const friend = chat.chatFriend || {};
    const profile = friend.profile || {};
    const name = profile.displayName || friend.username || "User";
    const chatId = chat.chatId || chat.id;

    return `
      <button
        type="button"
        class="chat-item"
        data-chat-id="${escapeHtml(chatId)}"
        onclick="openChat('${escapeHtml(chatId)}')"
      >
        ${avatarHtml(profile, "avatar")}

        <span class="chat-item-content">
          <strong>${escapeHtml(name)}</strong>
          <small>Open conversation</small>
        </span>

        <span class="chat-item-arrow">›</span>
      </button>
    `;
  }).join("");

  updateActiveChatItem(window.activeChat);
}


async function openChat(id) {
  if (!id) return;

  window.activeChat = id;

  updateActiveChatItem(id);

  const header = document.getElementById("chatHeader");
  const messagesBox = document.getElementById("messages");
  const form = document.getElementById("composer");

  if (!header || !messagesBox || !form) return;

  header.innerHTML = `
    <div class="chat-header-loading">
      <span class="loader-spinner"></span>
      Loading conversation...
    </div>
  `;

  messagesBox.innerHTML = `
    <div class="messages-loading">
      <span class="loader-spinner"></span>
      Loading messages...
    </div>
  `;

  disableComposer(true);

  try {
    /*
     * Load the conversation and messages in parallel.
     * This is noticeably faster than waiting for one request
     * before starting the second one.
     */
    const [chat, response] = await Promise.all([
      api.get(`/chats/${id}`),
      api.get(`/chats/${id}/messages`)
    ]);

    const friend = chat.chatFriend || {};
    const profile = friend.profile || {};

    const displayName =
      profile.displayName ||
      friend.username ||
      "User";

    renderChatHeader(displayName, profile);

    const messages = response?.allMessages || [];

    renderMessages(messages);

    enableComposer();

    requestAnimationFrame(() => {
      scrollMessagesToBottom();
    });

    updateUrlWithoutReload(id);
  } catch (error) {
    header.innerHTML = `
      <div class="chat-error">
        <strong>Couldn't open this conversation</strong>
        <span>${escapeHtml(error.message)}</span>
      </div>
    `;

    messagesBox.innerHTML = `
      <div class="empty">
        <strong>Something went wrong</strong>
        <p>${escapeHtml(error.message)}</p>
        <button class="btn secondary" onclick="openChat('${escapeHtml(id)}')">
          Try again
        </button>
      </div>
    `;

    disableComposer(true);
  }
}


function renderChatHeader(name, profile) {
  const header = document.getElementById("chatHeader");

  if (!header) return;

  header.innerHTML = `
    <div class="chat-header-user">
      ${avatarHtml(profile, "avatar")}

      <div class="chat-header-info">
        <strong>${escapeHtml(name)}</strong>
        <span>
          <span class="online-dot"></span>
          Language partner
        </span>
      </div>
    </div>
  `;
}


function renderMessages(messages = []) {
  const messagesBox = document.getElementById("messages");

  if (!messagesBox) return;

  if (!messages.length) {
    messagesBox.innerHTML = `
      <div class="empty messages-empty">
        <div class="empty-icon">👋</div>
        <strong>Start the conversation</strong>
        <p>Say hello and practice together.</p>
      </div>
    `;

    return;
  }

  const me = currentUser();

  messagesBox.innerHTML = messages.map(message => {
    const isMine = me && message.senderId === me.id;

    return `
      <div class="message-row ${isMine ? "mine" : "theirs"}">
        <div class="bubble ${isMine ? "mine" : ""}">
          <div class="bubble-content">
            ${escapeHtml(message.content)}
          </div>

          <small>
            ${fmtDate(message.createdAt)}
          </small>
        </div>
      </div>
    `;
  }).join("");
}


function updateActiveChatItem(id) {
  document.querySelectorAll(".chat-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.chatId === String(id)
    );
  });
}


function disableComposer(clearValue = false) {
  const form = document.getElementById("composer");

  if (!form) return;

  const input = form.querySelector("input");
  const button = form.querySelector("button");

  if (clearValue && input) {
    input.value = "";
  }

  if (input) input.disabled = true;
  if (button) button.disabled = true;

  form.onsubmit = null;
}


function enableComposer() {
  const form = document.getElementById("composer");

  if (!form) return;

  const input = form.querySelector("input");
  const button = form.querySelector("button");

  if (!input || !button) return;

  input.disabled = false;
  button.disabled = false;

  /*
   * Don't recreate the submit handler repeatedly.
   */
  form.onsubmit = handleMessageSubmit;

  requestAnimationFrame(() => {
    input.focus();
  });
}


async function handleMessageSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const input = form.querySelector("input");
  const button = form.querySelector("button");

  const content = input.value.trim();

  if (!content || !window.activeChat) {
    return;
  }

  /*
   * Keep the message before clearing the field.
   */
  const chatId = window.activeChat;

  input.disabled = true;
  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = "Sending...";

  try {
    await api.post(`/chats/${chatId}/messages`, {
      content
    });

    input.value = "";

    /*
     * Reload only the messages rather than rebuilding
     * the entire chat page.
     */
    await refreshMessages(chatId);
  } catch (error) {
    toast(error.message);
  } finally {
    input.disabled = false;
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = "Send";

    requestAnimationFrame(() => {
      input.focus();
    });
  }
}


async function refreshMessages(id) {
  try {
    const response = await api.get(`/chats/${id}/messages`);

    renderMessages(response?.allMessages || []);

    requestAnimationFrame(() => {
      scrollMessagesToBottom();
    });
  } catch (error) {
    toast(error.message);
  }
}


function scrollMessagesToBottom() {
  const messages = document.getElementById("messages");

  if (!messages) return;

  messages.scrollTop = messages.scrollHeight;
}


function updateUrlWithoutReload(id) {
  const url = new URL(window.location.href);

  url.searchParams.set("chat", id);

  window.history.replaceState({}, "", url);
}


/*
 * Allow Enter to send the message.
 * Shift + Enter can still be used for a new line
 * if the input is later changed to a textarea.
 */
document.addEventListener("keydown", event => {
  const input = event.target;

  if (
    input?.matches("#composer input") &&
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();

    const form = document.getElementById("composer");

    if (form && !form.querySelector("button").disabled) {
      form.requestSubmit();
    }
  }
});
