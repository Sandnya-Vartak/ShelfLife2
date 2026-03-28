

function setProfileMessage(message, type = "") {
    const node = document.getElementById("profile-message");
    if (!node) {
        return;
    }

    node.textContent = message;
    node.className = `message ${type}`.trim();
}

function updateUserMeta(user) {
    const initials = (user.name || "SL")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "SL";

    const displayName = user.name || "ShelfLife user";
    document.querySelectorAll("[data-user-name]").forEach((node) => {
        node.textContent = displayName;
    });
    document.querySelectorAll("[data-user-avatar]").forEach((node) => {
        node.textContent = initials;
    });
}

async function loadProfile() {
    if (!ApiClient.getToken()) {
        window.location.href = "/login/";
        return;
    }

    try {
        const user = await ApiClient.request("/auth/me");
        updateUserMeta(user);
        const nameInput = document.getElementById("profile-name");
        const emailInput = document.getElementById("profile-email");
        if (nameInput) {
            nameInput.value = user.name || "";
        }
        if (emailInput) {
            emailInput.value = user.email || "";
        }
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
            window.location.href = "/login/";
            return;
        }

        setProfileMessage(error.message, "error");
    }
}

async function logout() {
    try {
        await ApiClient.request("/auth/logout", { method: "POST" });
    } catch (error) {
        // ignore
    }

    ApiClient.clearToken();
    window.location.href = "/login/";
}

function setupProfileUi() {
    const toggles = Array.from(document.querySelectorAll("[data-profile-toggle]"));
    let activeDropdown = null;

    const closeDropdown = () => {
        if (!activeDropdown) {
            return;
        }
        activeDropdown.classList.remove("is-open");
        activeDropdown = null;
    };

    document.querySelectorAll("[data-profile-link]").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            window.location.href = "/profile/";
        });
    });

    document.querySelectorAll("[data-logout-link]").forEach((link) => {
        link.addEventListener("click", async (event) => {
            event.preventDefault();
            await logout();
        });
    });

    document.querySelectorAll("[data-delete-account]").forEach((button) => {
        button.addEventListener("click", async () => {
            const confirmed = window.confirm("Delete your account and all pantry data permanently?");
            if (!confirmed) {
                return;
            }

            try {
                await ApiClient.request("/auth/delete-account", { method: "DELETE" });
                ApiClient.clearToken();
                window.location.href = "/register/";
            } catch (error) {
                if ((error?.status === 401 || error?.status === 422)) {
                    ApiClient.clearToken();
                    window.location.href = "/login/";
                    return;
                }

                setProfileMessage(error.message, "error");
            }
        });
    });

    toggles.forEach((toggle) => {
        const panel = toggle.closest(".profile-panel");
        const dropdown = panel?.querySelector("[data-profile-dropdown]");

        if (!dropdown) {
            return;
        }

        dropdown.addEventListener("click", (event) => {
            event.stopPropagation();
        });

        toggle.addEventListener("click", (event) => {
            event.stopPropagation();

            if (activeDropdown && activeDropdown !== dropdown) {
                closeDropdown();
            }

            if (dropdown.classList.contains("is-open")) {
                closeDropdown();
                return;
            }

            closeDropdown();
            dropdown.classList.add("is-open");
            activeDropdown = dropdown;
        });
    });

    document.addEventListener("click", closeDropdown);
}

document.getElementById("profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setProfileMessage("");

    const form = event.target;
    const payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim().toLowerCase(),
    };

    const password = form.password.value.trim();
    const confirmPassword = form.confirm_password.value.trim();

    if (password) {
        if (password !== confirmPassword) {
            setProfileMessage("Passwords do not match.", "error");
            return;
        }
        payload.password = password;
    }

    try {
        const data = await ApiClient.request("/auth/profile", {
            method: "PATCH",
            body: JSON.stringify(payload)
        });

        setProfileMessage(data.message, "success");
        loadProfile();
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
            window.location.href = "/login/";
            return;
        }

        setProfileMessage(error.message, "error");
    }
});

setupProfileUi();
loadProfile();
