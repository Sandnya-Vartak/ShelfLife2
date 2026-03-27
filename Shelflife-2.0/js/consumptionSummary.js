const tokenKey = "shelflife_token";
const configuredApiBaseUrl = window.SHELFLIFE_API_BASE_URL || document.body?.dataset.apiBaseUrl || "";

let resolvedApiBaseUrl = "";

const normalizeBaseUrl = (url) => (url || "").replace(/\/+$/, "");

const getApiBaseCandidates = () => {
    if (resolvedApiBaseUrl) return [resolvedApiBaseUrl];

    const candidates = [];
    const origin = normalizeBaseUrl(window.location.origin);
    const currentProtocol = window.location.protocol === "https:" ? "https:" : "http:";
    const localHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
    const isLocalFile = window.location.protocol === "file:";
    const isLocalDevHost = localHosts.has(window.location.hostname);

    if (configuredApiBaseUrl) {
        candidates.push(normalizeBaseUrl(configuredApiBaseUrl));
    }
    if (origin) {
        candidates.push(origin);
    }

    if (isLocalFile || (isLocalDevHost && window.location.port !== "5000")) {
        candidates.push(`${currentProtocol}//127.0.0.1:5000`);
        candidates.push(`${currentProtocol}//localhost:5000`);
    }

    return [...new Set(candidates.filter(Boolean))];
};

const buildApiUrl = (base, path) => `${base}${path}`;

const getToken = () =>
    localStorage.getItem(tokenKey) ||
    document.cookie
        .split("; ")
        .find((c) => c.startsWith(tokenKey + "="))
        ?.split("=")[1];

const clearAuth = () => {
    localStorage.removeItem(tokenKey);
    document.cookie = `${tokenKey}=; path=/; expires=Thu, 01 Jan 1970`;
};

const isAuthError = (err) => err?.status === 401 || err?.status === 422;

const setMessage = (msg, type = "") => {
    const node = document.getElementById("consumption-message");
    if (!node) return;
    node.textContent = msg;
    node.className = `message ${type}`.trim();
};

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
            response = await fetch(buildApiUrl(baseUrl, url), {
                ...options,
                headers,
                credentials: "include"
            });
            resolvedApiBaseUrl = baseUrl;
            break;
        } catch (error) {
            response = null;
        }
    }

    if (!response) {
        throw new Error("Unable to reach the ShelfLife server.");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const err = new Error(data.message || "Request failed");
        err.status = response.status;
        throw err;
    }

    return data;
}

function updateSummary(summary) {
    document.querySelectorAll("[data-summary]").forEach((node) => {
        const key = node.dataset.summary;
        node.textContent = summary[key] ?? "--";
    });
}

function formatDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleString();
}

function renderWastedAlerts(alerts) {
    const container = document.getElementById("wasted-alerts");
    if (!container) return;

    if (!alerts.length) {
        container.innerHTML = `
            <div class="notification-card notification-empty-state">
                <h3>No wasted alerts yet</h3>
                <p>Consume items directly from the notifications panel to prevent waste.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = alerts
        .map((alert) => {
            const statusClass = alert.status || "fresh";
            const statusLabel = (alert.status || "fresh").replace(/_/g, " ");
            return `
                <div class="notification-card ${statusClass}">
                    <div class="notification-card-header">
                        <span class="status-pill ${statusClass}">${statusLabel}</span>
                        <span class="notification-state">Read but not consumed</span>
                    </div>
                    <h3>${alert.item_name || "Pantry item"}</h3>
                    <p>${alert.message}</p>
                    <small>Read at ${formatDate(alert.read_at)}</small>
                </div>
            `;
        })
        .join("");
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

async function loadCurrentUser() {
    if (!getToken()) {
        window.location.href = "/login/";
        return;
    }

    try {
        const user = await apiRequest("/auth/me");
        updateUserMeta(user);
    } catch (error) {
        if (isAuthError(error)) {
            clearAuth();
            window.location.href = "/login/";
            return;
        }

        setMessage(error.message, "error");
    }
}

async function loadSummary() {
    try {
        const summary = await apiRequest("/alerts/consumption-summary");
        updateSummary(summary);
        renderWastedAlerts(summary.wasted_alerts || []);
        setMessage("");
    } catch (error) {
        if (isAuthError(error)) {
            clearAuth();
            window.location.href = "/login/";
            return;
        }
        setMessage(error.message, "error");
    }
}

async function logout() {
    try {
        await apiRequest("/auth/logout", { method: "POST" });
    } catch {}
    clearAuth();
    window.location.href = "/login/";
}

function setupProfileUi() {
    const toggles = Array.from(document.querySelectorAll("[data-profile-toggle]"));
    let activeDropdown = null;

    const closeDropdown = () => {
        if (!activeDropdown) return;
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
            if (!confirmed) return;

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
                setMessage(error.message, "error");
            }
        });
    });

    toggles.forEach((toggle) => {
        const panel = toggle.closest(".profile-panel");
        const dropdown = panel?.querySelector("[data-profile-dropdown]");

        if (!dropdown) return;

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

(async () => {
    setupProfileUi();
    await loadCurrentUser();
    await loadSummary();
})();
