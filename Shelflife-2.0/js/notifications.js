

function getStatusClass(status) {
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

function updateUserUi(user) {
    const initials = (user.name || "SL")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "SL";

    document.querySelectorAll("[data-user-name]").forEach((node) => {
        node.textContent = user.name || "ShelfLife user";
    });
    document.querySelectorAll("[data-user-avatar]").forEach((node) => {
        node.textContent = initials;
    });

}

function renderNotifications(notifications) {
    const container = document.getElementById("notification-list");
    const countBadge = document.getElementById("notifications-count");
    countBadge.textContent = `${notifications.length} Alerts`;

    if (!notifications.length) {
        container.innerHTML = `
            <div class="notification-card notification-empty-state">
                <h3>No notifications yet</h3>
                <p>You are all caught up. Expiry alerts will show here when items need attention.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = notifications.map((notification) => {
        const stateText = notification.is_consumed ? "Consumed" : notification.is_read ? "Read" : "Unread";
        return `
            <div class="notification-card ${getStatusClass(notification.status)} ${notification.is_read ? "read" : "unread"} ${notification.is_consumed ? "consumed" : ""}">
                <div class="notification-card-header">
                    <span class="status-pill ${getStatusClass(notification.status)}">${getStatusLabel(notification.status)}</span>
                    <span class="notification-state">${stateText}</span>
                </div>
                <h3>${notification.message}</h3>
                <p>${notification.created_at ? `Created ${notification.created_at.slice(0, 10)}` : "Freshly generated from your pantry data."}</p>
                <div class="notification-card-actions">
                    ${notification.is_read ? "" : `<button class="secondary-btn" type="button" data-notification-read="${notification.id}">Mark as read</button>`}
                    ${notification.is_consumed ? "" : `<button class="primary-btn" type="button" data-notification-consume="${notification.id}">Consume</button>`}
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
    if (!ApiClient.getToken()) {
        window.location.href = "/login/";
        return;
    }

    try {
        const [user, notifications] = await Promise.all([
            ApiClient.request("/auth/me"),
            ApiClient.request("/alerts/notifications")
        ]);

        updateUserUi(user);
        renderNotifications(notifications);
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
            window.location.href = "/login/";
            return;
        }

        setNotificationMessage(error.message, "error");
    }
}

async function consumeNotification(notificationId) {
    return ApiClient.request(`/alerts/notifications/${notificationId}/consume`, {
        method: "PATCH"
    });
}

async function markNotificationRead(notificationId) {
    await ApiClient.request(`/alerts/notifications/${notificationId}/read`, {
        method: "PATCH"
    });
}

async function markAllRead() {
    await ApiClient.request("/alerts/notifications/mark-all-read", {
        method: "PATCH"
    });
}

async function logout() {
    try {
        await ApiClient.request("/auth/logout", { method: "POST" });
    } catch (error) {
        // Ignore logout request failures and clear client auth anyway.
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
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
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
              if ((error?.status === 401 || error?.status === 422)) {
                  ApiClient.clearToken();
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
          if ((error?.status === 401 || error?.status === 422)) {
              ApiClient.clearToken();
              window.location.href = "/login/";
              return;
          }

          setNotificationMessage(error.message, "error");
      }
  });

setupProfileUi();
initializeNotifications();
