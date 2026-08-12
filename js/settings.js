document.addEventListener("DOMContentLoaded", async () => {
  await initShell("settings");

  const content = document.getElementById("content");
  const user = currentUser();

  if (!content || !user) return;

  content.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">Account</span>
        <h1>Settings</h1>
        <p class="muted">Update your account details and session.</p>
      </div>
    </div>

    <div class="settings-grid">
      <section class="card settings-card">
        <h2>Account details</h2>
        <p class="muted">Change your username or email address.</p>

        <form id="accountForm" class="form">
          <label>Username
            <input name="username" value="${escapeHtml(user.username || "")}" required maxlength="80">
          </label>
          <label>Email
            <input name="email" type="email" value="${escapeHtml(user.email || "")}" required>
          </label>
          <p id="settingsError" class="error"></p>
          <button class="btn primary" type="submit" id="saveAccount">Save account</button>
        </form>
      </section>

      <section class="card settings-card danger-zone">
        <h2>Session</h2>
        <p class="muted">Sign out from this browser.</p>
        <button class="btn secondary" type="button" id="logoutEverywhere">Sign out</button>
      </section>

      <section class="card settings-card danger-zone">
        <h2>Delete account</h2>
        <p class="muted">This permanently deletes your account and associated data.</p>
        <button class="btn danger" type="button" id="deleteAccount">Delete my account</button>
      </section>
    </div>
  `;

  document.getElementById("accountForm")?.addEventListener("submit", saveAccount);
  document.getElementById("logoutEverywhere")?.addEventListener("click", logout);
  document.getElementById("deleteAccount")?.addEventListener("click", deleteAccount);
});


async function saveAccount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("saveAccount");
  const error = document.getElementById("settingsError");
  const user = currentUser();

  if (!user?.id) return;

  error.textContent = "";
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    await api.patch(`/users/${encodeURIComponent(user.id)}`, {
      username: form.elements.username.value.trim(),
      email: form.elements.email.value.trim()
    });
    const updated = await loadMe();
    renderAccountMini(updated);
    toast("Account updated");
  } catch (err) {
    error.textContent = err.message || "Unable to update account.";
  } finally {
    button.disabled = false;
    button.textContent = "Save account";
  }
}


async function deleteAccount() {
  const user = currentUser();
  if (!user?.id) return;

  const confirmed = await confirmDialog(
    "Delete your account permanently? This cannot be undone.",
    { confirmText: "Delete account" }
  );
  if (!confirmed) return;

  const button = document.getElementById("deleteAccount");
  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    await api.delete(`/users/${encodeURIComponent(user.id)}`);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("currentUser");
    location.replace("register.html");
  } catch (error) {
    toast(error.message || "Unable to delete account.");
    button.disabled = false;
    button.textContent = "Delete my account";
  }
}
