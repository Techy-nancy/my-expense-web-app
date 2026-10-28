const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const CATEGORIES = {
  income: ["Salary", "Freelance", "Gift", "Refund", "Other"],
  expense: ["Rent", "Groceries", "Transport", "Utilities", "Dining", "Health", "Shopping", "Entertainment", "Other"],
};

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function openDatabase(filename) {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      category TEXT NOT NULL,
      memo TEXT NOT NULL DEFAULT '',
      occurred_on TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries (user_id, occurred_on);
  `);
  return db;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash || hash.length % 2 !== 0) return false;
  const actual = Buffer.from(hash, "hex");
  const expected = crypto.scryptSync(password, salt, actual.length);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function publicUser(row) {
  return { id: Number(row.id), name: row.name, email: row.email };
}

function authPayload(row) {
  return { user: publicUser(row), categories: CATEGORIES };
}

function toEntry(row) {
  return {
    id: Number(row.id),
    kind: row.kind,
    amountCents: Number(row.amount_cents),
    category: row.category,
    memo: row.memo,
    occurredOn: row.occurred_on,
  };
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function setSessionCookie(res, token) {
  const maxAge = Math.floor(SESSION_MS / 1000);
  res.setHeader(
    "Set-Cookie",
    `daybook=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "daybook=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function parseMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month] = String(value).split("-").map(Number);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseAccount(body, { requireName }) {
  const source = body && typeof body === "object" ? body : {};
  const errors = [];
  const name = String(source.name ?? "").trim().replace(/\s+/g, " ");
  const email = String(source.email ?? "").trim().toLowerCase();
  const password = String(source.password ?? "");

  if (requireName && (name.length < 2 || name.length > 60)) {
    errors.push("Enter your name (2–60 characters).");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    errors.push("Enter a valid email address.");
  }
  if (password.length < 8 || password.length > 72) {
    errors.push("Use a password of 8–72 characters.");
  }
  if (errors.length) return { errors };
  return { value: { name, email, password } };
}

function parseEntry(body) {
  const source = body && typeof body === "object" ? body : {};
  const errors = [];
  const kind = String(source.kind ?? "");
  const category = String(source.category ?? "").trim();
  const memo = String(source.memo ?? "").trim().replace(/\s+/g, " ");
  const occurredOn = String(source.occurredOn ?? "");
  const amountCents = Number(source.amountCents);

  if (kind !== "income" && kind !== "expense") {
    errors.push("Choose income or expense.");
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 100000000) {
    errors.push("Enter an amount greater than 0, with up to 2 decimals.");
  }
  if (kind === "income" || kind === "expense") {
    if (!CATEGORIES[kind].includes(category)) errors.push("Choose a category from the list.");
  }
  if (memo.length > 140) errors.push("Keep the note under 140 characters.");
  if (!isRealDate(occurredOn)) errors.push("Choose a valid date.");

  if (errors.length) return { errors };
  return { value: { kind, category, memo, occurredOn, amountCents } };
}

function createApp(db) {
  const app = express();
  app.locals.db = db;

  const findUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
  const findUserById = db.prepare("SELECT * FROM users WHERE id = ?");
  const insertUser = db.prepare(
    "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
  );
  const insertSession = db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  );
  const deleteSession = db.prepare("DELETE FROM sessions WHERE token = ?");
  const findSessionUser = db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at > ?
  `);
  const findEntry = db.prepare("SELECT * FROM entries WHERE id = ? AND user_id = ?");
  const insertEntry = db.prepare(`
    INSERT INTO entries (user_id, kind, amount_cents, category, memo, occurred_on, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateEntry = db.prepare(`
    UPDATE entries
    SET kind = ?, amount_cents = ?, category = ?, memo = ?, occurred_on = ?
    WHERE id = ? AND user_id = ?
  `);
  const deleteEntry = db.prepare("DELETE FROM entries WHERE id = ? AND user_id = ?");

  function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + SESSION_MS).toISOString();
    insertSession.run(token, userId, expires);
    setSessionCookie(res, token);
  }

  function requireUser(req, res, next) {
    const token = readCookie(req, "daybook");
    const row = token ? findSessionUser.get(token, new Date().toISOString()) : undefined;
    if (!row) return res.status(401).json({ message: "Sign in to continue." });
    req.user = row;
    req.sessionToken = token;
    next();
  }

  app.use(express.json());

  app.post("/api/auth/register", (req, res) => {
    const parsed = parseAccount(req.body, { requireName: true });
    if (parsed.errors) {
      return res.status(400).json({ message: "Check the form and try again.", errors: parsed.errors });
    }
    const { name, email, password } = parsed.value;
    if (findUserByEmail.get(email)) {
      return res.status(409).json({
        message: "An account with that email already exists.",
        errors: ["An account with that email already exists."],
      });
    }

    const now = new Date().toISOString();
    let info;
    try {
      info = insertUser.run(name, email, hashPassword(password), now);
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) {
        return res.status(409).json({
          message: "An account with that email already exists.",
          errors: ["An account with that email already exists."],
        });
      }
      throw error;
    }

    const user = findUserById.get(Number(info.lastInsertRowid));
    startSession(res, user.id);
    res.status(201).json(authPayload(user));
  });

  app.post("/api/auth/login", (req, res) => {
    const parsed = parseAccount(req.body, { requireName: false });
    if (parsed.errors) {
      return res.status(400).json({ message: "Check the form and try again.", errors: parsed.errors });
    }
    const user = findUserByEmail.get(parsed.value.email);
    if (!user || !verifyPassword(parsed.value.password, user.password_hash)) {
      return res.status(401).json({
        message: "Email or password is incorrect.",
        errors: ["Email or password is incorrect."],
      });
    }
    startSession(res, user.id);
    res.json(authPayload(user));
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = readCookie(req, "daybook");
    if (token) deleteSession.run(token);
    clearSessionCookie(res);
    res.status(204).end();
  });

  app.get("/api/auth/me", requireUser, (req, res) => {
    res.json(authPayload(req.user));
  });

  app.get("/api/entries", requireUser, (req, res) => {
    const kind = req.query.kind === "income" || req.query.kind === "expense" ? req.query.kind : "";
    const month = req.query.month ? parseMonth(req.query.month) : "";
    if (req.query.month && !month) {
      return res.status(400).json({ message: "Choose a valid month." });
    }

    let limit = null;
    if (req.query.limit !== undefined) {
      limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1) {
        return res.status(400).json({ message: "Limit must be a positive number." });
      }
      limit = Math.min(limit, 200);
    }

    const clauses = ["user_id = ?"];
    const params = [req.user.id];
    if (kind) {
      clauses.push("kind = ?");
      params.push(kind);
    }
    if (month) {
      const range = monthRange(month);
      clauses.push("occurred_on >= ? AND occurred_on <= ?");
      params.push(range.start, range.end);
    }

    let sql = `SELECT * FROM entries WHERE ${clauses.join(" AND ")} ORDER BY occurred_on DESC, id DESC`;
    if (limit) {
      sql += " LIMIT ?";
      params.push(limit);
    }
    res.json(db.prepare(sql).all(...params).map(toEntry));
  });

  app.post("/api/entries", requireUser, (req, res) => {
    const parsed = parseEntry(req.body);
    if (parsed.errors) {
      return res.status(400).json({ message: "Check the form and try again.", errors: parsed.errors });
    }
    const { kind, amountCents, category, memo, occurredOn } = parsed.value;
    const info = insertEntry.run(
      req.user.id,
      kind,
      amountCents,
      category,
      memo,
      occurredOn,
      new Date().toISOString()
    );
    res.status(201).json(toEntry(findEntry.get(Number(info.lastInsertRowid), req.user.id)));
  });

  app.put("/api/entries/:id", requireUser, (req, res) => {
    const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : 0;
    if (!id || !findEntry.get(id, req.user.id)) {
      return res.status(404).json({ message: "Entry not found." });
    }
    const parsed = parseEntry(req.body);
    if (parsed.errors) {
      return res.status(400).json({ message: "Check the form and try again.", errors: parsed.errors });
    }
    const { kind, amountCents, category, memo, occurredOn } = parsed.value;
    updateEntry.run(kind, amountCents, category, memo, occurredOn, id, req.user.id);
    res.json(toEntry(findEntry.get(id, req.user.id)));
  });

  app.delete("/api/entries/:id", requireUser, (req, res) => {
    const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : 0;
    const info = id ? deleteEntry.run(id, req.user.id) : { changes: 0 };
    if (Number(info.changes) === 0) return res.status(404).json({ message: "Entry not found." });
    res.status(204).end();
  });

  app.get("/api/summary", requireUser, (req, res) => {
    const month = parseMonth(req.query.month || currentMonth());
    if (!month) return res.status(400).json({ message: "Choose a valid month." });

    const range = monthRange(month);
    const totals = db.prepare(`
      SELECT kind, SUM(amount_cents) AS total
      FROM entries
      WHERE user_id = ? AND occurred_on >= ? AND occurred_on <= ?
      GROUP BY kind
    `).all(req.user.id, range.start, range.end);

    let incomeCents = 0;
    let expenseCents = 0;
    for (const row of totals) {
      if (row.kind === "income") incomeCents = Number(row.total);
      if (row.kind === "expense") expenseCents = Number(row.total);
    }

    const categoryRows = db.prepare(`
      SELECT kind, category, SUM(amount_cents) AS total
      FROM entries
      WHERE user_id = ? AND occurred_on >= ? AND occurred_on <= ?
      GROUP BY kind, category
      ORDER BY total DESC, category
    `).all(req.user.id, range.start, range.end);

    const categories = { income: [], expense: [] };
    for (const row of categoryRows) {
      categories[row.kind].push({ category: row.category, totalCents: Number(row.total) });
    }

    const trendStart = monthRange(shiftMonth(month, -5)).start;
    const trendRows = db.prepare(`
      SELECT substr(occurred_on, 1, 7) AS month, kind, SUM(amount_cents) AS total
      FROM entries
      WHERE user_id = ? AND occurred_on >= ? AND occurred_on <= ?
      GROUP BY month, kind
    `).all(req.user.id, trendStart, range.end);

    const trendMap = new Map();
    for (let i = 5; i >= 0; i -= 1) trendMap.set(shiftMonth(month, -i), { incomeCents: 0, expenseCents: 0 });
    for (const row of trendRows) {
      const bucket = trendMap.get(row.month);
      if (!bucket) continue;
      bucket[row.kind === "income" ? "incomeCents" : "expenseCents"] = Number(row.total);
    }

    res.json({
      month,
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
      categories,
      trend: [...trendMap.entries()].map(([key, totalsForMonth]) => ({
        month: key,
        ...totalsForMonth,
      })),
    });
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found." });
  });

  app.use(express.static(path.join(__dirname, "public"), {
    etag: false,
    maxAge: 0,
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store");
    },
  }));

  app.use((error, _req, res, _next) => {
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Request body must be JSON." });
    }
    console.error(error);
    res.status(500).json({ message: "Something went wrong on the server." });
  });

  return app;
}

function main() {
  const dbPath = process.env.DAYBOOK_DB || path.join(__dirname, "data", "daybook.db");
  const db = openDatabase(dbPath);
  const port = Number(process.env.PORT) || 3000;
  createApp(db).listen(port, () => {
    console.log(`Daybook running at http://localhost:${port}`);
  });
}

if (require.main === module) main();

module.exports = { createApp, openDatabase, CATEGORIES };
