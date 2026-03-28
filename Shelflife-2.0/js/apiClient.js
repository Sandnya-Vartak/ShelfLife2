const ApiClient = (() => {
    const TOKEN_KEY = "shelflife_token";
    const configuredApiBaseUrl = window.SHELFLIFE_API_BASE_URL || document.body?.dataset.apiBaseUrl || "";
    let resolvedBase = "";

    const normalize = (url) => (url || "").replace(/\/+$/, "");

    const buildBaseCandidates = () => {
        if (resolvedBase) {
            return [resolvedBase];
        }

        const candidates = [];
        const origin = normalize(window.location.origin);
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const localHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
        const isLocalFile = window.location.protocol === "file:";
        const isLocalDevHost = localHosts.has(window.location.hostname);

        if (configuredApiBaseUrl) {
            candidates.push(normalize(configuredApiBaseUrl));
        }

        if (origin) {
            candidates.push(origin);
        }

        if (isLocalFile || (isLocalDevHost && window.location.port !== "5000")) {
            candidates.push(`${protocol}//127.0.0.1:5000`, `${protocol}//localhost:5000`);
        }

        return [...new Set(candidates.filter(Boolean))];
    };

    const buildUrl = (base, path) => `${base}${path}`;

    const getToken = () =>
        localStorage.getItem(TOKEN_KEY) ||
        document.cookie
            .split("; ")
            .find((entry) => entry.startsWith(`${TOKEN_KEY}=`))
            ?.split("=")[1];

    const persistToken = (token) => {
        localStorage.setItem(TOKEN_KEY, token);
        document.cookie = `${TOKEN_KEY}=${token}; path=/; SameSite=Lax`;
    };

    const clearToken = () => {
        localStorage.removeItem(TOKEN_KEY);
        document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    };

    const handleResponse = async (response) => {
        const payloadText = await response.text();
        let payload = {};
        if (payloadText) {
            try {
                payload = JSON.parse(payloadText);
            } catch {
                payload = { rawBody: payloadText };
            }
        }

        if (!response.ok) {
            const fallbackMessage = payload.rawBody
                ? `Request failed (${response.status} ${response.statusText})`
                : `Request failed (${response.status})`;
            const error = new Error(payload.message || fallbackMessage);
            error.status = response.status;
            throw error;
        }

        return payload;
    };

    const request = async (path, options = {}) => {
        const headers = {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        const token = getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        let response;
        for (const base of buildBaseCandidates()) {
            try {
                response = await fetch(buildUrl(base, path), {
                    ...options,
                    headers,
                    credentials: "include"
                });
                resolvedBase = base;
                break;
            } catch (error) {
                response = null;
            }
        }

        if (!response) {
            throw new Error("Unable to reach the ShelfLife server.");
        }

        return handleResponse(response);
    };

    const buildInitials = (name) => {
        if (!name) return "SL";
        return name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join("");
    };

    return {
        request,
        getToken,
        persistToken,
        clearToken,
        buildInitials
    };
})();
