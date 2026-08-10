document.addEventListener("DOMContentLoaded", async () => {
  await initShell("profile");

  const content = document.getElementById("content");

  content.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">Your space</div>
        <h1>Profile</h1>
        <p class="muted">Manage your profile and see what you've shared.</p>
      </div>

      <button class="btn secondary" type="button" onclick="editProfile()">
        Edit profile
      </button>
    </div>

    <section class="profile-card card">
      <div class="profile-cover">
        <div class="profile-cover-glow"></div>
      </div>

      <div class="profile-body">
        <div id="profileMain">
          <div class="profile-loading">
            <span class="spinner"></span>
            <span>Loading profile...</span>
          </div>
        </div>

        <div id="profileInfo"></div>
      </div>
    </section>

    <section class="profile-posts-section">
      <div class="section-header">
        <div>
          <div class="eyebrow">Your activity</div>
          <h2>Your posts</h2>
          <p class="muted">Everything you've shared with the community.</p>
        </div>

        <span id="postCount" class="count-pill">— posts</span>
      </div>

      <div id="posts" class="stack">
        <div class="loading-state">
          <span class="spinner"></span>
          <span>Loading your posts...</span>
        </div>
      </div>
    </section>
  `;

  try {
    const me = await loadMe();

    renderProfile(me);

    try {
      const posts = await api.get(`/users/${me.id}/posts`);
      renderProfilePosts(posts || []);
    } catch (error) {
      document.getElementById("posts").innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">!</div>
          <h3>Couldn't load your posts</h3>
          <p>${escapeHtml(error.message || "Something went wrong.")}</p>
          <button class="btn secondary" onclick="loadProfilePosts('${escapeHtml(me.id)}')">
            Try again
          </button>
        </div>
      `;
    }
  } catch (error) {
    const main = document.getElementById("profileMain");

    if (main) {
      main.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">!</div>
          <h3>Couldn't load your profile</h3>
          <p>${escapeHtml(error.message || "Something went wrong.")}</p>
          <button class="btn secondary" onclick="location.reload()">
            Try again
          </button>
        </div>
      `;
    }
  }
});


function renderProfile(user) {
  const profile = user?.profile || {};

  const displayName =
    profile.displayName ||
    user?.username ||
    "User";

  const username = user?.username || "";

  const email = user?.email || "";

  const bio =
    profile.bio ||
    "No bio yet. Tell the community a little about yourself.";

  const nativeLanguage =
    profile.nativeLanguage || "—";

  const learningLanguage =
    profile.learningLanguage || "—";

  const main = document.getElementById("profileMain");
  const info = document.getElementById("profileInfo");

  if (!main || !info) return;

  main.innerHTML = `
    <div class="profile-identity">
      <div class="profile-avatar-wrap">
        ${avatarHtml(profile, "avatar profile-avatar")}
        <span class="profile-online-dot" title="Active"></span>
      </div>

      <div class="profile-heading">
        <h2>${escapeHtml(displayName)}</h2>

        <div class="profile-handle">
          ${username ? `@${escapeHtml(username)}` : ""}
          ${username && email ? `<span>·</span>` : ""}
          ${email ? escapeHtml(email) : ""}
        </div>
      </div>
    </div>
  `;

  info.innerHTML = `
    <div class="profile-info-grid">

      <div class="profile-bio">
        <span class="profile-label">About you</span>
        <p>${escapeHtml(bio)}</p>
      </div>

      <div class="language-pair">

        <div class="language-item">
          <span class="profile-label">Native language</span>
          <strong>${formatLanguage(nativeLanguage)}</strong>
        </div>

        <div class="language-arrow">→</div>

        <div class="language-item">
          <span class="profile-label">Learning</span>
          <strong>${formatLanguage(learningLanguage)}</strong>
        </div>

      </div>

    </div>
  `;
}


async function loadProfilePosts(userId) {
  const container = document.getElementById("posts");

  if (!container || !userId) return;

  container.innerHTML = `
    <div class="loading-state">
      <span class="spinner"></span>
      <span>Loading your posts...</span>
    </div>
  `;

  try {
    const posts = await api.get(`/users/${userId}/posts`);
    renderProfilePosts(posts || []);
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <h3>Couldn't load your posts</h3>
        <p>${escapeHtml(error.message || "Something went wrong.")}</p>
        <button class="btn secondary" onclick="loadProfilePosts('${escapeHtml(userId)}')">
          Try again
        </button>
      </div>
    `;
  }
}


function renderProfilePosts(posts) {
  const container = document.getElementById("posts");
  const count = document.getElementById("postCount");

  if (!container) return;

  if (count) {
    count.textContent = `${posts.length} ${
      posts.length === 1 ? "post" : "posts"
    }`;
  }

  if (!posts.length) {
    container.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">✦</div>
        <h3>No posts yet</h3>
        <p>
          You haven't shared anything with the community yet.
          Your first post can start a conversation.
        </p>

        <a href="index.html" class="btn primary">
          Create a post
        </a>
      </div>
    `;

    return;
  }

  container.innerHTML = posts
    .map(post => {
      const title = post.title || "Untitled post";
      const content = post.content || "";

      return `
        <article class="card post profile-post">

          <div class="post-meta-row">
            <div class="post-mini-author">
              ${avatarHtml(
                currentUser()?.profile || {},
                "avatar sm"
              )}

              <div>
                <strong>
                  ${escapeHtml(
                    currentUser()?.profile?.displayName ||
                    currentUser()?.username ||
                    "You"
                  )}
                </strong>

                <span>
                  ${fmtDate(post.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <h3>${escapeHtml(title)}</h3>

          ${
            content
              ? `<p>${escapeHtml(content)}</p>`
              : ""
          }

          ${
            post.postPictureUrl
              ? `
                <img
                  class="post-image"
                  src="${escapeHtml(post.postPictureUrl)}"
                  alt=""
                  loading="lazy"
                >
              `
              : ""
          }

        </article>
      `;
    })
    .join("");
}


function editProfile() {
  const user = currentUser();

  if (!user) {
    toast("Your session has expired.");
    return;
  }

  const profile = user.profile || {};

  const modal = document.createElement("div");

  modal.className = "modal profile-modal";

  modal.innerHTML = `
    <div
      class="modal-card profile-edit-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profileEditTitle"
    >

      <div class="modal-header">
        <div>
          <div class="eyebrow">Personal details</div>
          <h2 id="profileEditTitle">Edit profile</h2>
          <p class="muted">
            Keep your profile up to date.
          </p>
        </div>

        <button
          class="icon-btn modal-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form id="profileForm" class="form">

        <div class="profile-upload">

          <div id="profilePreview">
            ${avatarHtml(profile, "avatar lg")}
          </div>

          <div>
            <strong>Profile picture</strong>
            <p class="muted">
              JPG, PNG or WEBP. Choose a clear picture.
            </p>

            <label class="btn secondary file-button">
              Choose image
              <input
                id="profilePictureInput"
                name="profilePicture"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
              >
            </label>
          </div>

        </div>

        <label>
          Display name

          <input
            name="displayName"
            value="${escapeHtml(profile.displayName || "")}"
            required
            maxlength="80"
            autocomplete="name"
          >
        </label>

        <label>
          Bio

          <textarea
            name="bio"
            rows="4"
            maxlength="500"
            placeholder="Tell people a little about yourself..."
          >${escapeHtml(profile.bio || "")}</textarea>

          <small class="field-hint">
            <span id="bioCount">${(profile.bio || "").length}</span>/500
          </small>
        </label>

        <div class="form-grid">

          <label>
            Native language

            <select name="nativeLanguage">
              ${langs(profile.nativeLanguage)}
            </select>
          </label>

          <label>
            Learning language

            <select name="learningLanguage">
              ${langs(profile.learningLanguage)}
            </select>
          </label>

        </div>

        <p id="pe" class="error"></p>

        <div class="modal-actions">
          <button
            class="btn ghost"
            type="button"
            onclick="this.closest('.modal').remove()"
          >
            Cancel
          </button>

          <button
            id="saveProfileBtn"
            class="btn primary"
            type="submit"
          >
            Save changes
          </button>
        </div>

      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#profileForm");
  const closeButton = modal.querySelector(".modal-close");
  const pictureInput = modal.querySelector("#profilePictureInput");
  const preview = modal.querySelector("#profilePreview");
  const bioInput = form.querySelector("textarea[name='bio']");
  const bioCount = modal.querySelector("#bioCount");

  closeButton.addEventListener("click", () => {
    modal.remove();
  });

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.remove();
    }
  });

  document.addEventListener(
    "keydown",
    function handleEscape(event) {
      if (event.key === "Escape" && document.body.contains(modal)) {
        modal.remove();
        document.removeEventListener("keydown", handleEscape);
      }
    },
    { once: true }
  );

  bioInput.addEventListener("input", () => {
    bioCount.textContent = bioInput.value.length;
  });

  pictureInput.addEventListener("change", () => {
    const file = pictureInput.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file.");
      pictureInput.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast("Profile pictures must be smaller than 5 MB.");
      pictureInput.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = event => {
      preview.innerHTML = `
        <img
          class="avatar lg"
          src="${event.target.result}"
          alt="Profile preview"
        >
      `;
    };

    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const errorElement = modal.querySelector("#pe");
    const saveButton = modal.querySelector("#saveProfileBtn");

    errorElement.textContent = "";

    const formData = new FormData(form);

    const displayName = String(
      formData.get("displayName") || ""
    ).trim();

    const bio = String(
      formData.get("bio") || ""
    ).trim();

    if (!displayName) {
      errorElement.textContent = "Please enter a display name.";
      return;
    }

    saveButton.disabled = true;
    saveButton.classList.add("is-loading");
    saveButton.textContent = "Saving...";

    try {
      await api.patch("/profiles/me", {
        displayName,
        bio,
        nativeLanguage: formData.get("nativeLanguage"),
        learningLanguage: formData.get("learningLanguage")
      });

      const picture = pictureInput.files?.[0];

      if (picture && picture.size) {
        const pictureForm = new FormData();

        pictureForm.append(
          "profilePicture",
          picture
        );

        await api.post(
          "/profiles/me/profilePicture",
          pictureForm
        );
      }

      const updatedUser = await loadMe();

      renderProfile(updatedUser);

      const posts = await api.get(
        `/users/${updatedUser.id}/posts`
      );

      renderProfilePosts(posts || []);

      modal.remove();

      toast("Profile updated successfully");
    } catch (error) {
      errorElement.textContent =
        error.message || "Unable to update your profile.";

      saveButton.disabled = false;
      saveButton.classList.remove("is-loading");
      saveButton.textContent = "Save changes";
    }
  });

  setTimeout(() => {
    form.querySelector("input[name='displayName']")?.focus();
  }, 50);
}


function langs(selected) {
  const languages = [
    ["ENGLISH", "English"],
    ["SPANISH", "Spanish"],
    ["FRENCH", "French"],
    ["ARABIC", "Arabic"],
    ["TURKISH", "Turkish"]
  ];

  return languages
    .map(([value, label]) => `
      <option
        value="${value}"
        ${value === selected ? "selected" : ""}
      >
        ${label}
      </option>
    `)
    .join("");
}


function formatLanguage(language) {
  if (!language || language === "—") {
    return "—";
  }

  return String(language)
    .toLowerCase()
    .replace(/^\w/, char => char.toUpperCase());
}
