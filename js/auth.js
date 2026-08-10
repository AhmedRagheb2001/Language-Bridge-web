document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
  }

  setupPasswordToggles();

  // If someone is already signed in and lands back on an auth page,
  // send them straight into the app instead of making them sign in again.
  if (isAuthenticated()) {
    window.location.replace("index.html");
  }
});


/* ---------------------------------------------------------
   PASSWORD VISIBILITY TOGGLE
   (button existed in the markup but had no handler wired up)
--------------------------------------------------------- */

function setupPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      const input = targetId && document.getElementById(targetId);

      if (!input) return;

      const showing = input.type === "text";

      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
      button.setAttribute(
        "aria-label",
        showing ? "Show password" : "Hide password"
      );
    });
  });
}


async function handleLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const error = document.getElementById("formError");
  const button = form.querySelector('button[type="submit"]');

  clearFormError(error);
  setFormLoading(button, true, "Signing in...");

  try {
    const formData = new FormData(form);

    const data = await api.post("/auth/login", {
      email: formData.get("email"),
      password: formData.get("password")
    });

    if (!data?.accessToken || !data?.refreshToken) {
      throw new Error("Login succeeded but authentication tokens were not returned.");
    }

    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);

    await loadMe();

    window.location.replace("index.html");
  } catch (err) {
    showFormError(error, getAuthErrorMessage(err));
    setFormLoading(button, false);
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const error = document.getElementById("formError");
  const button = form.querySelector('button[type="submit"]');

  clearFormError(error);

  const formData = new FormData(form);
  const password = formData.get("password") || "";

  if (password.length < 8) {
    showFormError(error, "Password must be at least 8 characters.");
    return;
  }

  setFormLoading(button, true, "Creating account...");

  try {
    await api.post("/auth/register", {
      username: formData.get("username"),
      email: formData.get("email"),
      password,
      // Role is intentionally never taken from the form: letting a public
      // sign-up page pick its own privilege level is a security bug.
      // Every self-registered account is a plain USER; promote to ADMIN
      // server-side only.
      role: "USER",
      displayName: formData.get("displayName"),
      bio: formData.get("bio") || null,
      nativeLanguage: formData.get("nativeLanguage"),
      learningLanguage: formData.get("learningLanguage"),
      profilePictureUrl: null
    });

    /*
     * Registration succeeded.
     * Automatically sign the user in so they don't
     * have to enter their credentials a second time.
     */
    const loginData = await api.post("/auth/login", {
      email: formData.get("email"),
      password
    });

    if (!loginData?.accessToken || !loginData?.refreshToken) {
      throw new Error("Account created, but automatic sign-in failed.");
    }

    localStorage.setItem("accessToken", loginData.accessToken);
    localStorage.setItem("refreshToken", loginData.refreshToken);

    await loadMe();

    window.location.replace("index.html");
  } catch (err) {
    showFormError(error, getAuthErrorMessage(err));
    setFormLoading(button, false);
  }
}

function setFormLoading(button, loading, text = "Please wait...") {
  if (!button) return;

  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.textContent = text;
    button.classList.add("is-loading");
  } else {
    button.disabled = false;
    button.innerHTML =
      button.dataset.originalText || button.innerHTML;
    button.classList.remove("is-loading");
  }
}

function clearFormError(element) {
  if (!element) return;

  element.textContent = "";
  element.classList.remove("visible");
}

function showFormError(element, message) {
  if (!element) return;

  element.textContent = message;
  element.classList.add("visible");
}

function getAuthErrorMessage(error) {
  if (!error) {
    return "Something went wrong. Please try again.";
  }

  switch (error.status) {
    case 400:
      return error.message || "Please check the information you entered.";

    case 401:
      return "Your email or password is incorrect.";

    case 409:
      return error.message || "An account with this information already exists.";

    case 422:
      return error.message || "Please check the information you entered.";

    case 500:
      return "The server encountered a problem. Please try again shortly.";

    default:
      return error.message || "Something went wrong. Please try again.";
  }
}
