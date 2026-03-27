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

async function loadCurrentUser() {
    if (!getToken()) {
        window.location.href = "/login/";
        return;
    }

    try {
        const user = await apiRequest("/auth/me");
        updateProfileMeta(user);
        displayPageMessage("message", "");
    } catch (error) {
        if (isAuthError(error)) {
            clearAuth();
            window.location.href = "/login/";
            return;
        }

        displayPageMessage("message", error.message, "error");
    }
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

async function deleteAccount() {
    try {
        await apiRequest("/auth/delete-account", { method: "DELETE" });
    } catch (error) {
        if (!isAuthError(error)) {
            displayPageMessage("message", error.message, "error");
            return;
        }
    } finally {
        clearAuth();
        window.location.href = "/register/";
    }
}

document.getElementById("add-item-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    displayPageMessage("message", "");

    try {
        const datePickerValue = event.target.elements.expiry_date_picker.value;
        const daysInputValue = event.target.elements.expiry_days.value.trim();

        let expiryValue = "";
        if (datePickerValue) {
            expiryValue = datePickerValue;
        } else if (daysInputValue) {
            const parsedDays = Number(daysInputValue);
            if (!Number.isFinite(parsedDays) || parsedDays < 0) {
            displayPageMessage("message", "Expiry days must be zero or a positive number.", "error");
                return;
            }
            const computedDate = new Date();
            computedDate.setDate(computedDate.getDate() + parsedDays);
            expiryValue = computedDate.toISOString().slice(0, 10);
        }

        if (!expiryValue) {
            displayPageMessage("message", "Please enter an expiry date or fill the days field", "error");
            return;
        }

        const quantityInput = event.target.elements.quantity.value.trim();
        const parsedQuantity = Number(quantityInput);
        const payload = {
            name: event.target.elements.item_name.value.trim(),
            category: event.target.elements.category.value.trim(),
            expiry_date: expiryValue,
            quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1
        };

        const priceInput = event.target.elements.price.value.trim();
        if (!priceInput) {
            displayPageMessage("message", "Enter the item price before saving.", "error");
            return;
        }

        const parsedPrice = Number(priceInput);
        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            displayPageMessage("message", "Price must be a positive number.", "error");
            return;
        }
        payload.price = parsedPrice;

        const currencyInput = event.target.elements.currency?.value;
        if (currencyInput) {
            payload.currency = currencyInput;
        }

        const data = await apiRequest("/inventory/add-item", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        displayPageMessage("message", data.message, "success");
        event.target.reset();
        window.setTimeout(() => {
            window.location.href = "/dashboard/";
        }, 700);
    } catch (error) {
        if (isAuthError(error)) {
            clearAuth();
            window.location.href = "/login/";
            return;
        }

        displayPageMessage("message", error.message, "error");
    }
});

const expiryDatePicker = document.getElementById("expiry-date-picker");
const expiryDaysInput = document.getElementById("expiry-days-input");

expiryDatePicker?.addEventListener("change", () => {
    if (expiryDatePicker.value) {
        expiryDaysInput.value = "";
    }
});

expiryDaysInput?.addEventListener("input", () => {
    if (expiryDaysInput.value) {
        expiryDatePicker.value = "";
    }
});

initializeProfilePanel({
    onLogout: logout,
    onDeleteAccount: deleteAccount,
    onProfileClick: () => window.location.href = "/profile/",
});

loadCurrentUser();
