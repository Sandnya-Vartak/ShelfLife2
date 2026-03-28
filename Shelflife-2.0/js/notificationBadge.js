const NotificationBadge = (() => {
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

    function getCookieValue(name) {
        const cookies = document.cookie ? document.cookie.split("; ") : [];
        const cookie = cookies.find((entry) => entry.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
    }

    function getToken() {
        return localStorage.getItem(tokenKey) || getCookieValue(tokenKey);
    }

    async function apiRequest(path) {
        const token = getToken();
        if (!token) {
            return [];
        }

        const headers = {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };

        let response = null;
        for (const baseUrl of getApiBaseCandidates()) {
            try {
                response = await fetch(`${baseUrl}${path}`, {
                    method: "GET",
                    headers,
                    credentials: "include",
                });
                resolvedApiBaseUrl = baseUrl;
                break;
            } catch (error) {
                response = null;
            }
        }

        if (!response || !response.ok) {
            return [];
        }

        return response.json().catch(() => []);
    }

    function applyUnreadCount(count) {
        document.querySelectorAll("[data-notification-badge]").forEach((node) => {
            if (!count) {
                node.hidden = true;
                node.textContent = "0";
                return;
            }
            node.hidden = false;
            node.textContent = count > 99 ? "99+" : String(count);
        });
    }

    async function refresh() {
        const notifications = await apiRequest("/alerts/notifications");
        const unreadCount = Array.isArray(notifications)
            ? notifications.filter((notification) => !notification.is_read).length
            : 0;
        applyUnreadCount(unreadCount);
    }

    return { refresh };
})();

window.NotificationBadge = NotificationBadge;

window.addEventListener("load", () => {
    NotificationBadge.refresh();
});
