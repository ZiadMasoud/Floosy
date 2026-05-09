# Floosy - Developer & AI Agent Guide

This document provides a comprehensive technical overview of the Floosy codebase to help AI agents and developers understand the project structure, data models, and core logic.

---

## 📂 Project Structure

| File | Responsibility |
| :--- | :--- |
| `index.html` | The main entry point and UI skeleton. Contains all modal structures, tab containers, and script includes. |
| `css/style.css` | Comprehensive design system. Uses CSS variables for themes and includes responsive breakpoints (mobile-first). |
| `js/db.js` | IndexedDB abstraction layer. Handles database initialization, migrations, and basic CRUD (Get, Add, Update, Remove). |
| `js/app.js` | The "brain" of the app. Manages global state, DOM event listeners, business logic, and UI rendering. |
| `js/monthly-summary.js` | Specialized module for generating PDF reports using `jsPDF`. |

---

## 💾 Data Architecture (IndexedDB)

The database is named `HouseSpendingDB`. All stores use `id` as an auto-incrementing `keyPath`.

### Core Stores
- **`records`**: Primary transaction storage.
  - Fields: `id`, `date` (ISO), `type` (spending/income/account_receivable), `amount`, `item`, `category`, `person`, `notes`, `quantity`, `savingsAccountId`.
  - Combined Logic: If `formatType: 'combined'`, it contains an array of `combinedTransactions`.
- **`categories`**: User-defined categories.
  - Fields: `id`, `name`, `type` (spending/income).
- **`people`**: User-defined people for tagging.
  - Fields: `id`, `name`.

### Feature Stores
- **`savingsAccounts`**: Tracks different savings buckets.
  - Fields: `id`, `name`, `person`, `displayOrder` (for custom sorting).
- **`savingsTransactions`**: Ledger for savings accounts.
  - Fields: `id`, `accountId`, `type` (deposit/withdrawal), `amount`, `date`.
- **`budgetLimits`**: Monthly spending caps per category.
  - Fields: `id`, `category`, `limitAmount`, `threshold`.
- **`recurringIncome`**: Templates for scheduled monthly income.
  - Fields: `id`, `source`, `amount`, `dayOfMonth` (1-31).

---

## 🧠 Application Logic (`app.js`)

### Global State
- `records`, `categories`, `people`, `savingsAccounts`, `savingsTransactions`: Local arrays kept in sync with IndexedDB.
- `currentTab`: Tracks the active view (`dashboard`, `analytics`, `budget`, `savings`, `settings`).
- `isPrivacyMode`: Boolean for blurring sensitive amounts.

### Key Lifecycle Functions
1.  **`refreshData()`**: The most important function. Fetches all data from DB, sorts it, updates dropdowns, and triggers `renderAll()`.
2.  **`renderAll()`**: Calls specific renderers for the current tab (`renderDashboard`, `renderAnalytics`, etc.).
3.  **`switchTab(tabId)`**: Handles navigation and UI state changes between sections.

### Feature-Specific Functions
- **Transactions**: `handleRecordSubmit`, `deleteRecord`, `editRecord`.
- **Savings**: `renderSavings`, `moveSavingsAccount` (handles reordering logic).
- **Upcoming Widget**: `renderUpcomingWidget` calculates items for the next 5 days, including recurring income.
- **Recurring Income**: `collectRecurringIncome` (creates a record from a template) and `undoRecurringIncome`.

---

## 🎨 Styling System (`style.css`)

- **Design Language**: Uses a premium, modern aesthetic with glassmorphism, linear gradients, and `cubic-bezier` animations.
- **Variable System**: `--primary-color`, `--secondary-color`, `--success`, `--danger`, `--shadow`, `--radius`.
- **Mobile Navigation**: On screens < 768px, the sidebar transforms into a fixed bottom navigation bar.
- **KPI Cards**: Standardized classes for financial metrics (`.kpi-card`).

---

## 🛠️ Adding New Features

1.  **Schema Change**: If adding a new store, bump `DB_VERSION` in `db.js` and update `onupgradeneeded`.
2.  **State Management**: Add a global array in `app.js` and fetch it in `refreshData`.
3.  **UI Injection**: Add the HTML structure in `index.html` within a `<section class="tab-content">`.
4.  **Rendering**: Create a `renderFeatureName` function in `app.js` and call it from `renderAll`.

---

## 🤖 AI Agent Tips
- Always call `refreshData()` after any DB write to ensure the UI stays in sync.
- Use `formatCurrency(num)` for displaying money.
- When modifying `style.css`, preserve the glassmorphism variables to maintain design consistency.
- Most UI elements are dynamically injected; use event delegation or attach listeners during rendering.
