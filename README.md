# Daybook

Daybook is my expense tracker. I can create an account, write down income and expenses, and see what is left for the month. The numbers on the page come from records I saved. There is no sample data and no made-up budget.

## How I would explain it

If I had to talk through the project, this is what I would say.

I built a full-stack web app. The screen is HTML, CSS, and JavaScript in the `public` folder. The server is Node.js with Express, in `server.js`. Records are stored in SQLite, in `data/daybook.db`, which is created the first time the app runs. That file stays on my computer, so a refresh does not wipe the book.

A person signs up with a name, an email, and a password of at least 8 characters. I do not save the password as plain text. I hash it with scrypt. After sign-in, the server sets an HttpOnly cookie named `daybook`. That cookie is the session, and it lasts 7 days. Log out deletes the session.

Every row is tied to the signed-in user. A second account cannot see or delete the first account’s entries. Amounts are stored as cents, so $24.50 is 2450 cents and does not get rounded badly.

The page has four parts:

- **Overview.** For the month I pick, it shows what is left, income, expenses, and what was left the month before. The line under the heading is the same idea in a sentence, for example “You kept $600.00 in October 2026.”
- **Cash flow.** A bar chart of income and expenses for the six months ending on the month I picked. Green is income. Red is expenses. Empty months stay flat.
- **Categories.** Spending share is a ring built from this month’s expenses. If I have not added an expense, it says so. Income by category is the list next to it.
- **Transactions.** The full list. I can search a note or category, filter by income or expenses, pick a category, and pick a month. Edit and delete are on each row.

On a narrow screen the sidebar is gone. The three-line button at the top left opens Overview, Cash flow, Categories, Transactions, Add income, Add expense, and Log out.

Income categories are Salary, Freelance, Gift, Refund, and Other. Expense categories are Rent, Groceries, Transport, Utilities, Dining, Health, Shopping, Entertainment, and Other.

## Run it

Node.js 22.5 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000 and create an account.

If `npm start` says `EADDRINUSE` and port 3000, Daybook is already running. Open the address above. A second `npm start` cannot use the same port.

## What I would test in the browser

I would use a new email for this, and a password of at least 8 characters.

1. Create an account. The dashboard opens. A month with no records shows $0.00.
2. Add income. Category Salary, amount 600, today’s date, note “Pay”. Income and “Left this month” become $600.00. The October bar is green. The transactions list shows +$600.00.
3. Add an expense. Category Groceries, amount 24.50. Expenses become $24.50. Left this month becomes $575.50. Spending share shows Groceries.
4. Change the month picker to a month with no records. The totals drop to zero. Change it back and the two records return.
5. In Transactions, search “Pay”. Only the salary row stays. Click Expenses. Only the grocery row stays. Click Clear. Both rows come back.
6. Edit the grocery note and save. The row shows the new note.
7. Delete the grocery row and confirm. It leaves the list, and the expense total goes back to $0.00.
8. Open a private window and create a second account. That account’s list is empty. It must not show the first account’s salary.
9. Log out. The sign-in page comes back. Sign in with the same email and password. The saved records are still there.
10. Shrink the window until the three-line button appears. Open it, go to Transactions, and check that the menu closes and the row is still readable.

These should fail on purpose:

- Sign in with the wrong password. I stay on the sign-in page.
- Try to save an amount of 0. The form asks for an amount greater than 0.
- Use a password shorter than 8 characters. The form does not submit.

## What `npm test` checks

```bash
npm test
```

The test uses an empty database in memory. It does not touch `data/daybook.db`. It checks that:

- a visitor who is not signed in cannot list entries
- register, add, list, monthly summary, and update work
- a second user cannot see or delete the first user’s entry
- log out ends the session
- a wrong password is rejected
- an entry with a bad amount, a bad category, and a bad date is rejected

## Files

| File | What it is |
| --- | --- |
| `server.js` | Accounts, sessions, entries, and the monthly summary |
| `public/index.html` | The page |
| `public/styles.css` | The layout |
| `public/app.js` | Sign-in, the dashboard, and the transaction list |
| `test/api.test.js` | The checks above |
| `data/daybook.db` | Created locally when the app runs. It is listed in `.gitignore`, so accounts and records are not uploaded |

## API

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Current user |
| GET | `/api/entries` | List income and expenses |
| POST | `/api/entries` | Add a record |
| PUT | `/api/entries/:id` | Update a record |
| DELETE | `/api/entries/:id` | Delete a record |
| GET | `/api/summary?month=YYYY-MM` | Totals, categories, and the six-month trend |
