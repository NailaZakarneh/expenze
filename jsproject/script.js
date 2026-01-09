const API_BASE = "https://pennypath-server.vercel.app";

// App State
 
let state = {
  page: 1,
  limit: 10,
  search: "",
  dateFilter: null, // {from:"YYYY-MM-DD", to:"YYYY-MM-DD"}
  expenses: [],
  pagination: { page: 1, limit: 10, totalPages: 1, totalItems: 0 },
  isLoading: false
};

// DOM 

const project = {
  tbody: document.getElementById("expensesTbody"),
  empty: document.getElementById("emptyState"),
  emptyAddBtn: document.getElementById("emptyAddBtn"),
  totalAmount: document.getElementById("totalAmount"),
  totalMeta: document.getElementById("totalMeta"),
  totalPill: document.getElementById("totalPill"),
  statusText: document.getElementById("statusText"),
  searchInput: document.getElementById("searchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  limitSelect: document.getElementById("limitSelect"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  pageText: document.getElementById("pageText"),
  pageMeta: document.getElementById("pageMeta"),
  addExpenseBtn: document.getElementById("addExpenseBtn"),
  filterTodayBtn: document.getElementById("filterTodayBtn"),
  filterMonthBtn: document.getElementById("filterMonthBtn"),
  filterResetBtn: document.getElementById("filterResetBtn"),
  dialog: document.getElementById("expenseDialog"),
  form: document.getElementById("expenseForm"),
  closeDialogBtn: document.getElementById("closeDialogBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  dialogTitle: document.getElementById("dialogTitle"),
  dialogSub: document.getElementById("dialogSub"),
  expenseId: document.getElementById("expenseId"),
  nameInput: document.getElementById("nameInput"),
  dateInput: document.getElementById("dateInput"),
  amountInput: document.getElementById("amountInput"),
  descInput: document.getElementById("descInput"),
  saveBtn: document.getElementById("saveBtn"),
};



function setStatus(text, type = "ok") {
  project.statusText.innerHTML = `<span class="dot"></span> ${text}`;
  const dot = project.statusText.querySelector(".dot");
  if (!dot) return;
  if (type === "ok") {
    dot.style.background = "var(--accent)";
    dot.style.boxShadow = "0 0 14px rgba(66,245,197,.6)";
  } else if (type === "warn") {
    dot.style.background = "var(--warn)";
    dot.style.boxShadow = "0 0 14px rgba(255,183,3,.55)";
  } else {
    dot.style.background = "var(--danger)";
    dot.style.boxShadow = "0 0 14px rgba(255,77,109,.55)";
  }
}


function setLoading(isLoading) {
  state.isLoading = isLoading;
  project.addExpenseBtn.disabled = isLoading;
  project.limitSelect.disabled = isLoading;
  project.searchInput.disabled = isLoading;
  project.clearSearchBtn.disabled = isLoading;
  if (project.saveBtn) project.saveBtn.disabled = isLoading;

  renderPagination();
}

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getId(exp) {
  return exp?.id ?? exp?._id ?? exp?.expenseId ?? exp?.uuid ?? exp?.ID;
}

function dedupeById(list) {
  const map = new Map();
  for (const item of list) {
    const id = getId(item);
    if (id == null) continue;
    const k = String(id);
    if (!map.has(k)) map.set(k, item);
  }
  return Array.from(map.values());
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("limit", String(state.limit));
  if (state.search.trim()) params.set("search", state.search.trim());
  return params.toString();
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });

    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }

    if (!res.ok) {
      const msg = data?.message || data?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data;
  } catch (err) {
    alert(`Error: ${err.message}`);
    throw err;
  }
}

function normalizeListResponse(json) {
  const root = json?.data ?? json;

  let expenses =
    root?.expenses ??
    root?.items ??
    root?.results ??
    root?.data ??
    (Array.isArray(root) ? root : []);
  expenses = Array.isArray(expenses) ? expenses : [];
  expenses = dedupeById(expenses);
  const page = Number(root?.currentPage ?? root?.page ?? state.page);
  const totalPages = Number(root?.totalPages ?? 1);
  const totalItems = Number(root?.count ?? root?.totalItems ?? root?.total ?? expenses.length);
  const limit = state.limit;

  return {
    expenses,
    pagination: {
      page: Number.isFinite(page) ? page : state.page,
      limit,
      totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
      totalItems: Number.isFinite(totalItems) && totalItems >= 0 ? totalItems : expenses.length,
    }
  };
}

function applyClientDateFilter(expenses) {
  if (!state.dateFilter) return expenses;
  const { from, to } = state.dateFilter;
  const fromT = from ? new Date(from).setHours(0, 0, 0, 0) : null;
  const toT = to ? new Date(to).setHours(23, 59, 59, 999) : null;
  return expenses.filter(e => {
    const t = new Date(e.date).getTime();
    if (fromT && t < fromT) return false;
    if (toT && t > toT) return false;
    return true;
  });
}

// API Calls 

async function loadExpenses({ _retry = false } = {}) {
  try {
    setLoading(true);
    setStatus("Loading...", "warn");
    const qs = buildQuery();
    const url = `${API_BASE}/api/v1/expenses?${qs}`;
    const json = await fetchJson(url, { method: "GET" });
    const normalized = normalizeListResponse(json);
    state.pagination = normalized.pagination;

    // if page out of range(after deletes)
    const totalPages = Number(state.pagination.totalPages || 1);
    if (state.page > totalPages) {
      state.page = totalPages;
      if (!_retry) return loadExpenses({ _retry: true });
    }
    let expenses = normalized.expenses;
    expenses = applyClientDateFilter(expenses);
    state.expenses = expenses;
    render();
    setStatus("Ready", "ok");
  } catch {
    setStatus("API error", "err");
  } finally {
    setLoading(false);
  }
}

// GET expense by ID 
async function getExpenseByIdFromApi(expenseId) {
  const url = `${API_BASE}/api/v1/expenses/${encodeURIComponent(expenseId)}`;
  const json = await fetchJson(url, { method: "GET" });
  const root = json?.data ?? json;
  const exp = root?.expense ?? root?.data ?? root;
  return exp;
}



// POST create 
async function createExpense(payload) {
  try {
    setStatus("Creating...", "warn");
    const url = `${API_BASE}/api/v1/expenses`;
    await fetchJson(url, { method: "POST", body: JSON.stringify(payload) });
    state.page = 1;
    await loadExpenses();
    setStatus("Created", "ok");
  } catch {
    setStatus("Create failed", "err");
  }
}

// PUT update 
async function updateExpense(id, payload) {
  try {
    setStatus("Updating...", "warn");
    const url = `${API_BASE}/api/v1/expenses/${encodeURIComponent(id)}`;
    await fetchJson(url, { method: "PUT", body: JSON.stringify(payload) });
    await loadExpenses();
    setStatus("Updated", "ok");
  } catch {
    setStatus("Update failed", "err");
  }
}

// DELETE 
async function deleteExpense(id) {
  const ok = confirm("Delete this expense?");
  if (!ok) return;
  const before = state.expenses.length;
  state.expenses = state.expenses.filter(e => String(getId(e)) !== String(id));
  if (state.expenses.length !== before) render();
  try {
    setStatus("Deleting...", "warn");
    const url = `${API_BASE}/api/v1/expenses/${encodeURIComponent(id)}`;
    await fetchJson(url, { method: "DELETE" });
    if (state.expenses.length === 0 && state.page > 1) state.page -= 1;
    await loadExpenses();
    setStatus("Deleted", "ok");
  } catch {
    setStatus("Delete failed", "err");
    await loadExpenses();
  }
}

// Render

function render() {
  renderTable();
  renderTotal();
  renderPagination();
}

function renderTable() {
  project.tbody.innerHTML = "";
  const items = state.expenses || [];
  const hasItems = items.length > 0;
  project.empty.classList.toggle("hidden", hasItems);
  if (!hasItems) return;
  for (const exp of items) {
    const id = getId(exp);
    const name = escapeHtml(exp.name);
    const date = escapeHtml(exp.date);
    const amount = Number(exp.amount || 0);
    const description = escapeHtml(exp.description || "");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="badge"><i class="fa-solid fa-receipt"></i> ${name}</span>
        </div>
      </td>
      <td>${date}</td>
      <td class="right"><strong>${money(amount)}</strong></td>
      <td>${description || '<span class="muted">—</span>'}</td>
      <td class="right">
        <div class="actions">
          <button class="action-btn" data-action="edit" data-id="${escapeHtml(id)}" title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="action-btn danger" data-action="delete" data-id="${escapeHtml(id)}" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    project.tbody.appendChild(tr);
  }
}

function renderTotal() {
  const items = state.expenses || [];
  const total = items.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  project.totalAmount.textContent = money(total);
  project.totalMeta.textContent = `${items.length} items loaded`;
  project.totalPill.textContent = state.search.trim()
    ? `Search: "${state.search.trim()}"`
    : "This page";
}
function renderPagination() {
  const p = state.pagination || {};
  const page = state.page;
  const totalPages = Number(p.totalPages || 1);
  const totalItems = Number(p.totalItems || 0);
  project.pageText.textContent = `Page ${page}`;
  project.pageMeta.textContent = totalPages > 1
    ? `of ${totalPages} • ${totalItems} total`
    : `${totalItems} total`;
  project.prevBtn.disabled = state.isLoading || page <= 1;
  project.nextBtn.disabled = state.isLoading || page >= totalPages;
}
// Dialog 

function openDialog(mode, expense = null) {
  const isEdit = mode === "edit";
  project.dialogTitle.textContent = isEdit ? "Edit Expense" : "Add Expense";
  project.dialogSub.textContent = isEdit ? "Update the record (from server)" : "Create a new record";
  project.expenseId.value = isEdit ? String(getId(expense) ?? "") : "";
  project.nameInput.value = isEdit ? (expense.name ?? "") : "";
  project.dateInput.value = isEdit ? (expense.date ?? "") : new Date().toISOString().slice(0, 10);
  project.amountInput.value = isEdit ? (expense.amount ?? "") : "";
  project.descInput.value = isEdit ? (expense.description ?? "") : "";
  project.dialog.showModal();
}
function closeDialog() {
  project.dialog.close();
}

// Filters 

function setTodayFilter() {
  const d = new Date();
  const iso = d.toISOString().slice(0, 10);
  state.dateFilter = { from: iso, to: iso };
  render();
  setStatus("Filtered: Today", "ok");
}

function setMonthFilter() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  state.dateFilter = { from, to };
  render();
  setStatus("Filtered: This month", "ok");
}

function resetDateFilter() {
  state.dateFilter = null;
  render();
  setStatus("Filter cleared", "ok");
}

// Events 

project.addExpenseBtn.addEventListener("click", () => openDialog("add"));
project.emptyAddBtn.addEventListener("click", () => openDialog("add"));
project.closeDialogBtn.addEventListener("click", closeDialog);
project.cancelBtn.addEventListener("click", closeDialog);
project.limitSelect.addEventListener("change", async () => {
  state.limit = Number(project.limitSelect.value);
  state.page = 1;
  await loadExpenses();
});

let searchTimer = null;
project.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    state.search = project.searchInput.value;
    state.page = 1;
    await loadExpenses();
  }, 350);
});

project.clearSearchBtn.addEventListener("click", async () => {
  project.searchInput.value = "";
  state.search = "";
  state.page = 1;
  await loadExpenses();
});

project.prevBtn.addEventListener("click", async () => {
  if (state.isLoading || state.page <= 1) return;
  state.page -= 1;
  await loadExpenses();
});

project.nextBtn.addEventListener("click", async () => {
  if (state.isLoading) return;
  state.page += 1;
  await loadExpenses();
});
project.filterTodayBtn.addEventListener("click", setTodayFilter);
project.filterMonthBtn.addEventListener("click", setMonthFilter);
project.filterResetBtn.addEventListener("click", resetDateFilter);
project.tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!id) return;
  if (action === "delete") {
    await deleteExpense(id);
    return;
  }

  if (action === "edit") {
    if (state.isLoading) return;
    try {
      setStatus("Loading expense...", "warn");
      const expense = await getExpenseByIdFromApi(id);
      if (!expense) {
        alert("Could not load this expense from server.");
        return;
      }
      openDialog("edit", expense);
      setStatus("Ready", "ok");
    } catch {
      setStatus("Failed to load expense", "err");
    }
  }
});

project.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: project.nameInput.value.trim(),
    date: project.dateInput.value,
    amount: Number(project.amountInput.value),
    description: project.descInput.value.trim() || undefined
  };
  if (!payload.name) return alert("Name is required.");
  if (!payload.date) return alert("Date is required.");
  if (!Number.isFinite(payload.amount)) return alert("Amount must be a number.");
  const id = project.expenseId.value.trim();
  if (id) await updateExpense(id, payload);
  else await createExpense(payload);
  closeDialog();
});


(async function init() {
  try {
    project.limitSelect.value = String(state.limit);
    await loadExpenses();
  } catch {
    setStatus("API error", "err");
  }
})();




