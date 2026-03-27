// ==============================
// CONFIG
// ==============================
const tokenKey = "shelflife_token";
const configuredApiBaseUrl =
  window.SHELFLIFE_API_BASE_URL || document.body?.dataset.apiBaseUrl || "";

let resolvedApiBaseUrl = "";

// ==============================
// HELPERS
// ==============================
const normalizeBaseUrl = (url) => (url || "").replace(/\/+$/, "");

const getApiBaseCandidates = () => {
  if (resolvedApiBaseUrl) return [resolvedApiBaseUrl];

  const candidates = [];
  const origin = normalizeBaseUrl(window.location.origin);

  if (configuredApiBaseUrl) candidates.push(normalizeBaseUrl(configuredApiBaseUrl));
  if (origin) candidates.push(origin);

  candidates.push("http://127.0.0.1:5000", "http://localhost:5000");

  return [...new Set(candidates)];
};

const buildApiUrl = (base, path) => `${base}${path}`;

const getToken = () =>
  localStorage.getItem(tokenKey) ||
  document.cookie
    .split("; ")
    .find((c) => c.startsWith(tokenKey + "="))
    ?.split("=")[1];

const clearAuth = () => {
  localStorage.removeItem(tokenKey);
  document.cookie = `${tokenKey}=; path=/; expires=Thu, 01 Jan 1970`;
};

const isAuthError = (err) => err?.status === 401 || err?.status === 422;

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
async function apiRequest(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;

  for (const base of getApiBaseCandidates()) {
    try {
      response = await fetch(buildApiUrl(base, url), {
        ...options,
        headers,
        credentials: "include"
      });
      resolvedApiBaseUrl = base;
      break;
    } catch {}
  }

  if (!response) throw new Error("Server not reachable");

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = response.status;
    throw err;
  }

  return data;
}

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

  await apiRequest(`/inventory/delete-item/${id}`, { method: "DELETE" });
  await initializeDashboard();
}

// ==============================
// LOGOUT
// ==============================
async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch {}

  clearAuth();
  window.location.href = "/login/";
}

async function deleteAccount() {
    try {
        await apiRequest("/auth/delete-account", { method: "DELETE" });
    } catch (error) {
        if (!isAuthError(error)) {
            displayPageMessage("dashboard-message", error.message, "error");
            return;
        }
    } finally {
        clearAuth();
        window.location.href = "/register/";
    }
}

// ==============================
// INIT
// ==============================
async function initializeDashboard() {
  if (!getToken()) {
    window.location.href = "/login/";
    return;
  }

  showLoading();

  try {
    const [user, items] = await Promise.all([
      apiRequest("/auth/me"),
      apiRequest("/inventory/items")
    ]);

    updateProfileMeta(user);
    updateMetrics(items);
    renderItems(items);

    displayPageMessage("dashboard-message", "");
  } catch (err) {
    if (isAuthError(err)) {
      clearAuth();
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
