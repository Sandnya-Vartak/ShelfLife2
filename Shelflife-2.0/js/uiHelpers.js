function displayPageMessage(targetId, message, type = "") {
    const node = document.getElementById(targetId);
    if (!node) return;

    node.textContent = message;
    node.className = `message ${type}`.trim();
}

function updateProfileMeta(user) {
    const name = (user?.name || user?.email || "ShelfLife user").trim();
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "SL";

    document.querySelectorAll("[data-user-name]").forEach((node) => {
        node.textContent = name;
    });

    document.querySelectorAll("[data-user-avatar]").forEach((node) => {
        node.textContent = initials;
    });
}

function initializeProfilePanel(callbacks = {}) {
    const { onProfileClick, onLogout, onDeleteAccount } = callbacks;
    const toggles = Array.from(document.querySelectorAll("[data-profile-toggle]"));
    let activeDropdown = null;

    const closeDropdown = () => {
        if (!activeDropdown) return;
        activeDropdown.classList.remove("is-open");
        activeDropdown = null;
    };

    const attachProfileLinks = () => {
        document.querySelectorAll("[data-profile-link]").forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                if (typeof onProfileClick === "function") {
                    onProfileClick();
                    return;
                }
                window.location.href = "/profile/";
            });
        });
    };

    const attachLogout = () => {
        document.querySelectorAll("[data-logout-link]").forEach((link) => {
            link.addEventListener("click", async (event) => {
                event.preventDefault();
                if (typeof onLogout === "function") {
                    await onLogout();
                } else {
                    window.location.href = "/login/";
                }
            });
        });
    };

    const attachDelete = () => {
        document.querySelectorAll("[data-delete-account]").forEach((button) => {
            button.addEventListener("click", async () => {
                if (!window.confirm("Delete your account and all pantry data permanently?")) {
                    return;
                }
                if (typeof onDeleteAccount === "function") {
                    await onDeleteAccount();
                }
            });
        });
    };

    toggles.forEach((toggle) => {
        const panel = toggle.closest(".profile-panel");
        const dropdown = panel?.querySelector("[data-profile-dropdown]");
        if (!dropdown) return;

        dropdown.addEventListener("click", (event) => event.stopPropagation());
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

    attachProfileLinks();
    attachLogout();
    attachDelete();
    document.addEventListener("click", closeDropdown);
}
