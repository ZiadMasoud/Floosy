# Floosy
 
Floosy is a personal finance tracker for managing income, expenses, savings, and monthly plans. It is built with vanilla JavaScript, HTML, and CSS, runs entirely in the browser, and can be installed on Android as an app. All data stays on your device.
 
[Open the live app](https://ziadmasoud.github.io/Floosy)
 
## Contents
 
- [Features](#features)
- [Install as an app](#install-as-an-app)
- [Offline support](#offline-support)
- [Data and privacy](#data-and-privacy)
- [Data management](#data-management)
- [Technology](#technology)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Releasing an update](#releasing-an-update)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)
## Features
 
**Tracking**
- Dashboard with income, spending, and balance for the current month.
- Transaction management with categories and per-person tracking.
- Multiple savings accounts with deposits, withdrawals, account-level indicators, and paginated history.
**Planning**
- Planner for monthly, weekly, and one-time income and fixed expenses, kept separate from actual transactions.
- Manually logged item prices with a price-history chart.
**Analysis**
- Interactive charts for spending by category, income versus spending over time, and spending by person.
- Monthly summary export as PDF.
**Data control**
- JSON export and import for backup and transfer.
- Selective reset: all data, the current month, a custom date range, or specific data types.
**Interface**
- Responsive layout for desktop and mobile.
- Compact navigation: Dashboard, Planner, Budget, and Savings are always available; Analytics and Settings are under the More menu.
## Install as an app
 
Floosy is a Progressive Web App (PWA). On Android:
 
1. Open https://ziadmasoud.github.io/Floosy in Chrome.
2. Use the app briefly, then reload the page once while online.
3. Open the Chrome menu and choose **Install app**.
4. Launch Floosy from the home screen. It opens fullscreen without the browser address bar.
It also works as a normal website in any modern desktop or mobile browser.
 
## Offline support
 
After the first two online visits, Floosy loads and runs without an internet connection. A service worker stores the application files on the device, including the charting, notification, and icon libraries, which are bundled in the project rather than loaded from external servers.
 
Offline you can view, add, and edit records, use the planner and savings, and browse analytics.
 
## Data and privacy
 
Floosy stores all data locally in your browser using IndexedDB. No financial data is sent to any server.
 
Because data lives in browser storage:
 
- Clearing Chrome's site data or storage for this site deletes your records.
- The installed app shares storage with the website at the same address.
- Export a JSON backup regularly and keep a copy outside the device, for example in cloud storage.
## Data management
 
### Export and import
 
- Export all data as JSON from **More > Settings**.
- Import a JSON file to restore or transfer data.
- The export includes transactions, categories, people, savings, recurring income, planned events, and tracked item price histories.
Planner events and item prices are stored separately from actual transactions. They do not affect Dashboard or Analytics totals. Item purchase frequency is informational only and does not create reminders.
 
### Selective reset
 
- **All data**: complete database reset.
- **Current month**: clears only the current month's transactions.
- **Custom period**: clears transactions in a selected date range.
- **Granular control**: choose what to reset (transactions, savings, categories, people).
- **Planner data**: optionally clear all planned events and tracked item price histories, independent of the selected transaction range.
## Technology
 
| Area | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Storage | IndexedDB |
| Charts | Chart.js 4.6.1 (bundled in `vendor/`) |
| Notifications | Toastify (bundled in `vendor/`) |
| Icons | Font Awesome 6.0.0 (bundled in `vendor/`) |
| PDF export | jsPDF 2.5.1 (loaded from a CDN) |
| Offline and install | Web App Manifest and service worker |
 
## Project structure
 
```
Floosy/
├── index.html            Application entry point
├── manifest.json         PWA manifest (name, colors, icons)
├── service-worker.js     Offline caching and versioning
├── css/                  Stylesheets
├── js/                   Application logic (database, planner, summaries)
├── images/               Favicon and app icons
└── vendor/               Locally hosted libraries and their licenses
```
 
## Running locally
 
Service workers require a web server, so opening `index.html` directly from the file system will not work.
 
1. Clone the repository.
2. Open the folder in VS Code and install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.
To test the PWA behavior, open DevTools (F12) and check the **Application** tab: Manifest, Service Workers, and Cache Storage. Use the **Network** tab with **Offline** selected to confirm offline loading.
 
## Releasing an update
 
The service worker caches exact file URLs, so any change to an application file needs three updates or installed copies will keep serving the old version:
 
1. Increase the `?v=` number for the changed file in `index.html`.
2. Update the same URL in the `APP_SHELL` list in `service-worker.js`.
3. Increase the cache name in `service-worker.js` (for example `floosy-v3` to `floosy-v4`).
## Known limitations
 
- PDF export loads jsPDF and an Arabic-capable font from the internet, so it requires a connection. Offline, the rest of the app is unaffected.
- Data is tied to the browser profile. Clearing browser data removes it, so keep JSON backups.
- Exports download as files and cannot overwrite a previous file on Android, so repeated exports create separate files.
## Contributing
 
Contributions are welcome. Please open an issue to discuss a change, or submit a pull request.
 
## License
 
Released under the [MIT License](LICENSE).
