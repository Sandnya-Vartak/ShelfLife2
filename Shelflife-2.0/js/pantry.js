

    localStorage.getItem(tokenKey) ||
    document.cookie
        .split("; ")
        .find((c) => c.startsWith(tokenKey + "="))
        ?.split("=")[1];

const setMessage = (msg, type = "") => {
    const node = document.getElementById("pantry-message");
    if (!node) return;
    node.textContent = msg;
    node.className = `message ${type}`.trim();
};

const showLoading = () => {
    const table = document.getElementById("pantry-table-body");
    if (!table) return;
    table.innerHTML = `
        <tr>
            <td colspan="8" style="text-align:center; padding:40px;">Loading pantry...</td>
        </tr>
    `;
};

const formatCurrency = (value, currency = "USD") => {
    const normalized = Number(value || 0);
    return `${currency} ${normalized.toFixed(2)}`;
};

function getStatusLabel(status) {
    if (status === "expired") return "Expired";
    if (status === "expiring_critical") return "Today / Tomorrow";
    if (status === "expiring_soon") return "Expiring Soon";
    return "Fresh";
}

function getStatusClass(status) {
    if (status === "expired") return "expired";
    if (status === "expiring_critical") return "expiring_critical";
    if (status === "expiring_soon") return "expiring_soon";
    return "fresh";
}

function renderItems(items) {
    const table = document.getElementById("pantry-table-body");
    if (!table) return;

    if (!items.length) {
        table.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:40px;">
                    <img src="../assets/empty-box.svg" alt="Empty pantry" style="width: 60px; opacity: 0.4;">
                    <p style="margin-top: 12px;">No pantry items yet.</p>
                </td>
            </tr>
        `;
        return;
    }

    const sorted = items.sort(
        (a, b) => new Date(b.expiry_date) - new Date(a.expiry_date)
    );

    table.innerHTML = sorted
        .map((item) => {
            const days = Math.ceil(
                (new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
            );
            return `
                <tr data-status="${getStatusClass(item.status)}">
                    <td class="item-name">${item.name}</td>
                    <td>${item.quantity || 1}</td>
                    <td>${item.category}</td>
                    <td>${item.expiry_date}</td>
                    <td><span class="days-left ${getStatusClass(item.status)}">${days}</span></td>
                    <td>${formatCurrency(item.price, item.currency)}</td>
                    <td>
                        <span class="status-badge ${getStatusClass(item.status)}">${getStatusLabel(item.status)}</span>
                    </td>
                    <td class="action-cell">
                        <div class="action-group">
                            <a href="/edit-item/${item.id}/" class="secondary-btn edit-btn">Edit</a>
                            <button class="delete-btn" data-delete-item="${item.id}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}

async function deleteItem(id) {
    const confirmDelete = confirm("Delete this item? This removes associated notifications.");
    if (!confirmDelete) return;
    await ApiClient.request(`/inventory/delete-item/${id}`, { method: "DELETE" });
    await initializePantry();
}

async function initializePantry() {
    const table = document.getElementById("pantry-table-body");
    if (table) {
        showLoading();
    }

    try {
        const items = await ApiClient.request("/inventory/pantry");
        renderItems(items);
        setMessage("");
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
            window.location.href = "/login/";
            return;
        }
        setMessage(error.message, "error");
    }
}

async function logout() {
    try {
        await ApiClient.request("/auth/logout", { method: "POST" });
    } catch {}

    ApiClient.clearToken();
    window.location.href = "/login/";
}

function setupProfileUi() {
    const toggles = Array.from(document.querySelectorAll("[data-profile-toggle]"));
    let activeDropdown = null;

    const closeDropdown = () => {
        if (!activeDropdown) return;
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
            if (!confirmed) return;

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
                setMessage(error.message, "error");
            }
        });
    });

    toggles.forEach((toggle) => {
        const panel = toggle.closest(".profile-panel");
        const dropdown = panel?.querySelector("[data-profile-dropdown]");

        if (!dropdown) return;

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

document.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest("[data-delete-item]");
    if (!deleteBtn) return;

    try {
        await deleteItem(deleteBtn.dataset.deleteItem);
    } catch (error) {
        setMessage(error.message, "error");
    }
});

(async () => {
    setupProfileUi();
    await initializePantry();
})();
