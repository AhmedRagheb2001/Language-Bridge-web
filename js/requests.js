document.addEventListener("DOMContentLoaded", async () => {
  await initShell("requests");

  const content = document.getElementById("content");

  // initShell may redirect unauthenticated users.
  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Friend requests</h1>
        <p class="muted">
          Manage incoming and outgoing connections.
        </p>
      </div>

      <a href="users.html" class="btn primary">Find people</a>
    </div>

    <div class="stack">

      <section>
        <h3>Received</h3>

        <div id="received" class="list">
          <div class="loader">
            Loading received requests...
          </div>
        </div>
      </section>

      <section>
        <h3>Sent</h3>

        <div id="sent" class="list">
          <div class="loader">
            Loading sent requests...
          </div>
        </div>
      </section>

    </div>
  `;

  await loadRequests();
});


/* =========================================================
   LOAD REQUESTS
   ========================================================= */

async function loadRequests() {
  const receivedContainer = document.getElementById("received");
  const sentContainer = document.getElementById("sent");

  if (!receivedContainer || !sentContainer) {
    return;
  }

  try {
    receivedContainer.innerHTML = `
      <div class="loader">
        Loading received requests...
      </div>
    `;

    sentContainer.innerHTML = `
      <div class="loader">
        Loading sent requests...
      </div>
    `;

    const [receivedResponse, sentResponse] = await Promise.all([
      api.get("/friend-requests/received"),
      api.get("/friend-requests/sent")
    ]);

    const received = normalizeList(receivedResponse);
    const sent = normalizeList(sentResponse);

    renderReceived(received);
    renderSent(sent);

  } catch (error) {
    console.error("Failed to load friend requests:", error);

    const message =
      error?.message || "Failed to load friend requests.";

    receivedContainer.innerHTML = `
      <div class="card empty">
        ${escapeHtml(message)}
      </div>
    `;

    sentContainer.innerHTML = `
      <div class="card empty">
        ${escapeHtml(message)}
      </div>
    `;
  }
}


/* =========================================================
   NORMALIZE API RESPONSE
   ========================================================= */

function normalizeList(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.content)) {
    return response.content;
  }

  if (Array.isArray(response?.receivedRequests)) {
    return response.receivedRequests;
  }

  if (Array.isArray(response?.sentRequests)) {
    return response.sentRequests;
  }

  if (Array.isArray(response?.friendRequests)) {
    return response.friendRequests;
  }

  if (Array.isArray(response?.requests)) {
    return response.requests;
  }

  return [];
}


/* =========================================================
   RECEIVED REQUESTS
   ========================================================= */

function renderReceived(items) {
  const container = document.getElementById("received");

  if (!container) {
    return;
  }

  if (!items.length) {
    container.innerHTML = `
      <div class="card empty">
        <div class="empty-icon">◎</div>
        <h3>No received requests</h3>
        <p>When people want to connect, their requests will appear here.</p>
        <a href="users.html" class="btn secondary">Find people</a>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(request => {

    const sender = request?.sender || {};
    const profile = sender?.profile || {};

    const displayName =
      profile?.displayName ||
      sender?.username ||
      "User";

    const status = String(
      request?.status || "UNKNOWN"
    ).toUpperCase();

    const requestId =
      request?.id ||
      request?.requestId ||
      request?.friendRequestId;

    return `
      <div class="card list-item">

        ${avatarHtml(profile, "avatar")}

        <div class="grow">
          <strong>
            ${escapeHtml(displayName)}
          </strong>

          <small>
            ${fmtDate(request?.createdAt)}
          </small>
        </div>

        <div class="actions">

          ${
            requestId && status === "PENDING"
              ? `
                <button
                  class="btn primary request-action"
                  type="button"
                  data-action="accept"
                  data-request-id="${escapeHtml(String(requestId))}"
                >
                  Accept
                </button>

                <button
                  class="btn danger request-action"
                  type="button"
                  data-action="reject"
                  data-request-id="${escapeHtml(String(requestId))}"
                >
                  Reject
                </button>
              `
              : `
                <span class="muted">
                  ${escapeHtml(status)}
                </span>
              `
          }

          ${
            requestId
              ? `
                <button
                  class="btn ghost request-action"
                  type="button"
                  data-action="delete"
                  data-request-id="${escapeHtml(String(requestId))}"
                >
                  Delete
                </button>
              `
              : ""
          }

        </div>

      </div>
    `;
  }).join("");

  attachRequestActions(container);
}


/* =========================================================
   SENT REQUESTS
   ========================================================= */

function renderSent(items) {
  const container = document.getElementById("sent");

  if (!container) {
    return;
  }

  if (!items.length) {
    container.innerHTML = `
      <div class="card empty">
        <div class="empty-icon">↗</div>
        <h3>No sent requests</h3>
        <p>Discover profiles and send a request to start connecting.</p>
        <a href="users.html" class="btn primary">Discover profiles</a>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(request => {

    const receiver = request?.receiver || {};
    const profile = receiver?.profile || {};

    const displayName =
      profile?.displayName ||
      receiver?.username ||
      "User";

    const status = String(
      request?.status || "UNKNOWN"
    ).toUpperCase();

    const requestId =
      request?.id ||
      request?.requestId ||
      request?.friendRequestId;

    return `
      <div class="card list-item">

        ${avatarHtml(profile, "avatar")}

        <div class="grow">
          <strong>
            ${escapeHtml(displayName)}
          </strong>

          <small>
            ${fmtDate(request?.createdAt)}
          </small>
        </div>

        <div class="actions">

          ${
            requestId && status === "PENDING"
              ? `
                <button
                  class="btn danger request-action"
                  type="button"
                  data-action="cancel"
                  data-request-id="${escapeHtml(String(requestId))}"
                >
                  Cancel
                </button>
              `
              : `
                <span class="muted">
                  ${escapeHtml(status)}
                </span>
              `
          }

          ${
            requestId
              ? `
                <button
                  class="btn ghost request-action"
                  type="button"
                  data-action="delete"
                  data-request-id="${escapeHtml(String(requestId))}"
                >
                  Delete
                </button>
              `
              : ""
          }

        </div>

      </div>
    `;
  }).join("");

  attachRequestActions(container);
}


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

function attachRequestActions(container) {
  container.querySelectorAll(".request-action").forEach(button => {

    button.addEventListener("click", async () => {

      const id = button.dataset.requestId;
      const action = button.dataset.action;

      await reqAction(id, action, button);
    });

  });
}


/* =========================================================
   REQUEST ACTION
   ========================================================= */

async function reqAction(id, action, button) {

  if (!id) {
    toast("Invalid friend request.");
    return;
  }

  const allowedActions = [
    "accept",
    "reject",
    "cancel",
    "delete"
  ];

  if (!allowedActions.includes(action)) {
    toast("Invalid request action.");
    return;
  }

  if (button?.disabled) {
    return;
  }

  const originalText = button?.textContent || "";

  try {

    if (button) {
      button.disabled = true;
      button.textContent = "Please wait...";
    }

    if (action === "delete") {
      await api.delete(
        `/friend-requests/${encodeURIComponent(id)}`
      );
    } else {
      await api.patch(
        `/friend-requests/${encodeURIComponent(id)}/${action}`,
        {}
      );
    }

    switch (action) {
      case "accept":
        toast("Friend request accepted.");
        break;

      case "reject":
        toast("Friend request rejected.");
        break;

      case "cancel":
        toast("Friend request cancelled.");
        break;

      case "delete":
        toast("Friend request deleted.");
        break;
    }

    await loadRequests();

  } catch (error) {

    console.error(
      `Failed to ${action} friend request:`,
      error
    );

    toast(
      error?.message ||
      `Failed to ${action} friend request.`
    );

    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}


/* =========================================================
   OPTIONAL GLOBAL HELPERS
   ========================================================= */

function acceptReq(id, button) {
  return reqAction(id, "accept", button);
}

function rejectReq(id, button) {
  return reqAction(id, "reject", button);
}

function cancelReq(id, button) {
  return reqAction(id, "cancel", button);
}

function deleteReq(id, button) {
  return reqAction(id, "delete", button);
}
