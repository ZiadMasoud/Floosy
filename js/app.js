// App State
let currentTab = 'dashboard';
let categoryChart = null;
let trendChart = null;
let monthlyTrendChart = null;
let personChart = null;
let records = [];
let categories = [];
let people = [];

// Combined transactions state
let combinedTransactions = [];
let combinedTransactionIdCounter = 0;

// savings feature state
let savingsAccounts = [];
let savingsTransactions = [];
let savingsPage = {}; // tracks current page for each account (zero-based)

// Budget limits state
let budgetLimits = [];

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
const recordSavingsAccountSelect = document.getElementById('record-savings-account');
const recordFormatTypeSelect = document.getElementById('record-format-type');
const combinedTransactionsSection = document.getElementById('combined-transactions-section');
const combinedTransactionsList = document.getElementById('combined-transactions-list');
const addTransactionBtn = document.getElementById('add-transaction-btn');
const categoryList = document.getElementById('category-list');
const personList = document.getElementById('person-list');
const newCategoryBtn = document.getElementById('add-category-btn');
const newPersonBtn = document.getElementById('add-person-btn');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');
const resetBtn = document.getElementById('reset-btn');
const selectiveResetBtn = document.getElementById('selective-reset-btn');
const resetTypeSelect = document.getElementById('reset-type');
const periodOptionsDiv = document.getElementById('period-options');
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
const privacyToggle = document.getElementById('privacy-toggle');
let currentDetailRecordId = null;
let isPrivacyMode = false;

// Category Edit Modal Elements
const categoryEditModal = document.getElementById('category-edit-modal');
const categoryEditForm = document.getElementById('category-edit-form');
const editCategoryIdInput = document.getElementById('edit-category-id');
const editCategoryNameInput = document.getElementById('edit-category-name');
const editCategoryTypeSelect = document.getElementById('edit-category-type');
const cancelCategoryEditBtn = document.getElementById('cancel-category-edit-modal');

// Budget DOM Elements
const addBudgetLimitBtn = document.getElementById('add-budget-limit-btn');
const budgetLimitModal = document.getElementById('budget-limit-modal');
const budgetLimitForm = document.getElementById('budget-limit-form');
const budgetLimitIdInput = document.getElementById('budget-limit-id');
const budgetLimitCategorySelect = document.getElementById('budget-limit-category');
const budgetLimitAmountInput = document.getElementById('budget-limit-amount');
const budgetLimitThresholdInput = document.getElementById('budget-limit-threshold');
const cancelBudgetLimitBtn = document.getElementById('cancel-budget-limit-modal');
const resetAllBudgetsBtn = document.getElementById('reset-all-budgets-btn');

// Upcoming Income DOM Elements
const addUpcomingIncomeBtn = document.getElementById('add-upcoming-income-btn');
const upcomingIncomeModal = document.getElementById('upcoming-income-modal');
const upcomingIncomeForm = document.getElementById('upcoming-income-form');
const upcomingIncomeSourceInput = document.getElementById('upcoming-income-source');
const upcomingIncomeDateInput = document.getElementById('upcoming-income-date');
const upcomingIncomeAmountInput = document.getElementById('upcoming-income-amount');
const upcomingIncomeCategorySelect = document.getElementById('upcoming-income-category');
const upcomingIncomeNotesInput = document.getElementById('upcoming-income-notes');
const cancelUpcomingIncomeBtn = document.getElementById('cancel-upcoming-income-modal');

// Show More Buttons
const showMoreCategoriesBtn = document.getElementById('show-more-categories');
const showMorePeopleBtn = document.getElementById('show-more-people');

// Pagination State
let categoriesVisible = 2;
let peopleVisible = 2;
let categoriesExpanded = false;
let peopleExpanded = false;

// Chart categories pagination state
let chartCategoriesVisible = 5;
let chartCategoriesExpanded = false;

// Utility Notification Functions
function showToast(message, type = 'info') {
    let backgroundColor = "#355872"; // default navy
    if (type === 'error') backgroundColor = "#ef4444";
    if (type === 'success') backgroundColor = "#10b981";
    if (type === 'warning') backgroundColor = "#f59e0b";

    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "center", // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        style: {
            background: backgroundColor,
            borderRadius: "8px",
            fontFamily: "Inter, sans-serif",
            fontWeight: "500"
        }
    }).showToast();
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        if (!modal) return resolve(confirm(message));

        const msgEl = document.getElementById('custom-confirm-message');
        const okBtn = document.getElementById('custom-confirm-ok');
        const cancelBtn = document.getElementById('custom-confirm-cancel');

        msgEl.textContent = message;
        modal.classList.add('active');

        const cleanup = () => {
            modal.classList.remove('active');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
        };

        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
    });
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await seedDefaultCategories();

        // Initialize Privacy Mode
        isPrivacyMode = localStorage.getItem('floosy_privacy_mode') === 'true';
        if (isPrivacyMode) {
            document.body.classList.add('privacy-mode');
            updatePrivacyIcon();
        }

        initEventListeners();
        await refreshData();

        // Set default date in modal
        document.getElementById('record-date').valueAsDate = new Date();
        // Note: Accounts Receivable are no longer duplicated month-to-month.
        // Pending A/R are treated as outstanding until collected, regardless of month.

        // Initialize checkbox labels for custom checkboxes
        const checkboxLabels = document.querySelectorAll('.checkbox-label');
        checkboxLabels.forEach(label => {
            label.addEventListener('click', function (e) {
                e.preventDefault();
                const checkbox = this.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));

                    // Update visual state
                    if (checkbox.checked) {
                        this.classList.add('checked');
                    } else {
                        this.classList.remove('checked');
                    }
                }
            });

            // Initialize visual state based on current checked status
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked) {
                label.classList.add('checked');
            }
        });

        switchTab('dashboard');

        // Test monthly balance reset functionality
        testMonthlyBalanceReset();

    } catch (error) {
        console.error('Error initializing app:', error);
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

    // Privacy Toggle
    if (privacyToggle) {
        privacyToggle.addEventListener('click', togglePrivacyMode);
    }
    const heroPrivacyToggle = document.getElementById('hero-privacy-toggle');
    if (heroPrivacyToggle) {
        heroPrivacyToggle.addEventListener('click', togglePrivacyMode);
    }

    // Records
    addRecordBtn.addEventListener('click', () => openModal());
    cancelModalBtn.addEventListener('click', closeModal);
    recordForm.addEventListener('submit', handleRecordSubmit);

    const filterType = document.getElementById('filter-type');
    if (filterType) {
        filterType.addEventListener('change', renderRecords);
    }

    // Filter panels (opened via header button)
    const recordsFilterControls = document.getElementById('records-filter-controls');
    const recordsFilterPanel = document.getElementById('records-filter-panel');

    // Date filters
    const filterYear = document.getElementById('filter-year');
    const filterMonth = document.getElementById('filter-month');
    const filterPerson = document.getElementById('filter-person');
    const filterCategory = document.getElementById('filter-category');
    const clearFiltersBtn = document.getElementById('clear-filters');

    if (filterYear) {
        filterYear.addEventListener('change', renderRecords);
    }

    if (filterMonth) {
        filterMonth.addEventListener('change', renderRecords);
    }

    if (filterPerson) {
        filterPerson.addEventListener('change', renderRecords);
    }

    if (filterCategory) {
        filterCategory.addEventListener('change', renderRecords);
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (filterType) filterType.value = 'all';
            if (filterYear) filterYear.value = '';
            if (filterMonth) filterMonth.value = '';
            if (filterPerson) filterPerson.value = '';
            if (filterCategory) filterCategory.value = '';
            renderRecords();
        });
    }

    // Dashboard Filters
    const dashboardFilterType = document.getElementById('dashboard-filter-type');
    const dashboardFilterYear = document.getElementById('dashboard-filter-year');
    const dashboardFilterMonth = document.getElementById('dashboard-filter-month');
    const dashboardFilterPerson = document.getElementById('dashboard-filter-person');
    const dashboardFilterCategory = document.getElementById('dashboard-filter-category');
    const dashboardClearFiltersBtn = document.getElementById('dashboard-clear-filters');
    const dashboardFilterBtn = document.getElementById('dashboard-filter-btn');
    const dashboardFilterPanel = document.getElementById('dashboard-filter-panel');
    const dashboardFilterControls = document.getElementById('dashboard-filter-controls');

    if (dashboardFilterType) {
        dashboardFilterType.addEventListener('change', () => {
            renderDashboard();
        });
    }
    if (dashboardFilterYear) {
        dashboardFilterYear.addEventListener('change', () => {
            renderDashboard();
        });
    }
    if (dashboardFilterMonth) {
        dashboardFilterMonth.addEventListener('change', () => {
            renderDashboard();
        });
    }
    if (dashboardFilterPerson) {
        dashboardFilterPerson.addEventListener('change', () => {
            renderDashboard();
        });
    }
    if (dashboardFilterCategory) {
        dashboardFilterCategory.addEventListener('change', () => {
            renderDashboard();
        });
    }
    if (dashboardClearFiltersBtn) {
        dashboardClearFiltersBtn.addEventListener('click', () => {
            if (dashboardFilterType) dashboardFilterType.value = 'all';
            if (dashboardFilterYear) dashboardFilterYear.value = '';
            if (dashboardFilterMonth) dashboardFilterMonth.value = '';
            if (dashboardFilterPerson) dashboardFilterPerson.value = '';
            if (dashboardFilterCategory) dashboardFilterCategory.value = '';
            renderDashboard();
        });
    }

    // Dashboard filter button toggle
    if (dashboardFilterBtn && dashboardFilterPanel && dashboardFilterControls) {
        dashboardFilterBtn.addEventListener('click', () => {
            const isVisible = dashboardFilterPanel.style.display !== 'none';
            dashboardFilterPanel.style.display = isVisible ? 'none' : 'block';
            dashboardFilterControls.style.display = isVisible ? 'none' : 'flex';
            dashboardFilterBtn.classList.toggle('active', !isVisible);
        });

        const dashboardFilterClose = document.getElementById('dashboard-filter-close');
        if (dashboardFilterClose) {
            dashboardFilterClose.addEventListener('click', () => {
                const isMobile = window.innerWidth <= 480;
                if (isMobile) {
                    dashboardFilterPanel.classList.remove('active');
                    document.body.classList.remove('filter-open');
                }
                dashboardFilterPanel.style.display = 'none';
                dashboardFilterControls.style.display = 'none';
                dashboardFilterBtn.classList.remove('active');
            });
        }
    }

    // Hero month selector click handler - open filter panel
    const heroMonthSelector = document.querySelector('.hero-month-selector');
    if (heroMonthSelector) {
        heroMonthSelector.addEventListener('click', () => {
            const dashboardFilterBtn = document.getElementById('dashboard-filter-btn');
            if (dashboardFilterBtn) {
                dashboardFilterBtn.click();
            }
        });
    }

    
    // Analytics Filters
    const analyticsFilterType = document.getElementById('analytics-filter-type');
    const analyticsFilterYear = document.getElementById('analytics-filter-year');
    const analyticsFilterMonth = document.getElementById('analytics-filter-month');
    const analyticsFilterPerson = document.getElementById('analytics-filter-person');
    const analyticsFilterCategory = document.getElementById('analytics-filter-category');
    const analyticsClearFiltersBtn = document.getElementById('analytics-clear-filters');

    const analyticsFilterControls = document.getElementById('analytics-filter-controls');
    const analyticsFilterPanel = document.getElementById('analytics-filter-panel');

    function togglePanel(panelEl, controlsEl) {
        if (!panelEl || !controlsEl) return;
        const isMobile = window.innerWidth <= 480;
        const isVisible = isMobile ? panelEl.classList.contains('active') : controlsEl.style.display !== 'none';

        if (isMobile) {
            // Mobile: use class-based toggle with body scroll lock
            if (isVisible) {
                panelEl.classList.remove('active');
                document.body.classList.remove('filter-open');
            } else {
                panelEl.classList.add('active');
                document.body.classList.add('filter-open');
            }
            // Keep controls visible when panel is active on mobile
            controlsEl.style.display = isVisible ? 'none' : 'flex';
        } else {
            // Desktop: use display toggle
            controlsEl.style.display = isVisible ? 'none' : 'flex';
            panelEl.style.display = isVisible ? 'none' : 'block';
        }
    }

    // Close filter panel when clicking outside on mobile
    const closeFilterOnBackdropClick = (e) => {
        const isMobile = window.innerWidth <= 480;
        if (!isMobile) return;

        const recordsPanel = document.getElementById('records-filter-panel');
        const analyticsPanel = document.getElementById('analytics-filter-panel');
        const recordsControls = document.getElementById('records-filter-controls');
        const analyticsControls = document.getElementById('analytics-filter-controls');

        if (e.target === recordsPanel && recordsPanel?.classList.contains('active')) {
            recordsPanel.classList.remove('active');
            if (recordsControls) recordsControls.style.display = 'none';
            document.body.classList.remove('filter-open');
            headerFiltersBtn?.classList.remove('active');
        }
        if (e.target === analyticsPanel && analyticsPanel?.classList.contains('active')) {
            analyticsPanel.classList.remove('active');
            if (analyticsControls) analyticsControls.style.display = 'none';
            document.body.classList.remove('filter-open');
            headerFiltersBtn?.classList.remove('active');
        }
    };

    window.addEventListener('click', closeFilterOnBackdropClick);

    // Header Filters button (next to month)
    const headerFiltersBtn = document.getElementById('header-filters-btn');
    if (headerFiltersBtn) {
        headerFiltersBtn.addEventListener('click', () => {
            if (currentTab === 'dashboard') togglePanel(dashboardFilterPanel, dashboardFilterControls);
            if (currentTab === 'analytics') togglePanel(analyticsFilterPanel, analyticsFilterControls);

            const isOpen =
                (currentTab === 'dashboard' && dashboardFilterPanel.style.display !== 'none') ||
                (currentTab === 'analytics' && analyticsFilterPanel.style.display !== 'none');
            headerFiltersBtn.classList.toggle('active', isOpen);
        });
    }

    const analyticsFilterClose = document.getElementById('analytics-filter-close');
    if (analyticsFilterClose) {
        analyticsFilterClose.addEventListener('click', () => {
            const isMobile = window.innerWidth <= 480;
            if (isMobile) {
                analyticsFilterPanel.classList.remove('active');
                document.body.classList.remove('filter-open');
            }
            analyticsFilterPanel.style.display = 'none';
            analyticsFilterControls.style.display = 'none';
            headerFiltersBtn.classList.remove('active');
        });
    }

    if (analyticsFilterType) {
        analyticsFilterType.addEventListener('change', renderAnalytics);
    }
    if (analyticsFilterYear) {
        analyticsFilterYear.addEventListener('change', renderAnalytics);
    }
    if (analyticsFilterMonth) {
        analyticsFilterMonth.addEventListener('change', renderAnalytics);
    }
    if (analyticsFilterPerson) {
        analyticsFilterPerson.addEventListener('change', renderAnalytics);
    }
    if (analyticsFilterCategory) {
        analyticsFilterCategory.addEventListener('change', renderAnalytics);
    }
    if (analyticsClearFiltersBtn) {
        analyticsClearFiltersBtn.addEventListener('click', () => {
            if (analyticsFilterType) analyticsFilterType.value = 'all';
            if (analyticsFilterYear) analyticsFilterYear.value = '';
            if (analyticsFilterMonth) analyticsFilterMonth.value = '';
            if (analyticsFilterPerson) analyticsFilterPerson.value = '';
            if (analyticsFilterCategory) analyticsFilterCategory.value = '';
            renderAnalytics();
        });
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

    // Show More Chart Categories Button
    const showMoreChartCategoriesBtn = document.getElementById('show-more-chart-categories');
    if (showMoreChartCategoriesBtn) {
        showMoreChartCategoriesBtn.addEventListener('click', toggleChartCategoriesVisibility);
    }

    // Data Management
    exportBtn.addEventListener('click', handleExport);
    importFile.addEventListener('change', handleImport);
    if (resetBtn) {
        resetBtn.addEventListener('click', handleReset);
    } else {
        console.error('reset-btn not found');
    }

    // Selective Reset
    if (selectiveResetBtn) {
        selectiveResetBtn.addEventListener('click', handleSelectiveReset);
    } else {
        console.error('selective-reset-btn not found');
    }
    if (resetTypeSelect) {
        resetTypeSelect.addEventListener('change', handleResetTypeChange);
    } else {
        console.error('reset-type not found');
    }

    // Record Type Toggle (Simplify Income)
    recordTypeSelect.addEventListener('change', () => {
        updateCategoryDropdowns();
        toggleItemField();
    });

    // Record Format Type Toggle (Single vs Combined)
    if (recordFormatTypeSelect) {
        recordFormatTypeSelect.addEventListener('change', toggleRecordFormat);
    }

    // Add Transaction Button for Combined Transactions
    if (addTransactionBtn) {
        addTransactionBtn.addEventListener('click', addCombinedTransaction);
    }

    // Savings tab: add account, transaction and pagination handlers
    if (addAccountBtn) {
        addAccountBtn.addEventListener('click', () => openAccountModal());
    }

    // Set up account form event listener directly
    const accountFormEl = document.getElementById('account-form');
    if (accountFormEl) {
        accountFormEl.addEventListener('submit', handleAccountSubmit);
    }

    const cancelAccountBtnEl = document.getElementById('cancel-account-modal');
    if (cancelAccountBtnEl) {
        cancelAccountBtnEl.addEventListener('click', closeAccountModal);
    }

    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionSubmit);
    }
    if (cancelTransactionBtn) {
        cancelTransactionBtn.addEventListener('click', closeTransactionModal);
    }

    // delegate click events inside savings list (deposit/withdraw buttons, pagination)
    if (savingsListEl) {
        savingsListEl.addEventListener('click', async (e) => {
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
                if (await showConfirm('Delete this account? All its transactions will be removed too.')) {
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
                if (await showConfirm('Delete this transaction?')) {
                    remove(STORE_SAVINGS_TRANSACTIONS, txId).then(() => refreshData());
                }
            }
        });
    }

    // global delegation in case buttons are moved out of cards
    document.body.addEventListener('click', async (e) => {
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
            if (await showConfirm('Delete this account? All its transactions will be removed too.')) {
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
            if (await showConfirm('Delete this transaction?')) {
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
        if (e.target === categoryEditModal) closeCategoryEditModal();
    });

    // Handle window resize for chart container
    window.addEventListener('resize', () => {
        if (chartCategoriesExpanded) {
            const chartContainer = document.querySelector('#categoryChart')?.closest('.chart-container');
            if (chartContainer) {
                // Recalculate height on resize
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                const monthlyRecords = records.filter(r => {
                    const recordDate = new Date(r.date);
                    return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
                });

                const spendingByCategory = {};
                const spendingRecords = monthlyRecords.filter(r => r.type === 'spending');
                spendingRecords.forEach(r => {
                    spendingByCategory[r.category] = (spendingByCategory[r.category] || 0) + parseFloat(r.amount);
                });

                const categoryCount = Object.keys(spendingByCategory).length;
                const neededHeight = Math.max(300, 250 + (categoryCount * 25));
                chartContainer.style.height = neededHeight + 'px';
            }
        }
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

    // Category Edit Modal
    if (cancelCategoryEditBtn) {
        cancelCategoryEditBtn.addEventListener('click', closeCategoryEditModal);
    }
    if (categoryEditForm) {
        categoryEditForm.addEventListener('submit', handleEditSubmit);
    }

    // Budget Limit Modal
    if (addBudgetLimitBtn) {
        addBudgetLimitBtn.addEventListener('click', () => openBudgetLimitModal());
    }
    if (cancelBudgetLimitBtn) {
        cancelBudgetLimitBtn.addEventListener('click', closeBudgetLimitModal);
    }
    if (budgetLimitForm) {
        budgetLimitForm.addEventListener('submit', handleBudgetLimitSubmit);
    }
    if (resetAllBudgetsBtn) {
        resetAllBudgetsBtn.addEventListener('click', handleResetAllBudgets);
    }

    // Budget limit list delegation for edit/delete/reset
    const budgetLimitsList = document.getElementById('budget-limits-list');
    if (budgetLimitsList) {
        budgetLimitsList.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-budget-btn');
            const deleteBtn = e.target.closest('.delete-budget-btn');
            const resetBtn = e.target.closest('.reset-budget-btn');
            
            if (editBtn) {
                const id = parseInt(editBtn.getAttribute('data-id'));
                const limit = budgetLimits.find(l => l.id === id);
                if (limit) openBudgetLimitModal(limit);
            } else if (deleteBtn) {
                const id = parseInt(deleteBtn.getAttribute('data-id'));
                if (await showConfirm('Delete this budget limit?')) {
                    await remove(STORE_BUDGET_LIMITS, id);
                    await refreshData();
                    renderBudget();
                    showToast('Budget limit deleted', 'success');
                }
            } else if (resetBtn) {
                const id = parseInt(resetBtn.getAttribute('data-id'));
                const limit = budgetLimits.find(l => l.id === id);
                if (limit) {
                    limit.lastResetDate = new Date().toISOString();
                    await updateRecord(STORE_BUDGET_LIMITS, limit);
                    renderBudget();
                    showToast('Spending reset for ' + limit.category + ' - tracking from now', 'success');
                }
            }
        });
    }

    // Close budget modal on click outside
    window.addEventListener('click', (e) => {
        if (e.target === budgetLimitModal) closeBudgetLimitModal();
    });

    // Upcoming Income Modal
    if (addUpcomingIncomeBtn) {
        addUpcomingIncomeBtn.addEventListener('click', openUpcomingIncomeModal);
    }
    if (cancelUpcomingIncomeBtn) {
        cancelUpcomingIncomeBtn.addEventListener('click', closeUpcomingIncomeModal);
    }
    if (upcomingIncomeForm) {
        upcomingIncomeForm.addEventListener('submit', handleUpcomingIncomeSubmit);
    }

    // Close upcoming income modal on click outside
    window.addEventListener('click', (e) => {
        if (e.target === upcomingIncomeModal) closeUpcomingIncomeModal();
    });
}

function toggleItemField() {
    const recordItem = document.getElementById('record-item');
    const formatType = recordFormatTypeSelect?.value || 'single';
    const recordType = recordTypeSelect?.value || 'spending';

    if (recordType === 'income') {
        itemFieldContainer.style.display = 'none';
        recordItem.removeAttribute('required');
    } else {
        // Show item field for spending and account_receivable
        itemFieldContainer.style.display = 'block';
        // Item field is optional - if empty, category name will be used
        recordItem.removeAttribute('required');
    }
}

function updateCombinedTransactionCategoryDropdown() {
    const combinedCategorySelect = document.getElementById('combined-transaction-category');
    if (!combinedCategorySelect) return;

    const selectedValue = combinedCategorySelect.value;

    // Show all categories for combined transactions (both income and spending)
    combinedCategorySelect.innerHTML = '<option value="">Select Category (Optional)</option>' +
        categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    combinedCategorySelect.value = selectedValue;
}

function getCombinedTransactionNetType() {
    if (combinedTransactions.length === 0) return 'spending';

    let totalIncome = 0;
    let totalSpending = 0;

    combinedTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const quantity = parseInt(t.quantity) || 1;
        const totalAmount = amount * quantity;

        if (t.type === 'income') {
            totalIncome += totalAmount;
        } else {
            totalSpending += totalAmount;
        }
    });

    return totalIncome >= totalSpending ? 'income' : 'spending';
}

function toggleRecordFormat() {
    const formatType = recordFormatTypeSelect.value;
    const isCombined = formatType === 'combined';

    // Show/hide combined transactions section
    if (combinedTransactionsSection) {
        combinedTransactionsSection.style.display = isCombined ? 'block' : 'none';
    }

    // For combined transactions, hide individual transaction fields and remove required
    const individualFields = [
        { element: document.getElementById('record-item'), container: document.getElementById('item-field-container') },
        { element: document.getElementById('record-amount'), container: document.getElementById('record-amount')?.closest('.form-group') },
        { element: document.getElementById('record-quantity'), container: document.getElementById('record-quantity')?.closest('.form-group') },
        { element: document.getElementById('record-category'), container: document.getElementById('record-category')?.closest('.form-group') },
        { element: document.getElementById('record-person'), container: document.getElementById('record-person')?.closest('.form-group') }
    ];

    individualFields.forEach(({ element, container }) => {
        if (element && container) {
            if (isCombined) {
                container.style.display = 'none';
                element.removeAttribute('required');
            } else {
                container.style.display = 'block';
                // Restore required attribute for necessary fields only
                if (element.id === 'record-amount') {
                    element.setAttribute('required', '');
                }
            }
        }
    });

    // Update combined transaction category dropdown when switching to combined format
    if (isCombined) {
        updateCombinedTransactionCategoryDropdown();
    }

    // Reset combined transactions when switching format
    if (!isCombined) {
        combinedTransactions = [];
        combinedTransactionIdCounter = 0;
        if (combinedTransactionsList) {
            combinedTransactionsList.innerHTML = '';
        }
    }
}

function updateSavingsAccountDropdown() {
    if (!recordSavingsAccountSelect) return;
    const selectedValue = recordSavingsAccountSelect.value;
    recordSavingsAccountSelect.innerHTML = '<option value="">No Savings Account</option>' +
        savingsAccounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');
    recordSavingsAccountSelect.value = selectedValue;
}

function addCombinedTransaction() {
    const transaction = {
        id: combinedTransactionIdCounter++,
        type: recordTypeSelect.value,
        category: '',
        item: '',
        person: '',
        amount: '',
        quantity: '1',
        savingsAccountId: ''
    };

    // Add to beginning of array so new transactions appear at top
    combinedTransactions.unshift(transaction);
    renderCombinedTransactions();
}

function removeCombinedTransaction(id) {
    combinedTransactions = combinedTransactions.filter(t => t.id !== id);
    // Re-index remaining transactions to maintain sequential numbering
    combinedTransactions.forEach((transaction, index) => {
        transaction.id = index;
    });
    combinedTransactionIdCounter = combinedTransactions.length;
    renderCombinedTransactions();
}

function renderCombinedTransactions() {
    if (!combinedTransactionsList) return;

    combinedTransactionsList.innerHTML = '';

    // Get the total element
    const totalElement = document.getElementById('combined-transactions-total');

    combinedTransactions.forEach((transaction, index) => {
        // Display number in reverse order (newest gets highest number)
        const displayNumber = combinedTransactions.length - index;

        const div = document.createElement('div');
        div.className = 'combined-transaction-item';
        div.innerHTML = `
            <div class="transaction-header">
                <span>Transaction #${displayNumber}</span>
                <button type="button" class="remove-transaction" onclick="removeCombinedTransaction(${transaction.id})">
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
            <div class="transaction-details">
                <div class="form-row">
                    <div class="form-group">
                        <label>Type</label>
                        <select onchange="updateCombinedTransaction(${transaction.id}, 'type', this.value)">
                            <option value="spending" ${transaction.type === 'spending' ? 'selected' : ''}>Spending</option>
                            <option value="income" ${transaction.type === 'income' ? 'selected' : ''}>Income</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select onchange="updateCombinedTransaction(${transaction.id}, 'category', this.value)">
                            <option value="">Select Category</option>
                            ${categories.filter(c => c.type === transaction.type).map(c =>
            `<option value="${c.name}" ${transaction.category === c.name ? 'selected' : ''}>${c.name}</option>`
        ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" ${transaction.type === 'income' ? 'style="display: none;"' : ''}>
                        <label>Item</label>
                        <input type="text" placeholder="e.g. Grocery shopping" 
                               value="${transaction.item}"
                               onchange="updateCombinedTransaction(${transaction.id}, 'item', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Amount</label>
                        <input type="number" step="0.01" placeholder="0.00" 
                               value="${transaction.amount}"
                               onchange="updateCombinedTransaction(${transaction.id}, 'amount', this.value)">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Person</label>
                        <select onchange="updateCombinedTransaction(${transaction.id}, 'person', this.value)">
                            <option value="">Select Person (Optional)</option>
                            ${people.map(p =>
            `<option value="${p.name}" ${transaction.person === p.name ? 'selected' : ''}>${p.name}</option>`
        ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Quantity</label>
                        <input type="number" placeholder="1" 
                               value="${transaction.quantity}"
                               onchange="updateCombinedTransaction(${transaction.id}, 'quantity', this.value)">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Savings Account (Optional)</label>
                        <select onchange="updateCombinedTransaction(${transaction.id}, 'savingsAccountId', this.value)">
                            <option value="">No Savings Account</option>
                            ${savingsAccounts.map(acc =>
            `<option value="${acc.id}" ${transaction.savingsAccountId == acc.id ? 'selected' : ''}>${acc.name}</option>`
        ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <!-- Empty div for grid layout balance -->
                    </div>
                </div>
            </div>
        `;
        combinedTransactionsList.appendChild(div);
    });

    // Update total display in header
    if (totalElement) {
        if (combinedTransactions.length > 0) {
            let totalIncome = 0;
            let totalSpending = 0;

            combinedTransactions.forEach(t => {
                const amount = parseFloat(t.amount) || 0;
                const quantity = parseInt(t.quantity) || 1;
                const totalAmount = amount * quantity;

                if (t.type === 'income') {
                    totalIncome += totalAmount;
                } else {
                    totalSpending += totalAmount;
                }
            });

            const netAmount = totalIncome - totalSpending;
            const incomeCount = combinedTransactions.filter(t => t.type === 'income').length;
            const spendingCount = combinedTransactions.filter(t => t.type === 'spending').length;

            totalElement.innerHTML = `Total: ${netAmount >= 0 ? '+' : ''}$${formatCurrency(Math.abs(netAmount))} (${incomeCount} income, ${spendingCount} spending)`;
            totalElement.style.display = 'block';

            // Update combined transaction category dropdown when transactions change
            updateCombinedTransactionCategoryDropdown();
        } else {
            totalElement.style.display = 'none';
        }
    }
}

function updateCombinedTransaction(id, field, value) {
    const transaction = combinedTransactions.find(t => t.id === id);
    if (transaction) {
        transaction[field] = value;

        // If type changed, update category options and item field visibility
        if (field === 'type') {
            transaction.category = '';
            transaction.item = '';
            renderCombinedTransactions();
        }
    }
}

function calculateBalanceAtTransaction(recordDate, excludeRecordId = null) {
    const targetDate = new Date(recordDate);
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    // Get all records before the transaction date within the same month only
    const recordsBeforeDate = records.filter(r => {
        const recordDateTime = new Date(r.date);
        const recordMonth = recordDateTime.getMonth();
        const recordYear = recordDateTime.getFullYear();

        // Only include records from the same month and year
        if (recordMonth !== targetMonth || recordYear !== targetYear) {
            return false;
        }

        // If same date, only include records with earlier ID (assuming sequential IDs)
        if (recordDateTime.getTime() === targetDate.getTime()) {
            return r.id !== excludeRecordId && r.id < excludeRecordId;
        }

        return recordDateTime < targetDate;
    });

    // Sort records by date and ID to ensure proper order
    recordsBeforeDate.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateA - dateB;
        }
        return a.id - b.id; // Sort by ID if same date
    });

    // Expand combined transactions for accurate balance calculation
    const expandedRecords = [];
    recordsBeforeDate.forEach(r => {
        if (r.formatType === 'combined' && r.combinedTransactions) {
            // For combined transactions, add the net amount as a single entry
            // Don't expand individual components to avoid double counting
            expandedRecords.push({
                ...r,
                type: r.type, // Use the combined transaction's net type
                amount: r.amount // Use the combined transaction's net amount
            });
        } else {
            expandedRecords.push(r);
        }
    });

    // Calculate balance
    let balance = 0;
    expandedRecords.forEach(r => {
        const amount = parseFloat(r.amount) || 0;
        if (r.type === 'income') {
            balance += amount;
        } else {
            balance -= amount;
        }
    });

    return balance;
}

function formatCurrency(amount) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrencyNoDecimals(amount) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Test function for monthly balance reset
function testMonthlyBalanceReset() {
    // Create test records spanning multiple months
    const testRecords = [
        { id: 1, date: '2027-02-15', type: 'income', amount: 1000, formatType: 'single' },
        { id: 2, date: '2027-02-20', type: 'spending', amount: 200, formatType: 'single' },
        { id: 3, date: '2027-03-01', type: 'income', amount: 500, formatType: 'single' },
        { id: 4, date: '2027-03-05', type: 'spending', amount: 100, formatType: 'single' },
        { id: 5, date: '2027-03-10', type: 'income', amount: 300, formatType: 'single' }
    ];

    // Temporarily replace records with test data
    const originalRecords = records;
    records = testRecords;

    // Test February transaction (should have opening balance of 0)
    const febBalance = calculateBalanceAtTransaction('2027-02-20', 2);
    console.log('February transaction opening balance:', febBalance); // Should be 1000

    // Test March transaction (should have opening balance of 0, ignoring February)
    const marchBalance = calculateBalanceAtTransaction('2027-03-05', 4);
    console.log('March transaction opening balance:', marchBalance); // Should be 500

    // Test later March transaction (should include earlier March transactions)
    const lateMarchBalance = calculateBalanceAtTransaction('2027-03-10', 5);
    console.log('Late March transaction opening balance:', lateMarchBalance); // Should be 500 + (-100) = 400

    // Restore original records
    records = originalRecords;

    console.log('Monthly balance reset test completed');
}

async function refreshData() {
    records = await getAll(STORE_RECORDS);
    categories = await getAll(STORE_CATEGORIES);
    people = await getAll(STORE_PEOPLE);
    // new: load savings
    savingsAccounts = await getAll(STORE_SAVINGS_ACCOUNTS);
    savingsTransactions = await getAll(STORE_SAVINGS_TRANSACTIONS);
    // load budget limits
    budgetLimits = await getAll(STORE_BUDGET_LIMITS);
    savingsPage = {}; // start pages over so user sees first page after data change
    updateCategoryDropdowns();
    updatePersonDropdown();
    updateSavingsAccountDropdown();
    renderAll();
    populateYearFilter();
    populateAnalyticsFilterDropdowns();
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

    const header = document.querySelector('header');
    if (header) {
        header.classList.toggle('dashboard-header-hide', tabId === 'dashboard');
    }
    const headerFiltersBtn = document.getElementById('header-filters-btn');
    const userInfo = document.querySelector('.user-info');

    // Show floating user-info on analytics, budget, savings, and settings only
    const showUserInfoTabs = ['analytics', 'budget', 'savings', 'settings'];
    if (userInfo) {
        userInfo.style.display = showUserInfoTabs.includes(tabId) ? 'flex' : 'none';
    }

    // Update tab name inside user-info box
    const tabNameBadgeUserInfo = document.getElementById('tab-name-badge-userinfo');
    if (tabNameBadgeUserInfo) {
        if (showUserInfoTabs.includes(tabId)) {
            tabNameBadgeUserInfo.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
            tabNameBadgeUserInfo.style.display = 'inline-block';
        } else {
            tabNameBadgeUserInfo.style.display = 'none';
        }
    }

    if (headerFiltersBtn) {
        headerFiltersBtn.style.display = tabId === 'analytics' ? '' : 'none';
        headerFiltersBtn.classList.remove('active');
    }

    // Close any open filter panels when switching tabs
    const idsToHide = [
        'records-filter-controls',
        'records-filter-panel',
        'analytics-filter-controls',
        'analytics-filter-panel'
    ];
    idsToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.classList?.remove('active');
        }
    });

    // Remove body scroll lock class when switching tabs
    document.body.classList.remove('filter-open');

    renderAll();

    // Scroll to top on tab switch
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderAll() {
    if (currentTab === 'dashboard') renderDashboard();
    else if (currentTab === 'analytics') renderAnalytics();
    else if (currentTab === 'settings') renderSettings();
    else if (currentTab === 'savings') renderSavings();
    else if (currentTab === 'budget') renderBudget();
}

// Dashboard Functions
function renderDashboard() {
    // Get filter values
    const filterType = document.getElementById('dashboard-filter-type')?.value || 'all';
    const filterYearValue = document.getElementById('dashboard-filter-year')?.value;
    const filterMonthValue = document.getElementById('dashboard-filter-month')?.value;
    const filterPerson = document.getElementById('dashboard-filter-person')?.value;
    const filterCategoryValue = document.getElementById('dashboard-filter-category')?.value;

    const now = new Date();
    // Default context is current month/year
    const currentMonth = filterMonthValue ? (parseInt(filterMonthValue) - 1) : now.getMonth();
    const currentYear = filterYearValue ? parseInt(filterYearValue) : now.getFullYear();

    const monthDisplay = document.getElementById('current-month-display');
    const heroMonthEl = document.getElementById('hero-month-display');

    // Update labels to reflect filtered month/year
    const displayDate = new Date(currentYear, currentMonth);
    let displayLabel = "";
    if (filterMonthValue && filterYearValue) {
        displayLabel = displayDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else if (filterMonthValue) {
        displayLabel = displayDate.toLocaleString('default', { month: 'long' });
    } else if (filterYearValue) {
        displayLabel = filterYearValue;
    } else {
        displayLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    if (monthDisplay) monthDisplay.textContent = displayLabel;
    if (heroMonthEl) heroMonthEl.textContent = displayLabel;


    // Process records to expand combined transactions for KPI calculations
    const expandedRecords = [];
    records.forEach(r => {
        if (r.formatType === 'combined' && r.combinedTransactions) {
            // Expand combined transactions into individual components
            r.combinedTransactions.forEach((ct, index) => {
                const amount = parseFloat(ct.amount) || 0;
                const quantity = parseInt(ct.quantity) || 1;
                const totalAmount = amount * quantity;

                expandedRecords.push({
                    ...r,
                    type: ct.type,
                    category: 'Combined',
                    actualCategory: ct.category,
                    person: ct.person || r.person,
                    item: ct.item || r.item,
                    amount: totalAmount,
                    quantity: quantity,
                    originalId: r.id,
                    isCombinedComponent: true,
                    componentIndex: index
                });
            });
        } else {
            // Ignore legacy carried-forward A/R duplicates (we keep the original record as the source of truth)
            if (!(r.type === 'account_receivable' && r.carriedForwardFrom)) {
                expandedRecords.push(r);
            }
        }
    });

    // Filter records for KPI calculation based on ALL active filters
    const kpiFilteredRecords = expandedRecords.filter(r => {
        const isSavings = !!r.isSavingsTransfer;

        // Type filter
        let typeMatch = true;
        if (filterType !== 'all') {
            if (filterType === 'savings') typeMatch = isSavings;
            else if (filterType === 'spending') typeMatch = r.type === 'spending' && !isSavings;
            else if (filterType === 'income') typeMatch = r.type === 'income' && !isSavings;
            else if (filterType === 'account_receivable') typeMatch = r.type === 'account_receivable';
        }

        // Person/Category filters
        const personMatch = !filterPerson || r.person === filterPerson;
        let categoryMatch = !filterCategoryValue;
        if (filterCategoryValue) {
            const catToMatch = r.isCombinedComponent ? r.actualCategory : r.category;
            if (filterCategoryValue === 'all-income') {
                categoryMatch = r.type === 'income' && !isSavings;
            } else if (filterCategoryValue === 'all-spending') {
                categoryMatch = (r.type === 'spending' || r.type === 'account_receivable') && !isSavings;
            } else {
                categoryMatch = catToMatch === filterCategoryValue;
            }
        }

        const d = new Date(r.date);
        const yearMatch = !filterYearValue || d.getFullYear().toString() === filterYearValue;
        const monthMatch = !filterMonthValue || (d.getMonth() + 1).toString().padStart(2, '0') === filterMonthValue;

        let isInPeriod = false;
        if (!filterYearValue && !filterMonthValue) {
            // Default: current month
            isInPeriod = (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
        } else {
            // Filtered period
            isInPeriod = yearMatch && monthMatch;
        }

        return typeMatch && isInPeriod && personMatch && categoryMatch;
    });

    const monthlyRecords = kpiFilteredRecords;


    // Calculate income and spending (AR does NOT affect either - it's balance-only)
    let income = 0;
    let spending = 0;

    monthlyRecords.forEach(r => {
        const amount = parseFloat(r.amount) || 0;

        if (r.isSavingsTransfer) {
            if (r.type === 'income') {
                spending += amount;
            }
            return;
        }

        if (r.type === 'income') {
            income += amount;
        } else if (r.type === 'spending') {
            spending += amount;
        }
        // account_receivable excluded - affects balance only, not income/spending
    });

    // Calculate AR impact on balance (only PENDING AR reduces balance - collected has no effect)
    const arImpact = monthlyRecords
        .filter(r => r.type === 'account_receivable' && !r.collected)
        .reduce((sum, r) => sum - (parseFloat(r.amount) || 0), 0);

    const balance = income - spending + arImpact;

    // Calculate Accounts Receivable (filter by selected person/category if applicable)
    const arPending = expandedRecords
        .filter(r => {
            if (r.type !== 'account_receivable' || r.collected) return false;

            const personMatch = !filterPerson || r.person === filterPerson;
            const categoryMatch = !filterCategoryValue || (r.isCombinedComponent ? r.actualCategory : r.category) === filterCategoryValue;

            return personMatch && categoryMatch;
        })
        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);


    const incomeEl = document.getElementById('total-income');
    const spendingEl = document.getElementById('total-spending');
    const balanceEl = document.getElementById('total-balance');
    const arEl = document.getElementById('total-ar');

    if (incomeEl) incomeEl.innerHTML = `<span class="dollar-positive">+$</span><span class="amount-num">${formatCurrency(income)}</span>`;
    if (spendingEl) spendingEl.innerHTML = `<span class="dollar-negative">-$</span><span class="amount-num">${formatCurrency(spending)}</span>`;
    if (balanceEl) balanceEl.innerHTML = `<span class="${balance >= 0 ? 'dollar-positive' : 'dollar-negative'}">${balance >= 0 ? '+' : '-'}$</span><span class="amount-num">${formatCurrency(Math.abs(balance))}</span>`;
    if (arEl) arEl.innerHTML = `<span class="dollar-negative">-$</span><span class="amount-num">${formatCurrency(arPending)}</span>`;

    // Update Mobile Hero Metrics
    // heroMonthEl update already handled above


    const heroSpendingEl = document.getElementById('hero-spending');
    const heroIncomeEl = document.getElementById('hero-income');
    const heroThisMonthValEl = document.getElementById('hero-this-month-val');
    const heroTrendIconEl = document.getElementById('hero-trend-icon');
    const heroArDisplayEl = document.getElementById('hero-ar-display');

    if (heroSpendingEl) heroSpendingEl.innerHTML = `<span class="dollar-icon spending-icon">$</span><span class="amount-num">${formatCurrencyNoDecimals(spending)}</span>`;
    if (heroIncomeEl) heroIncomeEl.innerHTML = `<span class="dollar-icon income-icon">$</span><span class="amount-num">${formatCurrencyNoDecimals(income)}</span>`;
    if (heroThisMonthValEl) heroThisMonthValEl.innerHTML = `<span class="currency-sign">$</span><span class="amount-num">${formatCurrencyNoDecimals(Math.abs(balance))}</span>`;
    if (heroTrendIconEl) {
        // Trend based on balance (positive = up/green, negative = down/red)
        if (balance >= 0) {
            heroTrendIconEl.className = 'fas fa-arrow-trend-up trend-up';
        } else {
            heroTrendIconEl.className = 'fas fa-arrow-trend-down trend-down';
        }
    }
    if (heroArDisplayEl) {
        heroArDisplayEl.style.display = 'block';
        heroArDisplayEl.innerHTML = `Accounts Receivable: <span class="dollar-icon ar-icon">$</span><span class="amount-num">${formatCurrency(arPending)}</span>`;
    }

    // Render records - pass ORIGINAL records (not expanded) so combined transactions appear as single entries
    // Only expand for the dashboard display list, not for KPI calculations which need to count each component
    const originalNonCarriedRecords = records.filter(r => !(r.type === 'account_receivable' && r.carriedForwardFrom));
    renderDashboardRecords(originalNonCarriedRecords);
    
    // Render upcoming widget
    renderUpcomingWidget();
}


// Dashboard Records - Card Based Layout (matching mobile app screenshots)
function renderDashboardRecords(recordsToRender) {
    const container = document.getElementById('dashboard-records-list');
    if (!container) return;

    // Get filter values
    const filterType = document.getElementById('dashboard-filter-type')?.value || 'all';
    const filterYear = document.getElementById('dashboard-filter-year')?.value;
    const filterMonth = document.getElementById('dashboard-filter-month')?.value;
    const filterPerson = document.getElementById('dashboard-filter-person')?.value;
    const filterCategory = document.getElementById('dashboard-filter-category')?.value;

    // Apply filters
    let filteredRecords = recordsToRender.filter(r => {
        const isSavings = !!r.isSavingsTransfer;

        // Correct type matching:
        // if filterType is 'income', match r.type === 'income' AND NOT savings
        // if filterType is 'spending', match r.type === 'spending' AND NOT savings
        // if filterType is 'savings', match isSavings === true
        // if filterType is 'account_receivable', match r.type === 'account_receivable'

        let typeMatch = false;
        if (filterType === 'all') {
            typeMatch = true;
        } else if (filterType === 'savings') {
            typeMatch = isSavings;
        } else if (filterType === 'spending') {
            typeMatch = r.type === 'spending' && !isSavings;
        } else if (filterType === 'income') {
            typeMatch = r.type === 'income' && !isSavings;
        } else if (filterType === 'account_receivable') {
            typeMatch = r.type === 'account_receivable';
        }

        const recordDate = new Date(r.date);
        const now = new Date();

        // Date Period Match logic
        let periodMatch = false;
        if (!filterYear && !filterMonth) {
            // Default Dashboard View: Current month transactions OR any currently pending AR
            const isCurrentMonth = recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
            const isPendingAR = r.type === 'account_receivable' && !r.collected;
            periodMatch = isCurrentMonth || isPendingAR;
        } else {
            // Explicit Filter View: Match the selected Year and/or Month
            const yearMatch = !filterYear || recordDate.getFullYear().toString() === filterYear;
            const monthMatch = !filterMonth || (recordDate.getMonth() + 1).toString().padStart(2, '0') === filterMonth;
            periodMatch = yearMatch && monthMatch;

            // Special Dashboard Case: Pending AR is often kept visible on the dashboard even when filtering by month,
            // as it represents outstanding action items. Only show if it matches other active filters.
            if (r.type === 'account_receivable' && !r.collected && (filterType === 'all' || filterType === 'account_receivable')) {
                periodMatch = true;
            }
        }

        const personMatch = !filterPerson || r.person === filterPerson;

        let categoryMatch = !filterCategory;
        if (filterCategory) {
            const catToMatch = r.isCombinedComponent ? r.actualCategory : r.category;
            if (filterCategory === 'all-income') {
                categoryMatch = r.type === 'income' && !isSavings;
            } else if (filterCategory === 'all-spending') {
                categoryMatch = (r.type === 'spending' || r.type === 'account_receivable') && !isSavings;
            } else {
                categoryMatch = catToMatch === filterCategory;
            }
        }

        return typeMatch && periodMatch && personMatch && categoryMatch;
    });

    // Sort by date (newest first), then by timestamp for precise ordering within same day
    filteredRecords.sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        // Use timestamp for secondary sort (newest first)
        return (b.timestamp || 0) - (a.timestamp || 0);
    });

    // Clear container
    container.innerHTML = '';

    if (filteredRecords.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>No transactions yet</p>
                <span>Your transactions will appear here. Tap the button above to add your first one!</span>
            </div>
        `;
        return;
    }

    // Group records by week for stats calculation
    const getWeekKey = (dateObj) => {
        const day = dateObj.getDate();
        let week = 4;
        if (day <= 7) week = 1;
        else if (day < 15) week = 2;
        else if (day < 22) week = 3;
        return `${dateObj.getMonth()}-${dateObj.getFullYear()}-W${week}`;
    };

    // Calculate week stats
    const weekStats = {};
    filteredRecords.forEach(r => {
        const recordDateObj = new Date(r.date);
        const weekKey = getWeekKey(recordDateObj);
        
        if (!weekStats[weekKey]) {
            weekStats[weekKey] = { count: 0, spending: 0, income: 0 };
        }
        
        weekStats[weekKey].count++;
        
        if (r.formatType === 'combined' && r.combinedTransactions) {
            // For combined transactions, calculate based on components
            r.combinedTransactions.forEach(ct => {
                const amount = (parseFloat(ct.amount) || 0) * (parseInt(ct.quantity) || 1);
                if (ct.type === 'income') {
                    weekStats[weekKey].income += amount;
                } else {
                    weekStats[weekKey].spending += amount;
                }
            });
        } else {
            const amount = parseFloat(r.amount) || 0;
            if (r.type === 'income') {
                weekStats[weekKey].income += amount;
            } else if (r.type === 'spending') {
                weekStats[weekKey].spending += amount;
            }
            // account_receivable excluded - affects balance only, not income/spending
        }
    });

    // Render each record as a card
    const now = new Date();
    let currentWeek = -1;
    let currentMonthYear = '';

    filteredRecords.forEach(r => {
        const isCombined = r.formatType === 'combined';
        const recordDateObj = new Date(r.date);

        // Add Week Separators logic
        const monthYearKey = `${recordDateObj.getMonth()}-${recordDateObj.getFullYear()}`;
        const day = recordDateObj.getDate();

        let recordWeek = 4;
        if (day <= 7) recordWeek = 1;
        else if (day < 15) recordWeek = 2;
        else if (day < 22) recordWeek = 3;

        // Detect if we transitioned to a different month (e.g. from current month to past AR items)
        if (typeof currentMonthYear === 'undefined' || monthYearKey !== currentMonthYear) {
            currentMonthYear = monthYearKey;
            currentWeek = -1; // Reset week tracking for the new month
        }

        if (recordWeek !== currentWeek) {
            currentWeek = recordWeek;
            const weekKey = getWeekKey(recordDateObj);
            const stats = weekStats[weekKey] || { count: 0, spending: 0, income: 0 };
            
            const separator = document.createElement('div');
            separator.className = 'week-separator';
            separator.innerHTML = `
                <div class="week-separator-header">
                    <span>Week ${currentWeek}</span>
                    <div class="week-separator-stats">
                        <span class="week-stat count">
                            <i class="fas fa-list-ol"></i> ${stats.count}
                        </span>
                        <span class="week-stat spending">
                            <i class="fas fa-arrow-down"></i> <span class="dollar-negative">$</span><span class="amount-num">${formatCurrency(stats.spending)}</span>
                        </span>
                        <span class="week-stat income">
                            <i class="fas fa-arrow-up"></i> <span class="dollar-positive">$</span><span class="amount-num">${formatCurrency(stats.income)}</span>
                        </span>
                    </div>
                </div>
            `;
            container.appendChild(separator);
        }
        const isAR = r.type === 'account_receivable';
        const isSavingsTransfer = r.category === 'Savings Transfer' || r.type === 'savings_transfer';
        const isCarriedForward = r.carriedForwardFrom;
        const arStatus = isAR ? (r.collected ? ' (Collected)' : ' (Pending)') : '';

        // For combined transactions, calculate net and breakdown
        let combinedIncome = 0;
        let combinedSpending = 0;
        let combinedNet = 0;
        let hasMixedTypes = false;
        let combinedBreakdownHtml = '';

        if (isCombined && r.combinedTransactions) {
            r.combinedTransactions.forEach(ct => {
                const amount = parseFloat(ct.amount) || 0;
                const quantity = parseInt(ct.quantity) || 1;
                const totalAmount = amount * quantity;
                if (ct.type === 'income') {
                    combinedIncome += totalAmount;
                } else {
                    combinedSpending += totalAmount;
                }
            });
            combinedNet = combinedIncome - combinedSpending;
            hasMixedTypes = combinedIncome > 0 && combinedSpending > 0;

            // Create breakdown HTML
            const incomePart = combinedIncome > 0 ? `<span class="income-part">+${formatCurrency(combinedIncome)}</span>` : '';
            const spendingPart = combinedSpending > 0 ? `<span class="spending-part">-${formatCurrency(combinedSpending)}</span>` : '';
            const netClass = combinedNet >= 0 ? 'positive' : 'negative';
            const netSign = combinedNet >= 0 ? '+' : '';
            const netPart = `<span class="net-part ${netClass}">${netSign}${formatCurrency(combinedNet)}</span>`;

            combinedBreakdownHtml = `
                <div class="combined-breakdown">
                    ${incomePart}
                    ${spendingPart}
                    <span style="color: var(--border-color);">|</span>
                    Net: ${netPart}
                </div>
            `;
        }

        // Determine icon and colors based on type
        let icon, typeClass, amountClass, amountPrefix;
        if (isSavingsTransfer) {
            icon = 'fa-piggy-bank';
            typeClass = 'savings';
            amountClass = 'spending';
            amountPrefix = '-';
        } else if (isCombined) {
            // Combined transaction: show special styling
            icon = 'fa-layer-group';
            typeClass = 'combined';
            // For combined, use net to determine color
            if (combinedNet >= 0) {
                amountClass = 'income';
                amountPrefix = '+';
            } else {
                amountClass = 'spending';
                amountPrefix = '-';
            }
        } else if (r.type === 'income') {
            icon = 'fa-dollar-sign';
            typeClass = 'income';
            amountClass = 'income';
            amountPrefix = '+';
        } else if (r.type === 'account_receivable') {
            icon = 'fa-dollar-sign';
            typeClass = 'account_receivable';
            amountClass = r.collected ? 'income' : 'account_receivable';
            amountPrefix = '';
        } else {
            icon = 'fa-dollar-sign';
            typeClass = 'spending';
            amountClass = 'spending';
            amountPrefix = '-';
        }

        // Get display name
        let displayName = r.isCombinedComponent ? (r.item || 'Combined Transaction') :
            (isCombined ? r.item : (r.type === 'income' ? r.category : r.item));
        if (isCarriedForward) displayName += ' ↻';

        // Get category name
        const categoryName = r.isCombinedComponent ? r.actualCategory : r.category;

        // Format date
        const dateObj = new Date(r.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const card = document.createElement('div');
        card.className = `transaction-card ${typeClass}`;
        card.onclick = (e) => {
            // Don't open details if clicking on action buttons
            if (e.target.closest('.transaction-actions')) return;
            openDetailsModal(r);
        };

        // Combined indicator badge - removed as per user request
        const combinedBadge = '';

        // Show amount - for combined, show the net
        const displayAmount = isCombined ? Math.abs(combinedNet) : parseFloat(r.amount);

        card.innerHTML = `
            <div class="transaction-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-name">${displayName}</div>
                <div class="transaction-category">
                    <span class="category-badge badge-${isCombined ? (combinedNet >= 0 ? 'income' : 'spending') : r.type}">${isCombined ? 'Combined' : categoryName}${arStatus}</span>
                    ${r.person ? `<span><i class="fas fa-user" style="font-size: 0.7rem;"></i> ${r.person}</span>` : ''}
                </div>
            </div>
            <div class="transaction-amount">
                <div class="amount ${amountClass}"><span class="${isAR ? 'ar-icon' : (amountPrefix === '+' ? 'dollar-positive' : 'dollar-negative')}">${amountPrefix}$</span><span class="amount-num">${formatCurrency(displayAmount)}</span></div>
                <div class="date">${dateStr}</div>
            </div>
            <div class="transaction-actions">
                ${isAR && !r.collected ? `
                    <button class="btn-icon collect-btn" onclick="event.stopPropagation(); collectAR(${r.isCombinedComponent ? r.originalId : r.id})" title="Mark Collected">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                ${isAR && r.collected ? `
                    <button class="btn-icon undo-btn" onclick="event.stopPropagation(); undoCollectAR(${r.isCombinedComponent ? r.originalId : r.id})" title="Mark Pending">
                        <i class="fas fa-undo"></i>
                    </button>
                ` : ''}
                <button class="btn-icon edit-btn" onclick="event.stopPropagation(); editRecord(${r.isCombinedComponent ? r.originalId : r.id})" title="Edit">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="btn-icon delete-btn" onclick="event.stopPropagation(); deleteRecord(${r.isCombinedComponent ? r.originalId : r.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        container.appendChild(card);
    });
}

function renderCharts(monthlyRecords) {
    // Include all transactions in chart calculations
    const nonSavingsRecords = monthlyRecords;

    const spendingByCategory = {};
    const spendingRecords = nonSavingsRecords.filter(r => r.type === 'spending');

    spendingRecords.forEach(r => {
        spendingByCategory[r.category] = (spendingByCategory[r.category] || 0) + parseFloat(r.amount);
    });

    const canvasCat = document.getElementById('categoryChart');
    if (canvasCat) {
        const ctxCat = canvasCat.getContext('2d');
        if (categoryChart) categoryChart.destroy();

        let labels = Object.keys(spendingByCategory);
        let data = Object.values(spendingByCategory);

        // Check if we're on mobile and need to limit categories
        const isMobile = window.innerWidth <= 768;
        const showMoreBtn = document.getElementById('show-more-chart-categories');
        const allLabels = [...labels]; // Store original labels before truncation

        console.log('renderCharts - isMobile:', isMobile, 'chartCategoriesExpanded:', chartCategoriesExpanded, 'labels.length:', labels.length, 'allLabels.length:', allLabels.length, 'chartCategoriesVisible:', chartCategoriesVisible);

        if (isMobile && !chartCategoriesExpanded && labels.length > chartCategoriesVisible) {
            // Limit categories and create "Other" category for the rest
            const sortedCategories = labels
                .map((label, index) => ({ label, value: data[index] }))
                .sort((a, b) => b.value - a.value);

            const visibleCategories = sortedCategories.slice(0, chartCategoriesVisible);
            const otherCategories = sortedCategories.slice(chartCategoriesVisible);

            labels = visibleCategories.map(cat => cat.label);
            data = visibleCategories.map(cat => cat.value);

            // Add "Other" category if there are remaining items
            if (otherCategories.length > 0) {
                const otherTotal = otherCategories.reduce((sum, cat) => sum + cat.value, 0);
                labels.push('Other');
                data.push(otherTotal);
            }

            // Show the show more button
            if (showMoreBtn) {
                showMoreBtn.style.display = 'block';
                console.log('Showing button (collapsed state)');
            }
        } else {
            // Show all categories or on desktop
            if (showMoreBtn) {
                // Always show button on mobile if we have more real categories than limit
                const shouldShowButton = isMobile && allLabels.length > chartCategoriesVisible;
                showMoreBtn.style.display = shouldShowButton ? 'block' : 'none';
                console.log('Button visibility (expanded/desktop):', shouldShowButton, 'display set to:', shouldShowButton ? 'block' : 'none');
            }
        }

        // Adjust chart container height based on expansion state
        const chartContainer = canvasCat.closest('.chart-container');
        if (chartContainer) {
            if (chartCategoriesExpanded) {
                // Calculate needed height based on number of categories
                const categoryCount = labels.length;
                // Base height + extra height for legend items (approximately 25px per legend item)
                const neededHeight = Math.max(300, 250 + (categoryCount * 25));
                chartContainer.style.height = neededHeight + 'px';
            } else {
                // Reset to default height
                chartContainer.style.height = '300px';
            }
        }

        if (labels.length > 0) {
            categoryChart = new Chart(ctxCat, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: ['#355872', '#7AAACE', '#9CD5FF', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
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

    const income = nonSavingsRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const spending = nonSavingsRecords.filter(r => r.type === 'spending').reduce((sum, r) => sum + parseFloat(r.amount), 0);

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

// Populate year dropdown
function populateYearFilter() {
    const yearSelect = document.getElementById('filter-year');
    const analyticsYearSelect = document.getElementById('analytics-filter-year');
    const dashboardYearSelect = document.getElementById('dashboard-filter-year');

    if (!records || records.length === 0) return;

    // Get unique years from records
    const years = [...new Set(records.map(r => r.date.substring(0, 4)))].sort().reverse();

    // Populate records filter
    if (yearSelect) {
        yearSelect.innerHTML = '<option value="">All Years</option>';
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    }

    // Populate analytics filter
    if (analyticsYearSelect) {
        analyticsYearSelect.innerHTML = '<option value="">All Years</option>';
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            analyticsYearSelect.appendChild(option);
        });
    }

    // Populate dashboard filter
    if (dashboardYearSelect) {
        dashboardYearSelect.innerHTML = '<option value="">All Years</option>';
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            dashboardYearSelect.appendChild(option);
        });
    }
}

// Populate analytics person and category dropdowns
function populateAnalyticsFilterDropdowns() {
    const analyticsPersonSelect = document.getElementById('analytics-filter-person');
    const analyticsCategorySelect = document.getElementById('analytics-filter-category');
    const recordsPersonSelect = document.getElementById('filter-person');
    const recordsCategorySelect = document.getElementById('filter-category');
    const dashboardPersonSelect = document.getElementById('dashboard-filter-person');
    const dashboardCategorySelect = document.getElementById('dashboard-filter-category');

    // Populate analytics person dropdown
    if (analyticsPersonSelect) {
        const currentValue = analyticsPersonSelect.value;
        analyticsPersonSelect.innerHTML = '<option value="">All People</option>' +
            people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        analyticsPersonSelect.value = currentValue;
    }

    // Populate analytics category dropdown
    if (analyticsCategorySelect) {
        const currentValue = analyticsCategorySelect.value;
        const incomeCategories = categories.filter(c => c.type === 'income');
        const spendingCategories = categories.filter(c => c.type === 'spending');

        analyticsCategorySelect.innerHTML = '<option value="">All Categories</option>' +
            '<option value="all-income">All Income Categories</option>' +
            '<option value="all-spending">All Spending Categories</option>' +
            '<option value="" disabled>──────────</option>' +
            incomeCategories.map(c => `<option value="${c.name}">${c.name} (Income)</option>`).join('') +
            (incomeCategories.length > 0 && spendingCategories.length > 0 ? '<option value="" disabled>──────────</option>' : '') +
            spendingCategories.map(c => `<option value="${c.name}">${c.name} (Spending)</option>`).join('');
        analyticsCategorySelect.value = currentValue;
    }

    // Populate records person dropdown
    if (recordsPersonSelect) {
        const currentValue = recordsPersonSelect.value;
        recordsPersonSelect.innerHTML = '<option value="">All People</option>' +
            people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        recordsPersonSelect.value = currentValue;
    }

    // Populate records category dropdown
    if (recordsCategorySelect) {
        const currentValue = recordsCategorySelect.value;
        const incomeCategories = categories.filter(c => c.type === 'income');
        const spendingCategories = categories.filter(c => c.type === 'spending');

        recordsCategorySelect.innerHTML = '<option value="">All Categories</option>' +
            '<option value="all-income">All Income Categories</option>' +
            '<option value="all-spending">All Spending Categories</option>' +
            '<option value="" disabled>──────────</option>' +
            incomeCategories.map(c => `<option value="${c.name}">${c.name} (Income)</option>`).join('') +
            (incomeCategories.length > 0 && spendingCategories.length > 0 ? '<option value="" disabled>──────────</option>' : '') +
            spendingCategories.map(c => `<option value="${c.name}">${c.name} (Spending)</option>`).join('');
        recordsCategorySelect.value = currentValue;
    }

    // Populate dashboard person dropdown
    if (dashboardPersonSelect) {
        const currentValue = dashboardPersonSelect.value;
        dashboardPersonSelect.innerHTML = '<option value="">All People</option>' +
            people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        dashboardPersonSelect.value = currentValue;
    }

    // Populate dashboard category dropdown
    if (dashboardCategorySelect) {
        const currentValue = dashboardCategorySelect.value;
        const incomeCategories = categories.filter(c => c.type === 'income');
        const spendingCategories = categories.filter(c => c.type === 'spending');

        dashboardCategorySelect.innerHTML = '<option value="">All Categories</option>' +
            '<option value="all-income">All Income Categories</option>' +
            '<option value="all-spending">All Spending Categories</option>' +
            '<option value="" disabled>──────────</option>' +
            incomeCategories.map(c => `<option value="${c.name}">${c.name} (Income)</option>`).join('') +
            (incomeCategories.length > 0 && spendingCategories.length > 0 ? '<option value="" disabled>──────────</option>' : '') +
            spendingCategories.map(c => `<option value="${c.name}">${c.name} (Spending)</option>`).join('');
        dashboardCategorySelect.value = currentValue;
    }
}

// Records Functions
function renderRecords() {
    const tbody = document.getElementById('records-body');
    if (!tbody) return;

    const filterTypeEl = document.getElementById('filter-type');
    tbody.innerHTML = '';

    const filterType = document.getElementById('filter-type')?.value || 'all';
    const filterYear = document.getElementById('filter-year')?.value;
    const filterMonth = document.getElementById('filter-month')?.value;
    const filterPerson = document.getElementById('filter-person')?.value;
    const filterCategory = document.getElementById('filter-category')?.value;

    // Expand combined transactions for rendering and filtering
    const expandedRecords = [];
    records.forEach(r => {
        if (r.formatType === 'combined' && r.combinedTransactions) {
            const total = r.combinedTransactions.length;
            r.combinedTransactions.forEach((ct, index) => {
                const amount = parseFloat(ct.amount) || 0;
                const quantity = parseInt(ct.quantity) || 1;
                const totalAmount = amount * quantity;

                expandedRecords.push({
                    ...r,
                    type: ct.type,
                    category: 'Combined',
                    actualCategory: ct.category, // Store for filtering
                    person: ct.person || r.person,
                    item: ct.item || r.item,
                    amount: totalAmount,
                    quantity: quantity,
                    originalId: r.id,
                    isCombinedComponent: true,
                    componentIndex: index,
                    totalComponents: total,
                    notes: r.notes // Keep parent notes or use component notes if added later
                });
            });
        } else {
            // Ignore legacy carried-forward A/R duplicates (we keep the original record as the source of truth)
            if (!(r.type === 'account_receivable' && r.carriedForwardFrom)) {
                expandedRecords.push(r);
            }
        }
    });

    // If month+year filters are set, pending A/R should "carry forward" into that month.
    // Example: viewing March 2027 should still show A/R from Feb 2027 if still pending.
    let filterMonthEnd = null;
    if (filterYear && filterMonth) {
        const y = parseInt(filterYear, 10);
        const m = parseInt(filterMonth, 10); // 1-12
        if (!Number.isNaN(y) && !Number.isNaN(m)) {
            // last millisecond of the filtered month
            filterMonthEnd = new Date(y, m, 0, 23, 59, 59, 999);
        }
    }

    let filteredRecords = expandedRecords.filter(r => {
        const isSavings = !!r.isSavingsTransfer;
        const typeMatch =
            filterType === 'all' ||
            (filterType === 'savings' ? isSavings : (r.type === filterType && !isSavings));
        const recordDate = new Date(r.date);
        const isPendingAR = r.type === 'account_receivable' && !r.collected;

        // Default year/month match behavior
        let yearMatch = !filterYear || recordDate.getFullYear().toString() === filterYear;
        let monthMatch = !filterMonth || (recordDate.getMonth() + 1).toString() === filterMonth;

        // Carry-forward behavior for pending A/R when filtering by a specific month+year
        if (filterMonthEnd && isPendingAR) {
            yearMatch = true;
            monthMatch = recordDate <= filterMonthEnd;
        }
        const personMatch = !filterPerson || r.person === filterPerson;

        let categoryMatch = !filterCategory;
        if (filterCategory) {
            const catToMatch = r.isCombinedComponent ? r.actualCategory : r.category;
            if (filterCategory === 'all-income') {
                categoryMatch = r.type === 'income' && !isSavings;
            } else if (filterCategory === 'all-spending') {
                categoryMatch = (r.type === 'spending' || r.type === 'account_receivable') && !isSavings;
            } else {
                categoryMatch = catToMatch === filterCategory;
            }
        }

        return typeMatch && yearMatch && monthMatch && personMatch && categoryMatch;
    });

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records found</td></tr>';
        return;
    }

    // Insert parent rows for grouped transactions if not filtering heavily
    const recordsWithParents = [];
    let lastOriginalId = null;
    const isFiltering = filterType !== 'all' || filterYear || filterMonth || filterPerson || filterCategory;

    filteredRecords.forEach(r => {
        if (!isFiltering && r.isCombinedComponent) {
            if (r.originalId !== lastOriginalId) {
                // Find original record to get total amount and name
                const parent = records.find(p => p.id === r.originalId);
                if (parent) {
                    recordsWithParents.push({
                        ...parent,
                        isParentGroupHeader: true
                    });
                }
                lastOriginalId = r.originalId;
            }
        } else if (!r.isCombinedComponent) {
            lastOriginalId = null;
        }
        recordsWithParents.push(r);
    });

    const finalRecords = isFiltering ? filteredRecords : recordsWithParents;

    // Group by month and sort by date (newest first within each month)
    const grouped = {};
    finalRecords.forEach(r => {
        const date = new Date(r.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (!grouped[monthKey]) grouped[monthKey] = [];
        grouped[monthKey].push(r);
    });

    // Sort months by date (newest first)
    const sortedMonths = Object.keys(grouped).sort((a, b) => {
        const [aYear, aMonth] = a.split('-').map(Number);
        const [bYear, bMonth] = b.split('-').map(Number);
        return (bYear - aYear) || (bMonth - aMonth);
    });

    sortedMonths.forEach(monthKey => {
        const monthRecords = grouped[monthKey];
        // Sort records within month by date and ID (newest first)
        monthRecords.sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;
            const idCompare = (b.originalId || b.id) - (a.originalId || a.id);
            if (idCompare !== 0) return idCompare;
            return (a.componentIndex || 0) - (b.componentIndex || 0); // Keep sub-transactions in original order
        });

        const [year, month] = monthKey.split('-').map(Number);
        const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Add month separator
        const separatorRow = document.createElement('tr');
        separatorRow.innerHTML = `
            <td colspan="8" style="padding: 0;">
                <div class="month-separator" data-month="${monthName} - ${monthRecords.length} transactions"></div>
            </td>
        `;
        tbody.appendChild(separatorRow);

        // Add records for this month
        monthRecords.forEach(r => {
            const tr = document.createElement('tr');
            const isCombined = r.formatType === 'combined';
            const isCarriedForward = r.carriedForwardFrom;
            const carriedForwardText = isCarriedForward ? ' <span class="carried-forward-indicator">↻ Carried Forward</span>' : '';

            let rowClass = (r.type || '');
            if (r.isCombinedComponent) {
                rowClass += ' sub-row';
                if (r.componentIndex === 0) rowClass += ' group-start';
                if (r.componentIndex === r.totalComponents - 1) rowClass += ' group-end';
            } else if (r.isParentGroupHeader) {
                rowClass += ' parent-group-row';
            }
            if (r.isSavingsTransfer) {
                rowClass += ' savings-transfer-row';
            }

            tr.className = rowClass;
            tr.onclick = () => openDetailsModal(r);

            const isAR = r.type === 'account_receivable';
            const arClass = isAR ? (r.collected ? 'collected' : 'pending') : '';
            const arStatusText = isAR ? (r.collected ? ' (Collected)' : ' (Pending)') : '';
            const isSavingsTransfer = !!r.isSavingsTransfer || r.category === 'Savings Transfer' || r.type === 'savings_transfer';
            const savingsTransferText = `<span class="category-badge badge-savings">Saving</span>`;

            tr.innerHTML = `
                <td>${r.isParentGroupHeader ? '' : r.date}</td>
                <td class="item-cell">${(r.isCombinedComponent ? (r.item || '-') : (isCombined ? r.item : (r.type === 'income' ? r.category : r.item))) + (r.isCombinedComponent ? '' : carriedForwardText)}</td>
                <td>
                    ${r.isParentGroupHeader ? '' : (isSavingsTransfer ? savingsTransferText : `
                        <span class="category-badge badge-${r.type} ${arClass}">${r.isCombinedComponent ? r.actualCategory : r.category}${arStatusText}</span>
                    `)}
                </td>
                <td>${r.isParentGroupHeader ? '' : (r.person || '-')}</td>
                <td class="${r.type === 'income' ? 'amount-income' : (r.type === 'account_receivable' ? 'amount-account_receivable ' + arClass : 'amount-spending')}">
                    <span class="${r.type === 'income' ? 'dollar-positive' : (r.type === 'account_receivable' ? 'ar-icon' : 'dollar-negative')}">${r.type === 'income' ? '+' : (r.type === 'account_receivable' ? '' : '-')}$</span><span class="amount-num">${formatCurrency(parseFloat(r.amount))}</span>
                    ${isCombined && !r.isCombinedComponent && !r.isParentGroupHeader ? `<br><small style="color: var(--text-muted);">(${r.quantity} items)</small>` : ''}
                </td>
                <td>${r.isParentGroupHeader ? '' : (r.quantity || '-')}</td>
                <td><div class="notes-cell">${r.isParentGroupHeader ? '' : (r.notes || '-')}</div></td>
                <td>
                    <div class="action-btns">
                        ${isAR && !r.collected && !r.isParentGroupHeader ? `
                            <button class="btn-icon collect-btn" onclick="event.stopPropagation(); collectAR(${r.isCombinedComponent ? r.originalId : r.id})" title="Mark Collected">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        ${isAR && r.collected && !r.isParentGroupHeader ? `
                            <button class="btn-icon uncollect-btn" onclick="event.stopPropagation(); uncollectAR(${r.isCombinedComponent ? r.originalId : r.id})" title="Mark Pending">
                                <i class="fas fa-undo"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon edit-btn" onclick="event.stopPropagation(); editRecord(${r.isCombinedComponent ? r.originalId : (r.isParentGroupHeader ? r.id : r.id)})"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-btn" onclick="event.stopPropagation(); deleteRecord(${r.isCombinedComponent ? r.originalId : (r.isParentGroupHeader ? r.id : r.id)})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

// Analytics Functions
function renderAnalytics() {
    const statsBody = document.getElementById('stats-body');
    if (!statsBody) return;
    statsBody.innerHTML = '';

    // Get filter values
    const filterType = document.getElementById('analytics-filter-type')?.value || 'all';
    const filterYear = document.getElementById('analytics-filter-year')?.value;
    const filterMonth = document.getElementById('analytics-filter-month')?.value;
    const filterPerson = document.getElementById('analytics-filter-person')?.value;
    const filterCategory = document.getElementById('analytics-filter-category')?.value;

    // Process records to expand combined transactions for analytics
    const expandedRecords = [];
    records.forEach(r => {
        if (r.formatType === 'combined' && r.combinedTransactions) {
            // Expand combined transactions into individual components
            r.combinedTransactions.forEach(ct => {
                const amount = parseFloat(ct.amount) || 0;
                const quantity = parseInt(ct.quantity) || 1;
                const totalAmount = amount * quantity;

                expandedRecords.push({
                    ...r,
                    type: ct.type,
                    category: ct.category,
                    person: ct.person || r.person,
                    item: ct.item || r.item,
                    amount: totalAmount,
                    quantity: quantity,
                    originalId: r.id,
                    isCombinedComponent: true
                });
            });
        } else {
            // Ignore legacy carried-forward A/R duplicates (use the original record only)
            if (!(r.type === 'account_receivable' && r.carriedForwardFrom)) {
                expandedRecords.push(r);
            }
        }
    });

    // Apply filters
    const filteredRecords = expandedRecords.filter(r => {
        const recordDate = new Date(r.date);
        const isSavings = !!r.isSavingsTransfer;
        const typeMatch =
            filterType === 'all' ||
            (filterType === 'savings' ? isSavings : (r.type === filterType && !isSavings));
        const yearMatch = !filterYear || recordDate.getFullYear().toString() === filterYear;
        const monthMatch = filterMonth === '' || (recordDate.getMonth() + 1).toString() === filterMonth;
        const personMatch = !filterPerson || r.person === filterPerson;

        let categoryMatch = !filterCategory;
        if (filterCategory) {
            if (filterCategory === 'all-income') {
                categoryMatch = r.type === 'income' && !isSavings;
            } else if (filterCategory === 'all-spending') {
                categoryMatch = (r.type === 'spending' || r.type === 'account_receivable') && !isSavings;
            } else {
                categoryMatch = r.category === filterCategory;
            }
        }

        return typeMatch && yearMatch && monthMatch && personMatch && categoryMatch;
    });

    // Group records by month
    const monthlyStats = {};
    filteredRecords.forEach(r => {
        const date = new Date(r.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { income: 0, spending: 0, arPending: 0, arCollected: 0, categories: {} };
        }

        const amount = parseFloat(r.amount) || 0;

        if (r.isSavingsTransfer) {
            if (r.type === 'income') {
                monthlyStats[monthKey].spending += amount;
            }
            return;
        }

        if (r.type === 'income') {
            monthlyStats[monthKey].income += amount;
        } else if (r.type === 'spending') {
            monthlyStats[monthKey].spending += parseFloat(r.amount);
            monthlyStats[monthKey].categories[r.category] = (monthlyStats[monthKey].categories[r.category] || 0) + parseFloat(r.amount);
        }
        // account_receivable excluded - affects balance only, not income/spending
    });

    const sortedMonths = Object.keys(monthlyStats).sort().reverse();

    if (sortedMonths.length === 0) {
        statsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 3rem; color: var(--text-muted);">No historical data available</td></tr>';
    }

    sortedMonths.forEach(monthKey => {
        const stats = monthlyStats[monthKey];
        const totalSpending = stats.spending;
        const totalIncome = stats.income;
        const savings = totalIncome - totalSpending;

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
            <td class="amount-income"><span class="dollar-positive">+$</span><span class="amount-num">${formatCurrency(totalIncome)}</span></td>
            <td class="amount-spending"><span class="dollar-negative">-$</span><span class="amount-num">${formatCurrency(totalSpending)}</span></td>
            <td><span class="${savings >= 0 ? 'dollar-positive' : 'dollar-negative'}">${savings >= 0 ? '+' : '-'}$</span><span class="amount-num">${formatCurrency(Math.abs(savings))}</span></td>
            <td>${topCategory}</td>
        `;
        statsBody.appendChild(tr);
    });

    // If a specific month is selected, show daily trend when year is known.
    // If year isn't selected but the chosen month is the current month, assume current year (common "this month" workflow).
    const now = new Date();
    const effectiveYear =
        filterYear ? parseInt(filterYear, 10)
            : (filterMonth && parseInt(filterMonth, 10) === (now.getMonth() + 1) ? now.getFullYear() : null);

    if (filterMonth && effectiveYear) {
        const monthIndex = parseInt(filterMonth, 10) - 1; // 0-based
        const yearNum = effectiveYear;
        renderMonthlyTrendChart(monthlyStats, {
            mode: 'daily',
            year: yearNum,
            monthIndex
        }, filteredRecords);
    } else {
        renderMonthlyTrendChart(monthlyStats, { mode: 'monthly' });
    }
    // Render filter-specific KPIs
    renderFilterKPIs(filteredRecords, filterCategory, filterPerson);

    renderPersonChart(filteredRecords);

    // Render charts moved from Dashboard
    renderCharts(filteredRecords);
}

// Render filter-specific KPIs for analytics
function renderFilterKPIs(filteredRecords, filterCategory, filterPerson) {
    const kpiContainer = document.getElementById('filter-kpi-container');
    const kpiCard = document.getElementById('analytics-filter-kpis');
    if (!kpiContainer || !kpiCard) return;

    // Always show KPIs
    kpiCard.style.display = 'block';

    // Calculate totals for filtered category
    let categoryIncome = 0;
    let categorySpending = 0;
    let topCategory = { name: 'N/A', amount: 0 };
    const categoryTotals = {};

    // Calculate totals for filtered person
    let personIncome = 0;
    let personSpending = 0;
    let topPerson = { name: 'N/A', amount: 0 };
    const personTotals = {};

    filteredRecords.forEach(r => {
        const amount = parseFloat(r.amount) || 0;
        const isSavings = !!r.isSavingsTransfer;

        // Category calculations
        if (r.category) {
            if (!categoryTotals[r.category]) {
                categoryTotals[r.category] = { income: 0, spending: 0 };
            }
            if (r.type === 'income' && !isSavings) {
                categoryTotals[r.category].income += amount;
                if (filterCategory && r.category === filterCategory) {
                    categoryIncome += amount;
                }
            } else if (r.type === 'spending' && !isSavings) {
                categoryTotals[r.category].spending += amount;
                if (filterCategory && r.category === filterCategory) {
                    categorySpending += amount;
                }
            }
        }

        // Person calculations
        if (r.person) {
            if (!personTotals[r.person]) {
                personTotals[r.person] = { income: 0, spending: 0 };
            }
            if (r.type === 'income' && !isSavings) {
                personTotals[r.person].income += amount;
                if (filterPerson && r.person === filterPerson) {
                    personIncome += amount;
                }
            } else if (r.type === 'spending' && !isSavings) {
                personTotals[r.person].spending += amount;
                if (filterPerson && r.person === filterPerson) {
                    personSpending += amount;
                }
            }
        }
    });

    // Find top spending category and person
    let maxCategorySpending = 0;
    for (const [cat, totals] of Object.entries(categoryTotals)) {
        if (totals.spending > maxCategorySpending) {
            maxCategorySpending = totals.spending;
            topCategory = { name: cat, amount: totals.spending };
        }
    }

    let maxPersonSpending = 0;
    for (const [person, totals] of Object.entries(personTotals)) {
        if (totals.spending > maxPersonSpending) {
            maxPersonSpending = totals.spending;
            topPerson = { name: person, amount: totals.spending };
        }
    }

    // Build KPI HTML
    let kpiHTML = '';

    // Filtered Category KPI
    if (filterCategory) {
        const catTotal = categoryIncome - categorySpending;
        const catType = catTotal >= 0 ? 'income' : 'spending';
        kpiHTML += `
            <div class="kpi-card ${catType}">
                <div class="kpi-icon"><i class="fas fa-tag"></i></div>
                <div class="kpi-details">
                    <h3>${filterCategory}</h3>
                    <p>${catTotal >= 0 ? '+' : ''}$${formatCurrency(Math.abs(catTotal))}</p>
                    <small style="color: var(--text-muted); font-size: 0.75rem;">
                        ${categoryIncome > 0 ? `Income: $${formatCurrency(categoryIncome)}` : ''}
                        ${categorySpending > 0 ? `Spending: $${formatCurrency(categorySpending)}` : ''}
                    </small>
                </div>
            </div>
        `;
    }

    // Filtered Person KPI
    if (filterPerson) {
        const personTotal = personIncome - personSpending;
        const personType = personTotal >= 0 ? 'income' : 'spending';
        kpiHTML += `
            <div class="kpi-card ${personType}">
                <div class="kpi-icon"><i class="fas fa-user"></i></div>
                <div class="kpi-details">
                    <h3>${filterPerson}</h3>
                    <p>${personTotal >= 0 ? '+' : ''}$${formatCurrency(Math.abs(personTotal))}</p>
                    <small style="color: var(--text-muted); font-size: 0.75rem;">
                        ${personIncome > 0 ? `Income: $${formatCurrency(personIncome)}` : ''}
                        ${personSpending > 0 ? `Spending: $${formatCurrency(personSpending)}` : ''}
                    </small>
                </div>
            </div>
        `;
    }

    // Top Category KPI (always show when filter is active)
    if (topCategory.amount > 0) {
        kpiHTML += `
            <div class="kpi-card spending">
                <div class="kpi-icon"><i class="fas fa-chart-pie"></i></div>
                <div class="kpi-details">
                    <h3>Top Category</h3>
                    <p>$${formatCurrency(topCategory.amount)}</p>
                    <small style="color: var(--text-muted); font-size: 0.75rem;">${topCategory.name}</small>
                </div>
            </div>
        `;
    }

    // Top Person KPI (always show when filter is active)
    if (topPerson.amount > 0) {
        kpiHTML += `
            <div class="kpi-card spending">
                <div class="kpi-icon"><i class="fas fa-users"></i></div>
                <div class="kpi-details">
                    <h3>Top Person</h3>
                    <p>$${formatCurrency(topPerson.amount)}</p>
                    <small style="color: var(--text-muted); font-size: 0.75rem;">${topPerson.name}</small>
                </div>
            </div>
        `;
    }

    kpiContainer.innerHTML = kpiHTML || '<p style="text-align:center; color: var(--text-muted);">No data available for selected filters</p>';
}

function renderMonthlyTrendChart(monthlyStats, view = { mode: 'monthly' }, filteredRecordsForDaily = null) {
    const canvas = document.getElementById('monthlyTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (monthlyTrendChart) monthlyTrendChart.destroy();

    let labels = [];
    let incomeData = [];
    let spendingData = [];

    if (view?.mode === 'daily' && filteredRecordsForDaily && Number.isFinite(view.year) && Number.isFinite(view.monthIndex)) {
        const daysInMonth = new Date(view.year, view.monthIndex + 1, 0).getDate();
        labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
        incomeData = Array.from({ length: daysInMonth }, () => 0);
        spendingData = Array.from({ length: daysInMonth }, () => 0);

        filteredRecordsForDaily.forEach(r => {
            const d = new Date(r.date);
            if (d.getFullYear() !== view.year || d.getMonth() !== view.monthIndex) return;
            const dayIdx = d.getDate() - 1;
            const amount = parseFloat(r.amount) || 0;

            // Savings transfer records should not count as income/spending here (they are "savings" type),
            // BUT existing analytics logic treats income+savingsTransfer as spending. Keep that behavior.
            if (r.isSavingsTransfer) {
                if (r.type === 'income') spendingData[dayIdx] += amount;
                return;
            }

            if (r.type === 'income') {
                incomeData[dayIdx] += amount;
            } else if (r.type === 'spending') {
                spendingData[dayIdx] += amount;
            }
            // account_receivable excluded - affects balance only, not income/spending
        });
    } else {
        const months = Object.keys(monthlyStats).sort();
        // Calculate total income and spending (AR does not affect either)
        incomeData = months.map(m => {
            const stats = monthlyStats[m];
            return stats.income;
        });
        spendingData = months.map(m => {
            const stats = monthlyStats[m];
            return stats.spending;
        });
        labels = months.map(m => {
            const [year, month] = m.split('-');
            return new Date(year, month - 1).toLocaleString('default', { month: 'short' });
        });
    }

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

function renderPersonChart(filteredRecords = null) {
    const canvas = document.getElementById('personChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (personChart) personChart.destroy();

    // Use filtered records if provided, otherwise use all records
    const recordsToUse = filteredRecords || records;

    // Calculate spending by person (AR does not affect spending)
    const spendingByPerson = {};
    recordsToUse.forEach(r => {
        if (r.person && r.type === 'spending') {
            spendingByPerson[r.person] = (spendingByPerson[r.person] || 0) + parseFloat(r.amount);
        }
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
                backgroundColor: ['#355872', '#7AAACE', '#9CD5FF', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
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

    // Get the form element from the event target
    const form = e.target.closest('form');
    if (!form) return;

    const id = form.elements['account-id'].value;
    const name = form.elements['account-name'].value.trim();
    const initial = parseFloat(form.elements['account-initial'].value) || 0;

    if (!name) {
        showToast('Please enter an account name', 'warning');
        return;
    }

    try {
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

            // if initial deposit provided, add transaction (allow 0)
            if (initial >= 0) {
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
    } catch (error) {
        showToast('Error saving account: ' + error.message, 'error');
    }
}

function openTransactionModal(accountId, type, tx = null) {
    transactionForm.reset();
    transactionForm.elements['tx-account-id'].value = accountId;
    transactionForm.elements['tx-type'].value = type;
    // show readable type in header and set select value
    const label = type === 'deposit' ? 'Income' : 'Withdrawal';
    transactionModal.querySelector('h2').textContent = label;
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

    // Calculate which page the transaction would be on after sorting
    // Reload transactions to include the new one
    savingsTransactions = await getAll(STORE_SAVINGS_TRANSACTIONS);
    const txs = savingsTransactions
        .filter(t => t.accountId === accountId)
        .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

    // Find the index of the transaction we just added/edited
    const targetId = id ? parseInt(id) : newId;
    const txIndex = txs.findIndex(t => t.id === targetId);

    // Calculate which page this transaction is on
    const perPage = 4;
    if (txIndex !== -1) {
        savingsPage[accountId] = Math.floor(txIndex / perPage);
    } else {
        savingsPage[accountId] = 0;
    }

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
            .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
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

        const perPage = 4;
        const totalPages = Math.ceil(txs.length / perPage) || 1;
        let page = savingsPage[acc.id] || 0;
        // ensure current page is within bounds
        if (page >= totalPages) page = totalPages - 1;
        if (page < 0) page = 0;
        savingsPage[acc.id] = page;
        const paged = txs.slice(page * perPage, page * perPage + perPage);

        const monthCashflow = monthDeposit - monthWithdraw;
        const cashflowPositive = monthCashflow >= 0;

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
                        <h4>Deposits This Month</h4>
                        <p>$${formatCurrency(monthDeposit)}</p>
                    </div>
                </div>
                <div class="kpi-card withdrawal">
                    <div class="kpi-icon"><i class="fas fa-arrow-down"></i></div>
                    <div class="kpi-details">
                        <h4>Withdrawn This Month</h4>
                        <p>$${formatCurrency(monthWithdraw)}</p>
                    </div>
                </div>
                <div class="kpi-card cashflow">
                    <div class="kpi-icon"><i class="fas fa-exchange-alt"></i></div>
                    <div class="kpi-details">
                        <h4>Cashflow</h4>
                        <p style="color: ${cashflowPositive ? '#ef4444' : 'var(--danger)'}">
                            ${cashflowPositive ? '+' : '-'}$${formatCurrency(Math.abs(monthCashflow))}
                            <i class="fas fa-arrow-${cashflowPositive ? 'up' : 'down'}" style="font-size: 0.8em; margin-left: 4px;"></i>
                        </p>
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
                                <td class="${t.type === 'deposit' ? 'amount-income' : 'amount-spending'}">$${formatCurrency(t.amount)}</td>
                                <td>${t.notes || '-'}</td>
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
                <button class="btn btn-outline prev-page" ${page <= 0 ? 'disabled' : ''}>Prev</button>
                <button class="btn btn-outline next-page" ${page >= totalPages - 1 ? 'disabled' : ''}>Next</button>
            </div>
        `;
        savingsListEl.appendChild(card);

        // attach listeners directly to the new card's buttons for reliability
        const depBtn = card.querySelector('.deposit-btn');
        if (depBtn) {
            depBtn.addEventListener('click', (e) => { e.stopPropagation(); openTransactionModal(acc.id, 'deposit'); });
        }
        const witBtn = card.querySelector('.withdraw-btn');
        if (witBtn) {
            witBtn.addEventListener('click', (e) => { e.stopPropagation(); openTransactionModal(acc.id, 'withdrawal'); });
        }
        const editAcc = card.querySelector('.edit-acc-btn');
        if (editAcc) {
            editAcc.addEventListener('click', (e) => { e.stopPropagation(); openAccountModal(acc); });
        }
        const delAcc = card.querySelector('.delete-acc-btn');
        if (delAcc) {
            delAcc.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showConfirm('Delete this account? All its transactions will be removed too.')) {
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
                const txId = parseInt(btn.getAttribute('data-tx-id'));
                const tx = savingsTransactions.find(t => t.id === txId);
                if (tx) openTransactionModal(acc.id, tx.type, tx);
            });
        });
        const delTxBtns = card.querySelectorAll('button.delete-btn');
        delTxBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const txId = parseInt(btn.getAttribute('data-tx-id'));
                if (await showConfirm('Delete this transaction?')) {
                    const tx = savingsTransactions.find(t => t.id === txId);
                    if (tx && tx.linkedRecordId) {
                        await remove(STORE_RECORDS, tx.linkedRecordId);
                    }
                    await remove(STORE_SAVINGS_TRANSACTIONS, txId);
                    await refreshData();
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
    const recordSavingsAccount = document.getElementById('record-savings-account');

    // Reset combined transactions
    combinedTransactions = [];
    combinedTransactionIdCounter = 0;

    if (record) {
        modalTitle.textContent = 'Edit Transaction';
        recordId.value = record.id;
        recordFormatTypeSelect.value = record.formatType || 'single';
        recordTypeSelect.value = record.type;
        recordDate.value = record.date;
        recordItem.value = record.item || '';
        recordAmount.value = record.amount;
        recordQuantity.value = record.quantity || '';
        recordNotes.value = record.notes || '';
        recordSavingsAccount.value = record.savingsAccountId || '';

        // If it's a combined transaction, load the combined transactions
        if (record.formatType === 'combined' && record.combinedTransactions) {
            combinedTransactions = [...record.combinedTransactions];
            combinedTransactionIdCounter = Math.max(...combinedTransactions.map(t => t.id)) + 1;

            // Load combined transaction name and category
            const combinedNameField = document.getElementById('combined-transaction-name');
            const combinedCategoryField = document.getElementById('combined-transaction-category');
            if (combinedNameField) {
                combinedNameField.value = record.combinedTransactionName || '';
            }
            if (combinedCategoryField) {
                combinedCategoryField.value = record.category || '';
            }
        }

        updateCategoryDropdowns();
        recordCategory.value = record.category;
        updatePersonDropdown();
        recordPersonSelect.value = record.person || '';
    } else {
        modalTitle.textContent = 'Add Transaction';
        recordForm.reset();
        recordId.value = '';
        recordDate.valueAsDate = new Date();
        recordFormatTypeSelect.value = 'single';
        updateCategoryDropdowns();
    }

    toggleRecordFormat();
    toggleItemField();

    // Render combined transactions if applicable
    if (recordFormatTypeSelect.value === 'combined') {
        renderCombinedTransactions();
    }

    recordModal.classList.add('active');
}

function closeModal() {
    recordModal.classList.remove('active');
}

async function handleRecordSubmit(e) {
    e.preventDefault();

    // Check if required elements exist
    if (!recordFormatTypeSelect) {
        console.error('recordFormatTypeSelect not found');
        showToast('Error: recordFormatTypeSelect not found', 'error');
        return;
    }

    const id = document.getElementById('record-id').value;
    const formatType = recordFormatTypeSelect.value;
    const savingsAccountId = document.getElementById('record-savings-account')?.value || '';
    const date = document.getElementById('record-date')?.value || '';
    const notes = document.getElementById('record-notes')?.value || '';

    if (formatType === 'combined') {
        // Handle combined transactions
        if (combinedTransactions.length === 0) {
            showToast('Please add at least one transaction to the combined record.', 'warning');
            return;
        }

        // Validate all combined transactions - be more lenient
        let hasValidTransaction = false;
        for (const transaction of combinedTransactions) {
            if (transaction.category && transaction.amount && parseFloat(transaction.amount) > 0) {
                hasValidTransaction = true;
                break;
            }
        }

        if (!hasValidTransaction) {
            showToast('Please fill in category and a valid amount for at least one transaction.', 'warning');
            return;
        }

        // Filter out invalid transactions and apply item defaulting
        const validTransactions = combinedTransactions.filter(t =>
            t.category && t.amount && parseFloat(t.amount) > 0
        ).map(t => ({
            ...t,
            // Use item if provided, otherwise use category name for spending (income doesn't need item)
            item: t.type === 'income' ? '' : (t.item || t.category)
        }));

        // Create main record
        let totalIncome = 0;
        let totalSpending = 0;

        validTransactions.forEach(t => {
            const amount = parseFloat(t.amount) || 0;
            const quantity = parseInt(t.quantity) || 1;
            const totalAmount = amount * quantity;

            if (t.type === 'income') {
                totalIncome += totalAmount;
            } else {
                totalSpending += totalAmount;
            }
        });

        const netAmount = totalIncome - totalSpending;

        // Get combined transaction name and category
        const combinedTransactionName = document.getElementById('combined-transaction-name')?.value || '';
        const combinedTransactionCategory = 'Combined'; // Forced category for combined transactions

        const data = {
            formatType: 'combined',
            type: netAmount >= 0 ? 'income' : 'spending', // Determine net type
            date: date,
            timestamp: Date.now(), // Store creation time in milliseconds for precise ordering
            item: combinedTransactionName || `Combined Transaction (${validTransactions.length} items)`,
            category: combinedTransactionCategory,
            person: validTransactions[0].person || '',
            amount: Math.abs(netAmount),
            quantity: validTransactions.length,
            notes: notes,
            savingsAccountId: savingsAccountId,
            combinedTransactions: validTransactions,
            combinedTransactionName: combinedTransactionName,
            // Mark as savings transfer if savings account is selected
            isSavingsTransfer: savingsAccountId ? true : false,
            savingsTransactionType: savingsAccountId ? 'mixed' : null
        };

        try {
            let recordId;
            if (id) {
                recordId = parseInt(id);
                data.id = recordId;
                await updateRecord(STORE_RECORDS, data);
            } else {
                recordId = await add(STORE_RECORDS, data);
            }

            // Update savings account for each transaction
            if (savingsAccountId) {
                await updateSavingsAccountForCombinedTransactions(validTransactions, date, savingsAccountId, recordId);
            } else {
                // Handle individual savings accounts for each transaction
                await updateSavingsAccountForCombinedTransactionsIndividual(validTransactions, date, recordId);
            }

        } catch (error) {
            console.error('Error saving combined transaction:', error);
            showToast('Error saving combined transaction: ' + error.message, 'error');
            return;
        }

    } else {
        // Handle single transaction
        const type = recordTypeSelect?.value || 'spending';
        const amount = parseFloat(document.getElementById('record-amount')?.value || 0);

        if (amount <= 0) {
            showToast('Please enter a valid amount.', 'warning');
            return;
        }

        const category = document.getElementById('record-category')?.value || '';
        const itemInput = document.getElementById('record-item')?.value || '';
        // Use item if provided, otherwise use category name for spending/AR (income doesn't need item)
        const item = type === 'income' ? '' : (itemInput || category);

        const data = {
            formatType: 'single',
            type: type,
            date: date,
            timestamp: Date.now(), // Store creation time in milliseconds for precise ordering
            item: item,
            category: category,
            person: document.getElementById('record-person')?.value || '',
            amount: amount,
            quantity: document.getElementById('record-quantity')?.value || '1',
            notes: notes,
            savingsAccountId: savingsAccountId,
            // Mark as savings transfer if savings account is selected
            isSavingsTransfer: savingsAccountId ? true : false,
            savingsTransactionType: savingsAccountId ? (type === 'income' ? 'deposit' : 'withdrawal') : null
        };

        try {
            let recordId;
            if (id) {
                recordId = parseInt(id);
                data.id = recordId;
                await updateRecord(STORE_RECORDS, data);
            } else {
                recordId = await add(STORE_RECORDS, data);
            }

            // Update savings account if selected
            if (savingsAccountId) {
                await updateSavingsAccountForSingleTransaction(data, savingsAccountId, recordId);
            }
        } catch (error) {
            console.error('Error saving single transaction:', error);
            showToast('Error saving transaction: ' + error.message, 'error');
            return;
        }
    }

    closeModal();
    await refreshData();
}

async function updateSavingsAccountForSingleTransaction(record, accountId, linkedRecordId) {
    const account = savingsAccounts.find(acc => acc.id === parseInt(accountId));
    if (!account) return;

    const transactionType = record.type === 'income' ? 'deposit' : 'withdrawal';
    const transaction = {
        accountId: parseInt(accountId),
        type: transactionType,
        amount: record.amount,
        date: record.date,
        notes: `${record.type === 'income' ? 'Income' : 'Spending'}: ${record.category}${record.item ? ' - ' + record.item : ''}`,
        linkedRecordId: linkedRecordId
    };

    await add(STORE_SAVINGS_TRANSACTIONS, transaction);

    // Note: The record is already marked as savings transfer in the main data object
    // So we don't need to update it again here
}

async function updateSavingsAccountForCombinedTransactions(transactions, date, accountId, linkedRecordId) {
    for (const transaction of transactions) {
        const transactionType = transaction.type === 'income' ? 'deposit' : 'withdrawal';
        const savingsTransaction = {
            accountId: parseInt(accountId),
            type: transactionType,
            amount: parseFloat(transaction.amount),
            date: date,
            notes: `${transaction.type === 'income' ? 'Income' : 'Spending'}: ${transaction.category}${transaction.item ? ' - ' + transaction.item : ''}`,
            linkedRecordId: linkedRecordId
        };

        await add(STORE_SAVINGS_TRANSACTIONS, savingsTransaction);
    }

    // Note: The main record is already marked as savings transfer in the main data object
    // So we don't need to update it again here
}

async function updateSavingsAccountForCombinedTransactionsIndividual(transactions, date, linkedRecordId) {
    for (const transaction of transactions) {
        if (transaction.savingsAccountId) {
            const transactionType = transaction.type === 'income' ? 'deposit' : 'withdrawal';
            const savingsTransaction = {
                accountId: parseInt(transaction.savingsAccountId),
                type: transactionType,
                amount: parseFloat(transaction.amount),
                date: date,
                notes: `${transaction.type === 'income' ? 'Income' : 'Spending'}: ${transaction.category}${transaction.item ? ' - ' + transaction.item : ''}`,
                linkedRecordId: linkedRecordId
            };

            await add(STORE_SAVINGS_TRANSACTIONS, savingsTransaction);
        }
    }
}

async function editRecord(id) {
    const record = records.find(r => r.id === id);
    if (record) openModal(record);
}

async function deleteRecord(id) {
    if (await showConfirm('Are you sure you want to delete this record?')) {
        // Find and delete linked savings transactions
        const linkedSavings = savingsTransactions.filter(t => t.linkedRecordId === parseInt(id));
        for (const tx of linkedSavings) {
            await remove(STORE_SAVINGS_TRANSACTIONS, tx.id);
        }

        await remove(STORE_RECORDS, id);
        await refreshData();
    }
}

// Record Details Modal Functions
function openDetailsModal(record) {
    if (!recordDetailsModal || !recordDetailsContent) return;

    // If it's a sub-transaction component, show the parent record instead
    if (record.isCombinedComponent) {
        const parentRecord = records.find(r => r.id === record.originalId);
        if (parentRecord) {
            record = parentRecord;
        }
    }

    currentDetailRecordId = record.id;
    const isCombined = record.formatType === 'combined';

    // Calculate balance at the time of this transaction
    const balanceBefore = calculateBalanceAtTransaction(record.date, record.id);
    const recordAmount = parseFloat(record.amount) || 0;
    const balanceAfter = record.type === 'income' ? balanceBefore + recordAmount : balanceBefore - recordAmount;

    const itemLabel = record.type === 'income' ? 'Source (Where money came from)' : 'Item (What was purchased)';
    const itemValue = record.type === 'income' ? record.category : (record.item || '-');

    let detailsHTML = `
        <div class="detail-row">
            <span class="detail-label">Transaction Type</span>
            <span class="detail-value ${record.type}">${record.type === 'income' ? 'Income' : 'Spending'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Format</span>
            <span class="detail-value">${isCombined ? '📦 Combined Transactions' : 'Single Transaction'}</span>
        </div>
        ${isCombined && record.combinedTransactionName ? `
        <div class="detail-row">
            <span class="detail-label">Combined Name</span>
            <span class="detail-value">${record.combinedTransactionName}</span>
        </div>
        ` : ''}
        <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${record.date}</span>
        </div>
        ${record.timestamp ? `
        <div class="detail-row">
            <span class="detail-label">Time Recorded</span>
            <span class="detail-value">${new Date(record.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        ` : ''}
        <div class="detail-row">
            <span class="detail-label">${record.type === 'income' ? 'Source & Category' : 'Item & Category'}</span>
            <span class="detail-value">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="color: ${record.type === 'income' ? '#059669' : '#dc2626'}; font-weight: 500;">
                        ${record.type === 'income' ? record.category : (record.item || '-')}
                    </div>
                    <div style="color: #6b7280; font-size: 0.85rem;">
                        ${record.category}
                    </div>
                </div>
            </span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value ${record.type}">${record.type === 'income' ? '+' : '-'}$${formatCurrency(parseFloat(record.amount))}</span>
        </div>
        <div class="detail-row" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 1rem; border-radius: var(--radius-sm); margin: 0.5rem 0;">
            <div style="font-size: 0.875rem; line-height: 1.6;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <div><strong>Opening Balance:</strong></div>
                    <div style="text-align: right;">$${formatCurrency(balanceBefore)}</div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.5rem; background: white; border-radius: 4px;">
                    <div><strong>Transaction:</strong></div>
                    <div style="text-align: right; font-weight: 600; color: ${record.type === 'income' ? '#059669' : '#dc2626'};">
                        ${record.type === 'income' ? '+' : '-'}$${formatCurrency(parseFloat(record.amount))}
                    </div>
                    ${isCombined && record.combinedTransactions ? `
                    <div style="grid-column: 1 / -1; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e2e8f0;">
                        <div style="font-weight: 600; margin-bottom: 0.25rem; color: #6b7280; font-size: 0.85rem;">Breakdown:</div>
                        ${record.combinedTransactions.map((transaction, index) => {
        const amount = parseFloat(transaction.amount) || 0;
        const quantity = parseInt(transaction.quantity) || 1;
        const totalAmount = amount * quantity;
        return `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem; font-size: 0.8rem; margin-bottom: 0.25rem;">
                                <div style="color: ${transaction.type === 'income' ? '#059669' : '#dc2626'};">
                                    ${transaction.item || transaction.category} ${transaction.quantity && transaction.quantity !== '1' ? `(${transaction.quantity})` : ''}:
                                </div>
                                <div style="text-align: right; font-weight: 500; color: ${transaction.type === 'income' ? '#059669' : '#dc2626'};">
                                    ${transaction.type === 'income' ? '+' : '-'}$${formatCurrency(totalAmount)}
                                </div>
                            </div>
                            `;
    }).join('')}
                    </div>
                    ` : ''}
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e2e8f0;">
                    <div><strong style="color: #1e40af;">Closing Balance:</strong></div>
                    <div style="text-align: right; font-weight: 600; color: #1e40af;">$${formatCurrency(balanceAfter)}</div>
                </div>
                <div style="margin-top: 0.5rem; padding: 0.5rem; background: #eff6ff; border-radius: 4px; font-size: 0.8rem;">
                    <strong>Net Change:</strong> 
                    <span style="color: ${balanceAfter >= balanceBefore ? '#059669' : '#dc2626'};">
                        ${balanceAfter >= balanceBefore ? '+' : ''}$${formatCurrency(balanceAfter - balanceBefore)}
                    </span>
                    ${record.type === 'spending' ? `
                    <div style="margin-top: 0.25rem; color: #7c3aed; font-size: 0.75rem;">
                        💰 Funds allocated to: ${record.category}
                    </div>
                    ` : ''}
                </div>
            </div>
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
        ${record.savingsAccountId ? `
        <div class="detail-row">
            <span class="detail-label">Savings Account</span>
            <span class="detail-value">${savingsAccounts.find(acc => acc.id === parseInt(record.savingsAccountId))?.name || 'Unknown'}</span>
        </div>
        ` : ''}
        ${record.notes ? `
        <div class="detail-row">
            <span class="detail-label">Notes</span>
            <span class="detail-value notes">${record.notes}</span>
        </div>
        ` : ''}
    `;

    // Add combined transactions details if applicable
    if (isCombined && record.combinedTransactions) {
        detailsHTML += `
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <h4 style="margin-bottom: 1rem; color: var(--primary-color);">📦 Combined Transactions Details</h4>
                ${record.combinedTransactions.map((transaction, index) => {
            const savingsAccount = transaction.savingsAccountId ?
                savingsAccounts.find(acc => acc.id === parseInt(transaction.savingsAccountId))?.name || 'Unknown' :
                'None';

            return `
                    <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 0.75rem;">
                        <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--primary-color);">
                            Transaction #${index + 1}
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.875rem;">
                            <div><strong>Type:</strong> <span class="${transaction.type}">${transaction.type === 'income' ? 'Income' : 'Spending'}</span></div>
                            <div><strong>Category:</strong> ${transaction.category}</div>
                            ${transaction.item ? `<div><strong>Item:</strong> ${transaction.item}</div>` : ''}
                            <div><strong>Amount:</strong> <span class="${transaction.type}">${transaction.type === 'income' ? '+' : '-'}$${formatCurrency(parseFloat(transaction.amount))}</span></div>
                            ${transaction.person ? `<div><strong>Person:</strong> ${transaction.person}</div>` : ''}
                            ${transaction.quantity && transaction.quantity !== '1' ? `<div><strong>Quantity:</strong> ${transaction.quantity}</div>` : ''}
                            <div><strong>Savings Account:</strong> ${savingsAccount}</div>
                        </div>
                    </div>
                `;
        }).join('')}
            </div>
        `;
    }

    recordDetailsContent.innerHTML = detailsHTML;
    recordDetailsModal.classList.add('active');
}

function closeDetailsModal() {
    if (recordDetailsModal) {
        recordDetailsModal.classList.remove('active');
        currentDetailRecordId = null;
    }
}

// Arabic-aware string comparison function
function compareStringsAlphabetically(a, b) {
    // Check if strings contain Arabic characters
    const isArabicA = /[\u0600-\u06FF]/.test(a);
    const isArabicB = /[\u0600-\u06FF]/.test(b);

    // If one is Arabic and one is not, prioritize non-Arabic first
    if (isArabicA && !isArabicB) return 1;
    if (!isArabicA && isArabicB) return -1;

    // If both are Arabic, use localeCompare with Arabic locale
    if (isArabicA && isArabicB) {
        return a.localeCompare(b, 'ar', { numeric: true, sensitivity: 'base' });
    }

    // If neither are Arabic, use standard comparison
    return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

// Category Edit Functions
function openCategoryEditModal(category) {
    if (!categoryEditModal || !editCategoryIdInput || !editCategoryNameInput || !editCategoryTypeSelect) return;

    const editTargetTypeInput = document.getElementById('edit-target-type');
    if (editTargetTypeInput) editTargetTypeInput.value = 'category';

    editCategoryIdInput.value = category.id;
    editCategoryNameInput.value = category.name;
    editCategoryTypeSelect.value = category.type;
    categoryEditModal.classList.add('active');
    editCategoryNameInput.focus();
}

function closeCategoryEditModal() {
    if (categoryEditModal) {
        categoryEditModal.classList.remove('active');

        // Reset person edit modal state
        const modalTitle = categoryEditModal.querySelector('h2');
        if (modalTitle) modalTitle.textContent = 'Edit Category';

        const nameLabel = editCategoryNameInput.parentElement.querySelector('label');
        if (nameLabel) nameLabel.textContent = 'Category Name';

        // Show type select and label again
        const typeContainer = editCategoryTypeSelect.parentElement;
        const typeLabel = typeContainer.querySelector('label');
        if (typeLabel) typeLabel.style.display = 'block';
        editCategoryTypeSelect.style.display = 'block';
    }
}

async function handleEditSubmit(e) {
    e.preventDefault();
    const targetType = document.getElementById('edit-target-type')?.value;
    if (targetType === 'person') {
        return handlePersonEdit(e);
    } else {
        return handleCategoryEdit(e);
    }
}

async function handleCategoryEdit(e) {
    e.preventDefault();

    const id = parseInt(editCategoryIdInput.value);
    const name = editCategoryNameInput.value.trim();
    const type = editCategoryTypeSelect.value;

    if (!name) {
        showToast('Please enter a category name', 'warning');
        return;
    }

    try {
        // Get the old category before updating
        const oldCategory = categories.find(c => c.id === id);

        // Update the category
        await updateRecord(STORE_CATEGORIES, { id, name, type });

        // Update all records that reference the old category name
        if (oldCategory && oldCategory.name !== name) {
            // Update regular records
            const recordsToUpdate = records.filter(r => r.category === oldCategory.name);
            for (const record of recordsToUpdate) {
                await updateRecord(STORE_RECORDS, {
                    ...record,
                    category: name
                });
            }

            // Update combined transactions
            const combinedRecordsToUpdate = records.filter(r =>
                r.formatType === 'combined' && r.combinedTransactions
            );

            for (const record of combinedRecordsToUpdate) {
                let updated = false;
                // Update combined transaction categories
                const updatedCombinedTransactions = record.combinedTransactions.map(ct => {
                    if (ct.category === oldCategory.name) {
                        updated = true;
                        return { ...ct, category: name };
                    }
                    return ct;
                });

                let parentUpdated = false;
                let updatedParentCategory = record.category;
                if (record.category === oldCategory.name) {
                    updatedParentCategory = name;
                    parentUpdated = true;
                }

                if (updated || parentUpdated) {
                    await updateRecord(STORE_RECORDS, {
                        ...record,
                        category: updatedParentCategory,
                        combinedTransactions: updatedCombinedTransactions
                    });
                }
            }
        }

        closeCategoryEditModal();
        await refreshData();
    } catch (error) {
        console.error('Error updating category:', error);
        showToast('Failed to update category. Please try again.', 'error');
    }
}

async function editCategory(id) {
    const category = categories.find(c => c.id === id);
    if (category) {
        openCategoryEditModal(category);
    }
}

// Person Edit Functions
function openPersonEditModal(person) {
    // Reuse the category edit modal for person editing
    if (!categoryEditModal || !editCategoryIdInput || !editCategoryNameInput) return;

    const editTargetTypeInput = document.getElementById('edit-target-type');
    if (editTargetTypeInput) editTargetTypeInput.value = 'person';

    editCategoryIdInput.value = person.id;
    editCategoryNameInput.value = person.name;
    // Hide type select for people (they don't have types)
    const typeContainer = editCategoryTypeSelect.parentElement;
    const typeLabel = typeContainer.querySelector('label');
    if (typeLabel) typeLabel.style.display = 'none';
    editCategoryTypeSelect.style.display = 'none';

    // Update modal title
    const modalTitle = categoryEditModal.querySelector('h2');
    if (modalTitle) modalTitle.textContent = 'Edit Person';

    const nameLabel = editCategoryNameInput.parentElement.querySelector('label');
    if (nameLabel) nameLabel.textContent = 'Person Name';

    categoryEditModal.classList.add('active');
    editCategoryNameInput.focus();
}

async function handlePersonEdit(e) {
    e.preventDefault();

    const id = parseInt(editCategoryIdInput.value);
    const name = editCategoryNameInput.value.trim();

    if (!name) {
        showToast('Please enter a person name', 'warning');
        return;
    }

    try {
        // Get the old person before updating
        const oldPerson = people.find(p => p.id === id);

        // Update the person
        await updateRecord(STORE_PEOPLE, { id, name });

        // Update all records that reference the old person name
        if (oldPerson && oldPerson.name !== name) {
            // Update regular records
            const recordsToUpdate = records.filter(r => r.person === oldPerson.name);
            for (const record of recordsToUpdate) {
                await updateRecord(STORE_RECORDS, {
                    ...record,
                    person: name
                });
            }

            // Update combined transactions
            const combinedRecordsToUpdate = records.filter(r =>
                r.formatType === 'combined' && r.combinedTransactions
            );

            for (const record of combinedRecordsToUpdate) {
                let updated = false;
                const updatedCombinedTransactions = record.combinedTransactions.map(ct => {
                    if (ct.person === oldPerson.name) {
                        updated = true;
                        return { ...ct, person: name };
                    }
                    return ct;
                });

                let parentUpdated = false;
                let updatedParentPerson = record.person;
                if (record.person === oldPerson.name) {
                    updatedParentPerson = name;
                    parentUpdated = true;
                }

                if (updated || parentUpdated) {
                    await updateRecord(STORE_RECORDS, {
                        ...record,
                        person: updatedParentPerson,
                        combinedTransactions: updatedCombinedTransactions
                    });
                }
            }
        }

        closeCategoryEditModal();
        await refreshData();
    } catch (error) {
        console.error('Error updating person:', error);
        showToast('Failed to update person. Please try again.', 'error');
    }
}

async function editPerson(id) {
    const person = people.find(p => p.id === id);
    if (person) {
        openPersonEditModal(person);
    }
}

// Settings Functions
function renderSettings() {
    if (!categoryList) return;
    categoryList.innerHTML = '';

    if (categories.length === 0) {
        categoryList.innerHTML = '<p style="grid-column: 1 / -1; text-align:center; padding: 2rem; color: var(--text-muted); width: 100%;">No categories defined</p>';
    } else {
        // Sort categories alphabetically with Arabic support
        const sortedCategories = [...categories].sort((a, b) => {
            return compareStringsAlphabetically(a.name, b.name);
        });

        const visibleCategories = categoriesExpanded ? sortedCategories : sortedCategories.slice(0, categoriesVisible);
        visibleCategories.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'category-item';
            div.innerHTML = `
                <div>
                    <strong>${cat.name}</strong>
                    <span class="category-badge badge-${cat.type}">${cat.type}</span>
                </div>
                <div>
                    <button class="btn-icon edit-btn" onclick="editCategory(${cat.id})" title="Edit Category">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-btn" onclick="deleteCategory(${cat.id})" title="Delete Category">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            categoryList.appendChild(div);
        });
    }

    // Update Show More button for categories
    if (showMoreCategoriesBtn) {
        if (categories.length > 2) {
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
            personList.innerHTML = '<p style="grid-column: 1 / -1; text-align:center; padding: 2rem; color: var(--text-muted); width: 100%;">No people defined</p>';
        } else {
            // Sort people alphabetically with Arabic support
            const sortedPeople = [...people].sort((a, b) => {
                return compareStringsAlphabetically(a.name, b.name);
            });

            const visiblePeople = peopleExpanded ? sortedPeople : sortedPeople.slice(0, peopleVisible);
            visiblePeople.forEach(person => {
                const div = document.createElement('div');
                div.className = 'category-item';
                div.innerHTML = `
                    <div>
                        <strong>${person.name}</strong>
                    </div>
                    <div>
                        <button class="btn-icon edit-btn" onclick="editPerson(${person.id})" title="Edit Person">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-btn" onclick="deletePerson(${person.id})" title="Delete Person">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                personList.appendChild(div);
            });
        }

        // Update Show More button for people
        if (showMorePeopleBtn) {
            if (people.length > 2) {
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
    if (await showConfirm('Delete this category? Records with this category will remain but the category option will be removed.')) {
        await remove(STORE_CATEGORIES, id);
        await refreshData();
    }
}

function updateCategoryDropdowns() {
    if (!recordTypeSelect || !recordCategorySelect) return;
    const type = recordTypeSelect.value;
    // For account_receivable, use spending categories
    const categoryType = type === 'account_receivable' ? 'spending' : type;
    const filtered = categories.filter(c => c.type === categoryType);
    const currentValue = recordCategorySelect.value;
    recordCategorySelect.innerHTML = filtered.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    recordCategorySelect.value = currentValue;
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
    categoriesVisible = categoriesExpanded ? categories.length : 2;
    renderSettings();
}

function togglePeopleVisibility() {
    peopleExpanded = !peopleExpanded;
    peopleVisible = peopleExpanded ? people.length : 2;
    renderSettings();
}

function toggleChartCategoriesVisibility() {
    chartCategoriesExpanded = !chartCategoriesExpanded;

    // Update button text BEFORE re-rendering
    const btn = document.getElementById('show-more-chart-categories');
    if (btn) {
        btn.textContent = chartCategoriesExpanded ? 'Show Less' : 'Show More';
    }

    console.log('Toggle clicked, chartCategoriesExpanded:', chartCategoriesExpanded);

    // Re-render charts with all records (not filtered to current month)
    // The chart should show the same data as before, just with different category limit
    renderCharts(records);
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
    if (await showConfirm('Delete this person? Records with this person will remain but the person option will be removed.')) {
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
    a.download = `Floosy_${new Date().toISOString().split('T')[0]}.json`;
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
                if (await showConfirm('Importing will overwrite your current data. Continue?')) {
                    await clearStore(STORE_RECORDS);
                    await clearStore(STORE_CATEGORIES);
                    await clearStore(STORE_PEOPLE);
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
                    const savingsAccountIdMap = new Map();
                    if (data.savingsAccounts) {
                        await clearStore(STORE_SAVINGS_ACCOUNTS);
                        for (const a of data.savingsAccounts) {
                            const oldId = a.id;
                            delete a.id;
                            const newId = await add(STORE_SAVINGS_ACCOUNTS, a);
                            if (oldId !== undefined && oldId !== null) {
                                savingsAccountIdMap.set(String(oldId), newId);
                                savingsAccountIdMap.set(Number(oldId), newId);
                            }
                        }
                    }
                    // import records AFTER savings accounts to remap savingsAccountId
                    if (data.records) {
                        for (const r of data.records) {
                            const oldSavingsAccountId = r.savingsAccountId;
                            if (oldSavingsAccountId !== undefined && oldSavingsAccountId !== null && String(oldSavingsAccountId).trim() !== '') {
                                const mapped = savingsAccountIdMap.get(oldSavingsAccountId) ?? savingsAccountIdMap.get(String(oldSavingsAccountId));
                                if (mapped) r.savingsAccountId = String(mapped);
                            }
                            delete r.id;
                            await add(STORE_RECORDS, r);
                        }
                    }
                    if (data.savingsTransactions) {
                        await clearStore(STORE_SAVINGS_TRANSACTIONS);
                        for (const t of data.savingsTransactions) {
                            const oldAccId = t.accountId;
                            const mapped = savingsAccountIdMap.get(oldAccId) ?? savingsAccountIdMap.get(String(oldAccId));
                            if (mapped) t.accountId = mapped;
                            delete t.id;
                            await add(STORE_SAVINGS_TRANSACTIONS, t);
                        }
                    }
                    showToast('Import successful!', 'success');
                    await refreshData();
                    // Force AR carry-forward after import so KPIs reflect pending AR from previous months
                    localStorage.removeItem('lastARCarryForwardCheck');
                    await checkAndCarryForwardAR();
                }
            } else {
                showToast('Invalid file format.', 'warning');
            }
        } catch (err) {
            showToast('Error importing data: ' + err.message, 'error');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

async function handleReset() {
    if (await showConfirm('Are you sure you want to reset the entire database? This will delete all records and restore default categories.')) {
        await resetDB();
        await refreshData();
        showToast('Database reset complete.', 'success');
    }
}

function handleResetTypeChange() {
    const resetType = resetTypeSelect.value;
    if (periodOptionsDiv) {
        periodOptionsDiv.style.display = resetType === 'period' ? 'block' : 'none';
    }
}

async function handleSelectiveReset() {
    const resetType = resetTypeSelect.value;
    const resetRecords = document.getElementById('reset-records')?.checked || false;
    const resetSavings = document.getElementById('reset-savings')?.checked || false;
    const resetCategories = document.getElementById('reset-categories')?.checked || false;
    const resetPeople = document.getElementById('reset-people')?.checked || false;

    // Validate at least one option is selected
    if (!resetRecords && !resetSavings && !resetCategories && !resetPeople) {
        showToast('Please select at least one type of data to reset.', 'warning');
        return;
    }

    // Validate period dates if period is selected
    let startDate = null;
    let endDate = null;
    if (resetType === 'period') {
        startDate = new Date(document.getElementById('period-start').value);
        endDate = new Date(document.getElementById('period-end').value);

        if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            showToast('Please select valid start and end dates for the custom period.', 'warning');
            return;
        }

        if (startDate > endDate) {
            showToast('Start date must be before end date.');
            return;
        }
    }

    // Create confirmation message
    let confirmMessage = 'Are you sure you want to reset the following data:\n\n';
    if (resetRecords) {
        confirmMessage += `• Transaction Records (${resetType === 'all' ? 'all time' : resetType === 'month' ? 'current month' : 'selected period'})\n`;
    }
    if (resetSavings) {
        confirmMessage += `• Savings Data (${resetType === 'all' ? 'all time' : resetType === 'month' ? 'current month' : 'selected period'})\n`;
    }
    if (resetCategories) {
        confirmMessage += '• Categories (will restore defaults)\n';
    }
    if (resetPeople) {
        confirmMessage += '• People\n';
    }

    confirmMessage += '\nThis action cannot be undone.';

    if (!(await showConfirm(confirmMessage))) {
        return;
    }

    try {
        const result = await selectiveReset({
            resetType,
            startDate,
            endDate,
            resetRecords,
            resetSavings,
            resetCategories,
            resetPeople
        });

        await refreshData();

        // Create success message
        let successMessage = 'Data reset complete!\n\n';
        if (result.recordsDeleted > 0) {
            successMessage += `• ${result.recordsDeleted === -1 ? 'All' : result.recordsDeleted} transaction records deleted\n`;
        }
        if (result.savingsDeleted > 0) {
            successMessage += `• ${result.savingsDeleted === -1 ? 'All' : result.savingsDeleted} savings transactions deleted\n`;
        }
        if (resetCategories) {
            successMessage += '• Categories reset to defaults\n';
        }
        if (resetPeople) {
            successMessage += '• All people data cleared\n';
        }

        showToast(successMessage, 'success');
    } catch (error) {
        console.error('Reset error:', error);
        showToast('An error occurred while resetting data. Please try again.', 'error');
    }
}

// Global functions
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
window.deleteCategory = deleteCategory;
window.deletePerson = deletePerson;
window.switchTab = switchTab;
window.removeCombinedTransaction = removeCombinedTransaction;
window.updateCombinedTransaction = updateCombinedTransaction;

// Accounts Receivable functions
function getARRootId(record) {
    if (!record) return null;
    let current = record;
    const seen = new Set();
    while (current && current.type === 'account_receivable' && current.carriedForwardFrom) {
        if (seen.has(current.id)) break;
        seen.add(current.id);
        const parent = records.find(r => r.id === current.carriedForwardFrom);
        if (!parent) return current.carriedForwardFrom;
        current = parent;
    }
    return current?.id ?? record.id;
}

function getARGroupRecords(rootId) {
    if (rootId == null) return [];
    return records.filter(r => r.type === 'account_receivable' && getARRootId(r) === rootId);
}

async function collectAR(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    const rootId = getARRootId(record);
    const group = getARGroupRecords(rootId);
    const collectedDate = new Date().toISOString().split('T')[0];
    group.forEach(r => {
        r.collected = true;
        r.collectedDate = collectedDate;
    });

    try {
        for (const r of group) {
            await updateRecord(STORE_RECORDS, r);
        }
        await refreshData();
    } catch (error) {
        console.error('Error collecting AR:', error);
        showToast('Error marking as collected: ' + error.message, 'error');
    }
}

async function undoCollectAR(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    const rootId = getARRootId(record);
    const group = getARGroupRecords(rootId);
    group.forEach(r => {
        r.collected = false;
        delete r.collectedDate;
    });

    try {
        for (const r of group) {
            await updateRecord(STORE_RECORDS, r);
        }
        await refreshData();
    } catch (error) {
        console.error('Error undoing AR collection:', error);
        showToast('Error undoing collection: ' + error.message, 'error');
    }
}

// Make AR functions globally available
window.collectAR = collectAR;
window.undoCollectAR = undoCollectAR;
// Records tab uses uncollectAR; keep it as an alias to undo collection.
window.uncollectAR = undoCollectAR;

// Make upcoming income functions globally available
window.editUpcomingIncome = editUpcomingIncome;
window.deleteUpcomingIncome = deleteUpcomingIncome;
window.showUpcomingIncomeDetails = showUpcomingIncomeDetails;

// Function to generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Legacy: month-to-month A/R duplication was removed. Keep a no-op to avoid runtime errors
// if older code paths call it.
async function checkAndCarryForwardAR() { /* no-op */ }

// Privacy Mode Functions
function togglePrivacyMode() {
    isPrivacyMode = !isPrivacyMode;
    document.body.classList.toggle('privacy-mode', isPrivacyMode);
    localStorage.setItem('floosy_privacy_mode', isPrivacyMode);
    updatePrivacyIcon();
}

function updatePrivacyIcon() {
    if (!privacyToggle) return;
    const icon = privacyToggle.querySelector('i');
    if (icon) {
        icon.className = isPrivacyMode ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
    // Update hero/dashboard privacy icon too
    const heroPrivacyToggle = document.getElementById('hero-privacy-toggle');
    if (heroPrivacyToggle) {
        const heroIcon = heroPrivacyToggle.querySelector('i');
        if (heroIcon) {
            heroIcon.className = isPrivacyMode ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
    }
}

// ========================================
// BUDGET FUNCTIONS
// ========================================

function renderBudget() {
    const container = document.getElementById('budget-limits-list');
    const activeBudgetsEl = document.getElementById('active-budgets-count');
    const nearLimitEl = document.getElementById('near-limit-count');
    const cappedEl = document.getElementById('capped-count');

    if (!container) return;

    // Calculate spending for each budget limit
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Get spending records for current month (after last reset)
    const monthlySpending = {};
    records.forEach(r => {
        if (r.type === 'spending') {
            const recordDate = new Date(r.date);
            if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
                // Find the budget limit for this category to check last reset date
                const limit = budgetLimits.find(l => l.category === r.category);
                const lastReset = limit?.lastResetDate ? new Date(limit.lastResetDate) : null;
                
                // Only count spending after last reset
                if (!lastReset || recordDate >= lastReset) {
                    // Handle combined transactions
                    if (r.formatType === 'combined' && r.combinedTransactions) {
                        r.combinedTransactions.forEach(ct => {
                            if (ct.type === 'spending') {
                                const amount = (parseFloat(ct.amount) || 0) * (parseInt(ct.quantity) || 1);
                                monthlySpending[ct.category] = (monthlySpending[ct.category] || 0) + amount;
                            }
                        });
                    } else {
                        const amount = parseFloat(r.amount) || 0;
                        monthlySpending[r.category] = (monthlySpending[r.category] || 0) + amount;
                    }
                }
            }
        }
    });

    // Update budget limits with current spending
    budgetLimits.forEach(limit => {
        limit.spent = monthlySpending[limit.category] || 0;
        limit.percentage = (limit.spent / limit.limit) * 100;
    });

    // Update KPI counts
    let nearCount = 0;
    let cappedCount = 0;

    budgetLimits.forEach(limit => {
        const threshold = limit.alertThreshold || 80;
        if (limit.percentage >= 100) {
            cappedCount++;
        } else if (limit.percentage >= threshold) {
            nearCount++;
        }
    });

    if (activeBudgetsEl) activeBudgetsEl.textContent = budgetLimits.length;
    if (nearLimitEl) nearLimitEl.textContent = nearCount;
    if (cappedEl) cappedEl.textContent = cappedCount;

    // Render upcoming income section
    renderUpcomingIncome();

    // Render budget limits
    if (budgetLimits.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bullseye"></i>
                <p>No budget limits set</p>
                <span>Add limits to track spending by category</span>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    // Sort by percentage (highest first)
    const sortedLimits = [...budgetLimits].sort((a, b) => b.percentage - a.percentage);

    sortedLimits.forEach(limit => {
        const threshold = limit.alertThreshold || 80;
        let status = 'safe';
        let statusClass = 'safe';
        let statusText = 'Safe';
        let statusIcon = 'fa-check-circle';

        if (limit.percentage >= 100) {
            status = 'capped';
            statusClass = 'capped';
            statusText = 'Capped';
            statusIcon = 'fa-ban';
        } else if (limit.percentage >= threshold) {
            status = 'near';
            statusClass = 'near';
            statusText = 'Near Limit';
            statusIcon = 'fa-exclamation-circle';
        }

        const item = document.createElement('div');
        item.className = `budget-limit-item ${status === 'near' ? 'near-limit' : ''} ${status === 'capped' ? 'capped' : ''}`;
        item.innerHTML = `
            <div class="budget-limit-header">
                <div class="budget-limit-info">
                    <span class="budget-limit-category">${limit.category}</span>
                    <span class="budget-status-badge ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${statusText}
                    </span>
                </div>
                <div class="budget-limit-actions">
                    <button class="btn-icon reset-budget-btn" data-id="${limit.id}" title="Reset Spent">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="btn-icon edit-budget-btn" data-id="${limit.id}" title="Edit">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn-icon delete-budget-btn" data-id="${limit.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="budget-amount-display">
                <span class="spent ${statusClass}">$${formatCurrency(limit.spent)} spent</span>
                <span class="limit">of $${formatCurrency(limit.limit)}</span>
                <span class="budget-percentage ${statusClass}">${Math.round(limit.percentage)}%</span>
            </div>
            <div class="budget-progress-container">
                <div class="budget-progress-bar ${statusClass}" style="width: ${Math.min(limit.percentage, 100)}%"></div>
            </div>
        `;
        container.appendChild(item);
    });
}

function openBudgetLimitModal(limit = null) {
    const modalTitle = document.getElementById('budget-limit-modal-title');
    const categorySelect = document.getElementById('budget-limit-category');
    const amountInput = document.getElementById('budget-limit-amount');
    const thresholdInput = document.getElementById('budget-limit-threshold');
    const idInput = document.getElementById('budget-limit-id');

    // Populate categories (only spending categories)
    const spendingCategories = categories.filter(c => c.type === 'spending');
    categorySelect.innerHTML = '<option value="">Select a category</option>' +
        spendingCategories.map(c => {
            const isUsed = budgetLimits.some(l => l.category === c.name && (!limit || l.id !== limit.id));
            return `<option value="${c.name}" ${isUsed ? 'disabled' : ''}>${c.name}${isUsed ? ' (already has limit)' : ''}</option>`;
        }).join('');

    if (limit) {
        modalTitle.textContent = 'Edit Budget Limit';
        idInput.value = limit.id;
        categorySelect.value = limit.category;
        amountInput.value = limit.limit;
        thresholdInput.value = limit.alertThreshold || 80;
        categorySelect.disabled = true;
    } else {
        modalTitle.textContent = 'Add Budget Limit';
        idInput.value = '';
        categorySelect.value = '';
        amountInput.value = '';
        thresholdInput.value = 80;
        categorySelect.disabled = false;
    }

    budgetLimitModal.classList.add('active');
}

function closeBudgetLimitModal() {
    budgetLimitModal.classList.remove('active');
    budgetLimitForm.reset();
}

async function handleBudgetLimitSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('budget-limit-id').value;
    const category = document.getElementById('budget-limit-category').value;
    const limit = parseFloat(document.getElementById('budget-limit-amount').value);
    const threshold = parseInt(document.getElementById('budget-limit-threshold').value);

    if (!category || !limit || limit <= 0) {
        showToast('Please fill in all fields with valid values', 'error');
        return;
    }

    const limitData = {
        category,
        limit,
        alertThreshold: threshold,
        spent: 0,
        createdAt: new Date().toISOString()
    };

    try {
        if (id) {
            // Edit existing
            limitData.id = parseInt(id);
            const existing = budgetLimits.find(l => l.id === parseInt(id));
            if (existing) {
                limitData.spent = existing.spent;
            }
            await updateRecord(STORE_BUDGET_LIMITS, limitData);
            showToast('Budget limit updated', 'success');
        } else {
            // Add new
            await add(STORE_BUDGET_LIMITS, limitData);
            showToast('Budget limit added', 'success');
        }

        closeBudgetLimitModal();
        await refreshData();
        renderBudget();
    } catch (error) {
        showToast('Error saving budget limit: ' + error.message, 'error');
    }
}

async function handleResetAllBudgets() {
    if (await showConfirm('Reset spending for all budget limits? This will mark current spending as tracked from now.')) {
        const now = new Date().toISOString();
        for (const limit of budgetLimits) {
            limit.lastResetDate = now;
            await updateRecord(STORE_BUDGET_LIMITS, limit);
        }
        renderBudget();
        showToast('All spending amounts reset - tracking from now', 'success');
    }
}

// ========================================
// UPCOMING WIDGET FUNCTIONS
// ========================================

function renderUpcomingWidget() {
    const container = document.getElementById('upcoming-widget');
    if (!container) return;

    const now = new Date();
    const fiveDaysFromNow = new Date(now);
    fiveDaysFromNow.setDate(now.getDate() + 5);

    // Get upcoming transactions (next 5 days)
    const upcoming = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate > now && recordDate <= fiveDaysFromNow;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    const listContainer = container.querySelector('.upcoming-list');
    if (!listContainer) return;

    if (upcoming.length === 0) {
        listContainer.innerHTML = '<div class="upcoming-empty">No upcoming transactions in the next 5 days</div>';
        return;
    }

    listContainer.innerHTML = '';
    upcoming.slice(0, 5).forEach(r => {
        const dateObj = new Date(r.date);
        const isToday = dateObj.toDateString() === now.toDateString();
        const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === dateObj.toDateString();
        
        let dateLabel;
        if (isToday) {
            dateLabel = 'Today';
        } else if (isTomorrow) {
            dateLabel = 'Tomorrow';
        } else {
            dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        const isIncome = r.type === 'income';
        const amountClass = isIncome ? 'income' : 'spending';
        const amountPrefix = isIncome ? '+' : '-';
        const amount = parseFloat(r.amount) || 0;

        let description = r.item || r.category;
        if (r.formatType === 'combined' && r.combinedTransactions) {
            const itemCount = r.combinedTransactions.length;
            description = `${r.item || 'Combined'} (${itemCount} items)`;
        }

        const item = document.createElement('div');
        item.className = 'upcoming-item';
        item.innerHTML = `
            <span class="upcoming-date">${dateLabel}</span>
            <span class="upcoming-amount ${amountClass}">${amountPrefix}$${formatCurrency(amount)}</span>
            <span class="upcoming-desc">${isIncome ? '💰' : '💸'} ${description}</span>
        `;
        listContainer.appendChild(item);
    });
}

function renderUpcomingIncome() {
    const container = document.getElementById('upcoming-income-list');
    if (!container) return;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Get upcoming income and AR (next 30 days)
    const upcomingIncome = records.filter(r => {
        const recordDate = new Date(r.date);
        // Include: future income dates and pending AR
        if (r.type === 'income' && recordDate > now && recordDate <= thirtyDaysFromNow) {
            return true;
        }
        if (r.type === 'account_receivable' && !r.collected && recordDate <= thirtyDaysFromNow) {
            return true;
        }
        return false;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcomingIncome.length === 0) {
        container.innerHTML = `
            <div class="upcoming-income-empty">
                <i class="fas fa-calendar"></i>
                <p>No upcoming income or receivables</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    upcomingIncome.forEach(r => {
        const dateObj = new Date(r.date);
        const isToday = dateObj.toDateString() === now.toDateString();
        const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === dateObj.toDateString();
        
        let dateLabel;
        if (isToday) {
            dateLabel = 'Today';
        } else if (isTomorrow) {
            dateLabel = 'Tomorrow';
        } else {
            dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        const isAR = r.type === 'account_receivable';
        const isProjected = r.isProjected;
        const amount = parseFloat(r.amount) || 0;
        const description = r.projectedSource || r.item || r.category;

        const item = document.createElement('div');
        item.className = `upcoming-income-item ${isAR ? 'upcoming-ar-item' : ''} ${isProjected ? 'upcoming-projected' : ''}`;
        item.innerHTML = `
            <div class="income-info" onclick="showUpcomingIncomeDetails(${r.id})">
                <div class="income-icon">
                    <i class="fas ${isAR ? 'fa-hand-holding-dollar' : (isProjected ? 'fa-calendar-check' : 'fa-arrow-trend-up')}"></i>
                </div>
                <div class="income-details">
                    <span class="income-name">${description}</span>
                    <span class="income-date">${dateLabel}${isAR ? ' (Receivable)' : (isProjected ? ' (Expected)' : '')}</span>
                </div>
            </div>
            <div class="income-actions">
                <span class="income-amount">+$${formatCurrency(amount)}</span>
                ${!isAR ? `<button class="btn-icon edit-btn" onclick="event.stopPropagation(); editUpcomingIncome(${r.id})" title="Edit"><i class="fas fa-pen"></i></button>` : ''}
                <button class="btn-icon delete-btn" onclick="event.stopPropagation(); deleteUpcomingIncome(${r.id})" title="Delete"><i class="fas fa-trash"></i></button>
                ${isAR ? `<button class="collect-btn" onclick="event.stopPropagation(); collectAR(${r.id})" title="Mark as Collected">Collect</button>` : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

// ========================================
// UPCOMING INCOME MODAL FUNCTIONS
// ========================================

function openUpcomingIncomeModal() {
    if (!upcomingIncomeModal) return;

    // Reset form
    upcomingIncomeForm.reset();

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    upcomingIncomeDateInput.valueAsDate = tomorrow;

    // Populate category dropdown with income categories
    const incomeCategories = categories.filter(c => c.type === 'income');
    upcomingIncomeCategorySelect.innerHTML = '<option value="">Select Category</option>' +
        incomeCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    upcomingIncomeModal.classList.add('active');
}

function closeUpcomingIncomeModal() {
    if (upcomingIncomeModal) upcomingIncomeModal.classList.remove('active');
}

async function handleUpcomingIncomeSubmit(e) {
    e.preventDefault();

    const source = upcomingIncomeSourceInput.value.trim();
    const date = upcomingIncomeDateInput.value;
    const amount = parseFloat(upcomingIncomeAmountInput.value);
    const category = upcomingIncomeCategorySelect.value;
    const notes = upcomingIncomeNotesInput.value.trim();
    const id = document.getElementById('upcoming-income-edit-id')?.value;

    if (!source || !date || !amount || amount <= 0 || !category) {
        showToast('Please fill in all required fields with valid values', 'error');
        return;
    }

    // Check if date is in the future
    const selectedDate = new Date(date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (selectedDate < now) {
        showToast('Expected date must be in the future', 'warning');
        return;
    }

    const data = {
        formatType: 'single',
        type: 'income',
        date: date,
        timestamp: Date.now(),
        item: '',
        category: category,
        person: '',
        amount: amount,
        quantity: '1',
        notes: notes ? `Expected Income: ${source}. ${notes}` : `Expected Income: ${source}`,
        isProjected: true,
        projectedSource: source
    };

    try {
        if (id) {
            data.id = parseInt(id);
            await updateRecord(STORE_RECORDS, data);
            showToast('Expected income updated successfully', 'success');
        } else {
            await add(STORE_RECORDS, data);
            showToast('Expected income added successfully', 'success');
        }
        closeUpcomingIncomeModal();
        await refreshData();
        renderBudget();
    } catch (error) {
        console.error('Error saving upcoming income:', error);
        showToast('Error saving expected income: ' + error.message, 'error');
    }
}

function editUpcomingIncome(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    // Populate form with existing data
    upcomingIncomeSourceInput.value = record.projectedSource || '';
    upcomingIncomeDateInput.value = record.date;
    upcomingIncomeAmountInput.value = record.amount;
    upcomingIncomeNotesInput.value = record.notes?.replace(`Expected Income: ${record.projectedSource}. `, '')?.replace(`Expected Income: ${record.projectedSource}`, '') || '';

    // Populate category dropdown
    const incomeCategories = categories.filter(c => c.type === 'income');
    upcomingIncomeCategorySelect.innerHTML = '<option value="">Select Category</option>' +
        incomeCategories.map(c => `<option value="${c.name}" ${c.name === record.category ? 'selected' : ''}>${c.name}</option>`).join('');

    // Add hidden field for edit mode
    let editIdField = document.getElementById('upcoming-income-edit-id');
    if (!editIdField) {
        editIdField = document.createElement('input');
        editIdField.type = 'hidden';
        editIdField.id = 'upcoming-income-edit-id';
        upcomingIncomeForm.appendChild(editIdField);
    }
    editIdField.value = id;

    // Update modal title
    upcomingIncomeModal.querySelector('h2').textContent = 'Edit Expected Income';
    upcomingIncomeModal.classList.add('active');
}

async function deleteUpcomingIncome(id) {
    if (await showConfirm('Delete this expected income?')) {
        try {
            await remove(STORE_RECORDS, id);
            showToast('Expected income deleted', 'success');
            await refreshData();
            renderBudget();
        } catch (error) {
            console.error('Error deleting upcoming income:', error);
            showToast('Error deleting expected income: ' + error.message, 'error');
        }
    }
}

function showUpcomingIncomeDetails(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    const isAR = record.type === 'account_receivable';
    const isProjected = record.isProjected;
    const dateObj = new Date(record.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Create floating popup
    let popup = document.getElementById('upcoming-income-details-popup');
    if (popup) popup.remove();

    popup = document.createElement('div');
    popup.id = 'upcoming-income-details-popup';
    popup.className = 'upcoming-income-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>${isAR ? 'Accounts Receivable' : (isProjected ? 'Expected Income' : 'Upcoming Income')}</h3>
                <button class="btn-icon close-popup" onclick="document.getElementById('upcoming-income-details-popup').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="popup-body">
                <div class="detail-row">
                    <span class="detail-label">Source</span>
                    <span class="detail-value">${record.projectedSource || record.item || record.category}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date</span>
                    <span class="detail-value">${dateStr}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Amount</span>
                    <span class="detail-value income-amount">+$${formatCurrency(parseFloat(record.amount) || 0)}</span>
                </div>
                ${record.category ? `
                <div class="detail-row">
                    <span class="detail-label">Category</span>
                    <span class="detail-value">${record.category}</span>
                </div>
                ` : ''}
                ${record.notes ? `
                <div class="detail-row">
                    <span class="detail-label">Notes</span>
                    <span class="detail-value notes-text">${record.notes}</span>
                </div>
                ` : ''}
                ${isAR ? `
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value ${record.collected ? 'collected' : 'pending'}">${record.collected ? 'Collected' : 'Pending'}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', function closePopup(e) {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        });
    }, 100);
}
