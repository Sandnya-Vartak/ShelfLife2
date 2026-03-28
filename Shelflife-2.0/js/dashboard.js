// ==============================
// CONFIG
// ==============================

// ==============================
// HELPERS
// ==============================

const showLoading = () => {
  const table = document.getElementById("inventory-table-body");
  if (!table) return;

  table.innerHTML = `
    <tr>
      <td colspan="7" style="text-align:center; padding:30px;">
        Loading data...
      </td>
    </tr>
  `;
};

// ==============================
// API REQUEST
// ==============================

// ==============================
// STATUS LOGIC
// ==============================
const getStatusLabel = (status) => {
  if (status === "expired") return "Expired";
  if (status === "expiring_critical") return "Today / Tomorrow";
  if (status === "expiring_soon") return "Expiring Soon";
  return "Fresh";
};

const getStatusClass = (status) => status || "fresh";

const getDaysClass = (days) => {
  if (days <= 0) return "expired";
  if (days <= 1) return "expiring_critical";
  if (days <= 3) return "expiring_soon";
  return "fresh";
};

// ==============================
// METRICS
// ==============================
function updateMetrics(items) {
  const counts = {
    total: items.length,
    fresh: items.filter((i) => getStatusClass(i.status) === "fresh").length,
    expiring_soon: items.filter((i) =>
      ["expiring_soon", "expiring_critical"].includes(i.status)
    ).length,
    expired: items.filter((i) => i.status === "expired").length
  };

  document.querySelectorAll("[data-metric]").forEach((el) => {
    el.textContent = counts[el.dataset.metric] ?? "--";
  });
}

// ==============================
// RENDER TABLE
// ==============================
function renderItems(items) {
  const table = document.getElementById("inventory-table-body");
  const urgentStatuses = new Set(["expired", "expiring_critical", "expiring_soon"]);
  const urgentItems = items.filter((item) => urgentStatuses.has(item.status));

  if (!urgentItems.length) {
    table.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:40px;">
          No urgent items right now.<br>
          <strong>Everything looks good. Use the Pantry page for the full list.</strong>
          <br><a href="/pantry/" class="secondary-btn">Open Pantry</a>
        </td>
      </tr>
    `;
    return;
  }
  const sorted = urgentItems.sort(
    (a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)
  );

  table.innerHTML = sorted
    .map((item) => {
      const days = Math.ceil(
        (new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
      );
      const statusClass = getStatusClass(item.status);
      const daysClass = getDaysClass(days);

      return `
        <tr data-status="${statusClass}">
          <td class="item-name">${item.name}</td>
          <td>${item.quantity || 1}</td>
          <td>${item.category}</td>
          <td>${item.expiry_date}</td>
          <td><span class="days-left ${daysClass}">${days}</span></td>
          <td>
            <span class="status-badge ${statusClass}">
              ${getStatusLabel(item.status)}
            </span>
          </td>
          <td class="action-cell">
            <div class="action-group">
              <a href="/edit-item/${item.id}/" class="secondary-btn edit-btn">
                Edit
              </a>
              <button class="delete-btn" data-delete-item="${item.id}">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// ==============================
// DELETE
// ==============================
async function deleteItem(id) {
  const confirmDelete = confirm("Delete this item?");
  if (!confirmDelete) return;

  await ApiClient.request(`/inventory/delete-item/${id}`, { method: "DELETE" });
  await initializeDashboard();
}

// ==============================
// LOGOUT
// ==============================
async function logout() {
  try {
    await ApiClient.request("/auth/logout", { method: "POST" });
  } catch {}

  ApiClient.clearToken();
  window.location.href = "/login/";
}

async function deleteAccount() {
    try {
        await ApiClient.request("/auth/delete-account", { method: "DELETE" });
    } catch (error) {
        if (!(error?.status === 401 || error?.status === 422)) {
            displayPageMessage("dashboard-message", error.message, "error");
            return;
        }
    } finally {
        ApiClient.clearToken();
        window.location.href = "/register/";
    }
}

// ==============================
// INIT
// ==============================
async function initializeDashboard() {
  if (!ApiClient.getToken()) {
    window.location.href = "/login/";
    return;
  }

  showLoading();

  try {
    const [user, items] = await Promise.all([
      ApiClient.request("/auth/me"),
      ApiClient.request("/inventory/items")
    ]);

    updateProfileMeta(user);
    updateMetrics(items);
    renderItems(items);

    displayPageMessage("dashboard-message", "");
  } catch (err) {
    if ((err?.status === 401 || err?.status === 422)) {
      ApiClient.clearToken();
      window.location.href = "/login/";
      return;
    }

    displayPageMessage("dashboard-message", err.message, "error");
  }
}

// ==============================
// EVENTS
// ==============================
document.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest("[data-delete-item]");
  if (!deleteBtn) return;

  try {
    await deleteItem(deleteBtn.dataset.deleteItem);
  } catch (err) {
    displayPageMessage("dashboard-message", err.message, "error");
  }
});

// ==============================
// START
// ==============================

initializeProfilePanel({
  onLogout: logout,
  onDeleteAccount: deleteAccount,
  onProfileClick: () => {
    window.location.href = "/profile/";
  },
});
initializeDashboard();
