document.addEventListener("DOMContentLoaded", async () => {
  await initShell("home");

  const content = document.getElementById("content");
  const postId = new URLSearchParams(location.search).get("post");

  if (!content) return;

  content.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">Post</span>
        <h1>Post details</h1>
        <p class="muted">Read the full post and join the conversation.</p>
      </div>
      <a href="index.html" class="btn secondary">Back to feed</a>
    </div>
    <div id="postDetail" class="stack">
      <div class="card loading-card"><div class="spinner"></div><span>Loading post...</span></div>
    </div>
  `;

  if (!postId) {
    showPostError("No post was selected.");
    return;
  }

  await loadPost(postId);
});


async function loadPost(postId) {
  try {
    const post = await api.get(`/posts/${encodeURIComponent(postId)}`);
    renderPostDetail(post);
    await loadComments(postId);
  } catch (error) {
    showPostError(error.message || "Unable to load this post.");
  }
}


function renderPostDetail(post) {
  const container = document.getElementById("postDetail");
  if (!container) return;

  const profile = post.user?.profile || {};
  const displayName = profile.displayName || post.user?.username || "LanguageBridge user";
  const totalLikes = post.totalLikes ?? 0;
  const liked = Boolean(post.likedByMe ?? post.isLiked);
  const me = currentUser();
  const canEdit = me && (
    me.role === "ADMIN" ||
    String(post.user?.id || post.userId) === String(me.id)
  );

  container.innerHTML = `
    <article class="card post post-detail-card" data-post-id="${escapeHtml(post.id)}">
      <div class="post-head">
        <a href="profile-view.html?user=${encodeURIComponent(post.user?.id || post.userId || "")}">
          ${avatarHtml(profile, "avatar")}
        </a>
        <div class="post-meta">
          <strong>${escapeHtml(displayName)}</strong>
          <span>${fmtDate(post.createdAt)}</span>
        </div>
      </div>

      <div class="post-content">
        <h3>${escapeHtml(post.title || "Untitled post")}</h3>
        ${post.content ? `<p>${escapeHtml(post.content)}</p>` : ""}
        ${post.postPictureUrl ? `<div class="post-media"><img class="post-image" src="${escapeHtml(post.postPictureUrl)}" alt="${escapeHtml(post.title || "Post image")}" loading="lazy"></div>` : ""}
      </div>

      <div class="post-actions">
        <button class="icon-btn like-btn ${liked ? "liked" : ""}" id="detailLike" type="button">
          <span class="action-icon">${liked ? "♥" : "♡"}</span><span>${escapeHtml(totalLikes)}</span>
        </button>
        ${canEdit ? `<button class="icon-btn" type="button" id="editDetailPost"><span class="action-icon">✎</span><span>Edit</span></button>` : ""}
        ${canEdit ? `<button class="icon-btn danger-icon" type="button" id="deleteDetailPost"><span class="action-icon">🗑</span><span>Delete</span></button>` : ""}
      </div>
    </article>

    <section class="card comments-panel detail-comments">
      <h3>Comments</h3>
      <div id="detailComments" class="comments-list">
        <div class="comments-loading"><span class="spinner small"></span>Loading comments...</div>
      </div>
      <form id="detailCommentForm" class="composer comment-form">
        <input name="content" type="text" placeholder="Write a comment..." autocomplete="off" required>
        <button class="btn primary" type="submit">Post</button>
      </form>
    </section>
  `;

  document.getElementById("detailLike")?.addEventListener("click", event => optimisticLike(post.id, event.currentTarget));
  document.getElementById("editDetailPost")?.addEventListener("click", () => openPostEditor(post));
  document.getElementById("deleteDetailPost")?.addEventListener("click", () => deleteDetailPost(post));
  document.getElementById("detailCommentForm")?.addEventListener("submit", event => addComment(event, post.id));
}


async function deleteDetailPost(post) {
  const confirmed = await confirmDialog(
    "Delete this post? This action cannot be undone."
  );

  if (!confirmed) return;

  const button = document.getElementById("deleteDetailPost");
  const card = document.querySelector(".post-detail-card");

  if (button) {
    button.disabled = true;
    button.textContent = "Deleting...";
  }

  try {
    await api.delete(`/posts/${encodeURIComponent(post.id)}`);

    if (card) {
      card.classList.add("is-removing");
    }

    toast("Post deleted");

    setTimeout(() => {
      location.replace("index.html");
    }, 320);
  } catch (error) {
    toast(error.message || "Unable to delete post.");

    if (button) {
      button.disabled = false;
      button.innerHTML = `<span class="action-icon">🗑</span><span>Delete</span>`;
    }
  }
}


function openPostEditor(post) {
  if (document.querySelector(".modal")) return;

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-card post-modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div><span class="eyebrow">Post settings</span><h2>Edit post</h2></div>
        <button class="icon-btn modal-close" type="button" aria-label="Close">×</button>
      </div>
      <form id="editPostForm" class="form">
        <label>Title<input name="title" value="${escapeHtml(post.title || "")}" maxlength="180" required></label>
        <label>Content<textarea name="content" rows="6" maxlength="5000">${escapeHtml(post.content || "")}</textarea></label>
        <label class="file-field"><span>Replace picture</span><input name="postPicture" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small>Choose a new picture or remove the current one.</small></label>
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
  const close = () => modal.remove();

  modal.querySelector(".modal-close").addEventListener("click", close);
  modal.querySelector(".modal-cancel").addEventListener("click", close);
  fileInput.addEventListener("change", () => previewPostImage(fileInput, modal));
  modal.querySelector("#removePostPicture")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api.delete(`/posts/${encodeURIComponent(post.id)}/postPicture`);
      toast("Post picture removed");
      close();
      await loadPost(post.id);
    } catch (error) {
      toast(error.message || "Unable to remove picture.");
      button.disabled = false;
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const errorElement = modal.querySelector("#postErr");
    const saveButton = modal.querySelector("#savePost");
    const picture = fileInput.files?.[0];
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    errorElement.textContent = "";

    try {
      await api.patch(`/posts/${encodeURIComponent(post.id)}`, {
        title: form.elements.title.value.trim(),
        content: form.elements.content.value.trim()
      });
      if (picture) {
        const formData = new FormData();
        formData.append("postPicture", picture);
        await api.patch(`/posts/${encodeURIComponent(post.id)}/postPicture`, formData);
      }
      toast("Post updated");
      close();
      await loadPost(post.id);
    } catch (error) {
      errorElement.textContent = error.message || "Unable to update post.";
      saveButton.disabled = false;
      saveButton.textContent = "Save changes";
    }
  });
}


function previewPostImage(input, modal) {
  const preview = modal.querySelector("#postPreview");
  if (!preview) return;

  const existingImage = preview.querySelector("img");
  if (existingImage?.src.startsWith("blob:")) URL.revokeObjectURL(existingImage.src);

  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    input.value = "";
    toast("Please choose an image file.");
    return;
  }

  const url = URL.createObjectURL(file);
  preview.classList.remove("hidden");
  preview.innerHTML = `
    <div class="preview-label">Image preview<button type="button" class="preview-remove">Remove</button></div>
    <img src="${url}" alt="Selected image preview">
  `;
  preview.querySelector(".preview-remove")?.addEventListener("click", () => {
    URL.revokeObjectURL(url);
    input.value = "";
    preview.innerHTML = "";
    preview.classList.add("hidden");
  });
}


async function optimisticLike(postId, button) {
  const wasLiked = button.classList.contains("liked");
  const countElement = button.querySelector("span:last-child");
  const currentCount = Number(countElement?.textContent || 0);
  updateLike(button, !wasLiked, Math.max(0, currentCount + (wasLiked ? -1 : 1)));

  try {
    const response = wasLiked
      ? await api.delete(`/posts/${encodeURIComponent(postId)}/likes`)
      : await api.post(`/posts/${encodeURIComponent(postId)}/likes`, {});
    updateLike(button, response.likedByMe ?? !wasLiked, response.totalLikes ?? currentCount);
  } catch (error) {
    updateLike(button, wasLiked, currentCount);
    toast(error.message || "Unable to update like.");
  }
}


function updateLike(button, liked, totalLikes) {
  button.classList.toggle("liked", liked);
  button.innerHTML = `<span class="action-icon">${liked ? "♥" : "♡"}</span><span>${escapeHtml(totalLikes)}</span>`;
}


async function loadComments(postId) {
  const commentsBox = document.getElementById("detailComments");
  if (!commentsBox) return;

  try {
    const response = await api.get(`/posts/${encodeURIComponent(postId)}/comments`);
    const comments = Array.isArray(response) ? response : response?.comments || response?.allComments || [];
    commentsBox.innerHTML = comments.length
      ? comments.map(renderComment).join("")
      : `<div class="comments-empty">No comments yet. Start the conversation.</div>`;
  } catch (error) {
    commentsBox.innerHTML = `<div class="comments-error">${escapeHtml(error.message || "Unable to load comments.")}</div>`;
  }
}


function renderComment(comment) {
  const profile = comment.user?.profile || comment.sender?.profile || {};
  const name = profile.displayName || comment.user?.username || "User";
  return `
    <div class="comment-item">
      ${avatarHtml(profile, "avatar sm")}
      <div class="comment-body">
        <strong>${escapeHtml(name)}</strong>
        <p>${escapeHtml(comment.content || "")}</p>
        <small>${fmtDate(comment.createdAt)}</small>
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
    await api.post(`/posts/${encodeURIComponent(postId)}/comments`, { content });
    input.value = "";
    await loadComments(postId);
    toast("Comment added");
  } catch (error) {
    toast(error.message || "Unable to add comment.");
  } finally {
    input.disabled = false;
    button.disabled = false;
    button.textContent = "Post";
  }
}


function showPostError(message) {
  const container = document.getElementById("postDetail");
  if (!container) return;
  container.innerHTML = `
    <div class="card empty-state">
      <div class="empty-icon">!</div>
      <h3>Couldn't load post</h3>
      <p>${escapeHtml(message)}</p>
      <a class="btn secondary" href="index.html">Back to feed</a>
    </div>
  `;
}
