/* eslint-disable no-undef */
const getMessageNode = () => document.getElementById("message");

const renderMessage = (text, type = "") => {
    const node = getMessageNode();
    if (!node) return;
    node.textContent = text;
    node.className = `message ${type}`.trim();
};

const collectField = (id) => document.getElementById(id)?.value.trim() ?? "";

const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const validatePassword = (value) => typeof value === "string" && value.length >= 8 && /[A-Za-z]/.test(value);

const buildRegisterPayload = () => ({
    name: collectField("register-name"),
    email: collectField("register-email"),
    password: collectField("register-password")
});

const buildLoginPayload = () => ({
    email: collectField("login-email"),
    password: collectField("login-password")
});

const handleRegistration = async (event) => {
    event.preventDefault();
    renderMessage("");

    const password = collectField("register-password");
    const confirmPassword = collectField("register-confirm-password");
    const email = collectField("register-email");

    if (password !== confirmPassword) {
        renderMessage("Passwords do not match.", "error");
        return;
    }

    if (!validateEmail(email)) {
        renderMessage("Enter a valid email address.", "error");
        return;
    }

    if (!validatePassword(password)) {
        renderMessage("Password must be at least 8 characters and include letters.", "error");
        return;
    }

    try {
        const data = await ApiClient.request("/auth/register", {
            method: "POST",
            body: JSON.stringify(buildRegisterPayload())
        });
        renderMessage(`${data.message} Please log in to continue.`, "success");
        ApiClient.clearToken();
        document.getElementById("register-form")?.reset();
        window.setTimeout(() => {
            window.location.href = "/login/";
        }, 700);
    } catch (error) {
        renderMessage(error.message, "error");
    }
};

const handleLogin = async (event) => {
    event.preventDefault();
    renderMessage("");

    const payload = buildLoginPayload();
    if (!validateEmail(payload.email)) {
        renderMessage("Enter a valid email address.", "error");
        return;
    }

    try {
        const data = await ApiClient.request("/auth/login", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        ApiClient.persistToken(data.access_token);
        window.location.href = "/dashboard/";
    } catch (error) {
        renderMessage(error.message, "error");
    }
};

const redirectIfLoggedIn = async () => {
    if (!ApiClient.getToken()) {
        return;
    }

    try {
        await ApiClient.request("/auth/me");
        window.location.href = "/dashboard/";
    } catch {
        // ignore invalid token
    }
};

document.getElementById("register-form")?.addEventListener("submit", handleRegistration);
document.getElementById("login-form")?.addEventListener("submit", handleLogin);

redirectIfLoggedIn();
