

    localStorage.getItem(tokenKey) ||
    document.cookie
        .split("; ")
        .find((c) => c.startsWith(tokenKey + "="))
        ?.split("=")[1];

const currencySymbols = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    INR: "₹",
    CAD: "CA$",
    AUD: "A$",
};

const formatCurrency = (value, currency = "USD") => {
    const normalized = Number(value || 0);
    const formatted = normalized.toFixed(2);
    const normalizedCurrency = (currency || "USD").toUpperCase();
    const symbol = currencySymbols[normalizedCurrency] ?? null;
    return symbol ? `${symbol}${formatted}` : `${normalizedCurrency} ${formatted}`;
};

function updateUtilizationMetrics(metrics, currency) {
    document.querySelectorAll("[data-utilization]").forEach((node) => {
        const key = node.dataset.utilization;
        if (["total_spent", "money_wasted", "money_saved"].includes(key)) {
            node.textContent = formatCurrency(metrics[key], currency);
        } else {
            node.textContent = metrics[key] ?? "--";
        }
    });
}

async function initializeUtilization() {
    try {
        const metrics = await ApiClient.request("/inventory/utilization");
        const currencyCode = metrics.currency || "USD";
        updateUtilizationMetrics(metrics, currencyCode);
        displayPageMessage("utilization-message", "");
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
            window.location.href = "/login/";
            return;
        }
        displayPageMessage("utilization-message", error.message, "error");
    }
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

        displayPageMessage("utilization-message", error.message, "error");
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
    } catch (error) {
        if (!(error?.status === 401 || error?.status === 422)) {
            displayPageMessage("utilization-message", error.message, "error");
            return;
        }
    } finally {
        ApiClient.clearToken();
        window.location.href = "/register/";
    }
}

(async () => {
    initializeProfilePanel({
        onLogout: logout,
        onDeleteAccount: deleteAccount,
        onProfileClick: () => window.location.href = "/profile/",
    });
    await loadCurrentUser();
    await initializeUtilization();
})();
