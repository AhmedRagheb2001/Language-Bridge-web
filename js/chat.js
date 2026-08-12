/* =========================================================
   SOCKET.IO CLIENT
   -----------------------------------------------------------
   The socket is OPTIONAL: if the chat server is unreachable
   the page keeps working through REST + a polling fallback.

   IMPORTANT: the websocket only works if the backend runs on
   an always-on Node server (Render/Railway/Fly.io), NOT on
   Vercel serverless.
   ========================================================= */

const SOCKET_EVENTS = {
  join: "join:chat",
  leave: "leave:chat",
  message: "message:new"
};

let socket = null;
let socketConnected = false;
let pollFallbackTimer = null;

function createSocket() {
  if (typeof io !== "function") {
    console.warn(
      "Socket.IO client library failed to load. Falling back to polling."
    );
    return null;
  }

  let base = String(API_BASE || "");

  if (base.endsWith("/api/v1")) {
    base = base.slice(0, -"/api/v1".length);
  }

  base = base.replace(/\/+$/, "");

  const socket = io(base, {
    path: "/api/socket-io/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    auth: {
      token: localStorage.getItem("accessToken") || null
    },
    autoConnect: false
  });

  socket.on("connect", () => {
    socketConnected = true;

    console.info("Live: connected to the chat server", socket.id);

    setSocketStatus("connected", "Live");

    /*
     * If a chat was already selected before the socket connected,
     * join that chat room now.
     */
    joinActiveChat();

    stopPollFallback();
  });

  socket.on("disconnect", reason => {
    socketConnected = false;

    console.info("Chat server disconnected:", reason);

    setSocketStatus("offline", "Offline");

    if (reason !== "io client disconnect") {
      startPollFallback();
    }
  });

  socket.on("connect_error", error => {
    // Log once instead of spamming the console on every retry.
    console.warn("Chat server unreachable:", error.message);

    setSocketStatus("connecting", "Reconnecting…");

    startPollFallback();
  });

  /*
   * Incoming message events.
   * Your backend currently emits "new:message".
   */
  [SOCKET_EVENTS.message, "new:message", "chat:message", "message"].forEach(
    name => {
      socket.on(name, payload => handleIncomingMessage(payload));
    }
  );

  socket.connect();

  return socket;
}

socket = createSocket();

function setSocketStatus(state, label) {
  const chip = document.getElementById("socketStatus");

  if (!chip) return;

  chip.className = `socket-status ${state}`;
  chip.textContent = label;
}

/*
 * Join the currently active chat if one exists.
 *
 * This is used when:
 * 1. The socket connects after a chat has already been selected.
 * 2. The page already has an active chat when the socket connects.
 */
function joinActiveChat() {
  if (!socket || !socketConnected || !window.activeChat) {
    return;
  }

  socket.emit(SOCKET_EVENTS.join, {
    chatId: window.activeChat
  });

  console.log("Joining active chat room:", window.activeChat);
}

function handleIncomingMessage(payload) {
  const chatId = payload?.chatId || payload?.chat_id;

  if (!chatId) return;

  if (String(chatId) === String(window.activeChat)) {
    refreshMessages(chatId);
  } else {
    renderChats(window._chats || []);
  }

  toast("New message");
}

function startPollFallback() {
  if (pollFallbackTimer || socketConnected) return;

  pollFallbackTimer = setInterval(() => {
    if (socketConnected || !window.activeChat) return;

    refreshMessages(window.activeChat);
  }, 5000);
}

function stopPollFallback() {
  if (pollFallbackTimer) {
    clearInterval(pollFallbackTimer);
    pollFallbackTimer = null;
  }
}

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

    <div class="page-head-actions chat-head-actions">
      <span id="socketStatus" class="socket-status connecting">
        Connecting…
      </span>
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

          <button
            class="btn secondary"
            onclick="location.reload()"
          >
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

  /*
   * Store chats globally so the incoming socket handler
   * can use them later.
   */
  window._chats = chats;

  if (!chats.length) {
    chatList.innerHTML = `
      <div class="empty chat-empty">
        <div class="empty-icon">💬</div>

        <strong>No conversations yet</strong>

        <p>
          Become friends with someone and start a conversation.
        </p>

        <a href="users.html" class="btn secondary">
          Find people
        </a>
      </div>
    `;

    return;
  }

  chatList.innerHTML = chats
    .map(chat => {
      const friend = chat.chatFriend || {};
      const profile = friend.profile || {};

      const name =
        profile.displayName ||
        friend.username ||
        "User";

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
    })
    .join("");

  updateActiveChatItem(window.activeChat);
}


/* =========================================================
   OPEN CHAT
   ========================================================= */

async function openChat(id) {
  if (!id) return;

  /*
   * Remember the previous chat before changing activeChat.
   */
  const previousChat = window.activeChat;

  /*
   * Leave the previous Socket.IO room.
   *
   * Example:
   * User was in chat A
   * User clicks chat B
   * Leave A first.
   */
  if (
    socket &&
    socketConnected &&
    previousChat &&
    String(previousChat) !== String(id)
  ) {
    socket.emit(SOCKET_EVENTS.leave, {
      chatId: previousChat
    });

    console.log("Leaving chat room:", previousChat);
  }

  /*
   * Set the newly selected chat as active.
   */
  window.activeChat = id;

  /*
   * Join the new Socket.IO room.
   *
   * This is the important Step 3 change.
   */
  if (socket && socketConnected) {
    socket.emit(SOCKET_EVENTS.join, {
      chatId: id
    });

    console.log("Joining chat room:", id);
  }

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

        <button
          class="btn secondary"
          onclick="openChat('${escapeHtml(id)}')"
        >
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

  messagesBox.innerHTML = messages
    .map(message => {
      const isMine =
        me &&
        message.senderId === me.id;

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
    })
    .join("");
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

    if (
      form &&
      !form.querySelector("button").disabled
    ) {
      form.requestSubmit();
    }
  }
});