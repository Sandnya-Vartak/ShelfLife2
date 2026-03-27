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

function setMessage(message, type = "") {
    const node = document.getElementById("message");
    if (!node) {
        return;
    }
    node.textContent = message;
    node.className = `message ${type}`.trim();
}

function isAuthError(error) {
    return error?.status === 401 || error?.status === 422;
}

function wireExpiryInputSync() {
    const dateInput = document.getElementById("edit-item-expiry");
    const daysInput = document.getElementById("edit-item-days");

    if (dateInput) {
        dateInput.addEventListener("change", () => {
            if (dateInput.value && daysInput) {
                daysInput.value = "";
            }
        });
    }

    if (daysInput) {
        daysInput.addEventListener("input", () => {
            if (daysInput.value && dateInput) {
                dateInput.value = "";
            }
        });
    }
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
        throw new Error("Unable to reach the ShelfLife server.");
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
        const fallbackMessage = data.rawBody ? `Request failed (${response.status} ${response.statusText})` : `Request failed (${response.status})`;
        const error = new Error(data.message || fallbackMessage);
        error.status = response.status;
        throw error;
    }

    return data;
}

function extractItemId() {
    const match = window.location.pathname.match(/\/edit-item\/(\d+)/);
    return match ? Number(match[1]) : null;
}

async function loadItem(itemId) {
    try {
        const item = await apiRequest(`/inventory/item/${itemId}`);
        document.getElementById("edit-item-name").value = item.name || "";
        document.getElementById("edit-item-category").value = item.category || "";
        document.getElementById("edit-item-quantity").value = item.quantity || 1;
        document.getElementById("edit-item-expiry").value = item.expiry_date || "";
        document.getElementById("edit-item-price").value = item.price ?? "";
        document.getElementById("edit-item-currency").value = item.currency || "USD";
    } catch (error) {
        if (isAuthError(error)) {
            clearAuth();
            window.location.href = "/login/";
            return;
        }

        setMessage("Unable to load item. Redirecting to dashboard...", "error");
        setTimeout(() => {
            window.location.href = "/dashboard/";
        }, 1200);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const itemId = extractItemId();
    if (!itemId) {
        window.location.href = "/dashboard/";
        return;
    }

    loadItem(itemId);
    wireExpiryInputSync();

    const form = document.getElementById("edit-item-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage("");

        const payload = {};
        const name = form.name.value.trim();
        const category = form.category.value.trim();
        const quantityValue = form.quantity.value.trim();
        const expiryDate = form.expiry_date.value;
        const expiryDays = form.expiry_days.value.trim();

        if (name) {
            payload.name = name;
        } else {
            setMessage("Item name is required.", "error");
            return;
        }

        if (category) {
            payload.category = category;
        } else {
            setMessage("Category is required.", "error");
            return;
        }

        if (quantityValue) {
            const parsed = Number(quantityValue);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                setMessage("Quantity must be a positive number.", "error");
                return;
            }
            payload.quantity = parsed;
        }

        if (expiryDate) {
            payload.expiry_date = expiryDate;
        } else if (expiryDays) {
            const parsedDays = Number(expiryDays);
            if (!Number.isFinite(parsedDays) || parsedDays < 0) {
                setMessage("Days until expiry must be zero or positive.", "error");
                return;
            }
            payload.expiry_days = parsedDays;
        }

        const priceInput = form.price.value.trim();
        if (!priceInput) {
            setMessage("Item price is required.", "error");
            return;
        }

        const parsedPrice = Number(priceInput);
        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            setMessage("Price must be a positive number.", "error");
            return;
        }
        payload.price = parsedPrice;

        const currencyInput = form.currency?.value;
        if (currencyInput) {
            payload.currency = currencyInput;
        }

        try {
            const data = await apiRequest(`/inventory/update-item/${itemId}`, {
                method: "PATCH",
                body: JSON.stringify(payload)
            });

            setMessage(data.message, "success");
            setTimeout(() => {
                window.location.href = "/dashboard/";
            }, 900);
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
