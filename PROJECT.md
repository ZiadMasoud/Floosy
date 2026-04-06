# Floosy - Project Overview

**Last Updated:** Auto-generated on project changes  
**Live Demo:** https://ziadmasoud.github.io/Floosy

---

## What is Floosy?

Floosy is a **personal finance tracking web application** that helps individuals manage income, expenses, and savings goals. It's a client-side only app that stores all data locally in the browser using IndexedDB - no server, no accounts, complete privacy.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Monthly income/spending/balance KPIs with recent transactions |
| **Transaction Management** | Add/edit/delete income, spending, and accounts receivable records |
| **Combined Transactions** | Group multiple purchases under one transaction (e.g., "Weekly Shopping") |
| **Categories** | Custom spending/income categories with type classification |
| **People Tracking** | Tag transactions by person (useful for families/roommates) |
| **Analytics** | Charts for spending by category, income vs spending trends, person-based analysis |
| **Savings Accounts** | Multiple savings goals with deposit/withdrawal tracking |
| **Data Management** | Export/import JSON, selective reset (by date range or data type) |
| **Privacy Mode** | Hide amounts with a toggle (useful in public) |

---

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Storage:** IndexedDB (client-side only)
- **Charts:** Chart.js
- **UI:** Font Awesome icons, Toastify.js for notifications
- **No build step required** - open `index.html` and it works

---

## File Structure

```
Floosy/
├── index.html              # Main app shell + all UI markup
├── css/
│   └── style.css           # All styling, responsive design
├── js/
│   ├── app.js              # Main application logic (~4000 lines)
│   ├── db.js               # IndexedDB wrapper
│   └── monthly-summary.js  # Monthly aggregation logic
├── data/
│   └── Floosy_*.json       # Sample data exports
└── README.md               # Full documentation
```

---

## Key UI Sections

1. **Dashboard** - Hero metrics, KPI cards, transaction list with filters
2. **Analytics** - Category pie chart, income/spending bar chart, monthly trends, person breakdown
3. **Savings** - Account cards with balance and paginated transaction history
4. **Settings** - Manage categories/people, import/export data, selective reset

---

## Data Model

**Records** (transactions):
- `id`, `date`, `type` (spending/income/account_receivable)
- `category`, `person` (optional), `amount`
- `item`, `notes`, `quantity`, `savingsAccountId`
- `isCombined`, `combinedTransactions[]` (for grouped purchases)

**Savings Accounts**:
- `id`, `name`, `balance`, `createdAt`

**Savings Transactions**:
- `id`, `accountId`, `type` (deposit/withdrawal), `amount`, `date`, `notes`

---

## Quick Start for Development

1. Open `index.html` in any modern browser
2. No server needed - runs entirely client-side
3. All changes auto-save to IndexedDB

---

## Deployment

The app is deployed to GitHub Pages at `https://ziadmasoud.github.io/Floosy`. Any push to the main branch triggers an automatic update.

---

## Recent Changes

*Track major updates here manually or via git log*

---

## Notes

- Data never leaves the browser - all storage is local
- Sample data available in `data/` folder for testing
- Mobile-first responsive design with bottom navigation on small screens
