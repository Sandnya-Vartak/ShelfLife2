const tokenKey = "shelflife_token";
const configuredApiBaseUrl = window.SHELFLIFE_API_BASE_URL || document.body?.dataset.apiBaseUrl || "";
let resolvedApiBaseUrl = "";

function normalizeBaseUrl(baseUrl) {
    return (baseUrl || "").replace(/\/+$/, "");
}

function getApiBaseCandidates() {
    if (resolvedApiBaseUrl) {
        return [resolvedApiBaseUrl];
    }

    const candidates = [];
    const currentOrigin = normalizeBaseUrl(window.location.origin);
    const currentProtocol = window.location.protocol === "https:" ? "https:" : "http:";
    const localHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
    const isLocalFile = window.location.protocol === "file:";
    const isLocalDevHost = localHosts.has(window.location.hostname);

    if (configuredApiBaseUrl) {
        candidates.push(normalizeBaseUrl(configuredApiBaseUrl));
    }

    if (!isLocalFile && currentOrigin) {
        candidates.push(currentOrigin);
    }

    if (isLocalFile || (isLocalDevHost && window.location.port !== "5000")) {
        candidates.push(`${currentProtocol}//127.0.0.1:5000`);
        candidates.push(`${currentProtocol}//localhost:5000`);
    }

    return [...new Set(candidates.filter(Boolean))];
}

function buildApiUrl(baseUrl, path) {
    return `${baseUrl}${path}`;
}

function getCookieValue(name) {
    const cookies = document.cookie ? document.cookie.split("; ") : [];
    const cookie = cookies.find((entry) => entry.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
}

function getToken() {
    return localStorage.getItem(tokenKey) || getCookieValue(tokenKey);
}

function clearAuth() {
    localStorage.removeItem(tokenKey);
    document.cookie = `${tokenKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

function setProfileMessage(message, type = "") {
    const node = document.getElementById("profile-message");
    if (!node) {
        return;
    }

    node.textContent = message;
    node.className = `message ${type}`.trim();
}

function isAuthError(error) {
    return error?.status === 401 || error?.status === 422;
}

async function apiRequest(url, options = {}) {
    const token = getToken();
    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let response;

    for (const baseUrl of getApiBaseCandidates()) {
        try {
            response = await fetch(buildApiUrl(baseUrl, url), { ...options, headers, credentials: "include" });
            resolvedApiBaseUrl = baseUrl;
            break;
        } catch (error) {
            response = null;
        }
    }

    if (!response) {
        throw new Error("Unable to reach the ShelfLife server. Start the Flask app or set window.SHELFLIFE_API_BASE_URL to your API origin.");
    }

    const rawBody = await response.text();
    let data = {};

    if (rawBody) {
        try {
            data = JSON.parse(rawBody);
        } catch (error) {
            data = { rawBody };
        }
    }

    if (!response.ok) {
        const fallbackMessage = data.rawBody
            ? `Request failed (${response.status} ${response.statusText})`
            : `Request failed (${response.status})`;
        const error = new Error(data.message || fallbackMessage);
        error.status = response.status;
        throw error;
    }

    return data;
}

function updateUserMeta(user) {
    const displayName = user.name || user.email || "ShelfLife user";
    const initials = (displayName || "SL")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "SL";

    document.querySelectorAll("[data-user-name]").forEach((node) => {
        node.textContent = displayName;
    });
    document.querySelectorAll("[data-user-avatar]").forEach((node) => {
        node.textContent = initials;
    });
}

async function loadProfile() {
    if (!getToken()) {
        window.location.href = "/login/";
        return;
    }

    try {
        const user = await apiRequest("/auth/me");
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
        if (isAuthError(error)) {
            clearAuth();
            window.location.href = "/login/";
            return;
        }

        setProfileMessage(error.message, "error");
    }
}

async function logout() {
    try {
        await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
        // ignore
    }

    clearAuth();
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
                await apiRequest("/auth/delete-account", { method: "DELETE" });
                clearAuth();
                window.location.href = "/register/";
            } catch (error) {
                if (isAuthError(error)) {
                    clearAuth();
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
        const data = await apiRequest("/auth/profile", {
            method: "PATCH",
            body: JSON.stringify(payload)
        });

        setProfileMessage(data.message, "success");
        loadProfile();
    } catch (error) {
        if (isAuthError(error)) {
            clearAuth();
            window.location.href = "/login/";
            return;
        }

        setProfileMessage(error.message, "error");
    }
});

setupProfileUi();
loadProfile();
