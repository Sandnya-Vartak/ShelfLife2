

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
        const data = await ApiClient.request("/auth/request-password-reset", {
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
        const data = await ApiClient.request("/auth/reset-password", {
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
