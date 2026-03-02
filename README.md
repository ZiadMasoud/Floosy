# Floosy

## Overview

Floosy is a modern, user-friendly personal finance tracking web application designed to help individuals manage their income, expenses, and financial habits. Built with vanilla JavaScript, HTML, and CSS, it provides a comprehensive dashboard for tracking transactions, analyzing spending patterns, and maintaining financial records.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-View%20Here-blue)](https://ziadmasoud.github.io/Floosy)

## Features

- **Dashboard Overview**: Get a quick snapshot of your total income, spending, and balance with intuitive KPI cards.
- **Transaction Management**: Add, view, and manage income and expense records with detailed categorization.
- **Analytics & Charts**: Visualize spending by category and track income vs. spending trends over time using interactive Chart.js charts.
- **Category Management**: Create and organize custom categories for better expense tracking.
- **People Management**: Track expenses by different people or family members.
- **Data Export/Import**: Export your financial data as JSON or import records from external sources.
- **Selective Data Reset**: Choose specific data to reset - current month only, custom periods, or all data with granular control.
- **Savings Tracker**: Create and manage multiple savings accounts, record deposits and withdrawals, and view account‑specific KPIs with pagination for transactions.
- **Responsive Design**: Fully responsive interface that works seamlessly on desktop and mobile devices.
- **Local Storage**: All data is stored locally using IndexedDB, ensuring privacy and offline functionality.

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js for data visualization
- **Icons**: Font Awesome for UI icons
- **Storage**: IndexedDB for client-side data persistence
- **Styling**: Custom CSS with responsive design

## Getting Started

### Prerequisites

- A modern web browser with JavaScript enabled
- No server-side dependencies required

### Quick Start

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Start tracking your finances immediately!

### Sample Data

The application includes comprehensive sample data for testing all features:

**📊 Sample Dataset Overview:**
- **8 months of transactions** (January-August 2026)
- **124 transactions** with realistic spending patterns
- **5 people**: John, Sarah, Mike, Emma, David
- **20 categories**: Including Rent/Mortgage, Groceries, Utilities, Transport, Entertainment, Healthcare, Insurance, Clothing, Dining Out, Education, Home Maintenance, Gifts, Pet Supplies, Gym/Fitness
- **Multiple income sources**: Salary, Rental Income, Freelance, Bonus, Side Hustle, Investment

**💰 Savings Accounts with Realistic Data:**
- **7 savings accounts**: Emergency Fund, Vacation Savings, New Car Fund, Home Renovation, Kids Education, Retirement Fund, Wedding Fund
- **67 savings transactions** with deposits and withdrawals
- **Current balances** reflecting real usage patterns
- **Life events**: Car purchases, vacation bookings, medical emergencies, home renovations

**📈 Financial Summary:**
- **Total Income**: ~$69,000 over 8 months
- **Diverse Spending**: Across all categories with seasonal patterns
- **Active Savings**: Multiple goals with regular contributions and withdrawals

To test the application with sample data:
1. Navigate to Settings → Data Management
2. Click "Import JSON"
3. Select the `house_spending_export_2026-03-02.json` file (included in this repository)

The sample data demonstrates:
- **Dashboard analytics** with monthly trends
- **Category breakdowns** and spending patterns
- **Person-based tracking** across family members
- **Savings management** with multiple goals
- **Historical data** for trend analysis

### Usage

1. **Dashboard**: View your financial overview with total income, spending, and balance for the current month.
2. **Records**: Add new transactions by clicking the "Add Transaction" button. Categorize your income and expenses.
3. **Analytics**: Explore charts showing spending by category, monthly trends, and person-based spending analysis.
4. **Savings**: Create savings accounts, track deposits and withdrawals with pagination support.
5. **Settings**: 
   - Manage categories and people
   - Export/import data as JSON
   - Use selective reset to clear specific data (current month, custom periods, or all data)
   - Reset all records if needed

## Data Management Features

### Export/Import
- Export all data as JSON for backup
- Import data from JSON files
- Preserves all records, categories, people, and savings data

### Selective Reset Options
- **All Data**: Complete database reset
- **Current Month Only**: Clears only current month transactions
- **Custom Period**: Select specific date ranges to clear
- **Granular Control**: Choose what to reset (transactions, savings, categories, people)

## Data Privacy

Floosy stores all financial data locally in your browser using IndexedDB. No data is transmitted to external servers, ensuring complete privacy and security.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).