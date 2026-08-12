document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;

  await initShell("home");

  const content = document.getElementById("content");

  content.innerHTML = `
    <div class="page-head feed-header">
      <div>
        <span class="eyebrow">Community</span>
        <h1>Your feed</h1>
        <p class="muted">
          Discover thoughts, stories, and language-learning moments.
        </p>
      </div>

      <button class="btn primary" id="newPost">
        <span class="btn-icon">+</span>
        New post
      </button>
    </div>

    <div id="feed" class="stack">
      <div class="card loading-card">
        <div class="spinner"></div>
        <span>Loading your feed...</span>
      </div>
    </div>
  `;

  document
    .getElementById("newPost")
    .addEventListener("click", openPostModal);

  await loadFeed();
});


/* ---------------------------------------------------------
   FEED
--------------------------------------------------------- */

async function loadFeed() {
  const feed = document.getElementById("feed");

  try {
    const posts = await api.get("/posts/");
    renderPosts(Array.isArray(posts) ? posts : []);
  } catch (error) {
    feed.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">!</div>
        <h3>Couldn't load your feed</h3>
        <p>${escapeHtml(error.message)}</p>
        <button class="btn secondary" id="retryFeed">
          Try again
        </button>
      </div>
    `;

    document
      .getElementById("retryFeed")
      ?.addEventListener("click", loadFeed);
  }
}


function renderPosts(posts) {
  const feed = document.getElementById("feed");

  if (!posts.length) {
    feed.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">✦</div>
        <h3>Your feed is quiet</h3>
        <p>
          Be the first person to share something with the community.
        </p>
        <button class="btn primary" id="emptyNewPost">
          Create your first post
        </button>
      </div>
    `;

    document
      .getElementById("emptyNewPost")
      ?.addEventListener("click", openPostModal);

    return;
  }

  feed.innerHTML = posts
    .map(renderPost)
    .join("");

  attachPostEvents();
}


function renderPost(post) {
  const profile = post.user?.profile || {};
  const displayName =
    profile.displayName ||
    post.user?.username ||
    "LanguageBridge user";

  const username = post.user?.username
    ? `@${post.user.username}`
    : "";

  const image = post.postPictureUrl
    ? `
      <div class="post-media">
        <img
          class="post-image"
          src="${escapeHtml(post.postPictureUrl)}"
          alt="${escapeHtml(post.title)}"
          loading="lazy"
          decoding="async"
        >
      </div>
    `
    : "";

  const me = currentUser();
  const canEdit = me && (
    me.role === "ADMIN" ||
    String(post.user?.id || post.userId) === String(me.id)
  );
  const totalLikes = post.totalLikes ?? post._count?.likes;

  return `
    <article class="card post" data-post-id="${escapeHtml(post.id)}">

      <div class="post-head">

        ${avatarHtml(profile, "avatar")}

        <div class="post-meta">
          <strong>
            ${escapeHtml(displayName)}
          </strong>

          <span>
            ${escapeHtml(username)}
            ${username ? " · " : ""}
            ${fmtDate(post.createdAt)}
          </span>
        </div>

      </div>

      <div class="post-content">

        <h3>
          <a href="post.html?post=${encodeURIComponent(post.id)}" class="post-title-link">
            ${escapeHtml(post.title)}
          </a>
        </h3>

        ${
          post.content
            ? `<p>${escapeHtml(post.content)}</p>`
            : ""
        }

        ${image}

      </div>

      <div class="post-actions">

        <button
          class="icon-btn like-btn"
          data-action="like"
          data-id="${escapeHtml(post.id)}"
        >
          <span class="action-icon">♡</span>
          <span>${totalLikes !== undefined ? escapeHtml(totalLikes) : "Like"}</span>
        </button>

        <button
          class="icon-btn"
          data-action="comments"
          data-id="${escapeHtml(post.id)}"
        >
          <span class="action-icon">○</span>
          <span>Comments</span>
        </button>

        <a class="icon-btn" href="post.html?post=${encodeURIComponent(post.id)}">
          <span class="action-icon">↗</span>
          <span>Open</span>
        </a>

        ${canEdit ? `
          <button
            class="icon-btn"
            data-action="edit-post"
            data-id="${escapeHtml(post.id)}"
          >
            <span class="action-icon">✎</span>
            <span>Edit</span>
          </button>

          <button
            class="icon-btn danger-icon"
            data-action="delete-post"
            data-id="${escapeHtml(post.id)}"
            title="Delete post"
            aria-label="Delete post"
          >
            <span class="action-icon">🗑</span>
            <span>Delete</span>
          </button>
        ` : ""}

      </div>

      <div
        class="comments-container"
        id="comments-${escapeHtml(post.id)}"
      ></div>

    </article>
  `;
}


/* ---------------------------------------------------------
   POST EVENTS
--------------------------------------------------------- */

function attachPostEvents() {
  document.querySelectorAll("[data-action='like']").forEach(button => {
    button.addEventListener("click", () => {
      toggleLike(
        button.dataset.id,
        button
      );
    });
  });

  document.querySelectorAll("[data-action='comments']").forEach(button => {
    button.addEventListener("click", () => {
      showComments(button.dataset.id);
    });
  });

  document.querySelectorAll("[data-action='edit-post']").forEach(button => {
    button.addEventListener("click", () => openEditPostModal(button.dataset.id));
  });

  document.querySelectorAll("[data-action='delete-post']").forEach(button => {
    button.addEventListener("click", () => deletePost(button.dataset.id, button));
  });
}


/* ---------------------------------------------------------
   DELETE POST
--------------------------------------------------------- */

async function deletePost(postId, button) {
  if (!postId) return;

  const confirmed = await confirmDialog(
    "Delete this post? This action cannot be undone."
  );

  if (!confirmed) return;

  const card = button.closest(".post");

  try {
    button.disabled = true;

    await api.delete(`/posts/${postId}`);

    if (card) {
      card.classList.add("is-removing");

      setTimeout(() => {
        card.remove();

        const remaining = document.querySelectorAll(".post").length;

        if (remaining === 0) {
          renderPosts([]);
        }
      }, 280);
    }

    toast("Post deleted");
  } catch (error) {
    toast(error.message || "Unable to delete post.");

    button.disabled = false;
  }
}


/* ---------------------------------------------------------
   LIKES
--------------------------------------------------------- */

async function toggleLike(postId, button) {
  if (button.dataset.loading === "true") return;

  button.dataset.loading = "true";
  const wasLiked = button.classList.contains("liked");
  const currentText = button.querySelector("span:last-child")?.textContent || "Like";
  const currentCount = Number(currentText);
  const optimisticCount = Number.isFinite(currentCount)
    ? Math.max(0, currentCount + (wasLiked ? -1 : 1))
    : undefined;

  updateLikeButton(button, !wasLiked, optimisticCount);

  try {
    const response = wasLiked
      ? await api.delete(`/posts/${postId}/likes`)
      : await api.post(`/posts/${postId}/likes`, {});

    updateLikeButton(
      button,
      !wasLiked,
      response.totalLikes
    );

    toast(wasLiked ? "Post unliked" : "Post liked");

  } catch (error) {
    updateLikeButton(button, wasLiked, Number.isFinite(currentCount) ? currentCount : undefined);
    toast(error.message);

  } finally {
    button.dataset.loading = "false";
  }
}


function updateLikeButton(button, liked, totalLikes) {
  button.innerHTML = `
    <span class="action-icon">
      ${liked ? "♥" : "♡"}
    </span>

    <span>
      ${totalLikes !== undefined ? totalLikes : "Like"}
    </span>
  `;

  button.classList.toggle("liked", liked);
}


/* ---------------------------------------------------------
   COMMENTS
--------------------------------------------------------- */

async function showComments(postId) {
  const box = document.getElementById(
    `comments-${postId}`
  );

  if (!box) return;

  if (box.dataset.loaded === "true") {
    box.innerHTML = "";
    box.dataset.loaded = "false";
    return;
  }

  box.innerHTML = `
    <div class="comments-loading">
      <div class="spinner small"></div>
      Loading comments...
    </div>
  `;

  try {
    const comments = await api.get(
      `/posts/${postId}/comments`
    );

    box.dataset.loaded = "true";

    box.innerHTML = `
      <div class="comments-panel">

        <div class="comments-list">
          ${
            comments.length
              ? comments.map(renderComment).join("")
              : `
                <div class="comments-empty">
                  No comments yet.
                  Start the conversation.
                </div>
              `
          }
        </div>

        <form
          class="composer comment-form"
          data-post-id="${escapeHtml(postId)}"
        >
          <input
            name="content"
            type="text"
            placeholder="Write a comment..."
            autocomplete="off"
            required
          >

          <button
            class="btn primary"
            type="submit"
          >
            Post
          </button>
        </form>

      </div>
    `;

    const form = box.querySelector(".comment-form");

    form.addEventListener("submit", event => {
      addComment(event, postId);
    });

  } catch (error) {
    box.innerHTML = `
      <div class="comments-error">
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}


function renderComment(comment) {
  const profile = comment.user?.profile || {};

  const name =
    profile.displayName ||
    comment.user?.username ||
    "User";

  return `
    <div class="comment-item">

      ${avatarHtml(profile, "avatar sm")}

      <div class="comment-body">

        <strong>
          ${escapeHtml(name)}
        </strong>

        <p>
          ${escapeHtml(comment.content)}
        </p>

        <small>
          ${fmtDate(comment.createdAt)}
        </small>

      </div>

    </div>
  `;
}


async function addComment(event, postId) {
  event.preventDefault();

  const form = event.currentTarget;
  const input = form.elements.content;
  const button = form.querySelector("button");

  const content = input.value.trim();

  if (!content) return;

  input.disabled = true;
  button.disabled = true;
  button.textContent = "Posting...";

  try {
    await api.post(
      `/posts/${postId}/comments`,
      {
        content
      }
    );

    input.value = "";

    const box = document.getElementById(
      `comments-${postId}`
    );

    if (box) {
      box.dataset.loaded = "false";
      await showComments(postId);
    }

    toast("Comment added");

  } catch (error) {
    toast(error.message);

  } finally {
    input.disabled = false;
    button.disabled = false;
    button.textContent = "Post";
  }
}


/* ---------------------------------------------------------
   CREATE POST MODAL
--------------------------------------------------------- */

function openPostModal() {
  if (document.querySelector(".modal")) return;

  const modal = document.createElement("div");

  modal.className = "modal";

  modal.innerHTML = `
    <div
      class="modal-card post-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="createPostTitle"
    >

      <div class="modal-header">

        <div>
          <span class="eyebrow">
            Share with the community
          </span>

          <h2 id="createPostTitle">
            Create a post
          </h2>
        </div>

        <button
          class="icon-btn modal-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>

      <form
        id="postForm"
        class="form"
      >

        <label>
          Title

          <input
            name="title"
            type="text"
            maxlength="180"
            placeholder="What would you like to share?"
            required
          >
        </label>

        <label>
          Content

          <textarea
            name="content"
            rows="6"
            maxlength="5000"
            placeholder="Share a thought, question, language-learning tip..."
          ></textarea>
        </label>

        <label class="file-field">

          <span>
            Add a picture
          </span>

          <input
            name="postPicture"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
          >

          <small>
            JPG, PNG, WebP or GIF
          </small>

        </label>

        <div
          id="postPreview"
          class="upload-preview hidden"
        ></div>

        <p
          id="postErr"
          class="error"
          role="alert"
        ></p>

        <div class="modal-actions">

          <button
            type="button"
            class="btn ghost modal-cancel"
          >
            Cancel
          </button>

          <button
            type="submit"
            class="btn primary"
            id="publishPost"
          >
            Publish post
          </button>

        </div>

      </form>

    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#postForm");
  const closeButton = modal.querySelector(".modal-close");
  const cancelButton = modal.querySelector(".modal-cancel");
  const fileInput = form.elements.postPicture;

  closeButton.addEventListener(
    "click",
    () => closePostModal(modal)
  );

  cancelButton.addEventListener(
    "click",
    () => closePostModal(modal)
  );

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      closePostModal(modal);
    }
  });

  document.addEventListener(
    "keydown",
    function escapeHandler(event) {
      if (event.key === "Escape") {
        closePostModal(modal);
        document.removeEventListener(
          "keydown",
          escapeHandler
        );
      }
    }
  );

  fileInput.addEventListener(
    "change",
    () => previewPostImage(fileInput, modal)
  );

  form.addEventListener(
    "submit",
    event => submitPost(event, modal)
  );

  setTimeout(() => {
    form.elements.title.focus();
  }, 50);
}


function closePostModal(modal) {
  if (!modal) return;

  const previewImage =
    modal.querySelector(".upload-preview img");

  if (previewImage?.src.startsWith("blob:")) {
    URL.revokeObjectURL(previewImage.src);
  }

  modal.remove();
}


/* ---------------------------------------------------------
   IMAGE PREVIEW
--------------------------------------------------------- */

function previewPostImage(input, modal) {
  const preview =
    modal.querySelector("#postPreview");

  if (!preview) return;

  // Release the previous blob URL (if any) before creating a new
  // one, otherwise every re-picked file leaks memory for the rest
  // of the session.
  const existingImage = preview.querySelector("img");

  if (existingImage?.src.startsWith("blob:")) {
    URL.revokeObjectURL(existingImage.src);
  }

  const file = input.files?.[0];

  if (!file) {
    preview.innerHTML = "";
    preview.classList.add("hidden");
    return;
  }

  if (!file.type.startsWith("image/")) {
    input.value = "";
    preview.innerHTML = "";
    preview.classList.add("hidden");
    toast("Please choose an image file.");
    return;
  }

  /*
   * Keep the frontend from accidentally trying to upload
   * extremely large files.
   */
  if (file.size > 10 * 1024 * 1024) {
    input.value = "";
    preview.innerHTML = "";
    preview.classList.add("hidden");
    toast("Please choose an image smaller than 10 MB.");
    return;
  }

  const url = URL.createObjectURL(file);

  preview.classList.remove("hidden");

  preview.innerHTML = `
    <div class="preview-label">
      Image preview
      <button type="button" class="preview-remove" data-action="remove-preview">Remove</button>
    </div>

    <img
      src="${url}"
      alt="Selected image preview"
    >
  `;

  preview.querySelector("[data-action='remove-preview']")?.addEventListener("click", () => {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    input.value = "";
    preview.innerHTML = "";
    preview.classList.add("hidden");
  });
}


/* ---------------------------------------------------------
   SUBMIT POST
--------------------------------------------------------- */

async function submitPost(event, modal) {
  event.preventDefault();

  const form = event.currentTarget;
  const errorElement = form.querySelector("#postErr");
  const publishButton = form.querySelector("#publishPost");

  errorElement.textContent = "";

  const title = form.elements.title.value.trim();
  const content = form.elements.content.value.trim();
  const picture = form.elements.postPicture.files?.[0];

  if (!title) {
    errorElement.textContent =
      "Please enter a title.";
    return;
  }

  const formData = new FormData();

  formData.append("title", title);
  formData.append("content", content);

  if (picture) {
    formData.append("postPicture", picture);
  }

  publishButton.disabled = true;
  publishButton.innerHTML = `
    <span class="spinner tiny"></span>
    Publishing...
  `;

  try {
    await api.post(
      "/posts/",
      formData
    );

    closePostModal(modal);

    toast("Post published successfully");

    /*
     * Do NOT reload the whole page.
     *
     * Reloading index.html makes the browser rebuild the
     * entire application and makes the site feel slower.
     */
    await loadFeed();

  } catch (error) {
    errorElement.textContent =
      error.message;

    publishButton.disabled = false;
    publishButton.textContent =
      "Publish post";
  }
}


async function openEditPostModal(postId) {
  if (!postId || document.querySelector(".modal")) return;

  try {
    const post = await api.get(`/posts/${encodeURIComponent(postId)}`);
    openPostEditor(post);
  } catch (error) {
    toast(error.message || "Unable to load this post.");
  }
}


function openPostEditor(post) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-card post-modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div>
          <span class="eyebrow">Post settings</span>
          <h2>Edit post</h2>
        </div>
        <button class="icon-btn modal-close" type="button" aria-label="Close">×</button>
      </div>

      <form id="editPostForm" class="form">
        <label>Title
          <input name="title" value="${escapeHtml(post.title || "")}" maxlength="180" required>
        </label>
        <label>Content
          <textarea name="content" rows="6" maxlength="5000">${escapeHtml(post.content || "")}</textarea>
        </label>
        <label class="file-field">
          <span>Replace picture</span>
          <input name="postPicture" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
          <small>Choose a new picture, or remove the current one below.</small>
        </label>
        <div id="postPreview" class="upload-preview ${post.postPictureUrl ? "" : "hidden"}">
          ${post.postPictureUrl ? `<div class="preview-label">Current image</div><img src="${escapeHtml(post.postPictureUrl)}" alt="Current post image">` : ""}
        </div>
        <p id="postErr" class="error"></p>
        <div class="modal-actions">
          ${post.postPictureUrl ? `<button type="button" class="btn danger" id="removePostPicture">Remove picture</button>` : ""}
          <button type="button" class="btn ghost modal-cancel">Cancel</button>
          <button type="submit" class="btn primary" id="savePost">Save changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#editPostForm");
  const fileInput = form.elements.postPicture;
  const close = () => closePostModal(modal);

  modal.querySelector(".modal-close").addEventListener("click", close);
  modal.querySelector(".modal-cancel").addEventListener("click", close);
  modal.addEventListener("click", event => {
    if (event.target === modal) close();
  });
  fileInput.addEventListener("change", () => previewPostImage(fileInput, modal));
  modal.querySelector("#removePostPicture")?.addEventListener("click", async buttonEvent => {
    const button = buttonEvent.currentTarget;
    button.disabled = true;
    try {
      await api.delete(`/posts/${encodeURIComponent(post.id)}/postPicture`);
      modal.querySelector("#postPreview").innerHTML = "";
      modal.querySelector("#postPreview").classList.add("hidden");
      button.remove();
      toast("Post picture removed");
      await loadFeed();
    } catch (error) {
      toast(error.message || "Unable to remove picture.");
      button.disabled = false;
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const errorElement = modal.querySelector("#postErr");
    const saveButton = modal.querySelector("#savePost");
    const title = form.elements.title.value.trim();
    const content = form.elements.content.value.trim();
    const picture = fileInput.files?.[0];

    errorElement.textContent = "";
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      await api.patch(`/posts/${encodeURIComponent(post.id)}`, { title, content });
      if (picture) {
        const formData = new FormData();
        formData.append("postPicture", picture);
        await api.patch(`/posts/${encodeURIComponent(post.id)}/postPicture`, formData);
      }
      closePostModal(modal);
      toast("Post updated");
      await loadFeed();
    } catch (error) {
      errorElement.textContent = error.message || "Unable to update post.";
      saveButton.disabled = false;
      saveButton.textContent = "Save changes";
    }
  });
}
