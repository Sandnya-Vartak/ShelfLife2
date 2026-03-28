

async function loadCurrentUser() {
    if (!ApiClient.getToken()) {
        window.location.href = "/login/";
        return;
    }

    try {
        const user = await ApiClient.request("/auth/me");
        updateProfileMeta(user);
        displayPageMessage("message", "");
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
            window.location.href = "/login/";
            return;
        }

        displayPageMessage("message", error.message, "error");
    }
}

async function logout() {
    try {
        await ApiClient.request("/auth/logout", { method: "POST" });
    } catch (error) {
        // Ignore logout request failures and clear client auth anyway.
    }

    ApiClient.clearToken();
    window.location.href = "/login/";
}

async function deleteAccount() {
    try {
        await ApiClient.request("/auth/delete-account", { method: "DELETE" });
    } catch (error) {
        if (!(error?.status === 401 || error?.status === 422)) {
            displayPageMessage("message", error.message, "error");
            return;
        }
    } finally {
        ApiClient.clearToken();
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

        const data = await ApiClient.request("/inventory/add-item", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        displayPageMessage("message", data.message, "success");
        event.target.reset();
        window.setTimeout(() => {
            window.location.href = "/dashboard/";
        }, 700);
    } catch (error) {
        if ((error?.status === 401 || error?.status === 422)) {
            ApiClient.clearToken();
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
