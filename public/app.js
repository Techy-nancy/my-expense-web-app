const bootEl = document.querySelector("#boot");
const authScreen = document.querySelector("#auth-screen");
const appEl = document.querySelector("#app");
const authForm = document.querySelector("#auth-form");
const authError = document.querySelector("#auth-error");
const nameField = document.querySelector("#name-field");
const passwordHint = document.querySelector("#password-hint");
const authSubmit = document.querySelector("#auth-submit");
const bannerEl = document.querySelector("#banner");
const modalEl = document.querySelector("#modal");
const entryForm = document.querySelector("#entry-form");
const confirmEl = document.querySelector("#confirm");
const formErrorsEl = document.querySelector("#form-errors");
const saveBtn = document.querySelector("#save-btn");

const GLYPHS = {
  Salary: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
  Freelance: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  Gift: '<rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 14h18M12 10v10"/><path d="M12 10c-2-3.5-6-3.5-6-.8S10 10 12 10s6-1.2 6-.8-4-2.7-6-.8z"/>',
  Refund: '<path d="M3 12a9 9 0 1 0 2.2-5.8"/><path d="M3 4v5h5"/>',
  Rent: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
  Groceries: '<circle cx="8" cy="20" r="1"/><circle cx="17" cy="20" r="1"/><path d="M3 4h2l2.2 11h11.2l2-7H7"/>',
  Transport: '<path d="M4 16V8l2.2-4h11.6L20 8v8"/><path d="M4 12h16"/><circle cx="7.5" cy="16.5" r="1.2"/><circle cx="16.5" cy="16.5" r="1.2"/>',
  Utilities: '<path d="M8 21h8"/><path d="M9 21v-4a5 5 0 1 1 6 0v4"/><path d="M12 3v3"/>',
  Dining: '<path d="M6 3v8a2 2 0 0 0 2 2V3"/><path d="M8 13v8"/><path d="M16 3v18"/><path d="M16 8h3v2a2 2 0 0 1-2 2"/>',
  Health: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/>',
  Shopping: '<path d="M6 8h12l-1.2 12H7.2L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  Entertainment: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9v6l5-3z"/>',
  Other: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/>',
};

const CATEGORY_COLORS = {
  Rent: "#f5b942",
  Groceries: "#6ea8ff",
  Transport: "#3dd6c6",
  Utilities: "#7dd3fc",
  Dining: "#8ea2ff",
  Health: "#3ddc97",
  Shopping: "#f472b6",
  Entertainment: "#c4b5fd",
  Other: "#94a3b8",
  Salary: "#3ddc97",
  Freelance: "#6ea8ff",
  Gift: "#f472b6",
  Refund: "#7dd3fc",
};

const state = {
  user: null,
  categories: { income: [], expense: [] },
  authMode: "login",
  summary: null,
  entries: [],
  editing: null,
  deleting: null,
  busy: false,
  flashId: null,
  kindFilter: "",
};

let bannerTimer = null;

function money(cents) {
  const value = Number(cents) || 0;
  const formatted = (Math.abs(value) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return value < 0 ? `−${formatted}` : formatted;
}

function signedMoney(kind, cents) {
  return kind === "income" ? `+${money(cents)}` : `−${money(cents)}`;
}

function axisMoney(cents) {
  const dollars = cents / 100;
  if (dollars >= 10000) return `$${Math.round(dollars / 100) / 10}k`;
  return `$${Math.round(dollars).toLocaleString("en-US")}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function shortMonth(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function formatDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dollarsToCents(value) {
  const trimmed = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isInteger(cents) || cents <= 0 || cents > 100000000) return null;
  return cents;
}

function colorFor(category) {
  return CATEGORY_COLORS[category] || "#94a3b8";
}

function glyph(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "glyph");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = GLYPHS[name] || GLYPHS.Other;
  return svg;
}

function entryCount(entries, month, kind) {
  return entries.filter((entry) => entry.kind === kind && entry.occurredOn.startsWith(month)).length;
}

function countLabel(count, word) {
  return `${count} ${word} ${count === 1 ? "entry" : "entries"}`;
}

function niceMax(cents) {
  const dollars = Math.max(cents, 1) / 100;
  const pow = 10 ** Math.floor(Math.log10(dollars));
  const n = dollars / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return Math.max(100, nice * pow * 100);
}

function showBanner(message, kind) {
  bannerEl.hidden = false;
  bannerEl.textContent = message;
  bannerEl.className = `banner ${kind}`;
  clearTimeout(bannerTimer);
  if (kind === "ok") bannerTimer = setTimeout(() => { bannerEl.hidden = true; }, 3200);
}

function showErrors(container, errors, fallback) {
  const lines = errors?.length ? errors : [fallback || "Something went wrong."];
  container.replaceChildren();
  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    container.append(p);
  }
  container.hidden = false;
}

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!response.ok) {
    const error = new Error(data?.message || "Request failed.");
    error.details = data?.errors || [];
    error.status = response.status;
    throw error;
  }
  return data;
}

function showScreen(name) {
  bootEl.hidden = true;
  authScreen.hidden = name !== "auth";
  appEl.hidden = name !== "app";
}

function setAuthMode(mode) {
  state.authMode = mode;
  const register = mode === "register";
  nameField.hidden = !register;
  passwordHint.hidden = !register;
  authForm.elements.name.required = register;
  authForm.elements.password.autocomplete = register ? "new-password" : "current-password";
  authSubmit.textContent = register ? "Create account" : "Sign in";
  document.querySelector("#show-login").classList.toggle("active", !register);
  document.querySelector("#show-register").classList.toggle("active", register);
  document.querySelector("#show-login").setAttribute("aria-selected", String(!register));
  document.querySelector("#show-register").setAttribute("aria-selected", String(register));
  authError.hidden = true;
}

function fillFilterCategories() {
  const select = document.querySelector("#filter-category");
  const current = select.value;
  const names = [...new Set([...state.categories.income, ...state.categories.expense])];
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All categories";
  select.append(all);
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  }
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function enterApp(payload) {
  state.user = payload.user;
  state.categories = payload.categories;
  for (const el of document.querySelectorAll(".user-name")) el.textContent = payload.user.name;
  for (const el of document.querySelectorAll(".user-email")) el.textContent = payload.user.email;
  document.querySelector("#hello").textContent = `Hello, ${payload.user.name}`;
  fillFilterCategories();
  showScreen("app");
  const monthInput = document.querySelector("#report-month");
  if (!monthInput.value) monthInput.value = monthKey();
  loadPage();
}

async function submitAuth(body) {
  authError.hidden = true;
  authSubmit.disabled = true;
  try {
    const path = state.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    enterApp(await api(path, { method: "POST", body }));
  } catch (error) {
    showErrors(authError, error.details, error.message);
  } finally {
    authSubmit.disabled = false;
  }
}

function selectedMonth() {
  const input = document.querySelector("#report-month");
  if (!input.value) input.value = monthKey();
  return input.value;
}

async function loadPage() {
  const month = selectedMonth();
  document.querySelector("#dash-month").textContent = monthLabel(month);
  try {
    const [summary, entries] = await Promise.all([
      api(`/api/summary?month=${encodeURIComponent(month)}`),
      api("/api/entries"),
    ]);
    state.summary = summary;
    state.entries = entries;
    renderSummary(summary, entries);
    renderChart(summary);
    renderDonut(summary);
    renderCategories(document.querySelector("#income-cats"), summary.categories.income, "income", "No income this month.");
    renderEntries();
  } catch (error) {
    showBanner(error.message, "err");
  }
}

function renderSummary(summary, entries) {
  const income = document.querySelector("#stat-income");
  const expense = document.querySelector("#stat-expense");
  const balance = document.querySelector("#stat-balance");
  const previous = summary.trend[summary.trend.length - 2];
  const previousBalance = previous.incomeCents - previous.expenseCents;
  income.textContent = money(summary.incomeCents);
  expense.textContent = money(summary.expenseCents);
  balance.textContent = money(summary.balanceCents);
  income.className = summary.incomeCents > 0 ? "pos" : "";
  expense.className = summary.expenseCents > 0 ? "neg" : "";
  balance.className = summary.balanceCents < 0 ? "neg" : "";
  document.querySelector("#stat-prev").textContent = money(previousBalance);
  document.querySelector("#stat-prev").className = previousBalance < 0 ? "neg" : "";
  document.querySelector("#prev-label").textContent = monthLabel(previous.month);
  document.querySelector("#income-note").textContent = countLabel(entryCount(entries, summary.month, "income"), "income");
  document.querySelector("#expense-note").textContent = countLabel(entryCount(entries, summary.month, "expense"), "expense");

  const note = document.querySelector("#balance-note");
  const diff = summary.balanceCents - previousBalance;
  note.className = "stat-note";
  if (diff > 0) note.classList.add("up");
  if (diff < 0) note.classList.add("down");
  if (diff === 0) note.textContent = `Same as ${shortMonth(previous.month)}.`;
  else note.textContent = `${diff > 0 ? "Up" : "Down"} ${money(Math.abs(diff))} from ${shortMonth(previous.month)}.`;

  const sentence = document.querySelector("#report-sentence");
  const label = monthLabel(summary.month);
  if (summary.incomeCents === 0 && summary.expenseCents === 0) sentence.textContent = `Nothing recorded in ${label}.`;
  else if (summary.balanceCents > 0) sentence.textContent = `You kept ${money(summary.balanceCents)} in ${label}.`;
  else if (summary.balanceCents < 0) sentence.textContent = `You spent ${money(Math.abs(summary.balanceCents))} more than you earned in ${label}.`;
  else sentence.textContent = `Income and expenses matched in ${label}.`;
}

function renderChart(summary) {
  const chart = document.querySelector("#chart");
  const axis = document.querySelector("#y-axis");
  const note = document.querySelector("#chart-note");
  chart.replaceChildren();
  axis.replaceChildren();
  const peak = Math.max(0, ...summary.trend.flatMap((item) => [item.incomeCents, item.expenseCents]));
  const max = peak === 0 ? 10000 : niceMax(peak);
  note.hidden = peak !== 0;
  for (const step of [4, 3, 2, 1, 0]) {
    const tick = document.createElement("span");
    tick.textContent = axisMoney((max * step) / 4);
    axis.append(tick);
  }
  for (const item of summary.trend) {
    const col = document.createElement("div");
    col.className = "chart-col";
    const bars = document.createElement("div");
    bars.className = "bars";
    bars.append(bar("income", item.incomeCents, max), bar("expense", item.expenseCents, max));
    const label = document.createElement("span");
    label.textContent = shortMonth(item.month);
    col.append(bars, label);
    chart.append(col);
  }
}

function bar(kind, cents, max) {
  const element = document.createElement("div");
  element.className = `bar ${kind}`;
  const height = cents === 0 ? 0 : Math.max(4, Math.round((cents / max) * 168));
  element.style.height = `${height}px`;
  element.title = `${kind === "income" ? "Income" : "Expenses"} ${money(cents)}`;
  return element;
}

function renderCategories(container, rows, kind, emptyText) {
  container.replaceChildren();
  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "quiet";
    p.textContent = emptyText;
    container.append(p);
    return;
  }
  const max = Math.max(...rows.map((row) => row.totalCents), 1);
  for (const row of rows) {
    const block = document.createElement("div");
    block.className = "cat";
    const top = document.createElement("div");
    top.className = "cat-top";
    const name = document.createElement("span");
    name.textContent = row.category;
    const total = document.createElement("span");
    total.textContent = money(row.totalCents);
    top.append(name, total);
    const track = document.createElement("div");
    track.className = "track";
    const fill = document.createElement("div");
    fill.className = `fill ${kind}`;
    fill.style.width = `${Math.max(4, Math.round((row.totalCents / max) * 100))}%`;
    track.append(fill);
    block.append(top, track);
    container.append(block);
  }
}

function renderDonut(summary) {
  const host = document.querySelector("#donut");
  const topLine = document.querySelector("#top-category");
  host.replaceChildren();
  const rows = summary.categories.expense;
  const total = rows.reduce((sum, row) => sum + row.totalCents, 0);
  if (!total) {
    const p = document.createElement("p");
    p.className = "quiet";
    p.textContent = "No expenses this month.";
    host.append(p);
    topLine.hidden = true;
    return;
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 160 160");
  svg.setAttribute("class", "donut");
  svg.setAttribute("aria-hidden", "true");
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("transform", "rotate(-90 80 80)");
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  rows.forEach((row, index) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "80");
    circle.setAttribute("cy", "80");
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", colorFor(row.category));
    circle.setAttribute("stroke-width", "16");
    if (rows.length > 1) {
      const gap = 4;
      const dash = Math.max(2, (row.totalCents / total) * circumference - gap);
      circle.setAttribute("stroke-dasharray", `${dash} ${circumference - dash}`);
      circle.setAttribute("stroke-dashoffset", String(-offset));
      offset += (row.totalCents / total) * circumference;
    }
    circle.setAttribute("stroke-linecap", rows.length > 1 ? "butt" : "butt");
    group.append(circle);
    void index;
  });
  svg.append(group);

  const legend = document.createElement("div");
  legend.className = "donut-legend";
  for (const row of rows) {
    const item = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = "dot";
    dot.style.background = colorFor(row.category);
    item.append(dot, document.createTextNode(row.category));
    legend.append(item);
  }
  const wrap = document.createElement("div");
  wrap.className = "donut-wrap";
  wrap.append(svg, legend);
  host.append(wrap);

  const top = rows[0];
  const pct = Math.round((top.totalCents / total) * 100);
  topLine.hidden = false;
  topLine.textContent = `Top category: ${top.category} (${pct}% of expenses)`;
}

function visibleEntries() {
  const query = document.querySelector("#filter-search").value.trim().toLowerCase();
  const category = document.querySelector("#filter-category").value;
  const month = document.querySelector("#filter-month").value;
  return state.entries.filter((entry) => {
    if (state.kindFilter && entry.kind !== state.kindFilter) return false;
    if (category && entry.category !== category) return false;
    if (month && !entry.occurredOn.startsWith(month)) return false;
    if (!query) return true;
    return `${entry.memo} ${entry.category}`.toLowerCase().includes(query);
  });
}

function renderEntries() {
  const body = document.querySelector("#entries-body");
  const empty = document.querySelector("#entries-empty");
  const rows = visibleEntries();
  body.replaceChildren();
  if (!rows.length) {
    empty.hidden = false;
    const filtered = state.kindFilter
      || document.querySelector("#filter-category").value
      || document.querySelector("#filter-month").value
      || document.querySelector("#filter-search").value.trim();
    empty.textContent = filtered
      ? "No entries match this filter."
      : "No entries yet. Add income or an expense.";
    return;
  }
  empty.hidden = true;
  for (const entry of rows) {
    const tr = document.createElement("tr");
    if (entry.id === state.flashId) tr.className = "flash";

    const what = document.createElement("td");
    const txn = document.createElement("div");
    txn.className = "txn";
    const icon = document.createElement("span");
    icon.className = "txn-icon";
    icon.style.color = colorFor(entry.category);
    icon.style.background = `${colorFor(entry.category)}22`;
    icon.append(glyph(entry.category));
    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.memo || entry.category;
    const sub = document.createElement("span");
    sub.className = "muted";
    sub.textContent = entry.kind === "income" ? "Income" : "Expense";
    text.append(title, sub);
    txn.append(icon, text);
    what.append(txn);

    const category = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = entry.category;
    category.append(pill);

    const date = document.createElement("td");
    date.textContent = formatDay(entry.occurredOn);

    const amount = document.createElement("td");
    amount.className = `amount ${entry.kind}`;
    amount.textContent = signedMoney(entry.kind, entry.amountCents);

    const actions = document.createElement("td");
    actions.className = "actions-col";
    const group = document.createElement("div");
    group.className = "actions";
    group.append(
      iconButton("Edit", "edit", () => openEntry(entry)),
      iconButton("Delete", "trash", () => openDelete(entry), true)
    );
    actions.append(group);
    tr.append(what, category, date, amount, actions);
    body.append(tr);
  }
}

function iconButton(label, name, onClick, danger) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = danger ? "icon-btn danger" : "icon-btn";
  button.setAttribute("aria-label", label);
  button.append(glyph(name));
  button.addEventListener("click", onClick);
  return button;
}

function fillCategories(kind, selected) {
  const select = entryForm.elements.category;
  select.replaceChildren();
  for (const category of state.categories[kind] || []) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.append(option);
  }
  if (selected && [...select.options].some((option) => option.value === selected)) {
    select.value = selected;
  }
}

function openModal() {
  bannerEl.hidden = true;
  modalEl.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal() {
  if (state.busy) return;
  modalEl.hidden = true;
  document.body.classList.remove("modal-open");
  state.editing = null;
  state.deleting = null;
  formErrorsEl.hidden = true;
}

function openEntry(entry, presetKind) {
  const current = entry || null;
  state.editing = current;
  state.deleting = null;
  entryForm.hidden = false;
  confirmEl.hidden = true;
  entryForm.reset();
  formErrorsEl.hidden = true;
  const kind = current?.kind || presetKind || "expense";
  entryForm.elements.kind.value = kind;
  fillCategories(kind, current?.category);
  entryForm.elements.occurredOn.value = current?.occurredOn || todayISO();
  entryForm.elements.amount.value = current ? (current.amountCents / 100).toFixed(2) : "";
  entryForm.elements.memo.value = current?.memo || "";
  document.querySelector("#modal-title").textContent = current
    ? "Edit entry"
    : kind === "income" ? "Add income" : "Add expense";
  saveBtn.textContent = current ? "Save changes" : "Save";
  openModal();
  entryForm.elements.amount.focus();
}

function openDelete(entry) {
  state.deleting = entry;
  state.editing = null;
  entryForm.hidden = true;
  confirmEl.hidden = false;
  document.querySelector("#modal-title").textContent = "Delete this entry?";
  document.querySelector("#confirm-text").textContent =
    `Remove ${signedMoney(entry.kind, entry.amountCents)} · ${entry.category} on ${formatDay(entry.occurredOn)}.`;
  openModal();
}

entryForm.elements.kind.addEventListener("change", () => {
  fillCategories(entryForm.elements.kind.value);
});

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy) return;
  const amountCents = dollarsToCents(entryForm.elements.amount.value);
  if (amountCents === null) {
    showErrors(formErrorsEl, ["Enter an amount greater than 0, such as 24.50."]);
    return;
  }
  const body = {
    kind: entryForm.elements.kind.value,
    amountCents,
    category: entryForm.elements.category.value,
    occurredOn: entryForm.elements.occurredOn.value,
    memo: entryForm.elements.memo.value,
  };
  state.busy = true;
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  const editing = state.editing;
  try {
    const saved = editing
      ? await api(`/api/entries/${editing.id}`, { method: "PUT", body })
      : await api("/api/entries", { method: "POST", body });
    state.flashId = saved.id;
    state.busy = false;
    closeModal();
    showBanner(editing ? "Entry updated." : body.kind === "income" ? "Income added." : "Expense added.", "ok");
    await loadPage();
  } catch (error) {
    showErrors(formErrorsEl, error.details, error.message);
  } finally {
    state.busy = false;
    saveBtn.disabled = false;
    saveBtn.textContent = editing ? "Save changes" : "Save";
  }
});

document.querySelector("#confirm-delete").addEventListener("click", async () => {
  if (!state.deleting || state.busy) return;
  const entry = state.deleting;
  state.busy = true;
  const button = document.querySelector("#confirm-delete");
  button.disabled = true;
  try {
    await api(`/api/entries/${entry.id}`, { method: "DELETE" });
    state.busy = false;
    closeModal();
    showBanner("Entry deleted.", "ok");
    await loadPage();
  } catch (error) {
    showBanner(error.message, "err");
  } finally {
    state.busy = false;
    button.disabled = false;
  }
});

document.querySelector("#show-login").addEventListener("click", () => setAuthMode("login"));
document.querySelector("#show-register").addEventListener("click", () => setAuthMode("register"));
authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const body = {
    email: authForm.elements.email.value,
    password: authForm.elements.password.value,
  };
  if (state.authMode === "register") body.name = authForm.elements.name.value;
  submitAuth(body);
});

function setNav(open) {
  const narrow = window.matchMedia("(max-width: 800px)").matches;
  const show = open && narrow;
  appEl.classList.toggle("nav-open", show);
  document.body.classList.toggle("nav-open", show);
  document.querySelector("#rail").inert = !show;
  menuToggle.setAttribute("aria-expanded", String(show));
  menuToggle.setAttribute("aria-label", show ? "Close menu" : "Open menu");
  navScrim.hidden = !show;
}

function setKindFilter(kind) {
  state.kindFilter = kind;
  for (const button of document.querySelectorAll("#kind-filter button")) {
    const on = button.dataset.kind === kind;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
  }
  renderEntries();
}

const menuToggle = document.querySelector("#menu-toggle");
const navScrim = document.querySelector("#nav-scrim");
menuToggle.addEventListener("click", () => setNav(!appEl.classList.contains("nav-open")));
navScrim.addEventListener("click", () => setNav(false));
document.querySelector("#menu-close").addEventListener("click", () => setNav(false));
for (const link of document.querySelectorAll(".drawer-nav a")) {
  link.addEventListener("click", () => setNav(false));
}
window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 800px)").matches) setNav(false);
});

for (const button of document.querySelectorAll(".logout")) {
  button.addEventListener("click", async () => {
    setNav(false);
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* still leave the app */ }
    state.user = null;
    authForm.reset();
    showScreen("auth");
  });
}

for (const button of document.querySelectorAll("[data-add]")) {
  button.addEventListener("click", () => {
    setNav(false);
    openEntry(null, button.dataset.add);
  });
}

for (const button of document.querySelectorAll("#kind-filter button")) {
  button.addEventListener("click", () => setKindFilter(button.dataset.kind));
}
document.querySelector("#filter-search").addEventListener("input", renderEntries);
document.querySelector("#filter-category").addEventListener("change", renderEntries);
document.querySelector("#filter-month").addEventListener("change", renderEntries);
document.querySelector("#clear-filters").addEventListener("click", () => {
  document.querySelector("#filter-search").value = "";
  document.querySelector("#filter-category").value = "";
  document.querySelector("#filter-month").value = "";
  setKindFilter("");
});
document.querySelector("#report-month").addEventListener("change", loadPage);
document.querySelector("#close-modal").addEventListener("click", closeModal);
document.querySelector("#cancel-form").addEventListener("click", closeModal);
document.querySelector("#cancel-delete").addEventListener("click", closeModal);
modalEl.addEventListener("click", (event) => { if (event.target === modalEl) closeModal(); });
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!modalEl.hidden) closeModal();
  else setNav(false);
});

setNav(false);

async function boot() {
  try {
    enterApp(await api("/api/auth/me"));
  } catch {
    showScreen("auth");
  }
}

boot();
