const assert = require("node:assert/strict");
const http = require("node:http");
const { before, after, test } = require("node:test");
const { createApp, openDatabase } = require("../server");

let server;
let base;

before(async () => {
  const app = createApp(openDatabase(":memory:"));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const setCookie = response.headers.getSetCookie?.() || [];
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    cookie: setCookie.map((value) => value.split(";")[0]).join("; "),
  };
}

const expense = {
  kind: "expense",
  amountCents: 1850,
  category: "Groceries",
  memo: "Market",
  occurredOn: "2026-10-08",
};

test("requires sign-in, then keeps each user's books separate", async () => {
  const guest = await request("/api/entries");
  assert.equal(guest.status, 401);

  const ada = await request("/api/auth/register", {
    method: "POST",
    body: { name: "Ada Lovelace", email: "ada@daybook.test", password: "ledger-pass" },
  });
  assert.equal(ada.status, 201);
  assert.equal(ada.body.user.email, "ada@daybook.test");
  assert.ok(ada.cookie.includes("daybook="));

  const created = await request("/api/entries", { method: "POST", cookie: ada.cookie, body: expense });
  assert.equal(created.status, 201);
  assert.equal(created.body.amountCents, 1850);

  const listed = await request("/api/entries", { cookie: ada.cookie });
  assert.equal(listed.body.length, 1);

  const summary = await request("/api/summary?month=2026-10", { cookie: ada.cookie });
  assert.equal(summary.status, 200);
  assert.equal(summary.body.expenseCents, 1850);
  assert.equal(summary.body.incomeCents, 0);
  assert.equal(summary.body.balanceCents, -1850);
  assert.equal(summary.body.categories.expense[0].category, "Groceries");
  assert.equal(summary.body.trend.length, 6);

  const updated = await request(`/api/entries/${created.body.id}`, {
    method: "PUT",
    cookie: ada.cookie,
    body: { ...expense, amountCents: 2000, memo: "Market restock" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.memo, "Market restock");

  const ben = await request("/api/auth/register", {
    method: "POST",
    body: { name: "Ben", email: "ben@daybook.test", password: "another-pass" },
  });
  const benList = await request("/api/entries", { cookie: ben.cookie });
  assert.deepEqual(benList.body, []);
  const stolen = await request(`/api/entries/${created.body.id}`, { method: "DELETE", cookie: ben.cookie });
  assert.equal(stolen.status, 404);

  const removed = await request(`/api/entries/${created.body.id}`, { method: "DELETE", cookie: ada.cookie });
  assert.equal(removed.status, 204);

  const loggedOut = await request("/api/auth/logout", { method: "POST", cookie: ada.cookie });
  assert.equal(loggedOut.status, 204);
  const after = await request("/api/auth/me", { cookie: ada.cookie });
  assert.equal(after.status, 401);
});

test("rejects bad sign-in and invalid entries", async () => {
  await request("/api/auth/register", {
    method: "POST",
    body: { name: "Chi", email: "chi@daybook.test", password: "good-password" },
  });

  const badPassword = await request("/api/auth/login", {
    method: "POST",
    body: { email: "chi@daybook.test", password: "wrong-password" },
  });
  assert.equal(badPassword.status, 401);

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "chi@daybook.test", password: "good-password" },
  });
  assert.equal(login.status, 200);

  const invalid = await request("/api/entries", {
    method: "POST",
    cookie: login.cookie,
    body: { kind: "expense", amountCents: 0, category: "Spaceship", memo: "", occurredOn: "nope" },
  });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.errors.length >= 2);
});
