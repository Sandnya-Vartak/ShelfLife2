

function setMessage(message, type = "") {
    const node = document.getElementById("message");
    if (!node) {
        return;
    }
    node.textContent = message;
    node.className = `message ${type}`.trim();
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

function extractItemId() {
    const match = window.location.pathname.match(/\/edit-item\/(\d+)/);
    return match ? Number(match[1]) : null;
}

async function loadItem(itemId) {
    try {
        const item = await ApiClient.request(`/inventory/item/${itemId}`);
        document.getElementById("edit-item-name").value = item.name || "";
        document.getElementById("edit-item-category").value = item.category || "";
        document.getElementById("edit-item-quantity").value = item.quantity || 1;
        document.getElementById("edit-item-expiry").value = item.expiry_date || "";
        document.getElementById("edit-item-price").value = item.price ?? "";
        document.getElementById("edit-item-currency").value = item.currency || "USD";
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
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
            const data = await ApiClient.request(`/inventory/update-item/${itemId}`, {
                method: "PATCH",
                body: JSON.stringify(payload)
            });

            setMessage(data.message, "success");
            setTimeout(() => {
                window.location.href = "/dashboard/";
            }, 900);
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
