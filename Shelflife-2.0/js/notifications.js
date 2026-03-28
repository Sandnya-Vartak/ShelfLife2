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

function getStatusClass(status) {
    if (status === "wasted") {
        return "wasted";
    }
    if (status === "expired") {
        return "expired";
    }
    if (status === "expiring_critical") {
        return "expiring_critical";
    }
    if (status === "expiring_soon") {
        return "expiring_soon";
    }
    return "fresh";
}

function getStatusLabel(status) {
    if (status === "wasted") {
        return "Money Wasted";
    }
    if (status === "expired") {
        return "Expired";
    }
    if (status === "expiring_critical") {
        return "Expires Today / Tomorrow";
    }
    if (status === "expiring_soon") {
        return "Expiring Soon";
    }
    return "Fresh";
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

function updateUserUi(user) {
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

function renderNotifications(notifications) {
    const container = document.getElementById("notification-list");
    const countBadge = document.getElementById("notifications-count");
    const sortedNotifications = [...notifications].sort((left, right) => {
        const leftTime = new Date(left.wasted_at || left.created_at || 0).getTime();
        const rightTime = new Date(right.wasted_at || right.created_at || 0).getTime();
        return rightTime - leftTime;
    });
    const unreadCount = notifications.filter((notification) => !notification.is_read).length;
    countBadge.textContent = unreadCount ? `${unreadCount} Unread` : `${notifications.length} Alerts`;

    if (!sortedNotifications.length) {
        container.innerHTML = `
            <div class="notification-card notification-empty-state">
                <h3>No notifications yet</h3>
                <p>You are all caught up. Expiry alerts will show here when items need attention.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = sortedNotifications.map((notification) => {
        const canConsume = !notification.is_consumed && notification.status !== "wasted";
        const stateText = notification.is_consumed
            ? "Consumed"
            : notification.status === "wasted"
                ? (notification.is_read ? "Logged as waste" : "Waste detected")
                : notification.is_read
                    ? "Read"
                    : "Unread";
        const detailText = notification.wasted_at
            ? `Waste logged ${notification.wasted_at.slice(0, 10)}`
            : notification.created_at
                ? `Created ${notification.created_at.slice(0, 10)}`
                : "Freshly generated from your pantry data.";
        return `
            <div class="notification-card ${getStatusClass(notification.status)} ${notification.is_read ? "read" : "unread"} ${notification.is_consumed ? "consumed" : ""}">
                <div class="notification-card-header">
                    <span class="status-pill ${getStatusClass(notification.status)}">${getStatusLabel(notification.status)}</span>
                    <span class="notification-state">${stateText}</span>
                </div>
                <h3>${notification.message}</h3>
                <p>${detailText}</p>
                <div class="notification-card-actions">
                    ${notification.is_read ? "" : `<button class="secondary-btn" type="button" data-notification-read="${notification.id}">Mark as read</button>`}
                    ${canConsume ? `<button class="primary-btn" type="button" data-notification-consume="${notification.id}">Consume</button>` : ""}
                </div>
            </div>
        `;
    }).join("");
}

function setNotificationMessage(message, type = "") {
    const node = document.getElementById("notification-message");
    if (!node) {
        return;
    }

    node.textContent = message;
    node.className = `message ${type}`.trim();
}

async function initializeNotifications() {
    if (!getToken()) {
        window.location.href = "/login/";
        return;
    }

    try {
        const [user, notifications] = await Promise.all([
            apiRequest("/auth/me"),
            apiRequest("/alerts/notifications")
        ]);

        updateUserUi(user);
        renderNotifications(notifications);
        if (typeof NotificationBadge !== "undefined") {
            NotificationBadge.refresh();
        }
    } catch (error) {
        if (isAuthError(error)) {
            clearAuth();
            window.location.href = "/login/";
            return;
        }

        setNotificationMessage(error.message, "error");
    }
}


async function consumeNotification(notificationId) {
    return apiRequest(`/alerts/notifications/${notificationId}/consume`, {
        method: "PATCH"
    });
}

async function markNotificationRead(notificationId) {
    await apiRequest(`/alerts/notifications/${notificationId}/read`, {
        method: "PATCH"
    });
}

async function markAllRead() {
    await apiRequest("/alerts/notifications/mark-all-read", {
        method: "PATCH"
    });
}

async function logout() {
    try {
        await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
        // Ignore logout request failures and clear client auth anyway.
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

                setNotificationMessage(error.message, "error");
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

document.getElementById("mark-all-read-btn").addEventListener("click", async () => {
    try {
        await markAllRead();
        setNotificationMessage("All notifications marked as read.", "success");
        await initializeNotifications();
    } catch (error) {
        if (isAuthError(error)) {
            clearAuth();
            window.location.href = "/login/";
            return;
        }

        setNotificationMessage(error.message, "error");
    }
});

  document.addEventListener("click", async (event) => {
      const consumeButton = event.target.closest("[data-notification-consume]");
      if (consumeButton) {
          try {
              await consumeNotification(consumeButton.dataset.notificationConsume);
              setNotificationMessage("Item marked as consumed.", "success");
              await initializeNotifications();
          } catch (error) {
              if (isAuthError(error)) {
                  clearAuth();
                  window.location.href = "/login/";
                  return;
              }

              setNotificationMessage(error.message, "error");
          }

          return;
      }

      const button = event.target.closest("[data-notification-read]");
      if (!button) {
          return;
      }

      try {
          await markNotificationRead(button.dataset.notificationRead);
          setNotificationMessage("Notification marked as read.", "success");
          await initializeNotifications();
      } catch (error) {
          if (isAuthError(error)) {
              clearAuth();
              window.location.href = "/login/";
              return;
          }

          setNotificationMessage(error.message, "error");
      }
  });

setupProfileUi();
initializeNotifications();
