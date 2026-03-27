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
    if (!isLocalFile && origin) {
        candidates.push(origin);
    }
    if (isLocalFile || (isLocalDevHost && window.location.port !== "5000")) {
        candidates.push(`${currentProtocol}//127.0.0.1:5000`);
        candidates.push(`${currentProtocol}//localhost:5000`);
    }

    return [...new Set(candidates.filter(Boolean))];
};

const buildApiUrl = (base, path) => `${base}${path}`;

async function apiRequest(url, options = {}) {
    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

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
        const fallback = data.rawBody ? `Request failed (${response.status} ${response.statusText})` : `Request failed (${response.status})`;
        throw new Error(data.message || fallback);
    }

    return data;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || "").trim());
}

function setMessage(message, type = "") {
    const messageBox = document.getElementById("forgot-message");
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `message ${type}`.trim();
}

const forgotForm = document.getElementById("forgot-password-form");
const resetForm = document.getElementById("reset-password-form");
const tokenInput = document.getElementById("reset-token");
const resetButton = document.getElementById("back-to-request");

const queryToken = new URLSearchParams(window.location.search).get("token");

function showRequestForm() {
    forgotForm.hidden = false;
    resetForm.hidden = true;
    setMessage("");
}

function showResetForm(token) {
    if (!token) {
        showRequestForm();
        return;
    }

    tokenInput.value = token;
    forgotForm.hidden = true;
    resetForm.hidden = false;
    setMessage("Use the form below to set a new password.", "success");
}

if (queryToken) {
    showResetForm(queryToken);
} else {
    showRequestForm();
}

forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("");

    const email = document.getElementById("reset-email").value.trim();
    if (!isValidEmail(email)) {
        setMessage("Enter a valid email address.", "error");
        return;
    }

    try {
        const data = await apiRequest("/auth/request-password-reset", {
            method: "POST",
            body: JSON.stringify({ email })
        });
        setMessage(data.message, "success");
    } catch (error) {
        setMessage(error.message, "error");
    }
});

resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("");

    const password = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-new-password").value;
    const token = tokenInput.value;

    if (!password || !confirmPassword || !token) {
        setMessage("All fields are required.", "error");
        return;
    }

    if (password !== confirmPassword) {
        setMessage("Passwords do not match.", "error");
        return;
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password)) {
        setMessage("Password must be at least 8 characters and include letters.", "error");
        return;
    }

    try {
        const data = await apiRequest("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({
                token,
                password,
                confirm_password: confirmPassword
            })
        });
        setMessage(data.message, "success");
        setTimeout(() => {
            window.location.href = "/login/";
        }, 1800);
    } catch (error) {
        setMessage(error.message, "error");
    }
});

resetButton.addEventListener("click", () => {
    showRequestForm();
});
