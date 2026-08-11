document.addEventListener("DOMContentLoaded", async () => {
  await initShell("notifications");

  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">Updates</span>
        <h1>Notifications</h1>
        <p class="muted">Friend requests, likes, comments, and messages when supported by the API.</p>
      </div>
      <a href="requests.html" class="btn secondary">Friend requests</a>
    </div>

    <section class="card">
      <div id="notifications" class="list">
        <div class="loading-state"><span class="spinner"></span><span>Loading notifications...</span></div>
      </div>
    </section>
  `;

  await loadNotifications();
});


async function loadNotifications() {
  const container = document.getElementById("notifications");
  if (!container) return;

  try {
    const response = await api.get("/notifications");
    const notifications = normalizeNotifications(response);
    renderNotifications(notifications);
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <h3>No notification feed yet</h3>
        <p>The current API contract does not list a notifications endpoint. Friend requests are still available.</p>
        <a href="requests.html" class="btn primary">Open requests</a>
      </div>
    `;
  }
}


function normalizeNotifications(response) {
  if (Array.isArray(response)) return response;
  return response?.notifications || response?.allNotifications || response?.data || response?.items || response?.content || [];
}


function renderNotifications(notifications) {
  const container = document.getElementById("notifications");
  if (!container) return;

  if (!notifications.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        <h3>You're all caught up</h3>
        <p>New friend requests, likes, comments, and messages will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notifications.map(item => `
    <article class="list-item notification-item">
      <div class="empty-icon notification-icon">${escapeHtml(notificationIcon(item))}</div>
      <div class="grow">
        <strong>${escapeHtml(item.title || item.type || "Notification")}</strong>
        <small>${escapeHtml(item.message || item.content || "You have a new update.")}</small>
        <small>${fmtDate(item.createdAt)}</small>
      </div>
    </article>
  `).join("");
}


function notificationIcon(item) {
  const type = String(item?.type || "").toLowerCase();
  if (type.includes("message")) return "○";
  if (type.includes("like")) return "♡";
  if (type.includes("comment")) return "✎";
  if (type.includes("friend")) return "+";
  return "✦";
}
