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
    let backgroundColor = "#3b82f6"; // default blue
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
            label.addEventListener('click', function(e) {
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

    // Records
    addRecordBtn.addEventListener('click', () => openModal());
    cancelModalBtn.addEventListener('click', closeModal);
    recordForm.addEventListener('submit', handleRecordSubmit);

    const filterType = document.getElementById('filter-type');
    if (filterType) {
        filterType.addEventListener('change', renderRecords);
    }

    // Filter toggle functionality
    const recordsFilterToggle = document.getElementById('records-filter-toggle');
    const recordsFilterControls = document.getElementById('records-filter-controls');
    
    if (recordsFilterToggle && recordsFilterControls) {
        recordsFilterToggle.addEventListener('click', () => {
            const isVisible = recordsFilterControls.style.display !== 'none';
            recordsFilterControls.style.display = isVisible ? 'none' : 'block';
            recordsFilterToggle.classList.toggle('active', !isVisible);
        });
    }

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

    // Analytics Filters
    const analyticsFilterType = document.getElementById('analytics-filter-type');
    const analyticsFilterYear = document.getElementById('analytics-filter-year');
    const analyticsFilterMonth = document.getElementById('analytics-filter-month');
    const analyticsFilterPerson = document.getElementById('analytics-filter-person');
    const analyticsFilterCategory = document.getElementById('analytics-filter-category');
    const analyticsClearFiltersBtn = document.getElementById('analytics-clear-filters');
    
    // Analytics filter toggle functionality
    const analyticsFilterToggle = document.getElementById('analytics-filter-toggle');
    const analyticsFilterControls = document.getElementById('analytics-filter-controls');
    
    if (analyticsFilterToggle && analyticsFilterControls) {
        analyticsFilterToggle.addEventListener('click', () => {
            const isVisible = analyticsFilterControls.style.display !== 'none';
            analyticsFilterControls.style.display = isVisible ? 'none' : 'block';
            analyticsFilterToggle.classList.toggle('active', !isVisible);
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
        // Only add required if not in combined mode
        if (formatType !== 'combined') {
            recordItem.setAttribute('required', '');
        }
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
                // Restore required attribute for necessary fields
                if (element.id === 'record-item' && recordTypeSelect.value !== 'income') {
                    element.setAttribute('required', '');
                }
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

// Test function for monthly balance reset
function testMonthlyBalanceReset() {
    // Create test records spanning multiple months
    const testRecords = [
        { id: 1, date: '2026-02-15', type: 'income', amount: 1000, formatType: 'single' },
        { id: 2, date: '2026-02-20', type: 'spending', amount: 200, formatType: 'single' },
        { id: 3, date: '2026-03-01', type: 'income', amount: 500, formatType: 'single' },
        { id: 4, date: '2026-03-05', type: 'spending', amount: 100, formatType: 'single' },
        { id: 5, date: '2026-03-10', type: 'income', amount: 300, formatType: 'single' }
    ];
    
    // Temporarily replace records with test data
    const originalRecords = records;
    records = testRecords;
    
    // Test February transaction (should have opening balance of 0)
    const febBalance = calculateBalanceAtTransaction('2026-02-20', 2);
    console.log('February transaction opening balance:', febBalance); // Should be 1000
    
    // Test March transaction (should have opening balance of 0, ignoring February)
    const marchBalance = calculateBalanceAtTransaction('2026-03-05', 4);
    console.log('March transaction opening balance:', marchBalance); // Should be 500
    
    // Test later March transaction (should include earlier March transactions)
    const lateMarchBalance = calculateBalanceAtTransaction('2026-03-10', 5);
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

    const monthlyRecords = expandedRecords.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // Outstanding A/R should carry forward into the current month for visibility,
    // but should NOT be re-applied to this month's spending.
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const outstandingAR = expandedRecords.filter(r => {
        if (r.type !== 'account_receivable' || r.collected) return false;
        const d = new Date(r.date);
        return d < startOfCurrentMonth;
    });
    const dashboardDisplayRecords = [...monthlyRecords, ...outstandingAR];

    // Calculate income, spending, and balance with AR logic
    // Pending AR counts as spending (money deducted now)
    // Collected AR counts as income (money received)
    let income = 0;
    let spending = 0;
    
    monthlyRecords.forEach(r => {
        const amount = parseFloat(r.amount) || 0;
        
        if (r.isSavingsTransfer) {
            // New logic:
            // 1. Income to Savings: Treat as a budget outflow (increases spending)
            // 2. Spending from Savings: Exclude from budget (already deducted when moved to savings)
            if (r.type === 'income') {
                spending += amount;
            }
            return;
        }
        
        if (r.type === 'income') {
            income += amount;
        } else if (r.type === 'account_receivable') {
            if (!r.collected) {
                spending += amount;
            }
        } else {
            spending += amount;
        }
    });
    
    const balance = income - spending;
    
    // Calculate Accounts Receivable (all outstanding A/R, regardless of month)
    const arPending = expandedRecords
        .filter(r => r.type === 'account_receivable' && !r.collected)
        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const incomeEl = document.getElementById('total-income');
    const spendingEl = document.getElementById('total-spending');
    const balanceEl = document.getElementById('total-balance');
    const arEl = document.getElementById('total-ar');

    if (incomeEl) incomeEl.textContent = `$${formatCurrency(income)}`;
    if (spendingEl) spendingEl.textContent = `$${formatCurrency(spending)}`;
    if (balanceEl) balanceEl.textContent = `$${formatCurrency(balance)}`;
    if (arEl) arEl.textContent = `$${formatCurrency(arPending)}`;

    renderRecentRecords(dashboardDisplayRecords);
    renderCharts(monthlyRecords);
}

function renderRecentRecords(monthlyRecords) {
    const tbody = document.getElementById('recent-records-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Sort by date and ID (newest first)
    const sorted = [...monthlyRecords].sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id - a.id; // If same date, newer ID first
    }).slice(0, 5);

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records for this month</td></tr>';
        return;
    }

    sorted.forEach(r => {
        const tr = document.createElement('tr');
        const isCombined = r.formatType === 'combined';
        const isAR = r.type === 'account_receivable';
        const isSavingsTransfer = r.category === 'Savings Transfer' || r.type === 'savings_transfer';
        const isCarriedForward = r.carriedForwardFrom;
        const arClass = isAR ? (r.collected ? 'collected' : 'pending') : '';
        const carriedForwardText = isCarriedForward ? ' <span class="carried-forward-indicator">↻ Carried Forward</span>' : '';
        const arStatusText = isAR ? (r.collected ? ' (Collected)' : ' (Pending)') : '';
        const savingsTransferText = `<span class="category-badge badge-savings">Saving</span>`;
        
        let rowClass = (r.type || '');
        if (r.isCombinedComponent) {
            rowClass += ' sub-row';
            if (r.componentIndex === 0) rowClass += ' group-start';
            if (r.componentIndex === r.totalComponents - 1) rowClass += ' group-end';
        }
        tr.className = rowClass;
        tr.onclick = () => openDetailsModal(r);

        tr.innerHTML = `
            <td>${r.date}</td>
            <td class="item-cell">${(r.isCombinedComponent ? (r.item || '-') : (isCombined ? r.item : (r.type === 'income' ? r.category : r.item))) + (r.isCombinedComponent ? '' : carriedForwardText)}</td>
            <td>
                ${isSavingsTransfer ? savingsTransferText : `
                    <span class="category-badge badge-${r.type} ${arClass}">${r.isCombinedComponent ? r.actualCategory : r.category}${arStatusText}</span>
                `}
            </td>
            <td>${r.person || '-'}</td>
            <td class="${r.type === 'income' ? 'amount-income' : (r.type === 'account_receivable' ? 'amount-account_receivable ' + arClass : 'amount-spending')}">
                ${r.type === 'income' ? '+' : (r.type === 'account_receivable' ? '' : '-')}$${formatCurrency(parseFloat(r.amount))}
                ${isCombined && !r.isCombinedComponent ? `<br><small style="color: var(--text-muted);">(${r.quantity} items)</small>` : ''}
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit-btn" onclick="event.stopPropagation(); editRecord(${r.isCombinedComponent ? r.originalId : r.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-btn" onclick="event.stopPropagation(); deleteRecord(${r.isCombinedComponent ? r.originalId : r.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${isAR && !r.collected ? `
                        <button class="btn-icon collect-btn" onclick="event.stopPropagation(); collectAR(${r.isCombinedComponent ? r.originalId : r.id})" title="Mark as Collected">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    ${isAR && r.collected ? `
                        <button class="btn-icon undo-btn" onclick="event.stopPropagation(); undoCollectAR(${r.isCombinedComponent ? r.originalId : r.id})" title="Undo Collection">
                            <i class="fas fa-undo"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
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
            }
        } else {
            // Show all categories or on desktop
            if (showMoreBtn) {
                showMoreBtn.style.display = isMobile && labels.length > chartCategoriesVisible ? 'block' : 'none';
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
}

// Populate analytics person and category dropdowns
function populateAnalyticsFilterDropdowns() {
    const analyticsPersonSelect = document.getElementById('analytics-filter-person');
    const analyticsCategorySelect = document.getElementById('analytics-filter-category');
    const recordsPersonSelect = document.getElementById('filter-person');
    const recordsCategorySelect = document.getElementById('filter-category');
    
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
    // Example: viewing March 2026 should still show A/R from Feb 2026 if still pending.
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
                    ${r.type === 'income' ? '+' : (r.type === 'account_receivable' ? '' : '-')}$${formatCurrency(parseFloat(r.amount))}
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
        } else if (r.type === 'account_receivable') {
            if (r.collected) {
                monthlyStats[monthKey].arCollected += parseFloat(r.amount);
            } else {
                monthlyStats[monthKey].arPending += parseFloat(r.amount);
            }
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
        // Total spending includes pending AR (money deducted now)
        const totalSpending = stats.spending + stats.arPending;
        // Total income - collected AR is neutral (money recovered, not earned)
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
            <td class="amount-income">$${formatCurrency(totalIncome)}</td>
            <td class="amount-spending">$${formatCurrency(totalSpending)}</td>
            <td style="font-weight: 700; color: ${savings >= 0 ? 'var(--success)' : 'var(--danger)'}">
                ${savings >= 0 ? '+' : ''}$${formatCurrency(savings)}
            </td>
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
    renderPersonChart(filteredRecords);
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
            } else if (r.type === 'account_receivable') {
                // Pending AR counts as spending (money deducted now)
                if (!r.collected) spendingData[dayIdx] += amount;
            } else if (r.type === 'spending') {
                spendingData[dayIdx] += amount;
            }
        });
    } else {
        const months = Object.keys(monthlyStats).sort();
        // Calculate total income and spending including AR logic
        incomeData = months.map(m => {
            const stats = monthlyStats[m];
            return stats.income; // Collected AR is neutral, not income
        });
        spendingData = months.map(m => {
            const stats = monthlyStats[m];
            return stats.spending + stats.arPending; // Include pending AR in spending
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

    // Calculate spending by person (includes pending AR)
    const spendingByPerson = {};
    recordsToUse.forEach(r => {
        if (r.person) {
            if (r.type === 'spending') {
                spendingByPerson[r.person] = (spendingByPerson[r.person] || 0) + parseFloat(r.amount);
            } else if (r.type === 'account_receivable' && !r.collected) {
                // Pending AR counts as spending (money deducted now)
                spendingByPerson[r.person] = (spendingByPerson[r.person] || 0) + parseFloat(r.amount);
            }
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
    savingsPage[accountId] = 0; // reset to first page so newest shows
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

        const perPage = 3;
        const totalPages = Math.ceil(txs.length / perPage) || 1;
        let page = savingsPage[acc.id] || 0;
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
        
        // Filter out invalid transactions
        const validTransactions = combinedTransactions.filter(t => 
            t.category && t.amount && parseFloat(t.amount) > 0
        );
        
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
        
        const data = {
            formatType: 'single',
            type: type,
            date: date,
            item: type === 'income' ? '' : (document.getElementById('record-item')?.value || ''),
            category: document.getElementById('record-category')?.value || '',
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
            <span class="detail-label" style="font-weight: 600; color: #1e40af; font-size: 1rem;">Balance Analysis</span>
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
    const btn = document.getElementById('show-more-chart-categories');
    if (btn) {
        btn.textContent = chartCategoriesExpanded ? 'Show Less' : 'Show More';
    }
    
    // Adjust chart container height based on expansion state
    const chartContainer = document.querySelector('#categoryChart').closest('.chart-container');
    if (chartContainer) {
        if (chartCategoriesExpanded) {
            // Calculate needed height based on number of categories
            const isMobile = window.innerWidth <= 768;
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
            // Base height + extra height for legend items (approximately 25px per legend item)
            const neededHeight = Math.max(300, 250 + (categoryCount * 25));
            chartContainer.style.height = neededHeight + 'px';
        } else {
            // Reset to default height
            chartContainer.style.height = '300px';
        }
    }
    
    // Re-render charts with updated visibility
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyRecords = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });
    renderCharts(monthlyRecords);
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
    
    showToast(isPrivacyMode ? 'Privacy Mode Enabled' : 'Privacy Mode Disabled', 'info');
}

function updatePrivacyIcon() {
    if (!privacyToggle) return;
    const icon = privacyToggle.querySelector('i');
    if (icon) {
        icon.className = isPrivacyMode ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
}

