// App State
let currentTab = 'dashboard';
let categoryChart = null;
let trendChart = null;
let monthlyTrendChart = null;
let personChart = null;
let records = [];
let categories = [];
let people = [];

// savings feature state
let savingsAccounts = [];
let savingsTransactions = [];
let savingsPage = {}; // tracks current page for each account (zero-based)

// DOM Elements
const navLinks = document.querySelectorAll('.nav-links li');
const tabContents = document.querySelectorAll('.tab-content');
const tabTitle = document.getElementById('tab-title');
const recordModal = document.getElementById('record-modal');
const recordForm = document.getElementById('record-form');
const cancelModalBtn = document.getElementById('cancel-modal');
const addRecordBtn = document.getElementById('add-record-btn');
const recordCategorySelect = document.getElementById('record-category');
const recordPersonSelect = document.getElementById('record-person');
const categoryList = document.getElementById('category-list');
const personList = document.getElementById('person-list');
const newCategoryBtn = document.getElementById('add-category-btn');
const newPersonBtn = document.getElementById('add-person-btn');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');
const resetBtn = document.getElementById('reset-btn');
const viewAllRecordsBtn = document.getElementById('view-all-records');
const recordTypeSelect = document.getElementById('record-type');
const itemFieldContainer = document.getElementById('item-field-container');

// savings DOM elements (some may not exist on other tabs)
const addAccountBtn = document.getElementById('add-account-btn');
const savingsListEl = document.getElementById('savings-list');
const accountModal = document.getElementById('account-modal');
const accountForm = document.getElementById('account-form');
const cancelAccountBtn = document.getElementById('cancel-account-modal');
const transactionModal = document.getElementById('transaction-modal');
const transactionForm = document.getElementById('transaction-form');
const cancelTransactionBtn = document.getElementById('cancel-transaction-modal');

// Record Details Modal Elements
const recordDetailsModal = document.getElementById('record-details-modal');
const recordDetailsContent = document.getElementById('record-details-content');
const closeDetailsModalBtn = document.getElementById('close-details-modal');
const editDetailsBtn = document.getElementById('edit-details-btn');
let currentDetailRecordId = null;

// Show More Buttons
const showMoreCategoriesBtn = document.getElementById('show-more-categories');
const showMorePeopleBtn = document.getElementById('show-more-people');

// Pagination State
let categoriesVisible = 5;
let peopleVisible = 5;
let categoriesExpanded = false;
let peopleExpanded = false;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await seedDefaultCategories();
        initEventListeners();
        await refreshData();
        
        // Set default date in modal
        document.getElementById('record-date').valueAsDate = new Date();
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

function initEventListeners() {
    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            switchTab(link.getAttribute('data-tab'));
        });
    });

    if (viewAllRecordsBtn) {
        viewAllRecordsBtn.addEventListener('click', () => switchTab('records'));
    }

    // Records
    addRecordBtn.addEventListener('click', () => openModal());
    cancelModalBtn.addEventListener('click', closeModal);
    recordForm.addEventListener('submit', handleRecordSubmit);
    
    const filterType = document.getElementById('filter-type');
    if (filterType) {
        filterType.addEventListener('change', renderRecords);
    }

    // Categories
    newCategoryBtn.addEventListener('click', handleAddCategory);

    // People
    if (newPersonBtn) {
        newPersonBtn.addEventListener('click', handleAddPerson);
    }

    // Show More Buttons
    if (showMoreCategoriesBtn) {
        showMoreCategoriesBtn.addEventListener('click', toggleCategoriesVisibility);
    }
    if (showMorePeopleBtn) {
        showMorePeopleBtn.addEventListener('click', togglePeopleVisibility);
    }

    // Data Management
    exportBtn.addEventListener('click', handleExport);
    importFile.addEventListener('change', handleImport);
    resetBtn.addEventListener('click', handleReset);

    // Record Type Toggle (Simplify Income)
    recordTypeSelect.addEventListener('change', () => {
        updateCategoryDropdowns();
        toggleItemField();
    });

    // Savings tab: add account, transaction and pagination handlers
    if (addAccountBtn) {
        addAccountBtn.addEventListener('click', () => openAccountModal());
    }

    if (accountForm) {
        accountForm.addEventListener('submit', handleAccountSubmit);
    }
    if (cancelAccountBtn) {
        cancelAccountBtn.addEventListener('click', closeAccountModal);
    }

    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionSubmit);
    }
    if (cancelTransactionBtn) {
        cancelTransactionBtn.addEventListener('click', closeTransactionModal);
    }

    // delegate click events inside savings list (deposit/withdraw buttons, pagination)
    if (savingsListEl) {
        savingsListEl.addEventListener('click', (e) => {
            const card = e.target.closest('.savings-card');
            if (!card) return;
            const accountId = parseInt(card.getAttribute('data-id'));
            if (e.target.closest('.deposit-btn')) {
                openTransactionModal(accountId, 'deposit');
            } else if (e.target.closest('.withdraw-btn')) {
                openTransactionModal(accountId, 'withdrawal');
            } else if (e.target.closest('.edit-acc-btn')) {
                const accId = parseInt(e.target.closest('.edit-acc-btn').getAttribute('data-acc-id'));
                const acc = savingsAccounts.find(a => a.id === accId);
                if (acc) openAccountModal(acc);
            } else if (e.target.closest('.delete-acc-btn')) {
                const accId = parseInt(e.target.closest('.delete-acc-btn').getAttribute('data-acc-id'));
                if (confirm('Delete this account? All its transactions will be removed too.')) {
                    // remove transactions first
                    const txsToDelete = savingsTransactions.filter(t => t.accountId === accId);
                    Promise.all(txsToDelete.map(t => remove(STORE_SAVINGS_TRANSACTIONS, t.id)))
                        .then(() => remove(STORE_SAVINGS_ACCOUNTS, accId))
                        .then(() => refreshData());
                }
            } else if (e.target.closest('.next-page')) {
                changePage(accountId, 1);
            } else if (e.target.closest('.prev-page')) {
                changePage(accountId, -1);
            } else if (e.target.closest('.edit-btn')) {
                const txId = parseInt(e.target.closest('.edit-btn').getAttribute('data-tx-id'));
                const tx = savingsTransactions.find(t => t.id === txId);
                if (tx) openTransactionModal(accountId, tx.type, tx);
            } else if (e.target.closest('.delete-btn')) {
                const txId = parseInt(e.target.closest('.delete-btn').getAttribute('data-tx-id'));
                if (confirm('Delete this transaction?')) {
                    remove(STORE_SAVINGS_TRANSACTIONS, txId).then(() => refreshData());
                }
            }
        });
    }

    // global delegation in case buttons are moved out of cards
    document.body.addEventListener('click', (e) => {
        let btn;
        if (btn = e.target.closest('.deposit-btn')) {
            e.stopPropagation();
            const accId = parseInt(btn.getAttribute('data-acc-id'));
            if (!isNaN(accId)) openTransactionModal(accId, 'deposit');
            return;
        }
        if (btn = e.target.closest('.withdraw-btn')) {
            e.stopPropagation();
            const accId = parseInt(btn.getAttribute('data-acc-id'));
            if (!isNaN(accId)) openTransactionModal(accId, 'withdrawal');
            return;
        }
        if (btn = e.target.closest('.edit-acc-btn')) {
            e.stopPropagation();
            const accId = parseInt(btn.getAttribute('data-acc-id'));
            const acc = savingsAccounts.find(a => a.id === accId);
            if (acc) openAccountModal(acc);
            return;
        }
        if (btn = e.target.closest('.delete-acc-btn')) {
            e.stopPropagation();
            const accId = parseInt(btn.getAttribute('data-acc-id'));
            if (confirm('Delete this account? All its transactions will be removed too.')) {
                const txsToDelete = savingsTransactions.filter(t => t.accountId === accId);
                Promise.all(txsToDelete.map(t => remove(STORE_SAVINGS_TRANSACTIONS, t.id)))
                    .then(() => remove(STORE_SAVINGS_ACCOUNTS, accId))
                    .then(() => refreshData());
            }
            return;
        }
        if (btn = e.target.closest('button.edit-btn[data-tx-id]')) {
            e.stopPropagation();
            const accId = parseInt(btn.getAttribute('data-acc-id'));
            const txId = parseInt(btn.getAttribute('data-tx-id'));
            const tx = savingsTransactions.find(t => t.id === txId);
            if (tx) openTransactionModal(accId, tx.type, tx);
            return;
        }
        if (btn = e.target.closest('button.delete-btn[data-tx-id]')) {
            e.stopPropagation();
            const txId = parseInt(btn.getAttribute('data-tx-id'));
            if (confirm('Delete this transaction?')) {
                remove(STORE_SAVINGS_TRANSACTIONS, txId).then(() => refreshData());
            }
            return;
        }
        if (btn = e.target.closest('.next-page')) {
            e.stopPropagation();
            const card = e.target.closest('.savings-card');
            const accId = card ? parseInt(card.getAttribute('data-id')) : null;
            if (accId !== null) changePage(accId, 1);
            return;
        }
        if (btn = e.target.closest('.prev-page')) {
            e.stopPropagation();
            const card = e.target.closest('.savings-card');
            const accId = card ? parseInt(card.getAttribute('data-id')) : null;
            if (accId !== null) changePage(accId, -1);
            return;
        }
    });

    // Close modal on click outside
    window.addEventListener('click', (e) => {
        if (e.target === recordModal) closeModal();
        if (e.target === recordDetailsModal) closeDetailsModal();
        if (e.target === accountModal) closeAccountModal();
        if (e.target === transactionModal) closeTransactionModal();
    });

    // Record Details Modal
    if (closeDetailsModalBtn) {
        closeDetailsModalBtn.addEventListener('click', closeDetailsModal);
    }
    if (editDetailsBtn) {
        editDetailsBtn.addEventListener('click', () => {
            if (currentDetailRecordId) {
                closeDetailsModal();
                editRecord(currentDetailRecordId);
            }
        });
    }
}

function toggleItemField() {
    if (recordTypeSelect.value === 'income') {
        itemFieldContainer.style.display = 'none';
        document.getElementById('record-item').required = false;
    } else {
        itemFieldContainer.style.display = 'block';
        document.getElementById('record-item').required = true;
    }
}

function formatCurrency(amount) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function refreshData() {
    records = await getAll(STORE_RECORDS);
    categories = await getAll(STORE_CATEGORIES);
    people = await getAll(STORE_PEOPLE);
    // new: load savings
    savingsAccounts = await getAll(STORE_SAVINGS_ACCOUNTS);
    savingsTransactions = await getAll(STORE_SAVINGS_TRANSACTIONS);
    savingsPage = {}; // start pages over so user sees first page after data change
    updateCategoryDropdowns();
    updatePersonDropdown();
    renderAll();
}

function switchTab(tabId) {
    if (currentTab === tabId) return;
    currentTab = tabId;
    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-tab') === tabId);
    });
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
    tabTitle.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
    renderAll();
}

function renderAll() {
    if (currentTab === 'dashboard') renderDashboard();
    else if (currentTab === 'records') renderRecords();
    else if (currentTab === 'analytics') renderAnalytics();
    else if (currentTab === 'settings') renderSettings();
    else if (currentTab === 'savings') renderSavings();
}

// Dashboard Functions
function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthDisplay = document.getElementById('current-month-display');
    if (monthDisplay) {
        monthDisplay.textContent = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    const monthlyRecords = records.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = monthlyRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const spending = monthlyRecords.filter(r => r.type === 'spending').reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const balance = income - spending;

    const incomeEl = document.getElementById('total-income');
    const spendingEl = document.getElementById('total-spending');
    const balanceEl = document.getElementById('total-balance');

    if (incomeEl) incomeEl.textContent = `$${formatCurrency(income)}`;
    if (spendingEl) spendingEl.textContent = `$${formatCurrency(spending)}`;
    if (balanceEl) balanceEl.textContent = `$${formatCurrency(balance)}`;

    renderRecentRecords(monthlyRecords);
    renderCharts(monthlyRecords);
}

function renderRecentRecords(monthlyRecords) {
    const tbody = document.getElementById('recent-records-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const sorted = [...monthlyRecords].sort((a, b) => b.id - a.id).slice(0, 5);
    
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records for this month</td></tr>';
        return;
    }

    sorted.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.date}</td>
            <td>${r.type === 'income' ? r.category : r.item}</td>
            <td><span class="category-badge badge-${r.type}">${r.category}</span></td>
            <td>${r.person || '-'}</td>
            <td class="${r.type === 'income' ? 'amount-income' : 'amount-spending'}">
                ${r.type === 'income' ? '+' : '-'}$${formatCurrency(parseFloat(r.amount))}
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit-btn" onclick="event.stopPropagation(); editRecord(${r.id})"><i class="fas fa-edit"></i></button>
                </div>
            </td>
        `;
        tr.addEventListener('click', () => openDetailsModal(r));
        tbody.appendChild(tr);
    });
}

function renderCharts(monthlyRecords) {
    const spendingByCategory = {};
    const spendingRecords = monthlyRecords.filter(r => r.type === 'spending');
    
    spendingRecords.forEach(r => {
        spendingByCategory[r.category] = (spendingByCategory[r.category] || 0) + parseFloat(r.amount);
    });

    const canvasCat = document.getElementById('categoryChart');
    if (canvasCat) {
        const ctxCat = canvasCat.getContext('2d');
        if (categoryChart) categoryChart.destroy();
        
        const labels = Object.keys(spendingByCategory);
        const data = Object.values(spendingByCategory);

        if (labels.length > 0) {
            categoryChart = new Chart(ctxCat, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
                        borderWidth: 0
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            position: 'bottom', 
                            labels: { 
                                usePointStyle: true, 
                                padding: 20,
                                boxWidth: 10,
                                font: { size: 11 }
                            } 
                        }
                    }
                }
            });
        } else {
            ctxCat.clearRect(0, 0, canvasCat.width, canvasCat.height);
        }
    }

    const income = monthlyRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const spending = monthlyRecords.filter(r => r.type === 'spending').reduce((sum, r) => sum + parseFloat(r.amount), 0);

    const canvasTrend = document.getElementById('trendChart');
    if (canvasTrend) {
        const ctxTrend = canvasTrend.getContext('2d');
        if (trendChart) trendChart.destroy();
        trendChart = new Chart(ctxTrend, {
            type: 'bar',
            data: {
                labels: ['Income', 'Spending'],
                datasets: [{
                    data: [income, spending],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 8,
                    barThickness: 40
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: { 
                    y: { 
                        beginAtZero: true,
                        grid: { display: false }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

// Records Functions
function renderRecords() {
    const tbody = document.getElementById('records-body');
    if (!tbody) return;
    
    const filterTypeEl = document.getElementById('filter-type');
    const filterType = filterTypeEl ? filterTypeEl.value : 'all';
    tbody.innerHTML = '';

    let filtered = records;
    if (filterType !== 'all') {
        filtered = records.filter(r => r.type === filterType);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 3rem; color: var(--text-muted);">No transactions found</td></tr>';
        return;
    }

    filtered.sort((a, b) => b.id - a.id).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.date}</td>
            <td>${r.type === 'income' ? r.category : r.item}</td>
            <td><span class="category-badge badge-${r.type}">${r.category}</span></td>
            <td>${r.person || '-'}</td>
            <td class="${r.type === 'income' ? 'amount-income' : 'amount-spending'}">
                ${r.type === 'income' ? '+' : '-'}$${formatCurrency(parseFloat(r.amount))}
            </td>
            <td>${r.quantity || '-'}</td>
            <td><div class="notes-cell">${r.notes || '-'}</div></td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit-btn" onclick="event.stopPropagation(); editRecord(${r.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete-btn" onclick="event.stopPropagation(); deleteRecord(${r.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tr.addEventListener('click', () => openDetailsModal(r));
        tbody.appendChild(tr);
    });
}

// Analytics Functions
function renderAnalytics() {
    const statsBody = document.getElementById('stats-body');
    if (!statsBody) return;
    statsBody.innerHTML = '';

    // Group records by month
    const monthlyStats = {};
    records.forEach(r => {
        const date = new Date(r.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { income: 0, spending: 0, categories: {} };
        }
        if (r.type === 'income') {
            monthlyStats[monthKey].income += parseFloat(r.amount);
        } else {
            monthlyStats[monthKey].spending += parseFloat(r.amount);
            monthlyStats[monthKey].categories[r.category] = (monthlyStats[monthKey].categories[r.category] || 0) + parseFloat(r.amount);
        }
    });

    const sortedMonths = Object.keys(monthlyStats).sort().reverse();
    
    if (sortedMonths.length === 0) {
        statsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 3rem; color: var(--text-muted);">No historical data available</td></tr>';
    }

    sortedMonths.forEach(monthKey => {
        const stats = monthlyStats[monthKey];
        const savings = stats.income - stats.spending;
        
        let topCategory = 'N/A';
        let maxAmount = 0;
        for (const [cat, amt] of Object.entries(stats.categories)) {
            if (amt > maxAmount) {
                maxAmount = amt;
                topCategory = cat;
            }
        }

        const tr = document.createElement('tr');
        const [year, month] = monthKey.split('-');
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
        
        tr.innerHTML = `
            <td style="font-weight: 600;">${monthName}</td>
            <td class="amount-income">$${formatCurrency(stats.income)}</td>
            <td class="amount-spending">$${formatCurrency(stats.spending)}</td>
            <td style="font-weight: 700; color: ${savings >= 0 ? 'var(--success)' : 'var(--danger)'}">
                $${formatCurrency(savings)}
            </td>
            <td><span class="category-badge badge-spending">${topCategory}</span></td>
        `;
        statsBody.appendChild(tr);
    });

    renderMonthlyTrendChart(monthlyStats);
    renderPersonChart();
}

function renderMonthlyTrendChart(monthlyStats) {
    const canvas = document.getElementById('monthlyTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (monthlyTrendChart) monthlyTrendChart.destroy();

    const months = Object.keys(monthlyStats).sort();
    const incomeData = months.map(m => monthlyStats[m].income);
    const spendingData = months.map(m => monthlyStats[m].spending);
    const labels = months.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleString('default', { month: 'short' });
    });

    monthlyTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Spending',
                    data: spendingData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderPersonChart() {
    const canvas = document.getElementById('personChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (personChart) personChart.destroy();

    // Calculate spending by person
    const spendingByPerson = {};
    const spendingRecords = records.filter(r => r.type === 'spending' && r.person);

    spendingRecords.forEach(r => {
        spendingByPerson[r.person] = (spendingByPerson[r.person] || 0) + parseFloat(r.amount);
    });

    const labels = Object.keys(spendingByPerson);
    const data = Object.values(spendingByPerson);

    if (labels.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No spending data by person available', canvas.width / 2, canvas.height / 2);
        return;
    }

    personChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Spending',
                data: data,
                backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [5, 5] }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// -- savings feature functions ------------------------------------------------

function openAccountModal(account = null) {
    if (!account) {
        accountForm.reset();
        accountForm.elements['account-id'].value = '';
        accountForm.elements['account-initial'].value = '';
        accountModal.querySelector('h2').textContent = 'New Savings Account';
    } else {
        accountForm.elements['account-id'].value = account.id;
        accountForm.elements['account-name'].value = account.name;
        accountForm.elements['account-initial'].value = '';
        accountModal.querySelector('h2').textContent = 'Edit Savings Account';
    }
    accountModal.classList.add('active');
}

function closeAccountModal() {
    if (accountModal) accountModal.classList.remove('active');
}

async function handleAccountSubmit(e) {
    e.preventDefault();
    const id = accountForm.elements['account-id'].value;
    const name = accountForm.elements['account-name'].value.trim();
    const initial = parseFloat(accountForm.elements['account-initial'].value) || 0;
    if (!name) return;

    if (id) {
        // update existing account
        const acc = savingsAccounts.find(a => a.id === parseInt(id));
        if (acc) {
            acc.name = name;
            await updateRecord(STORE_SAVINGS_ACCOUNTS, acc);
        }
    } else {
        const newAcc = { name };
        const newId = await add(STORE_SAVINGS_ACCOUNTS, newAcc);
        newAcc.id = newId;
        savingsAccounts.push(newAcc);
        // if initial deposit provided, add transaction
        if (initial > 0) {
            const tx = {
                accountId: newAcc.id,
                type: 'deposit',
                amount: initial,
                date: new Date().toISOString().split('T')[0],
                notes: 'Initial balance'
            };
            await add(STORE_SAVINGS_TRANSACTIONS, tx);
            savingsTransactions.push(tx);
        }
    }
    closeAccountModal();
    await refreshData();
}

function openTransactionModal(accountId, type, tx = null) {
    transactionForm.reset();
    transactionForm.elements['tx-account-id'].value = accountId;
    transactionForm.elements['tx-type'].value = type;
    // show readable type in header and set select value
    const label = type === 'deposit' ? 'Income' : 'Withdrawal';
    transactionForm.querySelector('h2').textContent = label;
    const typeDisplay = transactionForm.querySelector('#tx-type-display');
    if (typeDisplay) {
        typeDisplay.value = type;
    }
    if (tx) {
        transactionForm.elements['tx-id'].value = tx.id;
        transactionForm.elements['tx-amount'].value = tx.amount;
        transactionForm.elements['tx-date'].value = tx.date;
        transactionForm.elements['tx-notes'].value = tx.notes || '';
    } else {
        transactionForm.elements['tx-id'].value = '';
        transactionForm.elements['tx-date'].valueAsDate = new Date();
    }
    transactionModal.classList.add('active');
}

function closeTransactionModal() {
    if (transactionModal) transactionModal.classList.remove('active');
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const id = transactionForm.elements['tx-id'].value;
    const accountId = parseInt(transactionForm.elements['tx-account-id'].value);
    // type may be changed via select
    let type = transactionForm.elements['tx-type'].value;
    const typeSelect = transactionForm.elements['tx-type-display'];
    if (typeSelect && typeSelect.value) {
        type = typeSelect.value;
    }
    const amount = parseFloat(transactionForm.elements['tx-amount'].value) || 0;
    const date = transactionForm.elements['tx-date'].value;
    const notes = transactionForm.elements['tx-notes'].value.trim();

    if (id) {
        const tx = savingsTransactions.find(t => t.id === parseInt(id));
        if (tx) {
            tx.amount = amount;
            tx.date = date;
            tx.notes = notes;
            await updateRecord(STORE_SAVINGS_TRANSACTIONS, tx);
        }
    } else {
        const newTx = { accountId, type, amount, date, notes };
        const newId = await add(STORE_SAVINGS_TRANSACTIONS, newTx);
        newTx.id = newId;
        savingsTransactions.push(newTx);
    }
    closeTransactionModal();
    await refreshData();
}

function changePage(accountId, delta) {
    if (!savingsPage[accountId]) savingsPage[accountId] = 0;
    savingsPage[accountId] = Math.max(0, savingsPage[accountId] + delta);
    renderSavings();
}

function renderSavings() {
    if (!savingsListEl) return;
    savingsListEl.innerHTML = '';

    if (savingsAccounts.length === 0) {
        savingsListEl.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-muted);">No savings accounts created</p>';
        return;
    }

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    savingsAccounts.forEach(acc => {
        const txs = savingsTransactions
            .filter(t => t.accountId === acc.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        const totalDeposit = txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
        const totalWithdraw = txs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
        const balance = totalDeposit - totalWithdraw;
        const monthDeposit = txs.filter(t => {
            const d = new Date(t.date);
            return t.type === 'deposit' && d.getMonth() === curMonth && d.getFullYear() === curYear;
        }).reduce((s, t) => s + t.amount, 0);
        const monthWithdraw = txs.filter(t => {
            const d = new Date(t.date);
            return t.type === 'withdrawal' && d.getMonth() === curMonth && d.getFullYear() === curYear;
        }).reduce((s, t) => s + t.amount, 0);

        let page = savingsPage[acc.id] || 0;
        const perPage = 3;
        const totalPages = Math.ceil(txs.length / perPage);
        // ensure current page is within bounds
        if (page >= totalPages) page = totalPages - 1;
        if (page < 0) page = 0;
        savingsPage[acc.id] = page;
        const paged = txs.slice(page * perPage, page * perPage + perPage);

        const card = document.createElement('div');
        card.className = 'savings-card card';
        card.setAttribute('data-id', acc.id);
        card.innerHTML = `
            <div class="card-header">
                <h3>${acc.name}</h3>
                <div class="account-actions">
                    <button class="btn-icon btn-secondary deposit-btn" data-acc-id="${acc.id}" title="Deposit"><i class="fas fa-plus"></i></button>
                    <button class="btn-icon btn-secondary withdraw-btn" data-acc-id="${acc.id}" title="Withdraw"><i class="fas fa-minus"></i></button>
                    <button class="btn-icon btn-secondary edit-acc-btn" data-acc-id="${acc.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-secondary delete-acc-btn" data-acc-id="${acc.id}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="kpi-container savings-kpis">
                <div class="kpi-card balance">
                    <div class="kpi-icon"><i class="fas fa-piggy-bank"></i></div>
                    <div class="kpi-details">
                        <h4>Total Balance</h4>
                        <p>$${formatCurrency(balance)}</p>
                    </div>
                </div>
                <div class="kpi-card month">
                    <div class="kpi-icon"><i class="fas fa-calendar-alt"></i></div>
                    <div class="kpi-details">
                        <h4>Saved This Month</h4>
                        <p>$${formatCurrency(monthDeposit - monthWithdraw)}</p>
                    </div>
                </div>
                <div class="kpi-card withdrawal">
                    <div class="kpi-icon"><i class="fas fa-arrow-down"></i></div>
                    <div class="kpi-details">
                        <h4>Total Withdrawn</h4>
                        <p>$${formatCurrency(totalWithdraw)}</p>
                    </div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="savings-records-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Notes</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paged.map(t => `
                            <tr>
                                <td>${t.date}</td>
                                <td>${t.type === 'deposit' ? 'Income' : 'Withdrawal'}</td>
                                <td class="${t.type==='deposit'?'amount-income':'amount-spending'}">$${formatCurrency(t.amount)}</td>
                                <td>${t.notes||'-'}</td>
                                <td>
                                    <button class="btn-icon edit-btn" data-acc-id="${acc.id}" data-tx-id="${t.id}"><i class="fas fa-edit"></i></button>
                                    <button class="btn-icon delete-btn" data-acc-id="${acc.id}" data-tx-id="${t.id}"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="pagination" style="margin-top:8px; text-align:right;">
                <button class="btn btn-outline prev-page" ${page<=0?'disabled':''}>Prev</button>
                <button class="btn btn-outline next-page" ${page>=totalPages-1?'disabled':''}>Next</button>
            </div>
        `;
        savingsListEl.appendChild(card);

        // attach listeners directly to the new card's buttons for reliability
        const depBtn = card.querySelector('.deposit-btn');
        if (depBtn) {
            depBtn.addEventListener('click', (e) => { e.stopPropagation(); console.log('deposit btn', acc.id); openTransactionModal(acc.id, 'deposit'); });
        }
        const witBtn = card.querySelector('.withdraw-btn');
        if (witBtn) {
            witBtn.addEventListener('click', (e) => { e.stopPropagation(); console.log('withdraw btn', acc.id); openTransactionModal(acc.id, 'withdrawal'); });
        }
        const editAcc = card.querySelector('.edit-acc-btn');
        if (editAcc) {
            editAcc.addEventListener('click', (e) => { e.stopPropagation(); console.log('edit account', acc.id); openAccountModal(acc); });
        }
        const delAcc = card.querySelector('.delete-acc-btn');
        if (delAcc) {
            delAcc.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this account? All its transactions will be removed too.')) {
                    const txsToDelete = savingsTransactions.filter(t => t.accountId === acc.id);
                    Promise.all(txsToDelete.map(t => remove(STORE_SAVINGS_TRANSACTIONS, t.id)))
                        .then(() => remove(STORE_SAVINGS_ACCOUNTS, acc.id))
                        .then(() => refreshData());
                }
            });
        }
        const editTxBtns = card.querySelectorAll('button.edit-btn');
        editTxBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('edit tx', btn.getAttribute('data-tx-id'));
                const txId = parseInt(btn.getAttribute('data-tx-id'));
                const tx = savingsTransactions.find(t => t.id === txId);
                if (tx) openTransactionModal(acc.id, tx.type, tx);
            });
        });
        const delTxBtns = card.querySelectorAll('button.delete-btn');
        delTxBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('delete tx', btn.getAttribute('data-tx-id'));
                const txId = parseInt(btn.getAttribute('data-tx-id'));
                if (confirm('Delete this transaction?')) {
                    remove(STORE_SAVINGS_TRANSACTIONS, txId).then(() => refreshData());
                }
            });
        });
    });
}

// Modal Management
function openModal(record = null) {
    const modalTitle = document.getElementById('modal-title');
    const recordId = document.getElementById('record-id');
    const recordDate = document.getElementById('record-date');
    const recordItem = document.getElementById('record-item');
    const recordCategory = document.getElementById('record-category');
    const recordAmount = document.getElementById('record-amount');
    const recordQuantity = document.getElementById('record-quantity');
    const recordNotes = document.getElementById('record-notes');

    if (record) {
        modalTitle.textContent = 'Edit Transaction';
        recordId.value = record.id;
        recordTypeSelect.value = record.type;
        recordDate.value = record.date;
        recordItem.value = record.item || '';
        recordAmount.value = record.amount;
        recordQuantity.value = record.quantity || '';
        recordNotes.value = record.notes || '';
        
        updateCategoryDropdowns();
        recordCategory.value = record.category;
    } else {
        modalTitle.textContent = 'Add Transaction';
        recordForm.reset();
        recordId.value = '';
        recordDate.valueAsDate = new Date();
        updateCategoryDropdowns();
    }
    toggleItemField();
    recordModal.classList.add('active');
}

function closeModal() {
    recordModal.classList.remove('active');
}

async function handleRecordSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('record-id').value;
    const type = recordTypeSelect.value;
    const data = {
        type: type,
        date: document.getElementById('record-date').value,
        item: type === 'income' ? '' : document.getElementById('record-item').value,
        category: document.getElementById('record-category').value,
        person: document.getElementById('record-person').value || '',
        amount: parseFloat(document.getElementById('record-amount').value),
        quantity: document.getElementById('record-quantity').value,
        notes: document.getElementById('record-notes').value
    };

    if (id) {
        data.id = parseInt(id);
        await updateRecord(STORE_RECORDS, data);
    } else {
        await add(STORE_RECORDS, data);
    }

    closeModal();
    await refreshData();
}

async function editRecord(id) {
    const record = records.find(r => r.id === id);
    if (record) openModal(record);
}

async function deleteRecord(id) {
    if (confirm('Are you sure you want to delete this record?')) {
        await remove(STORE_RECORDS, id);
        await refreshData();
    }
}

// Record Details Modal Functions
function openDetailsModal(record) {
    if (!recordDetailsModal || !recordDetailsContent) return;
    
    currentDetailRecordId = record.id;
    
    const itemLabel = record.type === 'income' ? 'Source' : 'Item';
    const itemValue = record.type === 'income' ? record.category : (record.item || '-');
    
    recordDetailsContent.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Type</span>
            <span class="detail-value ${record.type}">${record.type === 'income' ? 'Income' : 'Spending'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${record.date}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">${itemLabel}</span>
            <span class="detail-value">${itemValue}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Category</span>
            <span class="detail-value">${record.category}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value ${record.type}">${record.type === 'income' ? '+' : '-'}$${formatCurrency(parseFloat(record.amount))}</span>
        </div>
        ${record.person ? `
        <div class="detail-row">
            <span class="detail-label">Person</span>
            <span class="detail-value">${record.person}</span>
        </div>
        ` : ''}
        ${record.quantity ? `
        <div class="detail-row">
            <span class="detail-label">Quantity</span>
            <span class="detail-value">${record.quantity}</span>
        </div>
        ` : ''}
        ${record.notes ? `
        <div class="detail-row">
            <span class="detail-label">Notes</span>
            <span class="detail-value notes">${record.notes}</span>
        </div>
        ` : ''}
    `;
    
    recordDetailsModal.classList.add('active');
}

function closeDetailsModal() {
    if (recordDetailsModal) {
        recordDetailsModal.classList.remove('active');
        currentDetailRecordId = null;
    }
}

// Settings Functions
function renderSettings() {
    if (!categoryList) return;
    categoryList.innerHTML = '';

    if (categories.length === 0) {
        categoryList.innerHTML = '<p style="text-align:center; padding: 1rem; color: var(--text-muted);">No categories defined</p>';
    } else {
        const visibleCategories = categoriesExpanded ? categories : categories.slice(0, categoriesVisible);
        visibleCategories.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'category-item';
            div.innerHTML = `
                <div>
                    <strong>${cat.name}</strong>
                    <span class="category-badge badge-${cat.type}">${cat.type}</span>
                </div>
                <div>
                    <button class="btn-icon delete-btn" onclick="deleteCategory(${cat.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;
            categoryList.appendChild(div);
        });
    }

    // Update Show More button for categories
    if (showMoreCategoriesBtn) {
        if (categories.length > 5) {
            showMoreCategoriesBtn.style.display = 'block';
            showMoreCategoriesBtn.textContent = categoriesExpanded ? 'Show Less' : 'Show More';
        } else {
            showMoreCategoriesBtn.style.display = 'none';
        }
    }

    // Render People List
    if (personList) {
        personList.innerHTML = '';
        if (people.length === 0) {
            personList.innerHTML = '<p style="text-align:center; padding: 1rem; color: var(--text-muted);">No people defined</p>';
        } else {
            const visiblePeople = peopleExpanded ? people : people.slice(0, peopleVisible);
            visiblePeople.forEach(person => {
                const div = document.createElement('div');
                div.className = 'category-item';
                div.innerHTML = `
                    <div>
                        <strong>${person.name}</strong>
                    </div>
                    <div>
                        <button class="btn-icon delete-btn" onclick="deletePerson(${person.id})"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                personList.appendChild(div);
            });
        }

        // Update Show More button for people
        if (showMorePeopleBtn) {
            if (people.length > 5) {
                showMorePeopleBtn.style.display = 'block';
                showMorePeopleBtn.textContent = peopleExpanded ? 'Show Less' : 'Show More';
            } else {
                showMorePeopleBtn.style.display = 'none';
            }
        }
    }
}

async function handleAddCategory() {
    const nameInput = document.getElementById('new-category-name');
    const typeSelect = document.getElementById('new-category-type');
    const name = nameInput.value.trim();
    const type = typeSelect.value;
    
    if (name) {
        await add(STORE_CATEGORIES, { name, type });
        nameInput.value = '';
        await refreshData();
    }
}

async function deleteCategory(id) {
    if (confirm('Delete this category? Records with this category will remain but the category option will be removed.')) {
        await remove(STORE_CATEGORIES, id);
        await refreshData();
    }
}

function updateCategoryDropdowns() {
    if (!recordTypeSelect || !recordCategorySelect) return;
    const type = recordTypeSelect.value;
    const filtered = categories.filter(c => c.type === type);
    recordCategorySelect.innerHTML = filtered.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function updatePersonDropdown() {
    if (!recordPersonSelect) return;
    const selectedValue = recordPersonSelect.value;
    recordPersonSelect.innerHTML = '<option value="">Select Person (Optional)</option>' +
        people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    recordPersonSelect.value = selectedValue;
}

// Show More Toggle Functions
function toggleCategoriesVisibility() {
    categoriesExpanded = !categoriesExpanded;
    categoriesVisible = categoriesExpanded ? categories.length : 5;
    renderSettings();
}

function togglePeopleVisibility() {
    peopleExpanded = !peopleExpanded;
    peopleVisible = peopleExpanded ? people.length : 5;
    renderSettings();
}

// People Management Functions
async function handleAddPerson() {
    const nameInput = document.getElementById('new-person-name');
    const name = nameInput.value.trim();

    if (name) {
        await add(STORE_PEOPLE, { name });
        nameInput.value = '';
        await refreshData();
    }
}

async function deletePerson(id) {
    if (confirm('Delete this person? Records with this person will remain but the person option will be removed.')) {
        await remove(STORE_PEOPLE, id);
        await refreshData();
    }
}

// Data Operations
async function handleExport() {
    const data = {
        records: await getAll(STORE_RECORDS),
        categories: await getAll(STORE_CATEGORIES),
        people: await getAll(STORE_PEOPLE),
        savingsAccounts: await getAll(STORE_SAVINGS_ACCOUNTS),
        savingsTransactions: await getAll(STORE_SAVINGS_TRANSACTIONS),
        exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `house_spending_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.records && data.categories) {
                if (confirm('Importing will overwrite your current data. Continue?')) {
                    await clearStore(STORE_RECORDS);
                    await clearStore(STORE_CATEGORIES);
                    await clearStore(STORE_PEOPLE);
                    for (const r of data.records) {
                        delete r.id;
                        await add(STORE_RECORDS, r);
                    }
                    for (const c of data.categories) {
                        delete c.id;
                        await add(STORE_CATEGORIES, c);
                    }
                    if (data.people) {
                        for (const p of data.people) {
                            delete p.id;
                            await add(STORE_PEOPLE, p);
                        }
                    }
                    // import savings
                    if (data.savingsAccounts) {
                        await clearStore(STORE_SAVINGS_ACCOUNTS);
                        for (const a of data.savingsAccounts) {
                            delete a.id;
                            await add(STORE_SAVINGS_ACCOUNTS, a);
                        }
                    }
                    if (data.savingsTransactions) {
                        await clearStore(STORE_SAVINGS_TRANSACTIONS);
                        for (const t of data.savingsTransactions) {
                            delete t.id;
                            await add(STORE_SAVINGS_TRANSACTIONS, t);
                        }
                    }
                    alert('Import successful!');
                    await refreshData();
                }
            } else {
                alert('Invalid file format.');
            }
        } catch (err) {
            alert('Error importing data: ' + err.message);
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

async function handleReset() {
    if (confirm('Are you sure you want to reset the entire database? This will delete all records and restore default categories.')) {
        await resetDB();
        await refreshData();
        alert('Database reset complete.');
    }
}

// Global functions
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
window.deleteCategory = deleteCategory;
window.deletePerson = deletePerson;
window.switchTab = switchTab;
