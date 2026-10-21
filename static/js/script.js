const API_BASE = "/api";

let medicines = [];
let editingId = null;

// ---------- View Navigation ----------
function showView(viewName) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));

  document.getElementById(`${viewName}-view`).classList.add("active");
  const navBtn = document.querySelector(`.nav-link[data-view="${viewName}"]`);
  if (navBtn) navBtn.classList.add("active");

  if (viewName === "medicines") renderMedicinesTable();
  if (viewName === "dashboard") loadDashboard();
  if (viewName === "add-medicine" && editingId === null) resetForm();
}

document.querySelectorAll("[data-nav]").forEach(el => {
  el.addEventListener("click", () => showView(el.dataset.nav));
});
document.querySelectorAll(".nav-link").forEach(el => {
  el.addEventListener("click", () => showView(el.dataset.view));
});

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
  loadMedicines();
});
// ---------- API Calls ----------
async function loadMedicines() {
  try {
    const res = await fetch(`${API_BASE}/medicines`);
    if (!res.ok) throw new Error("Failed to load medicines");
    medicines = await res.json();
  } catch (err) {
    showToast("Could not load medicines", "error");
    console.error(err);
  }
}

async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/dashboard`);
    if (!res.ok) throw new Error("Failed to load dashboard");
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    showToast("Could not load dashboard", "error");
    console.error(err);
  }
}

async function saveMedicine(payload, id) {
  const url = id ? `${API_BASE}/medicines/${id}` : `${API_BASE}/medicines`;
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to save medicine");
  return data;
}

async function deleteMedicine(id) {
  const res = await fetch(`${API_BASE}/medicines/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete medicine");
  }
}

async function toggleTaken(id) {
  const res = await fetch(`${API_BASE}/medicines/${id}/taken`, { method: "PATCH" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update status");
  }
  return res.json();
}
// ---------- Rendering ----------
function renderDashboard(data) {
  document.getElementById("stat-total").textContent = data.total;
  document.getElementById("stat-today").textContent = data.today_count;
  document.getElementById("stat-taken").textContent = data.taken_count;
  document.getElementById("stat-pending").textContent = data.pending_count;

  const todayList = document.getElementById("today-list");
  todayList.innerHTML = data.today.length
    ? data.today.map(m => miniItemHTML(m)).join("")
    : `<p class="empty-state">No medicines scheduled for today.</p>`;

  const upcomingList = document.getElementById("upcoming-list");
  upcomingList.innerHTML = data.upcoming.length
    ? data.upcoming.map(m => miniItemHTML(m)).join("")
    : `<p class="empty-state">No upcoming medicines.</p>`;
}

function miniItemHTML(m) {
  return `
    <div class="mini-item">
      <span class="mini-name">${escapeHTML(m.name)} — ${escapeHTML(m.dosage)}</span>
      <span class="mini-time">${escapeHTML(m.time)}</span>
    </div>`;
}

function renderMedicinesTable() {
  const tbody = document.getElementById("medicines-tbody");
  const emptyEl = document.getElementById("medicines-empty");

  if (medicines.length === 0) {
    tbody.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  tbody.innerHTML = medicines.map(m => `
    <tr>
      <td>${escapeHTML(m.name)}</td>
      <td>${escapeHTML(m.dosage)}</td>
      <td>${escapeHTML(m.time)}</td>
      <td>${escapeHTML(m.frequency)}</td>
      <td>${m.start_date}</td>
      <td>${m.end_date}</td>
      <td><span class="badge ${m.status === 'Taken' ? 'badge-taken' : 'badge-pending'}">${m.status}</span></td>
      <td>
        <button class="btn-small success" onclick="handleToggleTaken(${m.id})">
          ${m.status === 'Taken' ? 'Mark Pending' : 'Mark Taken'}
        </button>
        <button class="btn-small" onclick="handleEdit(${m.id})">Edit</button>
        <button class="btn-small danger" onclick="handleDelete(${m.id})">Delete</button>
      </td>
    </tr>
  `).join("");
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
// ---------- Form Handling ----------
const form = document.getElementById("medicine-form");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideFormError();

  const payload = {
    name: document.getElementById("name").value.trim(),
    dosage: document.getElementById("dosage").value.trim(),
    time: document.getElementById("time").value,
    frequency: document.getElementById("frequency").value,
    start_date: document.getElementById("start_date").value,
    end_date: document.getElementById("end_date").value,
    notes: document.getElementById("notes").value.trim()
  };

  const validationError = validateForm(payload);
  if (validationError) {
    showFormError(validationError);
    return;
  }

  try {
    await saveMedicine(payload, editingId);
    showToast(editingId ? "Medicine updated" : "Medicine added", "success");
    editingId = null;
    resetForm();
    await loadMedicines();
    await loadDashboard();
    showView("medicines");
  } catch (err) {
    showFormError(err.message);
  }
});

function validateForm(p) {
  if (!p.name) return "Medicine name is required.";
  if (!p.dosage) return "Dosage is required.";
  if (!p.time) return "Time is required.";
  if (!p.frequency) return "Please select a frequency.";
  if (!p.start_date || !p.end_date) return "Start and end dates are required.";
  if (p.end_date < p.start_date) return "End date cannot be before start date.";
  return null;
}

function resetForm() {
  form.reset();
  document.getElementById("medicine-id").value = "";
  document.getElementById("form-title").textContent = "Add Medicine";
  document.getElementById("form-submit-btn").textContent = "Save Medicine";
  editingId = null;
  hideFormError();
}

function showFormError(msg) {
  const el = document.getElementById("form-error");
  el.textContent = msg;
  el.style.display = "block";
}
function hideFormError() {
  document.getElementById("form-error").style.display = "none";
}

// ---------- Action Handlers ----------
async function handleEdit(id) {
  const m = medicines.find(x => x.id === id);
  if (!m) return;

  editingId = id;
  document.getElementById("medicine-id").value = m.id;
  document.getElementById("name").value = m.name;
  document.getElementById("dosage").value = m.dosage;
  document.getElementById("time").value = m.time;
  document.getElementById("frequency").value = m.frequency;
  document.getElementById("start_date").value = m.start_date;
  document.getElementById("end_date").value = m.end_date;
  document.getElementById("notes").value = m.notes || "";

  document.getElementById("form-title").textContent = "Edit Medicine";
  document.getElementById("form-submit-btn").textContent = "Update Medicine";
  showView("add-medicine");
}

async function handleDelete(id) {
  if (!confirm("Delete this medicine? This cannot be undone.")) return;
  try {
    await deleteMedicine(id);
    showToast("Medicine deleted", "success");
    await loadMedicines();
    await loadDashboard();
    renderMedicinesTable();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleToggleTaken(id) {
  try {
    await toggleTaken(id);
    await loadMedicines();
    await loadDashboard();
    renderMedicinesTable();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}