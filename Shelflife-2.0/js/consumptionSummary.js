

    localStorage.getItem(tokenKey) ||
    document.cookie
        .split("; ")
        .find((c) => c.startsWith(tokenKey + "="))
        ?.split("=")[1];

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
    if (!ApiClient.getToken()) {
        window.location.href = "/login/";
        return;
    }

    try {
        const user = await ApiClient.request("/auth/me");
        updateProfileMeta(user);
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
            window.location.href = "/login/";
            return;
        }

        displayPageMessage("consumption-message", error.message, "error");
    }
}

async function loadSummary() {
    try {
        const summary = await ApiClient.request("/alerts/consumption-summary");
        updateSummary(summary);
        renderWastedAlerts(summary.wasted_alerts || []);
        displayPageMessage("consumption-message", "");
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
            window.location.href = "/login/";
            return;
        }
        displayPageMessage("consumption-message", error.message, "error");
    }
}

async function logout() {
    try {
        await ApiClient.request("/auth/logout", { method: "POST" });
    } catch {}
    ApiClient.clearToken();
    window.location.href = "/login/";
}

async function deleteAccount() {
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
        displayPageMessage("consumption-message", error.message, "error");
    }
}

(async () => {
    initializeProfilePanel({
        onLogout: logout,
        onDeleteAccount: deleteAccount,
        onProfileClick: () => {
            window.location.href = "/profile/";
        },
    });
    await loadCurrentUser();
    await loadSummary();
})();
