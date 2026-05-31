// App State
let currentTab = 'dashboard';

// ============================================
// INACTIVITY TIMEOUT (Auto Blur)
// ============================================
const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes in milliseconds
let inactivityTimer = null;
let isContentBlurred = false;

// ============================================
// LOGO CONFIGURATION
// ============================================
// Set to true to use custom image logo, false to use Font Awesome icon
const USE_CUSTOM_LOGO = false;

// Path to your custom logo image (relative to index.html)
const CUSTOM_LOGO_PATH = 'images/logo.png';

// Font Awesome icon class for default logo (if not using custom image)
const DEFAULT_LOGO_ICON = 'fas fa-wallet';

// ============================================

// Helper to get local date string YYYY-MM-DD
function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Convert hex color to lighter transparent RGBA format
function getLighterColor(hex, opacity = 0.08) {
    if (!hex) return 'transparent';
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(char => char + char).join('');
    }
    if (cleanHex.length !== 6) return 'transparent';
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Helper to determine readable text color (white or black) based on hex background color
function getContrastColor(hexColor) {
    if (!hexColor) return '#ffffff';
    let cleanHex = hexColor.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(char => char + char).join('');
    }
    if (cleanHex.length !== 6) return '#ffffff';
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

// Initialize logo based on configuration
function initializeLogo() {
    const logoIcon = document.getElementById('logo-icon');
    const logoImage = document.getElementById('logo-image');

    if (!logoIcon || !logoImage) return;

    if (USE_CUSTOM_LOGO) {
        // Use custom image logo
        logoIcon.style.display = 'none';
        logoImage.style.display = 'block';
        logoImage.src = CUSTOM_LOGO_PATH;
    } else {
        // Use Font Awesome icon
        logoIcon.style.display = 'block';
        logoImage.style.display = 'none';
        logoIcon.className = DEFAULT_LOGO_ICON + ' logo-icon';
    }
}

// Helper to calculate usage frequency for all categories and people
function getUsageMaps() {
    const categoryUsage = {};
    const personUsage = {};
    if (Array.isArray(records)) {
        records.forEach(r => {
            if (r.carriedForwardFrom) return;
            if (r.category) {
                categoryUsage[r.category] = (categoryUsage[r.category] || 0) + 1;
            }
            if (r.person) {
                personUsage[r.person] = (personUsage[r.person] || 0) + 1;
            }
            if (r.formatType === 'combined' && Array.isArray(r.combinedTransactions)) {
                r.combinedTransactions.forEach(ct => {
                    if (ct.category) {
                        categoryUsage[ct.category] = (categoryUsage[ct.category] || 0) + 1;
                    }
                    if (ct.person) {
                        personUsage[ct.person] = (personUsage[ct.person] || 0) + 1;
                    }
                });
            }
        });
    }
    return { categoryUsage, personUsage };
}

function incomeExcludedFromTotals(r) {
    return !!(r && (r.isProjected || r.excludeFromIncomeTotals));
}

function getAROutstandingAmount(r) {
    if (!r || r.type !== 'account_receivable' || r.collected) return 0;
    return Math.max(0, (parseFloat(r.amount) || 0) - (parseFloat(r.collectedAmount) || 0));
}

function getAPOutstandingAmount(r) {
    if (!r || r.type !== 'account_payable' || r.paid) return 0;
    return Math.max(0, (parseFloat(r.amount) || 0) - (parseFloat(r.paidAmount) || 0));
}

function getProvisionalHeld(r) {
    if (!r || r.type !== 'provisional') return 0;
    if (r.status === 'closed') return 0;
    if (r.heldAmount !== undefined && r.heldAmount !== null) {
        const h = parseFloat(r.heldAmount);
        if (!Number.isNaN(h)) return Math.max(0, h);
    }
    return Math.max(0, (parseFloat(r.amount) || 0) - provisionalReturnedTotal(r) - provisionalSpentTotal(r));
}

function provisionalReturnedTotal(r) {
    return (r.resolutions || []).filter(x => x.action === 'return' && !x.undone).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
}

function provisionalSpentTotal(r) {
    return (r.resolutions || []).filter(x => x.action === 'spend' && !x.undone).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
}

function refreshProvisionalDerivedFields(rec) {
    if (!rec || rec.type !== 'provisional') return;
    const total = parseFloat(rec.amount) || 0;
    const ret = provisionalReturnedTotal(rec);
    const sp = provisionalSpentTotal(rec);
    rec.heldAmount = Math.max(0, total - ret - sp);
    if (rec.heldAmount <= 0.0001) {
        rec.heldAmount = 0;
        rec.status = 'closed';
    } else if ((rec.resolutions || []).length > 0) {
        rec.status = 'partially_resolved';
    } else {
        rec.status = 'open';
    }
}

function provisionalBalanceEffectInMonth(r, year, month) {
    let n = 0;
    const created = new Date(r.date);
    if (created.getFullYear() === year && created.getMonth() === month - 1) {
        n -= parseFloat(r.amount) || 0;
    }
    (r.resolutions || []).forEach(res => {
        if ((res.action !== 'return' && res.action !== 'spend') || res.undone) return;
        const rd = new Date(res.date);
        if (rd.getFullYear() === year && rd.getMonth() === month - 1) {
            n += parseFloat(res.amount) || 0;
        }
    });
    return n;
}

function provisionalBalanceEffectPriorToTimestamp(r, targetTimestamp, excludeRecordId) {
    let n = 0;
    const createdTs = new Date(r.date).getTime();
    if (createdTs < targetTimestamp || (createdTs === targetTimestamp && r.id < excludeRecordId)) {
        n -= parseFloat(r.amount) || 0;
    }
    (r.resolutions || []).forEach(res => {
        if ((res.action !== 'return' && res.action !== 'spend') || res.undone) return;
        const rdTs = new Date(res.date).getTime();
        if (rdTs < targetTimestamp) {
            n += parseFloat(res.amount) || 0;
        }
    });
    return n;
}

let categoryChart = null;
let trendChart = null;
let monthlyTrendChart = null;
let personChart = null;
let categoryComparisonChart = null;
let categoryComparisonExpanded = false;
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

// Recurring income templates state
let recurringIncomeTemplates = [];

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
const heroExportBtn = document.getElementById('hero-export-btn');
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
const upcomingIncomeRecurringCheckbox = document.getElementById('upcoming-income-recurring');
const cancelUpcomingIncomeBtn = document.getElementById('cancel-upcoming-income-modal');

// Show More Buttons
const showMoreCategoriesBtn = document.getElementById('show-more-categories');
const showMorePeopleBtn = document.getElementById('show-more-people');

// Pagination State
let categoriesVisible = window.innerWidth > 768 ? 3 : 2;
let peopleVisible = window.innerWidth > 768 ? 3 : 2;
let categoriesExpanded = false;
let peopleExpanded = false;

// Chart categories pagination state
let chartCategoriesVisible = 5;
let chartCategoriesExpanded = false;

// Category breakdown pagination state
const categoryBreakdownLimit = 8;

// Spending breakdown pagination state
let spendingBreakdownPage = 0;
let currentSpendingData = [];

// Income breakdown pagination state
let incomeBreakdownPage = 0;
let currentIncomeData = [];

// Utility Notification Functions
function showToast(message, type = 'info') {
    console.log(`Toast (${type}): ${message}`);
    
    // Fallback if Toastify is not loaded
    if (typeof Toastify === 'undefined') {
        alert(message);
        return;
    }

    let backgroundColor = "#355872"; // default navy
    if (type === 'error') backgroundColor = "#ef4444";
    if (type === 'success') backgroundColor = "#10b981";
    if (type === 'warning') backgroundColor = "#f59e0b";

    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "center",
        stopOnFocus: true,
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

// ============================================
// INACTIVITY BLUR FUNCTIONS
// ============================================
function blurContent() {
    // Enable privacy mode instead of blurring
    if (!isContentBlurred) {
        isPrivacyMode = true;
        document.body.classList.add('privacy-mode');
        localStorage.setItem('floosy_privacy_mode', true);
        updatePrivacyIcon();
        isContentBlurred = true;
    }
}

function unblurContent() {
    // Disable privacy mode instead of unblurring
    if (isContentBlurred) {
        isPrivacyMode = false;
        document.body.classList.remove('privacy-mode');
        localStorage.setItem('floosy_privacy_mode', false);
        updatePrivacyIcon();
        isContentBlurred = false;
    }
}

function resetInactivityTimer() {
    // Clear existing timer if any
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    // Unblur content if it was blurred
    unblurContent();
    
    // Set new timer for inactivity
    inactivityTimer = setTimeout(() => {
        blurContent();
    }, INACTIVITY_TIMEOUT);
}

// Initialize App
document.addEventListener('DOMContentLoaded', async function initApp() {
    try {
        await initDB();
        await seedDefaultCategories();

        // Initialize Privacy Mode
        isPrivacyMode = localStorage.getItem('floosy_privacy_mode') === 'true';
        if (isPrivacyMode) {
            document.body.classList.add('privacy-mode');
            updatePrivacyIcon();
        }

        // Initialize Logo
        initializeLogo();

        // Initialize Inactivity Blur
        resetInactivityTimer();

        initEventListeners();
        await refreshData();

        // Set default date in modal
        document.getElementById('record-date').value = formatDateLocal(new Date());
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

        await switchTab('dashboard');

        // Test monthly balance reset functionality
        testMonthlyBalanceReset();

    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

function initEventListeners() {
    // Reset inactivity timer on genuine user button clicks only
    document.addEventListener('click', (e) => {
        // Only reset on trusted (genuine user) clicks, not programmatic events
        if (e.isTrusted && (e.target.closest('button') || e.target.closest('[data-tab]'))) {
            resetInactivityTimer();
        }
    });

    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', async () => {
            await switchTab(link.getAttribute('data-tab'));
        });
    });

    if (viewAllRecordsBtn) {
        viewAllRecordsBtn.addEventListener('click', async () => await switchTab('records'));
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
        dashboardFilterType.addEventListener('change', async () => {
            await renderDashboard();
        });
    }
    if (dashboardFilterYear) {
        dashboardFilterYear.addEventListener('change', async () => {
            await renderDashboard();
        });
    }
    if (dashboardFilterMonth) {
        dashboardFilterMonth.addEventListener('change', async () => {
            await renderDashboard();
        });
    }
    if (dashboardFilterPerson) {
        dashboardFilterPerson.addEventListener('change', async () => {
            await renderDashboard();
        });
    }
    if (dashboardFilterCategory) {
        dashboardFilterCategory.addEventListener('change', async () => {
            await renderDashboard();
        });
    }
    if (dashboardClearFiltersBtn) {
        dashboardClearFiltersBtn.addEventListener('click', async () => {
            if (dashboardFilterType) dashboardFilterType.value = 'all';
            if (dashboardFilterYear) dashboardFilterYear.value = '';
            if (dashboardFilterMonth) dashboardFilterMonth.value = '';
            if (dashboardFilterPerson) dashboardFilterPerson.value = '';
            if (dashboardFilterCategory) dashboardFilterCategory.value = '';
            await renderDashboard();
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

    // Monthly Balance Carry-Over Button
    const carryOverBtn = document.getElementById('carry-over-btn');
    if (carryOverBtn) {
        carryOverBtn.addEventListener('click', handleCarryOverToggle);
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
            panelEl.style.display = isVisible ? 'none' : 'flex';
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
    const clearAnalyticsFiltersHeaderBtn = document.getElementById('clear-analytics-filters-btn');
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

    if (clearAnalyticsFiltersHeaderBtn) {
        clearAnalyticsFiltersHeaderBtn.addEventListener('click', () => {
            if (analyticsFilterType) analyticsFilterType.value = 'all';
            if (analyticsFilterYear) analyticsFilterYear.value = '';
            if (analyticsFilterMonth) analyticsFilterMonth.value = '';
            if (analyticsFilterPerson) analyticsFilterPerson.value = '';
            if (analyticsFilterCategory) analyticsFilterCategory.value = '';
            renderAnalytics();
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

    function isAnalyticsFilterActive() {
        return (
            (analyticsFilterType && analyticsFilterType.value !== 'all') ||
            (analyticsFilterYear && analyticsFilterYear.value !== '') ||
            (analyticsFilterMonth && analyticsFilterMonth.value !== '') ||
            (analyticsFilterPerson && analyticsFilterPerson.value !== '') ||
            (analyticsFilterCategory && analyticsFilterCategory.value !== '')
        );
    }

    function updateAnalyticsClearHeaderButtonVisibility() {
        const clearBtn = document.getElementById('clear-analytics-filters-btn');
        if (!clearBtn) return;
        clearBtn.style.display = isAnalyticsFilterActive() ? '' : 'none';
    }

    // Category Breakdown Pagination
    // Spending breakdown pagination
    const prevSpendingBtn = document.getElementById('prev-spending-page');
    const nextSpendingBtn = document.getElementById('next-spending-page');
    if (prevSpendingBtn) {
        prevSpendingBtn.addEventListener('click', () => {
            if (spendingBreakdownPage > 0) {
                spendingBreakdownPage--;
                renderSpendingBreakdownTable();
            }
        });
    }
    if (nextSpendingBtn) {
        nextSpendingBtn.addEventListener('click', () => {
            const maxPage = Math.ceil(currentSpendingData.length / categoryBreakdownLimit) - 1;
            if (spendingBreakdownPage < maxPage) {
                spendingBreakdownPage++;
                renderSpendingBreakdownTable();
            }
        });
    }

    // Income breakdown pagination
    const prevIncomeBtn = document.getElementById('prev-income-page');
    const nextIncomeBtn = document.getElementById('next-income-page');
    if (prevIncomeBtn) {
        prevIncomeBtn.addEventListener('click', () => {
            if (incomeBreakdownPage > 0) {
                incomeBreakdownPage--;
                renderIncomeBreakdownTable();
            }
        });
    }
    if (nextIncomeBtn) {
        nextIncomeBtn.addEventListener('click', () => {
            const maxPage = Math.ceil(currentIncomeData.length / categoryBreakdownLimit) - 1;
            if (incomeBreakdownPage < maxPage) {
                incomeBreakdownPage++;
                renderIncomeBreakdownTable();
            }
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
    if (heroExportBtn) {
        heroExportBtn.addEventListener('click', handleExport);
    }
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

    // Savings Account Dropdown - Update Beneficiary Field
    if (recordSavingsAccountSelect) {
        recordSavingsAccountSelect.addEventListener('change', updateSavingsBeneficiaryField);
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
        
        // Re-render settings to dynamically adjust category/people collapsed limits on resize
        if (currentTab === 'settings') {
            renderSettings();
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

    // Savings Transaction Details Modal
    const closeSavingsDetailsBtn = document.getElementById('close-savings-details-modal');
    const savingsTransactionDetailsModal = document.getElementById('savings-transaction-details-modal');
    if (closeSavingsDetailsBtn && savingsTransactionDetailsModal) {
        closeSavingsDetailsBtn.addEventListener('click', () => {
            savingsTransactionDetailsModal.classList.remove('active');
        });
        // Close on clicking outside
        savingsTransactionDetailsModal.addEventListener('click', (e) => {
            if (e.target === savingsTransactionDetailsModal) {
                savingsTransactionDetailsModal.classList.remove('active');
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

    // Recurring checkbox styling toggle - fix: handle click on wrapper to toggle checkbox
    if (upcomingIncomeRecurringCheckbox) {
        const wrapper = upcomingIncomeRecurringCheckbox.closest('.recurring-checkbox-wrapper');
        if (wrapper) {
            // Sync visual state on change
            upcomingIncomeRecurringCheckbox.addEventListener('change', () => {
                wrapper.classList.toggle('active', upcomingIncomeRecurringCheckbox.checked);
            });

            // Click on wrapper should toggle checkbox (since checkbox is hidden)
            wrapper.addEventListener('click', (e) => {
                // Don't double-toggle if clicking the label (label's for= already toggles)
                if (e.target.tagName === 'LABEL') return;
                upcomingIncomeRecurringCheckbox.checked = !upcomingIncomeRecurringCheckbox.checked;
                wrapper.classList.toggle('active', upcomingIncomeRecurringCheckbox.checked);
            });
        }
    }

    // Close upcoming income modal on click outside
    window.addEventListener('click', (e) => {
        if (e.target === upcomingIncomeModal) closeUpcomingIncomeModal();
    });

    // AR Collection Card Listeners
    const arCard = document.getElementById('ar-collection-card');
    const arOverlay = document.getElementById('ar-collection-overlay');
    const closeBtn = document.getElementById('close-ar-collection-card');
    const cancelBtn = document.getElementById('cancel-ar-collection');
    const confirmBtn = document.getElementById('confirm-ar-collection');
    const fullCollectBtn = document.getElementById('ar-collect-full-btn');
    const amountInput = document.getElementById('ar-collected-amount');

    closeBtn?.addEventListener('click', hideARCollectionCard);
    cancelBtn?.addEventListener('click', hideARCollectionCard);
    confirmBtn?.addEventListener('click', processPartialARCollection);
    arOverlay?.addEventListener('click', hideARCollectionCard);
    fullCollectBtn?.addEventListener('click', () => {
        if (currentARCollection) {
            amountInput.value = currentARCollection.remainingAmount.toFixed(2);
            updateARProgress();
        }
    });

    amountInput?.addEventListener('input', updateARProgress);

    // AR Write-off button listener
    const arWriteoffBtn = document.getElementById('ar-writeoff-btn');
    const arWriteoffAmountGroup = document.getElementById('ar-writeoff-amount-group');
    const arWriteoffCategoryGroup = document.getElementById('ar-writeoff-category-group');
    const arWriteoffCategory = document.getElementById('ar-writeoff-category');
    
    arWriteoffBtn?.addEventListener('click', () => {
        const isActive = arWriteoffBtn.classList.contains('btn-primary');
        
        if (!isActive) {
            arWriteoffBtn.classList.remove('btn-outline');
            arWriteoffBtn.classList.add('btn-primary');
            arWriteoffAmountGroup.style.display = 'block';
            arWriteoffCategoryGroup.style.display = 'block';
            
            // Populate categories
            arWriteoffCategory.innerHTML = '<option value="">Select category...</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = cat.name;
                arWriteoffCategory.appendChild(option);
            });
        } else {
            arWriteoffBtn.classList.remove('btn-primary');
            arWriteoffBtn.classList.add('btn-outline');
            arWriteoffAmountGroup.style.display = 'none';
            arWriteoffCategoryGroup.style.display = 'none';
            document.getElementById('ar-writeoff-amount').value = '';
            arWriteoffCategory.value = '';
        }
    });

    // Allow Enter key to confirm
    amountInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            processPartialARCollection();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && arCard?.classList.contains('active')) {
            hideARCollectionCard();
        }
    });

    // Income Collection Card Listeners
    const incomeCard = document.getElementById('income-collection-card');
    const incomeOverlay = document.getElementById('income-collection-overlay');
    const closeIncomeBtn = document.getElementById('close-income-collection-card');
    const cancelIncomeBtn = document.getElementById('cancel-income-collection');
    const confirmIncomeBtn = document.getElementById('confirm-income-collection');
    const sameAmountBtn = document.getElementById('income-receive-same-btn');
    const incomeAmountInput = document.getElementById('income-received-amount');

    closeIncomeBtn?.addEventListener('click', hideIncomeCollectionCard);
    cancelIncomeBtn?.addEventListener('click', hideIncomeCollectionCard);
    confirmIncomeBtn?.addEventListener('click', processIncomeCollection);
    incomeOverlay?.addEventListener('click', hideIncomeCollectionCard);
    sameAmountBtn?.addEventListener('click', () => {
        if (currentIncomeCollection) {
            incomeAmountInput.value = currentIncomeCollection.amount.toFixed(2);
        }
    });

    incomeAmountInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            processIncomeCollection();
        }
    });

    // Close income card on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && incomeCard?.classList.contains('active')) {
            hideIncomeCollectionCard();
        }
    });

    const apCard = document.getElementById('ap-collection-card');
    const apOverlay = document.getElementById('ap-collection-overlay');
    document.getElementById('close-ap-collection-card')?.addEventListener('click', hideAPCollectionCard);
    document.getElementById('cancel-ap-collection')?.addEventListener('click', hideAPCollectionCard);
    document.getElementById('confirm-ap-collection')?.addEventListener('click', processPartialAPPayment);
    apOverlay?.addEventListener('click', hideAPCollectionCard);
    document.getElementById('ap-pay-full-btn')?.addEventListener('click', () => {
        const inp = document.getElementById('ap-paid-amount');
        if (currentAPCollection && inp) {
            inp.value = currentAPCollection.remainingAmount.toFixed(2);
            updateAPProgress();
        }
    });
    document.getElementById('ap-paid-amount')?.addEventListener('input', updateAPProgress);
    document.getElementById('ap-paid-amount')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processPartialAPPayment();
    });

    // AP Write-off button listener
    const apWriteoffBtn = document.getElementById('ap-writeoff-btn');
    const apWriteoffAmountGroup = document.getElementById('ap-writeoff-amount-group');
    
    apWriteoffBtn?.addEventListener('click', () => {
        const isActive = apWriteoffBtn.classList.contains('btn-primary');
        
        if (!isActive) {
            apWriteoffBtn.classList.remove('btn-outline');
            apWriteoffBtn.classList.add('btn-primary');
            apWriteoffAmountGroup.style.display = 'block';
        } else {
            apWriteoffBtn.classList.remove('btn-primary');
            apWriteoffBtn.classList.add('btn-outline');
            apWriteoffAmountGroup.style.display = 'none';
            document.getElementById('ap-writeoff-amount').value = '';
        }
    });

    const provCard = document.getElementById('provisional-resolve-card');
    const provOverlay = document.getElementById('provisional-resolve-overlay');
    document.getElementById('close-provisional-resolve-card')?.addEventListener('click', hideProvisionalResolveCard);
    document.getElementById('cancel-provisional-resolve')?.addEventListener('click', hideProvisionalResolveCard);
    provOverlay?.addEventListener('click', hideProvisionalResolveCard);
    document.getElementById('confirm-provisional-return')?.addEventListener('click', processProvisionalReturn);
    document.getElementById('confirm-provisional-spend')?.addEventListener('click', processProvisionalSpend);
    document.getElementById('confirm-provisional-mix')?.addEventListener('click', processProvisionalMix);
    document.getElementById('prov-return-full-btn')?.addEventListener('click', () => {
        const inp = document.getElementById('prov-return-amount');
        if (currentProvisionalResolve && inp) {
            inp.value = currentProvisionalResolve.heldRemaining.toFixed(2);
        }
    });
    document.getElementById('prov-spend-full-btn')?.addEventListener('click', () => {
        const inp = document.getElementById('prov-spend-amount');
        if (currentProvisionalResolve && inp) {
            inp.value = currentProvisionalResolve.heldRemaining.toFixed(2);
        }
    });

    // Provisional undo selection card
    const provUndoCard = document.getElementById('provisional-undo-card');
    const provUndoOverlay = document.getElementById('provisional-undo-overlay');
    document.getElementById('close-provisional-undo-card')?.addEventListener('click', hideProvisionalUndoCard);
    document.getElementById('cancel-provisional-undo')?.addEventListener('click', hideProvisionalUndoCard);
    provUndoOverlay?.addEventListener('click', hideProvisionalUndoCard);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && apCard?.classList.contains('active')) hideAPCollectionCard();
        if (e.key === 'Escape' && provCard?.classList.contains('active')) hideProvisionalResolveCard();
        if (e.key === 'Escape' && provUndoCard?.classList.contains('active')) hideProvisionalUndoCard();
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
        // Show item field for spending, A/R, A/P, and provisional
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

function updateSavingsBeneficiaryField() {
    const savingsAccountId = recordSavingsAccountSelect?.value;
    const beneficiaryGroup = document.getElementById('savings-beneficiary-group');
    const beneficiarySelect = document.getElementById('record-savings-beneficiary');

    if (!beneficiaryGroup || !beneficiarySelect) return;

    if (!savingsAccountId) {
        beneficiaryGroup.style.display = 'none';
        beneficiarySelect.value = '';
        return;
    }

    const account = savingsAccounts.find(acc => acc.id === parseInt(savingsAccountId));
    if (account && account.person) {
        beneficiaryGroup.style.display = 'block';
        beneficiarySelect.innerHTML = `<option value="${account.person}">${account.person}</option>`;
        beneficiarySelect.value = account.person;
    } else {
        beneficiaryGroup.style.display = 'block';
        beneficiarySelect.innerHTML = '<option value="">No owner assigned to this account</option>';
        beneficiarySelect.value = '';
    }
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

async function calculateBalanceAtTransaction(recordDate, excludeRecordId = null) {
    const targetDate = new Date(recordDate);
    const targetTimestamp = targetDate.getTime();
    const recordYear = targetDate.getFullYear();
    const recordMonth = targetDate.getMonth() + 1; // 1-indexed

    // Get carried balance from previous month
    const carriedBalance = await getLiveCarriedBalance(recordYear, recordMonth);

    // Get records from the SAME MONTH as this transaction that come BEFORE it
    const priorRecords = records.filter(r => {
        const recordDateTime = new Date(r.date);
        const recordTimestamp = recordDateTime.getTime();
        const rYear = recordDateTime.getFullYear();
        const rMonth = recordDateTime.getMonth() + 1; // 1-indexed

        // Only include records from the same month
        if (rYear !== recordYear || rMonth !== recordMonth) {
            return false;
        }

        // Exclude the record itself if specified
        if (excludeRecordId !== null && r.id === excludeRecordId) {
            return false;
        }

        // Include records with earlier dates in the same month
        if (recordTimestamp < targetTimestamp) {
            return true;
        }

        // For same date, use timestamp or ID to determine order
        if (recordTimestamp === targetTimestamp) {
            // If both have timestamps, compare them
            if (r.timestamp && excludeRecordId !== null) {
                const currentRecord = records.find(rec => rec.id === excludeRecordId);
                if (currentRecord && currentRecord.timestamp) {
                    return r.timestamp < currentRecord.timestamp;
                }
            }
            // Fallback: use ID (lower ID = earlier)
            if (excludeRecordId !== null) {
                return r.id < excludeRecordId;
            }
        }

        return false;
    });

    // Calculate income and spending from prior records in this month (same logic as dashboard)
    let income = 0;
    let spending = 0;

    priorRecords.forEach(r => {
        // Skip carried-forward AR duplicates
        if (r.type === 'account_receivable' && r.carriedForwardFrom) return;

        // Handle combined transactions - iterate through components
        if (r.formatType === 'combined' && r.combinedTransactions) {
            r.combinedTransactions.forEach(ct => {
                const amount = parseFloat(ct.amount) || 0;
                const quantity = parseInt(ct.quantity) || 1;
                const totalAmount = amount * quantity;

                // Process savings transfer components: deduct from balance but don't count as income/spending
                if (r.savingsAccountId || ct.savingsAccountId) {
                    // Both income-to-savings and spending-to-savings should deduct from wallet balance
                    spending += totalAmount;
                    return;
                }

                if (ct.type === 'income') {
                    income += totalAmount;
                } else if (ct.type === 'spending') {
                    spending += totalAmount;
                }
            });
            return;
        }

        const amount = parseFloat(r.amount) || 0;

        // Process savings transfers: deduct from balance but don't count as income/spending
        if (r.isSavingsTransfer) {
            // Both income-to-savings and spending-to-savings should deduct from wallet balance
            spending += amount;
            return;
        }

        if (r.type === 'income') {
            income += amount;
        } else if (r.type === 'spending') {
            spending += amount;
        }
        // account_receivable / account_payable excluded from income/spending here — balance handled below
    });

    // Calculate AR impact from prior records in this month (only pending AR, partial-aware)
    const arImpact = priorRecords
        .filter(r => r.type === 'account_receivable' && !r.collected)
        .reduce((sum, r) => sum - getAROutstandingAmount(r), 0);

    const apImpact = priorRecords
        .filter(r => r.type === 'account_payable')
        .reduce((sum, r) => sum - (parseFloat(r.paidAmount) || 0), 0);

    const targetTs = targetDate.getTime();
    let provImpact = 0;
    records.forEach(r => {
        if (r.type !== 'provisional' || r.isProjected) return;
        const d = new Date(r.date);
        if (d.getFullYear() !== recordYear || d.getMonth() + 1 !== recordMonth) {
            (r.resolutions || []).forEach(res => {
                if (res.action !== 'return' || res.undone) return;
                const rd = new Date(res.date);
                if (rd.getFullYear() !== recordYear || rd.getMonth() + 1 !== recordMonth) return;
                if (rd.getTime() < targetTs) {
                    provImpact += parseFloat(res.amount) || 0;
                }
            });
            return;
        }
        provImpact += provisionalBalanceEffectPriorToTimestamp(r, targetTs, excludeRecordId);
    });

    // Opening Balance = Carried Balance + Income (this month) - Spending (this month) + AR Impact (this month) + AP paid impact + provisional
    const openingBalance = carriedBalance + income - spending + arImpact + apImpact + provImpact;

    return openingBalance;
}

function formatCurrency(amount) {
    return amount.toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
    });
}

// Monthly Balance Carry-Over Handler
async function handleCarryOverToggle() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    // Get current settings for this month
    const settings = await getMonthlyBalanceSettings(currentYear, currentMonth);
    const currentCarryOver = settings ? settings.carryOver : false;

    // Toggle the setting
    const newCarryOver = !currentCarryOver;

    // Save as global default for future months
    localStorage.setItem('floosy_carry_over_default', newCarryOver);

    // If enabling carry-over, calculate and store the current balance as remaining balance
    // This is now just a snapshot, the actual carry-over is calculated live
    let remainingBalance = 0;
    if (newCarryOver) {
        remainingBalance = await calculateCurrentMonthRemainingBalance(currentYear, currentMonth);
    }

    // Save the setting
    await setMonthlyBalanceCarryOver(currentYear, currentMonth, newCarryOver, remainingBalance);

    // Update UI
    updateCarryOverUI(newCarryOver, remainingBalance);

    // Refresh dashboard to show updated balance
    await renderDashboard();

    showToast(newCarryOver ? 'Balance will carry over to next month' : 'Balance starts fresh each month', 'info');
}

/**
 * Gets the carried balance from the previous month live.
 * If carry-over is enabled for the previous month, it recursively calculates its balance.
 */
async function getLiveCarriedBalance(year, month) {
    // Get previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    // Check if carry-over is enabled for the previous month
    const settings = await getMonthlyBalanceSettings(prevYear, prevMonth);

    if (settings && settings.carryOver) {
        // Recursively calculate the balance for the previous month
        // This ensures changes multiple months back propagate forward instantly
        return await calculateCurrentMonthRemainingBalance(prevYear, prevMonth);
    }

    return 0;
}

// Calculate the remaining balance for a specific month
async function calculateCurrentMonthRemainingBalance(year, month) {
    // Check if there's a carried balance from previous month (CALCULATE LIVE)
    const carriedBalance = await getLiveCarriedBalance(year, month);

    // Get all records for this month
    const monthRecords = records.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() === month - 1;
    });

    let income = 0;
    let spending = 0;
    let arImpact = 0;
    let apImpact = 0;
    let provImpact = 0;

    monthRecords.forEach(r => {
        // Skip projected/expected income - they don't affect actual balance
        if (r.isProjected) return;
        // Skip carryover records - they're already accounted for in carriedBalance
        if (r.isCarryover) return;

        if (r.formatType === 'combined' && r.combinedTransactions) {
            r.combinedTransactions.forEach(ct => {
                const amount = parseFloat(ct.amount) || 0;
                const quantity = parseInt(ct.quantity) || 1;
                const totalAmount = amount * quantity;

                // Process savings transfers: deduct from balance but don't count as income/spending
                const isComponentSavingsTransfer = !!(r.savingsAccountId || ct.savingsAccountId);
                if (isComponentSavingsTransfer) {
                    // Both income-to-savings and spending-to-savings should deduct from wallet balance
                    spending += totalAmount;
                    return;
                }

                if (ct.type === 'income') {
                    income += totalAmount;
                } else if (ct.type === 'spending') {
                    spending += totalAmount;
                }
            });
        } else {
            const amount = parseFloat(r.amount) || 0;

            // Process savings transfers: deduct from balance but don't count as income/spending
            if (r.isSavingsTransfer) {
                // Both income-to-savings and spending-to-savings should deduct from wallet balance
                spending += amount;
                return;
            }

            if (r.type === 'income') {
                income += amount;
            } else if (r.type === 'spending') {
                spending += amount;
            } else if (r.type === 'account_receivable' && !r.collected) {
                arImpact -= Math.max(0, amount - (r.collectedAmount || 0));
            } else if (r.type === 'account_payable') {
                apImpact -= parseFloat(r.paidAmount) || 0;
            } else if (r.type === 'provisional') {
                provImpact += provisionalBalanceEffectInMonth(r, year, month);
            }
        }
    });

    records.forEach(r => {
        if (r.type !== 'provisional' || r.isProjected) return;
        const d = new Date(r.date);
        if (d.getFullYear() === year && d.getMonth() === month - 1) return;
        provImpact += provisionalBalanceEffectInMonth(r, year, month);
    });

    // We need to calculate the balance by excluding the portion of income that went to savings
    const walletIncome = monthRecords
        .filter(r => !r.isSavingsTransfer && !r.isProjected && !r.isCarryover)
        .reduce((sum, r) => {
            if (r.formatType === 'combined' && r.combinedTransactions) {
                // Only include income components, exclude savings transfers
                return sum + r.combinedTransactions
                    .filter(ct => ct.type === 'income' && !(r.savingsAccountId || ct.savingsAccountId))
                    .reduce((s, ct) => s + ((parseFloat(ct.amount) || 0) * (parseInt(ct.quantity) || 1)), 0);
            } else if (r.type === 'income') {
                // Single income record (non-savings, non-combined)
                return sum + (parseFloat(r.amount) || 0);
            }
            return sum;
        }, 0);

    return carriedBalance + walletIncome - spending + arImpact + apImpact + provImpact;
}

// Update the carry-over button UI
function updateCarryOverUI(carryOver, remainingBalance = 0) {
    const carryOverBtn = document.getElementById('carry-over-btn');
    const carryOverText = document.getElementById('carry-over-text');
    const carryOverHint = document.getElementById('carry-over-hint');

    if (!carryOverBtn || !carryOverText || !carryOverHint) return;

    if (carryOver) {
        carryOverBtn.classList.add('active');
        carryOverText.textContent = `Carry Over: $${formatCurrency(Math.abs(remainingBalance))}`;
        carryOverHint.textContent = remainingBalance >= 0
            ? `+$${formatCurrency(remainingBalance)} will be added next month`
            : `-$${formatCurrency(Math.abs(remainingBalance))} deficit will carry over`;
        carryOverHint.classList.add('carry-active');
    } else {
        carryOverBtn.classList.remove('active');
        carryOverText.textContent = 'Start Fresh (No Carry-Over)';
        carryOverHint.textContent = 'Balance starts at 0 each month';
        carryOverHint.classList.remove('carry-active');
    }
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
    categories.sort((a, b) => a.name.localeCompare(b.name));
    people = await getAll(STORE_PEOPLE);
    // new: load savings
    savingsAccounts = await getAll(STORE_SAVINGS_ACCOUNTS);
    
    // Ensure all accounts have a displayOrder
    let needsOrderUpdate = false;
    savingsAccounts.forEach((acc, i) => {
        if (acc.displayOrder === undefined) {
            acc.displayOrder = i;
            needsOrderUpdate = true;
        }
    });
    
    if (needsOrderUpdate) {
        for (const acc of savingsAccounts) {
            await updateRecord(STORE_SAVINGS_ACCOUNTS, acc);
        }
    }
    
    savingsAccounts.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    savingsTransactions = await getAll(STORE_SAVINGS_TRANSACTIONS);
    // load budget limits
    budgetLimits = await getAll(STORE_BUDGET_LIMITS);
    // load recurring income templates
    recurringIncomeTemplates = await getAll(STORE_RECURRING_INCOME);
    savingsPage = {}; // start pages over so user sees first page after data change
    updateCategoryDropdowns();
    updatePersonDropdown();
    updateSavingsAccountDropdown();
    await renderAll();
    populateYearFilter();
    populateAnalyticsFilterDropdowns();
}

async function switchTab(tabId) {
    if (currentTab === tabId) return;
    currentTab = tabId;
    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-tab') === tabId);
    });
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
    tabTitle.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);

    // Set default analytics filters when switching to analytics tab
    if (tabId === 'analytics') {
        const analyticsYearSelect = document.getElementById('analytics-filter-year');
        const analyticsMonthSelect = document.getElementById('analytics-filter-month');
        
        if (analyticsYearSelect && analyticsMonthSelect) {
            // Set defaults if either filter is empty
            if (!analyticsYearSelect.value || !analyticsMonthSelect.value) {
                const now = new Date();
                const currentYear = now.getFullYear().toString();
                const currentMonth = (now.getMonth() + 1).toString();
                
                analyticsYearSelect.value = currentYear;
                analyticsMonthSelect.value = currentMonth;
                
                // Trigger change events to re-render analytics
                analyticsYearSelect.dispatchEvent(new Event('change'));
                analyticsMonthSelect.dispatchEvent(new Event('change'));
            }
        }
    }

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
    const clearAnalyticsFiltersHeaderBtn = document.getElementById('clear-analytics-filters-btn');
    if (clearAnalyticsFiltersHeaderBtn) {
        clearAnalyticsFiltersHeaderBtn.style.display = tabId === 'analytics' ? '' : 'none';
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

    await renderAll();

    // Scroll to top on tab switch
    window.scrollTo({ top: 0, behavior: 'instant' });
}

async function renderAll() {
    if (currentTab === 'dashboard') await renderDashboard();
    else if (currentTab === 'analytics') renderAnalytics();
    else if (currentTab === 'settings') renderSettings();
    else if (currentTab === 'savings') renderSavings();
    else if (currentTab === 'budget') renderBudget();
}

// Dashboard Functions

// Create carryover transaction record if it doesn't exist
async function ensureCarryoverRecord(year, month) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    
    // Only create carryover record for current month
    if (year !== currentYear || month !== currentMonth) {
        return;
    }
    
    // Check if carryover is enabled for previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevSettings = await getMonthlyBalanceSettings(prevYear, prevMonth);
    
    if (!prevSettings || !prevSettings.carryOver) {
        return;
    }
    
    // Calculate the carried balance
    const carriedBalance = await getLiveCarriedBalance(year, month);
    
    if (Math.abs(carriedBalance) < 0.01) {
        return; // No balance to carry over
    }
    
    // Check if a carryover record already exists for this month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    const existingCarryover = records.find(r => {
        const rDate = new Date(r.date);
        return rDate >= monthStart && rDate <= monthEnd && r.isCarryover;
    });
    
    if (existingCarryover) {
        return; // Already exists
    }
    
    // Create the carryover record
    const carryoverRecord = {
        type: 'income',
        category: 'Balance Carryover',
        amount: carriedBalance,
        date: formatDateLocal(new Date(year, month - 1, 1)), // First day of the month
        notes: `Balance carried over from ${new Date(prevYear, prevMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        excludeFromIncomeTotals: true, // This ensures it doesn't affect income totals
        isCarryover: true
    };
    
    await add(STORE_RECORDS, carryoverRecord);
    await refreshData(); // Reload records to include the new carryover record
}

async function renderDashboard() {
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
    
    // Ensure carryover record exists for current month
    await ensureCarryoverRecord(currentYear, currentMonth + 1);

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
    updateExportStatusUI();


    // Process records to expand combined transactions for KPI calculations
    const expandedRecords = [];
    records.forEach(r => {
        // Skip projected/expected income - they don't affect actual totals
        if (r.isProjected) return;

        if (r.formatType === 'combined' && r.combinedTransactions) {
            // Expand combined transactions into individual components
            r.combinedTransactions.forEach((ct, index) => {
                const amount = parseFloat(ct.amount) || 0;
                const quantity = parseInt(ct.quantity) || 1;
                const totalAmount = amount * quantity;

                // Check if this component is a savings transfer (parent has savingsAccountId or component has its own)
                const isComponentSavingsTransfer = !!(r.savingsAccountId || ct.savingsAccountId);

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
                    componentIndex: index,
                    isSavingsTransfer: isComponentSavingsTransfer
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
            else if (filterType === 'income') typeMatch = r.type === 'income' && !isSavings; // Exclude savings transfers from income filter
            else if (filterType === 'account_receivable') typeMatch = r.type === 'account_receivable';
            else if (filterType === 'account_payable') typeMatch = r.type === 'account_payable';
            else if (filterType === 'provisional') typeMatch = r.type === 'provisional';
        }

        // Person/Category filters
        const personMatch = !filterPerson || r.person === filterPerson;
        let categoryMatch = !filterCategoryValue;
        if (filterCategoryValue) {
            const catToMatch = r.isCombinedComponent ? r.actualCategory : r.category;
            if (filterCategoryValue === 'all-income') {
                categoryMatch = r.type === 'income'; // Include savings income
            } else if (filterCategoryValue === 'all-spending') {
                categoryMatch = (r.type === 'spending' || r.type === 'account_receivable' || r.type === 'account_payable' || r.type === 'provisional') && !isSavings;
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

    // Get the year/month we're displaying
    const displayYear = filterYearValue ? parseInt(filterYearValue) : now.getFullYear();
    const displayMonth = filterMonthValue ? parseInt(filterMonthValue) : now.getMonth() + 1;

    // Check if there's a carried balance from previous month (CALCULATE LIVE)
    const carriedBalance = await getLiveCarriedBalance(displayYear, displayMonth);

    // Calculate the remaining balance for current month (what will be carried TO next month)
    const currentLiveRemainingBalance = await calculateCurrentMonthRemainingBalance(displayYear, displayMonth);

    // Update the carry-over UI for the current month if in current period view
    if (!filterYearValue && !filterMonthValue) {
        let currentSettings = await getMonthlyBalanceSettings(displayYear, displayMonth);
        
        if (!currentSettings) {
            const defaultCarryOver = localStorage.getItem('floosy_carry_over_default') === 'true';
            await setMonthlyBalanceCarryOver(displayYear, displayMonth, defaultCarryOver, currentLiveRemainingBalance);
            currentSettings = { carryOver: defaultCarryOver, remainingBalance: currentLiveRemainingBalance };
        }

        updateCarryOverUI(currentSettings?.carryOver || false, currentLiveRemainingBalance);
        
        // Sync the live balance to the database cache if carry-over is active
        if (currentSettings && currentSettings.carryOver && Math.abs((currentSettings.remainingBalance || 0) - currentLiveRemainingBalance) > 0.001) {
            await setMonthlyBalanceCarryOver(displayYear, displayMonth, true, currentLiveRemainingBalance);
        }
    }

    // Calculate income and spending (AR does NOT affect either - it's balance-only)
    let income = 0;
    let spending = 0;
    let saved = 0; // Track savings transfers separately
    let dashboardBalanceIncome = 0;
    let dashboardBalanceSpending = 0;

    // Debug: Log all savings transfers
    console.log('=== Processing monthly records ===', monthlyRecords.length);

    monthlyRecords.forEach(r => {
        // Skip projected/expected income - they don't affect actual balance
        if (r.isProjected) return;

        const amount = parseFloat(r.amount) || 0;

        // Process savings transfers: income-to-savings counts as 'saved' and deducts from balance
        if (r.isSavingsTransfer) {
            console.log(`Savings transfer: type=${r.type}, amount=${amount}, item=${r.item || r.category}`);
            if (r.type === 'income') {
                // Income recorded directly to savings: counts as saved only, NOT as income
                // Deducts from wallet balance (like spending) but doesn't affect income/spending totals
                saved += amount;
                dashboardBalanceSpending += amount;
                console.log(`  -> Added to saved. Saved now: ${saved}. Deducted from wallet balance.`);
            } else if (r.type === 'spending') {
                // Spending from wallet to savings: affects wallet balance only
                dashboardBalanceSpending += amount;
                console.log(`  -> Added to dashboardBalanceSpending. Not added to saved.`);
            }
            return;
        }

        if (r.type === 'income') {
            if (!incomeExcludedFromTotals(r)) {
                income += amount;
            }
            dashboardBalanceIncome += amount;
        } else if (r.type === 'spending') {
            spending += amount;
            dashboardBalanceSpending += amount;
        }
        // account_receivable excluded - affects balance only, not income/spending
    });

    // Calculate AR impact on balance for current period (only PENDING AR reduces balance - collected has no effect)
    const arImpact = monthlyRecords
        .filter(r => r.type === 'account_receivable' && !r.collected)
        .reduce((sum, r) => sum - Math.max(0, (parseFloat(r.amount) || 0) - (r.collectedAmount || 0)), 0);

    // Current Balance = Money on hand = the amount that will be carried to next month
    // This represents actual cash in wallet (Income - Spent - Saved - AR)
    const currentBalance = currentLiveRemainingBalance;
    const openingBalance = currentBalance;
    const endingBalance = currentBalance;
    const balance = currentBalance;

    // Calculate Accounts Receivable (filter by selected person/category if applicable)
    const arPending = expandedRecords
        .filter(r => {
            if (r.type !== 'account_receivable' || r.collected) return false;

            const personMatch = !filterPerson || r.person === filterPerson;
            const categoryMatch = !filterCategoryValue || (r.isCombinedComponent ? r.actualCategory : r.category) === filterCategoryValue;

            return personMatch && categoryMatch;
        })
        .reduce((sum, r) => sum + Math.max(0, (parseFloat(r.amount) || 0) - (r.collectedAmount || 0)), 0);

    const apOutstanding = expandedRecords
        .filter(r => {
            if (r.type !== 'account_payable' || r.paid) return false;
            const personMatch = !filterPerson || r.person === filterPerson;
            const categoryMatch = !filterCategoryValue || (r.isCombinedComponent ? r.actualCategory : r.category) === filterCategoryValue;
            return personMatch && categoryMatch;
        })
        .reduce((sum, r) => sum + getAPOutstandingAmount(r), 0);

    const heldTotal = expandedRecords
        .filter(r => {
            if (r.type !== 'provisional') return false;
            const personMatch = !filterPerson || r.person === filterPerson;
            const categoryMatch = !filterCategoryValue || (r.isCombinedComponent ? r.actualCategory : r.category) === filterCategoryValue;
            return personMatch && categoryMatch;
        })
        .reduce((sum, r) => sum + getProvisionalHeld(r), 0);

    const incomeEl = document.getElementById('total-income');
    const spendingEl = document.getElementById('total-spending');
    const balanceEl = document.getElementById('total-balance');
    const arEl = document.getElementById('total-ar');
    const apEl = document.getElementById('total-ap');
    const heldEl = document.getElementById('total-held');

    if (incomeEl) incomeEl.innerHTML = `<span class="dollar-positive">+$</span><span class="amount-num">${formatCurrency(income)}</span>`;
    if (spendingEl) spendingEl.innerHTML = `<span class="dollar-negative">-$</span><span class="amount-num">${formatCurrency(spending)}</span>`;
    if (balanceEl) balanceEl.innerHTML = `<span class="${balance >= 0 ? 'dollar-positive' : 'dollar-negative'}">${balance >= 0 ? '+' : '-'}$</span><span class="amount-num">${formatCurrency(Math.abs(balance))}</span>`;
    if (arEl) arEl.innerHTML = `<span class="dollar-negative">-$</span><span class="amount-num">${formatCurrency(arPending)}</span>`;
    if (apEl) apEl.innerHTML = `<span class="ap-kpi-amount">$</span><span class="amount-num">${formatCurrency(apOutstanding)}</span>`;
    if (heldEl) heldEl.innerHTML = `<span class="held-kpi-amount">$</span><span class="amount-num">${formatCurrency(heldTotal)}</span>`;

    // Update Mobile Hero Metrics
    // heroMonthEl update already handled above


    const heroSpendingEl = document.getElementById('hero-spending');
    const heroSavedEl = document.getElementById('hero-saved');
    const heroIncomeEl = document.getElementById('hero-income');
    const heroThisMonthValEl = document.getElementById('hero-this-month-val');
    const heroTrendIconEl = document.getElementById('hero-trend-icon');
    const heroArDisplayEl = document.getElementById('hero-ar-display');
    const heroApDisplayEl = document.getElementById('hero-ap-display');
    const heroHeldDisplayEl = document.getElementById('hero-held-display');

    if (heroSpendingEl) heroSpendingEl.innerHTML = `<span class="dollar-icon spending-icon">$</span><span class="amount-num">${formatCurrency(spending)}</span>`;
    if (heroSavedEl) heroSavedEl.innerHTML = `<span class="dollar-icon savings-icon">$</span><span class="amount-num">${formatCurrency(saved)}</span>`;
    if (heroIncomeEl) heroIncomeEl.innerHTML = `<span class="dollar-icon income-icon">$</span><span class="amount-num">${formatCurrency(income)}</span>`;
    if (heroThisMonthValEl) heroThisMonthValEl.innerHTML = `<span class="currency-sign">$</span><span class="amount-num">${formatCurrency(Math.abs(balance))}</span>`;
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
        heroArDisplayEl.innerHTML = `AR: <span class="dollar-icon ar-icon">$</span><span class="amount-num">${formatCurrency(arPending)}</span>`;
    }
    if (heroApDisplayEl) {
        heroApDisplayEl.style.display = 'block';
        heroApDisplayEl.innerHTML = `AP: <span class="dollar-icon ap-icon">$</span><span class="amount-num">${formatCurrency(apOutstanding)}</span>`;
    }
    if (heroHeldDisplayEl) {
        heroHeldDisplayEl.style.display = 'block';
        heroHeldDisplayEl.innerHTML = `Held: <span class="dollar-icon held-icon">$</span><span class="amount-num">${formatCurrency(heldTotal)}</span>`;
    }

    // Render records - pass ORIGINAL records (not expanded) so combined transactions appear as single entries
    // Only expand for the dashboard display list, not for KPI calculations which need to count each component
    const originalNonCarriedRecords = records.filter(r => !(r.type === 'account_receivable' && r.carriedForwardFrom));
    renderDashboardRecords(originalNonCarriedRecords);
    
    // Render upcoming widget
    renderUpcomingWidget();
    
    // Render month countdown
    renderMonthCountdown();
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
        // Exclude projected/expected income - they only show in Upcoming Income section
        if (r.isProjected) return false;

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
            typeMatch = (r.type === 'spending' || r.type === 'provisional') && !isSavings;
        } else if (filterType === 'income') {
            typeMatch = r.type === 'income'; // Include savings income
        } else if (filterType === 'account_receivable') {
            typeMatch = r.type === 'account_receivable';
        } else if (filterType === 'account_payable') {
            typeMatch = r.type === 'account_payable';
        } else if (filterType === 'provisional') {
            typeMatch = r.type === 'provisional';
        }

        const recordDate = new Date(r.date);
        const now = new Date();

        // Date Period Match logic
        let periodMatch = false;
        if (!filterYear && !filterMonth) {
            // Default Dashboard View: Current month transactions OR any currently pending AR
            const isCurrentMonth = recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
            const isPendingAR = r.type === 'account_receivable' && !r.collected;
            const isPendingAP = r.type === 'account_payable' && !r.paid;
            const isOpenProv = r.type === 'provisional' && r.status !== 'closed' && getProvisionalHeld(r) > 0;
            periodMatch = isCurrentMonth || isPendingAR || isPendingAP || isOpenProv;
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
            if (r.type === 'account_payable' && !r.paid && (filterType === 'all' || filterType === 'account_payable')) {
                periodMatch = true;
            }
            if (r.type === 'provisional' && r.status !== 'closed' && getProvisionalHeld(r) > 0 && (filterType === 'all' || filterType === 'provisional' || filterType === 'spending')) {
                periodMatch = true;
            }
        }

        const personMatch = !filterPerson || r.person === filterPerson;

        let categoryMatch = !filterCategory;
        if (filterCategory) {
            const catToMatch = r.isCombinedComponent ? r.actualCategory : r.category;
            if (filterCategory === 'all-income') {
                categoryMatch = r.type === 'income'; // Include savings income
            } else if (filterCategory === 'all-spending') {
                categoryMatch = (r.type === 'spending' || r.type === 'account_receivable' || r.type === 'account_payable' || r.type === 'provisional') && !isSavings;
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
        // Skip projected/expected income - they don't affect actual totals
        if (r.isProjected) return;

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
                    <div class="week-name"><span>Week ${currentWeek}</span></div>
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

            // Add scroll animation if text overflows for week name
            const weekNameEl = separator.querySelector('.week-name');
            if (weekNameEl) {
                const span = weekNameEl.querySelector('span');
                setTimeout(() => {
                    if (span && span.scrollWidth > weekNameEl.clientWidth) {
                        const scrollDist = span.scrollWidth - weekNameEl.clientWidth;
                        weekNameEl.style.setProperty('--scroll-dist', `-${scrollDist}px`);
                        const duration = Math.max(4, scrollDist / 20);
                        weekNameEl.style.setProperty('--scroll-duration', `${duration}s`);
                        weekNameEl.classList.add('animate-scroll');
                    }
                }, 0);
            }
        }
        const isAR = r.type === 'account_receivable';
        const isAP = r.type === 'account_payable';
        const isProv = r.type === 'provisional';
        const isSavingsTransfer = r.category === 'Savings Transfer' || r.type === 'savings_transfer';
        const isCarriedForward = r.carriedForwardFrom;
        const arStatus = isAR ? (r.collected ? ' (Collected)' : ' (Pending)') : '';
        const apStatus = isAP ? (r.paid ? ' (Paid)' : ' (Open)') : '';
        const provStatusLabel = isProv ? (r.status === 'closed' ? 'Closed' : r.status === 'partially_resolved' ? 'Partial' : 'Open') : '';
        const provStatus = isProv ? ` (${provStatusLabel})` : '';

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
        } else if (r.type === 'account_payable') {
            icon = 'fa-file-invoice-dollar';
            typeClass = 'account_payable';
            amountClass = r.paid ? 'income' : 'account_payable';
            amountPrefix = '';
        } else if (r.type === 'provisional') {
            icon = 'fa-hourglass-half';
            typeClass = 'provisional';
            amountClass = r.status === 'closed' ? 'provisional-closed' : 'provisional';
            amountPrefix = '-';
        } else {
            icon = 'fa-dollar-sign';
            typeClass = 'spending';
            amountClass = 'spending';
            amountPrefix = '-';
        }

        // Get display name - fallback to category if item is empty
        let displayName = r.isCombinedComponent ? (r.item || r.actualCategory || 'Combined Transaction') :
            (isCombined ? (r.item || 'Combined Transaction') : (r.item || r.category));
        if (isCarriedForward) displayName += ' ↻';

        // Get category name
        const categoryName = r.isCombinedComponent ? r.actualCategory : r.category;

        // Format date
        const dateObj = new Date(r.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const isSavingsRelevant = !!(r.savingsAccountId || r.isSavingsTransfer);
        const card = document.createElement('div');
        const provResolvedClass = isProv && r.status === 'closed' ? ' provisional-resolved' : '';
        card.className = `transaction-card ${typeClass} ${isSavingsRelevant ? 'savings-belong' : ''}${provResolvedClass}`;

        // Apply custom category color as background and border
        const catObj = categories.find(c => c.name === categoryName);
        const catColor = catObj?.color || '#355872';
        const lightBg = getLighterColor(catColor, 0.08);
        card.style.backgroundColor = lightBg;
        card.style.border = `1px solid ${catColor}`;
        card.onclick = async (e) => {
            // Don't open details if clicking on action buttons
            if (e.target.closest('.transaction-actions')) return;
            await openDetailsModal(r);
        };

        // Combined indicator badge - removed as per user request
        const combinedBadge = '';

        // Show amount - for combined, show the net
        let displayAmount = parseFloat(r.amount);
        if (isCombined) {
            displayAmount = Math.abs(combinedNet);
        } else if (isProv) {
            displayAmount = r.status === 'closed' ? 0 : getProvisionalHeld(r);
        } else if (isAR) {
            displayAmount = getAROutstandingAmount(r);
        } else if (isAP) {
            displayAmount = getAPOutstandingAmount(r);
        }

        const badgeType = isCombined ? (combinedNet >= 0 ? 'income' : 'spending') : r.type;
        const typeExtraStatus = isAR ? arStatus : (isAP ? apStatus : (isProv ? provStatus : ''));
        const amountIconClass = isAR ? 'ar-icon' : isAP ? 'ap-icon' : isProv ? 'held-icon' : (amountPrefix === '+' ? 'dollar-positive' : 'dollar-negative');
        const amountPrefixOut = isProv ? '-' : amountPrefix;

        card.innerHTML = `
            <div class="transaction-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-name"><span>${displayName}</span>${isProv && r.status === 'closed' ? ' <i class="fas fa-check-circle prov-closed-icon" title="Resolved"></i>' : ''}</div>
                <div class="transaction-category">
                    <span class="category-badge badge-${badgeType}">${isCombined ? 'Combined' : categoryName}${typeExtraStatus}</span>
                    ${r.person ? (() => {
                        const personObj = people.find(p => p.name === r.person);
                        const personColor = personObj?.color || '#355872';
                        return `<span><i class="fas fa-user" style="font-size: 0.7rem; color: ${personColor};"></i> <strong style="color: ${personColor}; font-weight: 600;">${r.person}</strong></span>`;
                    })() : ''}
                </div>
            </div>
            <div class="transaction-amount">
                <div class="amount ${amountClass}">
                    <div style="display: flex; align-items: baseline; justify-content: flex-end; gap: 2px;">
                        <span class="${amountIconClass}">${amountPrefixOut}$</span><span class="amount-num">${formatCurrency(displayAmount)}</span>
                    </div>
                    ${((isAR || isAP) && displayAmount < parseFloat(r.amount) - 0.001) ? `
                        <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 500; text-align: right; margin-top: -2px;">
                            of $${formatCurrency(parseFloat(r.amount))}
                        </div>
                    ` : ''}
                </div>
                <div class="date">${dateStr}</div>
            </div>
            <div class="transaction-actions">
                ${isAR ? `
                    ${!r.collected ? `
                        <button class="btn-icon collect-btn" onclick="event.stopPropagation(); collectAR(${r.isCombinedComponent ? r.originalId : r.id})" title="Mark Collected">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : `
                        <button class="btn-icon undo-btn" onclick="event.stopPropagation(); undoCollectAR(${r.isCombinedComponent ? r.originalId : r.id})" title="Mark Pending">
                            <i class="fas fa-undo"></i>
                        </button>
                    `}
                ` : ''}
                ${isAP ? `
                    ${!r.paid ? `
                        <button class="btn-icon collect-btn" onclick="event.stopPropagation(); payDebtAP(${r.isCombinedComponent ? r.originalId : r.id})" title="Pay Debt">
                            <i class="fas fa-money-bill-wave"></i>
                        </button>
                    ` : `
                        <button class="btn-icon undo-btn" onclick="event.stopPropagation(); undoPayAP(${r.isCombinedComponent ? r.originalId : r.id})" title="Undo Payment">
                            <i class="fas fa-undo"></i>
                        </button>
                    `}
                ` : ''}
                ${isProv && r.status !== 'closed' && getProvisionalHeld(r) > 0 ? `
                        <button class="btn-icon collect-btn" onclick="event.stopPropagation(); resolveProvisional(${r.isCombinedComponent ? r.originalId : r.id})" title="Resolve Held Funds">
                            <i class="fas fa-sliders-h"></i>
                        </button>
                ` : ''}
                ${isProv && r.resolutions && r.resolutions.filter(res => !res.undone).length > 0 ? `
                        <button class="btn-icon undo-btn" onclick="event.stopPropagation(); undoLastProvisionalResolution(${r.isCombinedComponent ? r.originalId : r.id})" title="Undo Last Resolution">
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

        // Add scroll animation if text overflows
        const nameEl = card.querySelector('.transaction-name');
        if (nameEl) {
            const span = nameEl.querySelector('span');
            // Use a small timeout to ensure DOM is rendered and dimensions are available
            setTimeout(() => {
                if (span && span.scrollWidth > nameEl.clientWidth) {
                    const scrollDist = span.scrollWidth - nameEl.clientWidth;
                    nameEl.style.setProperty('--scroll-dist', `-${scrollDist}px`);
                    // Slower duration for better readability (20px per second, min 4s)
                    const duration = Math.max(4, scrollDist / 20);
                    nameEl.style.setProperty('--scroll-duration', `${duration}s`);
                    nameEl.classList.add('animate-scroll');
                }
            }, 0);
        }
    });
}

function renderCharts(monthlyRecords) {
    const filterType = document.getElementById('analytics-filter-type')?.value || 'all';
    const filterCategory = document.getElementById('analytics-filter-category')?.value;

    // Detect focus based on filter
    let dataFocus = 'spending';
    if (filterType === 'income' || filterCategory === 'all-income') {
        dataFocus = 'income';
    } else if (filterCategory) {
        // If specific category is selected, try to find its type
        const cat = categories.find(c => c.name === filterCategory);
        if (cat && cat.type === 'income') dataFocus = 'income';
    }

    // Update Category Chart Title
    const catTitle = document.getElementById('category-chart-title');
    if (catTitle) {
        catTitle.textContent = dataFocus === 'income' ? 'Income by Category' : 'Spending by Category';
    }

    const categoryData = {};
    const relevantRecords = monthlyRecords.filter(r => r.type === dataFocus);

    relevantRecords.forEach(r => {
        categoryData[r.category] = (categoryData[r.category] || 0) + parseFloat(r.amount);
    });

    // 1. Category Breakdown Table
    // Pass all monthly records to show both spending and income breakdowns
    renderCategoryBreakdown(monthlyRecords);

    // 2. Category Doughnut Chart
    const canvasCat = document.getElementById('categoryChart');
    if (canvasCat) {
        const ctxCat = canvasCat.getContext('2d');
        if (categoryChart) categoryChart.destroy();

        let labels = Object.keys(categoryData);
        let data = Object.values(categoryData);
        const chartCard = canvasCat.closest('.card');
        const canvasWrapper = canvasCat.closest('.chart-container');

        if (labels.length > 0) {
            chartCard.style.display = 'block';
            if (canvasWrapper) {
                canvasWrapper.style.display = 'block';
                const msg = canvasWrapper.querySelector('.no-data-msg');
                if (msg) msg.remove();
                canvasCat.style.display = 'block';
            }
            
            // Re-use logic for mobile truncation
            const isMobile = window.innerWidth <= 768;
            const showMoreBtn = document.getElementById('show-more-chart-categories');
            
            if (isMobile && !chartCategoriesExpanded && labels.length > chartCategoriesVisible) {
                const sorted = labels.map((l, i) => ({ l, v: data[i] })).sort((a,b) => b.v - a.v);
                labels = sorted.slice(0, chartCategoriesVisible).map(x => x.l);
                data = sorted.slice(0, chartCategoriesVisible).map(x => x.v);
                const otherVal = sorted.slice(chartCategoriesVisible).reduce((s, x) => s + x.v, 0);
                if (otherVal > 0) {
                    labels.push('Other');
                    data.push(otherVal);
                }
                if (showMoreBtn) showMoreBtn.style.display = 'block';
            } else if (showMoreBtn) {
                showMoreBtn.style.display = (isMobile && Object.keys(categoryData).length > chartCategoriesVisible) ? 'block' : 'none';
            }

            // Shrink/Grow logic
            if (canvasWrapper) {
                const neededHeight = chartCategoriesExpanded ? Math.max(300, 250 + (labels.length * 25)) : 300;
                canvasWrapper.style.height = neededHeight + 'px';
            }

            categoryChart = new Chart(ctxCat, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: dataFocus === 'income' ? 
                            ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#047857', '#064e3b'] : 
                            ['#355872', '#7AAACE', '#9CD5FF', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { usePointStyle: true, padding: 15, font: { size: 11 } }
                        }
                    }
                }
            });
        } else {
            // Shrink container instead of hiding
            if (canvasWrapper) {
                canvasWrapper.style.height = '100px';
                canvasWrapper.style.display = 'flex';
                canvasWrapper.style.alignItems = 'center';
                canvasWrapper.style.justifyContent = 'center';
                ctxCat.clearRect(0, 0, canvasCat.width, canvasCat.height);
                canvasCat.style.display = 'none';
                
                // Add a "No data" message if not already there
                let msg = canvasWrapper.querySelector('.no-data-msg');
                if (!msg) {
                    msg = document.createElement('div');
                    msg.className = 'no-data-msg';
                    msg.style.color = 'var(--text-muted)';
                    msg.style.fontSize = '0.875rem';
                    canvasWrapper.appendChild(msg);
                }
                msg.textContent = `No ${dataFocus} data for this period`;
            }
        }
    }

    // 3. Income vs Spending Chart
    const canvasTrend = document.getElementById('trendChart');
    if (canvasTrend) {
        const ctxTrend = canvasTrend.getContext('2d');
        if (trendChart) trendChart.destroy();

        const totalIncome = monthlyRecords.filter(r => r.type === 'income' && !r.isProjected).reduce((s, r) => s + parseFloat(r.amount), 0);
        const totalSpending = monthlyRecords.reduce((s, r) => {
            if (r.isProjected) return s;
            if (r.type === 'spending') return s + parseFloat(r.amount);
            return s;
        }, 0);
        
        const trendCard = canvasTrend.closest('.card');
        if (totalIncome === 0 && totalSpending === 0) {
            trendCard.style.display = 'none';
        } else {
            trendCard.style.display = 'block';
            trendChart = new Chart(ctxTrend, {
                type: 'bar',
                data: {
                    labels: ['Income', 'Spending'],
                    datasets: [{
                        data: [totalIncome, totalSpending],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderRadius: 8,
                        barThickness: 40
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }
}

function renderCategoryBreakdown(records, type) {
    // Process data for spending and income separately
    // Use composite key "category|isSavings" to separate normal from savings records
    const spendingStats = {};
    const incomeStats = {};
    let totalSpending = 0;
    let totalIncome = 0;
    let spendingCount = 0;
    let incomeCount = 0;

    records.forEach(r => {
        if (r.isProjected) return;

        const amt = parseFloat(r.amount) || 0;
        const categoryName = r.category;
        const isSavingsAccount = r.savingsAccountId ? true : false;
        // Create separate keys for normal vs savings records of the same category
        const categoryKey = isSavingsAccount ? `${categoryName}|savings` : `${categoryName}|normal`;

        if (r.type === 'spending') {
            if (!spendingStats[categoryKey]) {
                spendingStats[categoryKey] = { 
                    name: categoryName, 
                    amount: 0, 
                    count: 0, 
                    isSavingsAccount: isSavingsAccount 
                };
            }
            spendingStats[categoryKey].amount += amt;
            spendingStats[categoryKey].count += 1;
            totalSpending += amt;
            spendingCount += 1;
        } else if (r.type === 'income' && !incomeExcludedFromTotals(r)) {
            if (!incomeStats[categoryKey]) {
                incomeStats[categoryKey] = { 
                    name: categoryName, 
                    amount: 0, 
                    count: 0, 
                    isSavingsAccount: isSavingsAccount 
                };
            }
            incomeStats[categoryKey].amount += amt;
            incomeStats[categoryKey].count += 1;
            totalIncome += amt;
            incomeCount += 1;
        }


    });

    // Convert to arrays and sort by amount (descending)
    // Map to format: [displayName, stats]
    currentSpendingData = Object.entries(spendingStats)
        .map(([key, stats]) => [stats.name, stats])
        .sort((a, b) => b[1].amount - a[1].amount);
    currentIncomeData = Object.entries(incomeStats)
        .map(([key, stats]) => [stats.name, stats])
        .sort((a, b) => b[1].amount - a[1].amount);

    // Reset pagination
    spendingBreakdownPage = 0;
    incomeBreakdownPage = 0;

    // Show/hide spending card and update totals
    const spendingCard = document.getElementById('spending-breakdown-card');
    if (spendingCard) {
        if (currentSpendingData.length > 0) {
            spendingCard.style.display = 'block';
            document.getElementById('spending-total-count').textContent = spendingCount;
            document.getElementById('spending-total-amount').textContent = '$' + formatCurrency(totalSpending);
            renderSpendingBreakdownTable();
        } else {
            spendingCard.style.display = 'none';
        }
    }

    // Show/hide income card and update totals
    const incomeCard = document.getElementById('income-breakdown-card');
    if (incomeCard) {
        if (currentIncomeData.length > 0) {
            incomeCard.style.display = 'block';
            document.getElementById('income-total-count').textContent = incomeCount;
            document.getElementById('income-total-amount').textContent = '$' + formatCurrency(totalIncome);
            renderIncomeBreakdownTable();
        } else {
            incomeCard.style.display = 'none';
        }
    }
}

function renderSpendingBreakdownTable() {
    const tbody = document.getElementById('spending-breakdown-body');
    const pagination = document.getElementById('spending-breakdown-pagination');
    const pageInfo = document.getElementById('spending-page-info');
    const prevBtn = document.getElementById('prev-spending-page');
    const nextBtn = document.getElementById('next-spending-page');

    if (!tbody) return;

    const totalSpending = currentSpendingData.reduce((sum, item) => sum + item[1].amount, 0);
    const start = spendingBreakdownPage * categoryBreakdownLimit;
    const end = start + categoryBreakdownLimit;
    const paginatedItems = currentSpendingData.slice(start, end);
    const totalPages = Math.ceil(currentSpendingData.length / categoryBreakdownLimit);

    tbody.innerHTML = paginatedItems.map(([name, stats], index) => {
        const percentage = totalSpending > 0 ? ((stats.amount / totalSpending) * 100).toFixed(1) : 0;
        const isSavingsAccount = stats.isSavingsAccount;
        const rowClass = isSavingsAccount ? 'savings-account-row' : '';
        const displayName = name + (isSavingsAccount ? ' (Savings)' : '');
        const nameStyle = isSavingsAccount ? 'color: #ef4444; font-weight: 600;' : '';

        let barColor = 'rgba(53, 88, 114, 0.2)';
        if (percentage > 25) barColor = '#ef4444';
        else if (percentage > 10) barColor = '#355872';

        return `
            <tr class="${rowClass}">
                <td class="breakdown-category-name" id="spending-cat-${index}"><span style="${nameStyle}">${displayName}</span></td>
                <td>${stats.count}</td>
                <td class="amount-spending" style="font-weight: 700;">$${formatCurrency(stats.amount)}</td>
                <td>
                    <div class="percentage-bar-container">
                        <span class="percentage-bar">
                            <div class="percentage-bar-fill" style="width: ${percentage}%; background: ${barColor};"></div>
                        </span>
                        <span class="percentage-text">${percentage}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Trigger text scroll animation for long category names
    setTimeout(() => {
        paginatedItems.forEach(([name, stats], index) => {
            const catEl = document.getElementById(`spending-cat-${index}`);
            if (catEl) {
                const span = catEl.querySelector('span');
                // Use getBoundingClientRect for actual rendered width
                const containerWidth = catEl.getBoundingClientRect().width;
                if (span && span.scrollWidth > containerWidth + 2) { // +2 for safety margin
                    const scrollDist = span.scrollWidth - containerWidth;
                    catEl.style.setProperty('--scroll-dist', `-${scrollDist}px`);
                    const duration = Math.max(4, scrollDist / 20);
                    catEl.style.setProperty('--scroll-duration', `${duration}s`);
                    catEl.classList.add('animate-scroll');
                }
            }
        });
    }, 0);

    if (pagination) {
        pagination.style.display = totalPages > 1 ? 'flex' : 'none';
        if (pageInfo) pageInfo.textContent = `Page ${spendingBreakdownPage + 1} of ${totalPages || 1}`;
        if (prevBtn) prevBtn.disabled = spendingBreakdownPage === 0;
        if (nextBtn) nextBtn.disabled = spendingBreakdownPage >= totalPages - 1;
    }
}

function renderIncomeBreakdownTable() {
    const tbody = document.getElementById('income-breakdown-body');
    const pagination = document.getElementById('income-breakdown-pagination');
    const pageInfo = document.getElementById('income-page-info');
    const prevBtn = document.getElementById('prev-income-page');
    const nextBtn = document.getElementById('next-income-page');

    if (!tbody) return;

    const totalIncome = currentIncomeData.reduce((sum, item) => sum + item[1].amount, 0);
    const start = incomeBreakdownPage * categoryBreakdownLimit;
    const end = start + categoryBreakdownLimit;
    const paginatedItems = currentIncomeData.slice(start, end);
    const totalPages = Math.ceil(currentIncomeData.length / categoryBreakdownLimit);

    tbody.innerHTML = paginatedItems.map(([name, stats], index) => {
        const percentage = totalIncome > 0 ? ((stats.amount / totalIncome) * 100).toFixed(1) : 0;
        const isSavingsAccount = stats.isSavingsAccount;
        const rowClass = isSavingsAccount ? 'savings-account-row' : '';
        const displayName = name + (isSavingsAccount ? ' (Savings)' : '');
        const nameStyle = isSavingsAccount ? 'color: #ef4444; font-weight: 600;' : '';

        let barColor = 'rgba(16, 185, 129, 0.2)';
        if (percentage > 25) barColor = '#10b981';
        else if (percentage > 10) barColor = '#34d399';

        return `
            <tr class="${rowClass}">
                <td class="breakdown-category-name" id="income-cat-${index}"><span style="${nameStyle}">${displayName}</span></td>
                <td>${stats.count}</td>
                <td class="amount-income" style="font-weight: 700;">$${formatCurrency(stats.amount)}</td>
                <td>
                    <div class="percentage-bar-container">
                        <span class="percentage-bar">
                            <div class="percentage-bar-fill" style="width: ${percentage}%; background: ${barColor};"></div>
                        </span>
                        <span class="percentage-text">${percentage}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Trigger text scroll animation for long category names
    setTimeout(() => {
        paginatedItems.forEach(([name, stats], index) => {
            const catEl = document.getElementById(`income-cat-${index}`);
            if (catEl) {
                const span = catEl.querySelector('span');
                // Use getBoundingClientRect for actual rendered width
                const containerWidth = catEl.getBoundingClientRect().width;
                if (span && span.scrollWidth > containerWidth + 2) { // +2 for safety margin
                    const scrollDist = span.scrollWidth - containerWidth;
                    catEl.style.setProperty('--scroll-dist', `-${scrollDist}px`);
                    const duration = Math.max(4, scrollDist / 20);
                    catEl.style.setProperty('--scroll-duration', `${duration}s`);
                    catEl.classList.add('animate-scroll');
                }
            }
        });
    }, 0);

    if (pagination) {
        pagination.style.display = totalPages > 1 ? 'flex' : 'none';
        if (pageInfo) pageInfo.textContent = `Page ${incomeBreakdownPage + 1} of ${totalPages || 1}`;
        if (prevBtn) prevBtn.disabled = incomeBreakdownPage === 0;
        if (nextBtn) nextBtn.disabled = incomeBreakdownPage >= totalPages - 1;
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

    const { categoryUsage, personUsage } = getUsageMaps();

    // Sort people by usage frequency (descending)
    const sortedPeople = [...people].sort((a, b) => {
        const usageA = personUsage[a.name] || 0;
        const usageB = personUsage[b.name] || 0;
        if (usageB !== usageA) return usageB - usageA;
        return compareStringsAlphabetically(a.name, b.name);
    });

    // Sort categories by type and usage frequency
    const incomeCategories = categories.filter(c => c.type === 'income').sort((a, b) => {
        const usageA = categoryUsage[a.name] || 0;
        const usageB = categoryUsage[b.name] || 0;
        if (usageB !== usageA) return usageB - usageA;
        return compareStringsAlphabetically(a.name, b.name);
    });
    const spendingCategories = categories.filter(c => c.type === 'spending').sort((a, b) => {
        const usageA = categoryUsage[a.name] || 0;
        const usageB = categoryUsage[b.name] || 0;
        if (usageB !== usageA) return usageB - usageA;
        return compareStringsAlphabetically(a.name, b.name);
    });

    // Populate analytics person dropdown
    if (analyticsPersonSelect) {
        const currentValue = analyticsPersonSelect.value;
        analyticsPersonSelect.innerHTML = '<option value="">All People</option>' +
            sortedPeople.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        analyticsPersonSelect.value = currentValue;
    }

    // Populate analytics category dropdown
    if (analyticsCategorySelect) {
        const currentValue = analyticsCategorySelect.value;
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
            sortedPeople.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        recordsPersonSelect.value = currentValue;
    }

    // Populate records category dropdown
    if (recordsCategorySelect) {
        const currentValue = recordsCategorySelect.value;
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
            sortedPeople.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        dashboardPersonSelect.value = currentValue;
    }

    // Populate dashboard category dropdown
    if (dashboardCategorySelect) {
        const currentValue = dashboardCategorySelect.value;
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
        // Exclude projected/expected income - they only show in Upcoming Income section
        if (r.isProjected) return false;

        const isSavings = !!r.isSavingsTransfer;
        const typeMatch =
            filterType === 'all' ||
            (filterType === 'savings' ? isSavings :
             filterType === 'income' ? r.type === 'income' :
             filterType === 'spending' ? (r.type === 'spending' || r.type === 'provisional') && !isSavings :
             (r.type === filterType && !isSavings));
        const recordDate = new Date(r.date);
        const isPendingAR = r.type === 'account_receivable' && !r.collected;
        const isPendingAP = r.type === 'account_payable' && !r.paid;
        const isOpenProv = r.type === 'provisional' && r.status !== 'closed' && getProvisionalHeld(r) > 0;

        // Default year/month match behavior
        let yearMatch = !filterYear || recordDate.getFullYear().toString() === filterYear;
        let monthMatch = !filterMonth || (recordDate.getMonth() + 1).toString() === filterMonth;

        // Carry-forward behavior for pending A/R when filtering by a specific month+year
        if (filterMonthEnd && isPendingAR) {
            yearMatch = true;
            monthMatch = recordDate <= filterMonthEnd;
        }
        if (filterMonthEnd && isPendingAP) {
            yearMatch = true;
            monthMatch = recordDate <= filterMonthEnd;
        }
        if (filterMonthEnd && isOpenProv) {
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
                categoryMatch = (r.type === 'spending' || r.type === 'account_receivable' || r.type === 'account_payable' || r.type === 'provisional') && !isSavings;
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
            tr.onclick = async () => await openDetailsModal(r);

            // Apply dynamic background color based on category color
            if (!r.isParentGroupHeader) {
                const recCat = r.isCombinedComponent ? r.actualCategory : r.category;
                const catObj = categories.find(c => c.name === recCat);
                const catColor = catObj?.color || '#355872';
                const lightBg = getLighterColor(catColor, 0.08);
                tr.style.backgroundColor = lightBg;
                tr.style.border = `1px solid ${catColor}`;
            }

            const isAR = r.type === 'account_receivable';
            const isAP = r.type === 'account_payable';
            const isProv = r.type === 'provisional';
            const arClass = isAR ? (r.collected ? 'collected' : 'pending') : '';
            const arStatusText = isAR ? (r.collected ? ' (Collected)' : ' (Pending)') : '';
            const apClass = isAP ? (r.paid ? 'collected' : 'pending') : '';
            const apStatusText = isAP ? (r.paid ? ' (Paid)' : ' (Open)') : '';
            const provLabel = isProv ? (r.status === 'closed' ? 'Closed' : r.status === 'partially_resolved' ? 'Partial' : 'Open') : '';
            const provStatusText = isProv ? ` (${provLabel})` : '';
            const isSavingsTransfer = !!r.isSavingsTransfer || r.category === 'Savings Transfer' || r.type === 'savings_transfer';
            const savingsTransferText = `<span class="category-badge badge-savings">Saving</span>`;
            const badgeExtra = isAR ? arClass : (isAP ? apClass : '');
            const typeExtra = isAR ? arStatusText : (isAP ? apStatusText : (isProv ? provStatusText : ''));
            const rowAmt = isProv ? getProvisionalHeld(r) : parseFloat(r.amount);
            const amtCellClass = r.type === 'income' ? 'amount-income'
                : (r.type === 'account_receivable' ? 'amount-account_receivable ' + arClass
                    : (r.type === 'account_payable' ? 'amount-account_payable ' + apClass
                        : (r.type === 'provisional' ? 'amount-provisional' : 'amount-spending')));
            const amtSpanClass = r.type === 'income' ? 'dollar-positive'
                : (r.type === 'account_receivable' ? 'ar-icon'
                    : (r.type === 'account_payable' ? 'ap-icon'
                        : (r.type === 'provisional' ? 'held-icon' : 'dollar-negative')));
            const amtPrefix = r.type === 'income' ? '+' : (r.type === 'account_receivable' || r.type === 'account_payable' ? '' : '-');

            tr.innerHTML = `
                <td>${r.isParentGroupHeader ? '' : r.date}</td>
                <td class="item-cell">${(r.isCombinedComponent ? (r.item || r.actualCategory || '-') : (isCombined ? (r.item || 'Combined Transaction') : (r.item || r.category))) + (r.isCombinedComponent ? '' : carriedForwardText)}</td>
                <td>
                    ${r.isParentGroupHeader ? '' : (isSavingsTransfer ? savingsTransferText : `
                        <span class="category-badge badge-${r.type} ${badgeExtra}">${r.isCombinedComponent ? r.actualCategory : r.category}${typeExtra}</span>
                    `)}
                </td>
                <td>${r.isParentGroupHeader ? '' : (() => {
                    if (!r.person) return '-';
                    const personObj = people.find(p => p.name === r.person);
                    const personColor = personObj?.color || '#355872';
                    return `<span style="color: ${personColor}; font-weight: 600;"><i class="fas fa-user" style="font-size: 0.7rem; color: ${personColor};"></i> ${r.person}</span>`;
                })()}</td>
                <td class="${amtCellClass}">
                    <span class="${amtSpanClass}">${amtPrefix}$</span><span class="amount-num">${formatCurrency(rowAmt)}</span>
                    ${((isAR || isAP) && rowAmt < parseFloat(r.amount) - 0.001) ? `<br><small style="color: var(--text-muted);">of $${formatCurrency(parseFloat(r.amount))}</small>` : ''}
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
                        ${isAP && !r.paid && !r.isParentGroupHeader ? `
                            <button class="btn-icon collect-btn" onclick="event.stopPropagation(); payDebtAP(${r.isCombinedComponent ? r.originalId : r.id})" title="Pay Debt">
                                <i class="fas fa-money-bill-wave"></i>
                            </button>
                        ` : ''}
                        ${isAP && r.paid && !r.isParentGroupHeader ? `
                            <button class="btn-icon uncollect-btn" onclick="event.stopPropagation(); undoPayAP(${r.isCombinedComponent ? r.originalId : r.id})" title="Undo Payment">
                                <i class="fas fa-undo"></i>
                            </button>
                        ` : ''}
                        ${isProv && r.status !== 'closed' && getProvisionalHeld(r) > 0 && !r.isParentGroupHeader ? `
                            <button class="btn-icon collect-btn" onclick="event.stopPropagation(); resolveProvisional(${r.isCombinedComponent ? r.originalId : r.id})" title="Resolve">
                                <i class="fas fa-sliders-h"></i>
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

    const clearAnalyticsFiltersHeaderBtn = document.getElementById('clear-analytics-filters-btn');
    if (clearAnalyticsFiltersHeaderBtn) {
        const filterActive = filterType !== 'all' || filterYear || filterMonth || filterPerson || filterCategory;
        clearAnalyticsFiltersHeaderBtn.style.display = filterActive ? '' : 'none';
    }

    // Update Date Display in Header/User Info
    const monthDisplay = document.getElementById('current-month-display');
    if (monthDisplay) {
        let displayLabel = "All History";
        if (filterYear && filterMonth) {
            const date = new Date(parseInt(filterYear), parseInt(filterMonth) - 1);
            displayLabel = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        } else if (filterYear) {
            displayLabel = filterYear;
        } else if (filterMonth) {
            const date = new Date(2000, parseInt(filterMonth) - 1);
            displayLabel = date.toLocaleString('default', { month: 'long' });
        }
        monthDisplay.textContent = displayLabel;
    }

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
            (filterType === 'savings' ? isSavings :
             filterType === 'income' ? r.type === 'income' : // Include savings income
             (r.type === filterType && !isSavings));
        const yearMatch = !filterYear || recordDate.getFullYear().toString() === filterYear;
        const monthMatch = filterMonth === '' || (recordDate.getMonth() + 1).toString() === filterMonth;
        // Match person on either the record's person or the savings beneficiary
        const personMatch = !filterPerson || r.person === filterPerson || r.savingsBeneficiary === filterPerson;

        let categoryMatch = !filterCategory;
        if (filterCategory) {
            if (filterCategory === 'all-income') {
                categoryMatch = r.type === 'income'; // Include savings income
            } else if (filterCategory === 'all-spending') {
                categoryMatch = (r.type === 'spending' || r.type === 'account_receivable' || r.type === 'account_payable' || r.type === 'provisional') && !isSavings;
            } else {
                categoryMatch = r.category === filterCategory;
            }
        }

        return typeMatch && yearMatch && monthMatch && personMatch && categoryMatch;
    });

    // Group records by month
    const monthlyStats = {};
    filteredRecords.forEach(r => {
        // Skip projected/expected income - they don't affect actual totals
        if (r.isProjected) return;

        const date = new Date(r.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { income: 0, spending: 0, savings: 0, arPending: 0, arCollected: 0, categories: {} };
        }

        const amount = parseFloat(r.amount) || 0;

        if (r.type === 'income' && !incomeExcludedFromTotals(r)) {
            monthlyStats[monthKey].income += amount;
        } else if (r.type === 'spending') {
            monthlyStats[monthKey].spending += parseFloat(r.amount);
            monthlyStats[monthKey].categories[r.category] = (monthlyStats[monthKey].categories[r.category] || 0) + parseFloat(r.amount);
        } else if (r.type === 'provisional') {
            const held = getProvisionalHeld(r);
            monthlyStats[monthKey].spending += held;
            monthlyStats[monthKey].categories[r.category] = (monthlyStats[monthKey].categories[r.category] || 0) + held;
        }
        
        // Count actual savings transfers (check both isSavingsTransfer flag and category/type)
        if (r.isSavingsTransfer || r.category === 'Savings Transfer' || r.type === 'savings_transfer') {
            monthlyStats[monthKey].savings += amount;
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
        const savings = stats.savings || 0; // Use actual savings transfers

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

    // Initialize category comparison chart
    initializeCategoryComparison(expandedRecords, filteredRecords);

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

    // Calculate totals for filtered context
    let contextIncome = 0;
    let contextSpending = 0;
    const categoryTotals = {};
    const personTotals = {};

    filteredRecords.forEach(r => {
        // Skip projected/expected income - they don't affect actual totals
        if (r.isProjected) return;

        const amount = parseFloat(r.amount) || 0;

        // General totals for whatever is in filteredRecords (include savings income)
        if (r.type === 'income' && !incomeExcludedFromTotals(r)) {
            contextIncome += amount;
        } else if (r.type === 'spending') {
            contextSpending += amount;
        } else if (r.type === 'provisional') {
            contextSpending += getProvisionalHeld(r);
        }


        // Grouping records (for finding "Tops")
        if (r.category) {
            if (!categoryTotals[r.category]) categoryTotals[r.category] = { income: 0, spending: 0 };
            if (r.type === 'income' && !incomeExcludedFromTotals(r)) {
                categoryTotals[r.category].income += amount;
            } else if (r.type === 'spending') {
                categoryTotals[r.category].spending += amount;
            } else if (r.type === 'provisional') {
                categoryTotals[r.category].spending += getProvisionalHeld(r);
            }
        }

        if (r.person) {
            if (!personTotals[r.person]) personTotals[r.person] = { income: 0, spending: 0 };
            if (r.type === 'income' && !incomeExcludedFromTotals(r)) {
                personTotals[r.person].income += amount;
            } else if (r.type === 'spending') {
                personTotals[r.person].spending += amount;
            } else if (r.type === 'provisional') {
                personTotals[r.person].spending += getProvisionalHeld(r);
            }

        }
    });

    // Build KPI HTML
    let kpiHTML = '';

    // Primary Summary KPI
    const totalBalance = contextIncome - contextSpending;
    const summaryLabel = filterCategory ? (filterCategory === 'all-income' ? 'Total Income' : (filterCategory === 'all-spending' ? 'Total Spending' : filterCategory)) : 'Filtered Total';
    
    kpiHTML += `
        <div class="kpi-card ${totalBalance >= 0 ? 'income' : 'spending'}">
            <div class="kpi-icon"><i class="fas ${filterPerson ? 'fa-user' : 'fa-chart-line'}"></i></div>
            <div class="kpi-details">
                <h3>${filterPerson ? filterPerson : summaryLabel}</h3>
                <p>${totalBalance >= 0 ? '+' : ''}$${formatCurrency(Math.abs(totalBalance))}</p>
                <small style="color: var(--text-muted); font-size: 0.75rem;">
                    ${contextIncome > 0 ? `Income: $${formatCurrency(contextIncome)}` : ''}
                    ${contextSpending > 0 ? `${contextIncome > 0 ? ' • ' : ''}Spending: $${formatCurrency(contextSpending)}` : ''}
                </small>
            </div>
        </div>
    `;

    // Top Category (if not filtering for a single category)
    const isSingleCategory = filterCategory && filterCategory !== 'all-income' && filterCategory !== 'all-spending';
    if (!isSingleCategory) {
        let topCat = { name: 'N/A', amount: 0 };
        for (const [cat, totals] of Object.entries(categoryTotals)) {
            const val = Math.max(totals.income, totals.spending);
            if (val > topCat.amount) {
                topCat = { name: cat, amount: val };
            }
        }
        if (topCat.amount > 0) {
            kpiHTML += `
                <div class="kpi-card spending">
                    <div class="kpi-icon"><i class="fas fa-tag"></i></div>
                    <div class="kpi-details">
                        <h3>Top Category</h3>
                        <p>$${formatCurrency(topCat.amount)}</p>
                        <small style="color: var(--text-muted); font-size: 0.75rem;">${topCat.name}</small>
                    </div>
                </div>
            `;
        }
    }

    // Top Person (if not filtering for a single person)
    if (!filterPerson) {
        let topPers = { name: 'N/A', amount: 0 };
        for (const [person, totals] of Object.entries(personTotals)) {
            const val = totals.spending || totals.income;
            if (val > topPers.amount) {
                topPers = { name: person, amount: val };
            }
        }
        if (topPers.amount > 0) {
            kpiHTML += `
                <div class="kpi-card spending">
                    <div class="kpi-icon"><i class="fas fa-user-tag"></i></div>
                    <div class="kpi-details">
                        <h3>Top Contributor</h3>
                        <p>$${formatCurrency(topPers.amount)}</p>
                        <small style="color: var(--text-muted); font-size: 0.75rem;">${topPers.name}</small>
                    </div>
                </div>
            `;
        }
    }

    kpiContainer.innerHTML = kpiHTML || '<p style="text-align:center; color: var(--text-muted);">No data available for selected filters</p>';
}

// Initialize category comparison chart
function initializeCategoryComparison(expandedRecords, filteredRecords) {
    const categorySelect = document.getElementById('category-comparison-select');
    if (!categorySelect) return;

    // Get all unique spending categories from filtered records
    const spendingCategories = new Set();
    filteredRecords.forEach(r => {
        if ((r.type === 'spending' || r.type === 'provisional' || r.type === 'account_receivable' || r.type === 'account_payable') && r.category) {
            spendingCategories.add(r.category);
        }
    });

    // Populate dropdown
    const sortedCategories = Array.from(spendingCategories).sort();
    categorySelect.innerHTML = '<option value="">Select Category...</option>';
    sortedCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });

    // Handle category selection
    categorySelect.addEventListener('change', () => {
        if (categorySelect.value) {
            renderCategoryComparisonChart(categorySelect.value, filteredRecords);
        } else {
            document.getElementById('category-comparison-container').style.display = 'none';
            document.getElementById('category-comparison-empty').style.display = 'block';
        }
    });

    // Show empty state initially
    document.getElementById('category-comparison-container').style.display = 'none';
    document.getElementById('category-comparison-empty').style.display = 'block';
}

// Render category comparison chart across months
function renderCategoryComparisonChart(selectedCategory, filteredRecords) {
    const container = document.getElementById('category-comparison-container');
    const emptyState = document.getElementById('category-comparison-empty');
    const statsContainer = document.getElementById('category-comparison-stats');

    if (!container || !statsContainer) return;

    // Group records by month for the selected category
    const monthlyData = {};
    let totalAmount = 0;
    let totalCount = 0;
    let maxAmount = 0;

    filteredRecords.forEach(r => {
        if (r.category === selectedCategory && (r.type === 'spending' || r.type === 'provisional' || r.type === 'account_receivable' || r.type === 'account_payable')) {
            const date = new Date(r.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            const amount = r.type === 'provisional' ? getProvisionalHeld(r) : (parseFloat(r.amount) || 0);

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { amount: 0, count: 0 };
            }
            monthlyData[monthKey].amount += amount;
            monthlyData[monthKey].count += 1;
            totalAmount += amount;
            totalCount += 1;
            maxAmount = Math.max(maxAmount, monthlyData[monthKey].amount);
        }
    });

    if (totalCount === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    // Sort months
    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, parseInt(month) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });
    const amounts = sortedMonths.map(m => monthlyData[m].amount);

    // Render chart
    const canvas = document.getElementById('categoryComparisonChart');
    const ctx = canvas.getContext('2d');
    
    if (categoryComparisonChart) {
        categoryComparisonChart.destroy();
    }

    categoryComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `${selectedCategory}`,
                data: amounts,
                backgroundColor: 'rgba(11, 40, 73, 0.7)',
                borderColor: '#0B2849',
                borderWidth: 2,
                borderRadius: 6,
                hoverBackgroundColor: 'rgba(11, 40, 73, 0.9)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: 'var(--text-main)' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + formatCurrency(value);
                        }
                    }
                }
            }
        }
    });

    // Render statistics
    const average = totalCount > 0 ? totalAmount / sortedMonths.length : 0;
    const highest = Math.max(...amounts);
    const lowest = Math.min(...amounts);

    const stats = [
        { label: 'Total', value: `$${formatCurrency(totalAmount)}` },
        { label: 'Average/Month', value: `$${formatCurrency(average)}` },
        { label: 'Highest', value: `$${formatCurrency(highest)}` },
        { label: 'Lowest', value: `$${formatCurrency(lowest)}` },
        { label: 'Transactions', value: `${totalCount}` },
        { label: 'Months Tracked', value: `${sortedMonths.length}` }
    ];

    statsContainer.innerHTML = stats.map((item, index) => `
        <div class="category-comparison-stat-item${index > 0 ? ' collapsed' : ''}">
            <div class="kpi-icon balance"><i class="fas fa-chart-line"></i></div>
            <div class="kpi-details">
                <h3>${item.label}</h3>
                <p>${item.value}</p>
            </div>
        </div>
    `).join('');

    const actionContainer = document.querySelector('.category-comparison-actions');
    const toggleBtn = document.getElementById('category-comparison-toggle');
    if (actionContainer && toggleBtn) {
        categoryComparisonExpanded = false;
        const showToggle = stats.length > 1;
        actionContainer.style.display = showToggle ? 'flex' : 'none';
        toggleBtn.style.display = showToggle ? 'inline-flex' : 'none';
        toggleBtn.textContent = 'Show More';
        toggleBtn.onclick = () => {
            categoryComparisonExpanded = !categoryComparisonExpanded;
            updateCategoryComparisonCollapsedState();
        };
        updateCategoryComparisonCollapsedState();
    }

    container.style.display = 'block';
    emptyState.style.display = 'none';
}

function updateCategoryComparisonCollapsedState() {
    const items = Array.from(document.querySelectorAll('#category-comparison-stats .category-comparison-stat-item'));
    items.forEach((item, index) => {
        if (index === 0) {
            item.classList.remove('collapsed');
            return;
        }
        item.classList.toggle('collapsed', !categoryComparisonExpanded);
    });

    const toggleBtn = document.getElementById('category-comparison-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = categoryComparisonExpanded ? 'Show Less' : 'Show More';
    }
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

            if (r.type === 'income' && !incomeExcludedFromTotals(r)) {
                incomeData[dayIdx] += amount;
            } else if (r.type === 'spending') {
                spendingData[dayIdx] += amount;
            } else if (r.type === 'provisional') {
                spendingData[dayIdx] += getProvisionalHeld(r);
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

    const filterType = document.getElementById('analytics-filter-type')?.value || 'all';
    const filterCategory = document.getElementById('analytics-filter-category')?.value;

    // Detect focus
    let dataFocus = 'spending';
    if (filterType === 'income' || filterCategory === 'all-income') {
        dataFocus = 'income';
    } else if (filterCategory) {
        const cat = categories.find(c => c.name === filterCategory);
        if (cat && cat.type === 'income') dataFocus = 'income';
    }

    const recordsToUse = filteredRecords || records;
    const dataByPerson = {};
    const relevantRecords = recordsToUse.filter(r => r.person && (r.type === dataFocus || (dataFocus === 'spending' && r.type === 'provisional')));

    relevantRecords.forEach(r => {
        const amt = r.type === 'provisional' ? getProvisionalHeld(r) : parseFloat(r.amount);
        if (amt > 0) {
            dataByPerson[r.person] = (dataByPerson[r.person] || 0) + amt;
        }
    });

    const labels = Object.keys(dataByPerson);
    const data = Object.values(dataByPerson);
    const chartCard = canvas.closest('.card');
    const chartTitle = chartCard?.querySelector('h3');

    const canvasWrapper = canvas.closest('.chart-container');

    if (labels.length === 0) {
        if (chartCard) {
            chartCard.style.display = 'block';
            if (canvasWrapper) {
                canvasWrapper.style.height = '100px';
                canvasWrapper.style.display = 'flex';
                canvasWrapper.style.alignItems = 'center';
                canvasWrapper.style.justifyContent = 'center';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.style.display = 'none';
                
                let msg = canvasWrapper.querySelector('.no-data-msg');
                if (!msg) {
                    msg = document.createElement('div');
                    msg.className = 'no-data-msg';
                    msg.style.color = 'var(--text-muted)';
                    msg.style.fontSize = '0.875rem';
                    canvasWrapper.appendChild(msg);
                }
                msg.textContent = `No ${dataFocus} data by person available`;
            }
        }
        return;
    }

    if (chartCard) {
        chartCard.style.display = 'block';
        if (canvasWrapper) {
            canvasWrapper.style.display = 'block';
            canvasWrapper.style.height = '300px';
            const msg = canvasWrapper.querySelector('.no-data-msg');
            if (msg) msg.remove();
            canvas.style.display = 'block';
        }
    }
    if (chartTitle) chartTitle.textContent = dataFocus === 'income' ? 'Income by Person' : 'Spending by Person';

    personChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: dataFocus === 'income' ? 'Income' : 'Spending',
                data: data,
                backgroundColor: dataFocus === 'income' ? 
                    ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'] : 
                    ['#355872', '#7AAACE', '#9CD5FF', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
                x: { grid: { display: false } }
            }
        }
    });
}

// -- savings feature functions ------------------------------------------------

function openAccountModal(account = null) {
    // Populate the person dropdown
    const personSelect = document.getElementById('account-person');
    if (personSelect) {
        const currentValue = personSelect.value;
        personSelect.innerHTML = '<option value="">Select Owner (Optional)</option>' +
            people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        personSelect.value = currentValue;
    }

    if (!account) {
        accountForm.reset();
        accountForm.elements['account-id'].value = '';
        accountForm.elements['account-initial'].value = '';
        if (personSelect) personSelect.value = '';
        accountModal.querySelector('h2').textContent = 'New Savings Account';
    } else {
        accountForm.elements['account-id'].value = account.id;
        accountForm.elements['account-name'].value = account.name;
        accountForm.elements['account-initial'].value = '';
        if (personSelect) personSelect.value = account.person || '';
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
    const person = form.elements['account-person']?.value || '';

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
                acc.person = person;
                // Preserve displayOrder if it exists
                await updateRecord(STORE_SAVINGS_ACCOUNTS, acc);
            }
        } else {
            const newAcc = { 
                name, 
                person,
                displayOrder: savingsAccounts.length // Set initial order to end of list
            };
            const newId = await add(STORE_SAVINGS_ACCOUNTS, newAcc);
            newAcc.id = newId;
            savingsAccounts.push(newAcc);

            // if initial deposit provided, add transaction (allow 0)
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
        transactionForm.elements['tx-date'].value = formatDateLocal(new Date());
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
            tx.type = type;
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

    savingsAccounts.forEach((acc, index) => {
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

        const monthCashflow = monthDeposit - monthWithdraw;
        const cashflowPositive = monthCashflow >= 0;
        const totalIncome = totalDeposit;

        const card = document.createElement('div');
        card.className = 'savings-card card';
        card.setAttribute('data-id', acc.id);
        card.innerHTML = `
            <div class="account-actions-reorder">
                <button class="reorder-btn move-up" onclick="moveSavingsAccount(${acc.id}, 'up')" ${index === 0 ? 'disabled' : ''} title="Move Up">
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button class="reorder-btn move-down" onclick="moveSavingsAccount(${acc.id}, 'down')" ${index === savingsAccounts.length - 1 ? 'disabled' : ''} title="Move Down">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
            <div class="card-header">
                <h3>${acc.name}</h3>
            </div>
            <!-- New Mini Dashboard Layout -->
            <div class="account-mini-dashboard">
                <div class="dashboard-row top-row">
                    <div class="mini-stat deposits">
                        <div class="mini-stat-label">Deposits</div>
                        <div class="mini-stat-value positive">+$${formatCurrency(monthDeposit)}</div>
                    </div>
                    <div class="main-balance">
                        <div class="balance-label">Total Balance</div>
                        <div class="balance-value">$${formatCurrency(balance)}</div>
                    </div>
                    <div class="mini-stat withdrawn">
                        <div class="mini-stat-label">Withdrawn</div>
                        <div class="mini-stat-value negative">-$${formatCurrency(monthWithdraw)}</div>
                    </div>
                </div>
                <div class="dashboard-row bottom-row">
                    <div class="cashflow-stat">
                        <span class="cashflow-label">Cashflow:</span>
                        <span class="cashflow-value ${cashflowPositive ? 'positive' : 'negative'}">
                            ${cashflowPositive ? '+' : '-'}$${formatCurrency(Math.abs(monthCashflow))}
                            <i class="fas fa-arrow-${cashflowPositive ? 'down' : 'up'}"></i>
                        </span>
                    </div>
                    <div class="cashflow-stat">
                        <span class="cashflow-label">Income:</span>
                        <span class="cashflow-value positive">+$${formatCurrency(totalIncome)}</span>
                    </div>
                </div>
            </div>
            <!-- Action Buttons -->
            <div class="account-actions-top">
                <button class="btn btn-secondary deposit-btn" data-acc-id="${acc.id}" title="Deposit"><i class="fas fa-plus"></i></button>
                <button class="btn btn-secondary withdraw-btn" data-acc-id="${acc.id}" title="Withdraw"><i class="fas fa-minus"></i></button>
                <button class="btn btn-outline edit-acc-btn" data-acc-id="${acc.id}" title="Edit Account"><i class="fas fa-edit"></i></button>
                <button class="btn btn-outline delete-acc-btn" data-acc-id="${acc.id}" title="Delete Account"><i class="fas fa-trash"></i></button>
            </div>
            <!-- Card-based Transactions List -->
            <div class="savings-transactions-list">
                ${paged.length === 0 ? `
                    <div class="empty-state" style="padding: 1rem;">
                        <i class="fas fa-receipt"></i>
                        <p>No transactions yet</p>
                        <span>Add a deposit or withdrawal to get started</span>
                    </div>
                ` : paged.map(t => {
                    const dateObj = new Date(t.date);
                    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const isDeposit = t.type === 'deposit';
                    const icon = isDeposit ? 'fa-arrow-down' : 'fa-arrow-up';
                    const typeClass = isDeposit ? 'income' : 'spending';
                    const amountClass = isDeposit ? 'income' : 'spending';
                    const amountPrefix = isDeposit ? '+' : '-';
                    const notes = t.notes || '-';
                    // Extract category from notes if available
                    const categoryMatch = notes.match(/^(Income|Spending):\s*([^-]+)/);
                    const category = categoryMatch ? categoryMatch[2].trim() : (isDeposit ? 'Deposit' : 'Withdrawal');
                    const itemName = categoryMatch && notes.includes('-') ? notes.split('-')[1].trim() : notes;
                    
                    return `
                        <div class="transaction-card ${typeClass}" onclick="openSavingsTransactionDetails(${t.id}, ${acc.id})">
                            <div class="transaction-icon">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="transaction-info">
                                <div class="transaction-name"><span>${itemName}</span></div>
                                <div class="transaction-category">
                                    <span class="category-badge badge-${typeClass}">${category}</span>
                                </div>
                            </div>
                            <div class="transaction-amount">
                                <div class="amount ${amountClass}"><span class="${amountPrefix === '+' ? 'dollar-positive' : 'dollar-negative'}">${amountPrefix}$</span><span class="amount-num">${formatCurrency(t.amount)}</span></div>
                                <div class="date">${dateStr}</div>
                            </div>
                            <div class="transaction-actions">
                                <button class="btn-icon edit-btn" onclick="event.stopPropagation(); editSavingsTransaction(${acc.id}, ${t.id})" title="Edit">
                                    <i class="fas fa-pen"></i>
                                </button>
                                <button class="btn-icon delete-btn" onclick="event.stopPropagation(); deleteSavingsTransaction(${acc.id}, ${t.id})" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="pagination" style="margin-top:6px; text-align:right;">
                <button class="btn btn-sm btn-outline prev-page" ${page <= 0 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
                <button class="btn btn-sm btn-outline next-page" ${page >= totalPages - 1 || txs.length <= perPage ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
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
    });
}

async function moveSavingsAccount(id, direction) {
    const index = savingsAccounts.findIndex(acc => acc.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= savingsAccounts.length) return;

    // Swap in array
    const temp = savingsAccounts[index];
    savingsAccounts[index] = savingsAccounts[newIndex];
    savingsAccounts[newIndex] = temp;

    // Update displayOrder for all accounts based on new array order
    for (let i = 0; i < savingsAccounts.length; i++) {
        const acc = savingsAccounts[i];
        acc.displayOrder = i;
        await updateRecord(STORE_SAVINGS_ACCOUNTS, acc);
    }

    // Explicitly re-sort and render
    savingsAccounts.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    renderSavings();
    
    showToast(`Account moved ${direction}`, 'success');
}

// Helper function to edit savings transaction
function editSavingsTransaction(accId, txId) {
    const tx = savingsTransactions.find(t => t.id === txId);
    if (tx) openTransactionModal(accId, tx.type, tx);
}

// Helper function to delete savings transaction
async function deleteSavingsTransaction(accId, txId) {
    if (await showConfirm('Delete this transaction?')) {
        const tx = savingsTransactions.find(t => t.id === txId);
        if (tx && tx.linkedRecordId) {
            await remove(STORE_RECORDS, tx.linkedRecordId);
        }
        await remove(STORE_SAVINGS_TRANSACTIONS, txId);
        await refreshData();
    }
}

// Open savings transaction details modal
async function openSavingsTransactionDetails(txId, accId) {
    const tx = savingsTransactions.find(t => t.id === txId);
    const acc = savingsAccounts.find(a => a.id === accId);
    if (!tx || !acc) return;

    const modal = document.getElementById('savings-transaction-details-modal');
    const content = document.getElementById('savings-transaction-details-content');
    if (!modal || !content) return;

    const isDeposit = tx.type === 'deposit';
    const dateObj = new Date(tx.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

    // Parse notes to extract category and item
    const notes = tx.notes || '-';
    const categoryMatch = notes.match(/^(Income|Spending):\s*([^-]+)/);
    const category = categoryMatch ? categoryMatch[2].trim() : (isDeposit ? 'Deposit' : 'Withdrawal');
    const itemName = categoryMatch && notes.includes('-') ? notes.split('-')[1].trim() : notes;

    // Calculate balance before and after
    const allTxs = savingsTransactions
        .filter(t => t.accountId === accId)
        .sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id);
    const txIndex = allTxs.findIndex(t => t.id === txId);
    let balanceBefore = 0;
    for (let i = 0; i < txIndex; i++) {
        if (allTxs[i].type === 'deposit') {
            balanceBefore += allTxs[i].amount;
        } else {
            balanceBefore -= allTxs[i].amount;
        }
    }
    const amount = parseFloat(tx.amount) || 0;
    const balanceAfter = isDeposit ? balanceBefore + amount : balanceBefore - amount;

    content.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Date & Time Recorded</span>
            <span class="detail-value">${dateStr}${timeStr ? ' at ' + timeStr : ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Item & Category</span>
            <span class="detail-value" style="color: ${isDeposit ? '#10b981' : '#ef4444'};">${itemName}<br><small style="color: var(--text-muted);">${category}</small></span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value ${isDeposit ? 'income' : 'spending'}">${isDeposit ? '+' : '-'}$${formatCurrency(amount)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Transaction Type</span>
            <span class="detail-value" style="color: ${isDeposit ? '#10b981' : '#ef4444'};">${isDeposit ? 'Deposit' : 'Withdrawal'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Account</span>
            <span class="detail-value">${acc.name}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Notes</span>
            <span class="detail-value notes">${tx.notes || '-'}</span>
        </div>
        <div class="detail-row" style="background: #f8fafc; border-radius: 8px; padding: 1rem; margin-top: 0.5rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; width: 100%;">
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Opening Balance:</div>
                    <div style="font-weight: 600; color: var(--text-main);">$${formatCurrency(balanceBefore)}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Closing Balance:</div>
                    <div style="font-weight: 600; color: var(--text-main);">$${formatCurrency(balanceAfter)}</div>
                </div>
            </div>
        </div>
    `;

    // Store current IDs for edit/delete buttons
    modal.dataset.txId = txId;
    modal.dataset.accId = accId;

    modal.classList.add('active');
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
        recordDate.value = formatDateLocal(new Date());
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

    // Get savings account beneficiary (owner) if savings account is selected
    let savingsBeneficiary = '';
    if (savingsAccountId) {
        const account = savingsAccounts.find(acc => acc.id === parseInt(savingsAccountId));
        savingsBeneficiary = account?.person || '';
    }

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

        // If a savings account is selected, only record in savings (don't affect main wallet)
        if (savingsAccountId) {
            // Only record to savings account, not to main records
            for (const transaction of validTransactions) {
                const transactionType = transaction.type === 'income' ? 'deposit' : 'withdrawal';
                const savingsTransaction = {
                    accountId: parseInt(savingsAccountId),
                    type: transactionType,
                    amount: parseFloat(transaction.amount) * (parseInt(transaction.quantity) || 1),
                    date: date,
                    notes: `${transaction.type === 'income' ? 'Income' : 'Spending'}: ${transaction.category}${transaction.item ? ' - ' + transaction.item : ''}`,
                    linkedRecordId: 0 // No main record linked
                };
                await add(STORE_SAVINGS_TRANSACTIONS, savingsTransaction);
            }
        } else {
            // Create main record only if not a savings account transaction
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

            // Get original record to preserve timestamp when editing
            const existingRecordCombined = id ? records.find(r => r.id === parseInt(id)) : null;
            const timestampCombined = existingRecordCombined?.timestamp || Date.now();

            const data = {
                formatType: 'combined',
                type: netAmount >= 0 ? 'income' : 'spending', // Determine net type
                date: date,
                timestamp: timestampCombined, // Preserve original timestamp when editing
                item: combinedTransactionName || `Combined Transaction (${validTransactions.length} items)`,
                category: combinedTransactionCategory,
                person: validTransactions[0].person || '',
                amount: Math.abs(netAmount),
                quantity: validTransactions.length,
                notes: notes,
                savingsAccountId: savingsAccountId,
                savingsBeneficiary: savingsBeneficiary,
                combinedTransactions: validTransactions,
                combinedTransactionName: combinedTransactionName,
                isSavingsTransfer: false,
                savingsTransactionType: null
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

                // Handle individual savings accounts for each transaction
                await updateSavingsAccountForCombinedTransactionsIndividual(validTransactions, date, recordId, !!id);
            } catch (error) {
                console.error('Error saving combined transaction:', error);
                showToast('Error saving combined transaction: ' + error.message, 'error');
                return;
            }
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

        // If savings account is selected for income/spending, only record to savings (don't affect main wallet)
        if (savingsAccountId && (type === 'income' || type === 'spending')) {
            const transactionType = type === 'income' ? 'deposit' : 'withdrawal';
            const savingsTransaction = {
                accountId: parseInt(savingsAccountId),
                type: transactionType,
                amount: amount,
                date: date,
                notes: `${type === 'income' ? 'Income' : 'Spending'}: ${category}${item && item !== category ? ' - ' + item : ''}`,
                linkedRecordId: 0 // No main record linked
            };

            try {
                await add(STORE_SAVINGS_TRANSACTIONS, savingsTransaction);
            } catch (error) {
                console.error('Error saving savings transaction:', error);
                showToast('Error saving savings transaction: ' + error.message, 'error');
                return;
            }
        } else {
            // Create main record only if not a savings account transaction (or if special type like A/R, A/P, provisional)
            const finalCategory = savingsAccountId && !category ? 'Savings Transfer' : category;

            // Get original record to preserve timestamp when editing
            const existingRecord = id ? records.find(r => r.id === parseInt(id)) : null;
            const timestamp = existingRecord?.timestamp || Date.now();

            const data = {
                formatType: 'single',
                type: type,
                date: date,
                timestamp: timestamp, // Preserve original timestamp when editing
                item: item,
                category: finalCategory,
                person: document.getElementById('record-person')?.value || '',
                amount: amount,
                quantity: document.getElementById('record-quantity')?.value || '1',
                notes: notes,
                savingsAccountId: savingsAccountId,
                savingsBeneficiary: savingsBeneficiary,
                isSavingsTransfer: false,
                savingsTransactionType: null
            };

            if (type === 'account_payable') {
                if (existingRecord && existingRecord.type === 'account_payable') {
                    data.paid = !!existingRecord.paid;
                    data.paidAmount = parseFloat(existingRecord.paidAmount) || 0;
                    data.remainingAmount = Math.max(0, amount - data.paidAmount);
                    if (data.remainingAmount <= 0.0001) {
                        data.paid = true;
                        data.remainingAmount = 0;
                    }
                } else {
                    data.paid = false;
                    data.paidAmount = 0;
                    data.remainingAmount = amount;
                }
            }

            if (type === 'provisional') {
                if (existingRecord && existingRecord.type === 'provisional') {
                    data.resolutions = Array.isArray(existingRecord.resolutions) ? [...existingRecord.resolutions] : [];
                    const oldAmt = parseFloat(existingRecord.amount) || 0;
                    const delta = amount - oldAmt;
                    let held = parseFloat(existingRecord.heldAmount);
                    if (Number.isNaN(held)) {
                        refreshProvisionalDerivedFields(existingRecord);
                        held = parseFloat(existingRecord.heldAmount) || 0;
                    }
                    data.heldAmount = Math.max(0, held + delta);
                    data.amount = amount;
                    refreshProvisionalDerivedFields(data);
                } else {
                    data.resolutions = [];
                    data.heldAmount = amount;
                    data.status = 'open';
                    refreshProvisionalDerivedFields(data);
                }
            }

            try {
                let recordId;
                if (id) {
                    recordId = parseInt(id);
                    data.id = recordId;
                    await updateRecord(STORE_RECORDS, data);
                } else {
                    recordId = await add(STORE_RECORDS, data);
                }
            } catch (error) {
                console.error('Error saving single transaction:', error);
                showToast('Error saving transaction: ' + error.message, 'error');
                return;
            }
        }
    }

    closeModal();
    await refreshData();
}

async function updateSavingsAccountForSingleTransaction(record, accountId, linkedRecordId, isEdit = false) {
    const account = savingsAccounts.find(acc => acc.id === parseInt(accountId));
    if (!account) return;

    // If editing, remove existing linked savings transactions to avoid duplicates
    if (isEdit) {
        const existingTransactions = savingsTransactions.filter(t => t.linkedRecordId === parseInt(linkedRecordId));
        for (const tx of existingTransactions) {
            await remove(STORE_SAVINGS_TRANSACTIONS, tx.id);
        }
    }

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

async function updateSavingsAccountForCombinedTransactions(transactions, date, accountId, linkedRecordId, isEdit = false) {
    // If editing, remove existing linked savings transactions to avoid duplicates
    if (isEdit) {
        const existingTransactions = savingsTransactions.filter(t => t.linkedRecordId === parseInt(linkedRecordId));
        for (const tx of existingTransactions) {
            await remove(STORE_SAVINGS_TRANSACTIONS, tx.id);
        }
    }

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

async function updateSavingsAccountForCombinedTransactionsIndividual(transactions, date, linkedRecordId, isEdit = false) {
    // If editing, remove existing linked savings transactions to avoid duplicates
    if (isEdit) {
        const existingTransactions = savingsTransactions.filter(t => t.linkedRecordId === parseInt(linkedRecordId));
        for (const tx of existingTransactions) {
            await remove(STORE_SAVINGS_TRANSACTIONS, tx.id);
        }
    }

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
        const rec = records.find(r => r.id === parseInt(id, 10));
        
        // Handle recurring income deletion: don't show it in upcoming again
        if (rec && rec.fromRecurringTemplate) {
            const template = recurringIncomeTemplates.find(t => t.id === parseInt(rec.fromRecurringTemplate));
            if (template) {
                const date = new Date(rec.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!template.ignoredOccurrences) template.ignoredOccurrences = [];
                if (!template.ignoredOccurrences.includes(monthKey)) {
                    template.ignoredOccurrences.push(monthKey);
                    await updateRecord(STORE_RECURRING_INCOME, template);
                }
            }
        }

        // Restore remaining held funds to wallet balance (not counted as income)
        if (rec && rec.type === 'provisional') {
            refreshProvisionalDerivedFields(rec);
            const held = getProvisionalHeld(rec);
            if (held > 0) {
                await add(STORE_RECORDS, {
                    formatType: 'single',
                    type: 'income',
                    date: formatDateLocal(new Date()),
                    timestamp: Date.now(),
                    item: 'Held funds restored (deleted provisional)',
                    category: 'Held Funds Restore',
                    person: rec.person || '',
                    amount: held,
                    quantity: '1',
                    notes: `Automatic balance restoration. Deleted provisional record #${rec.id}.`,
                    savingsAccountId: '',
                    excludeFromIncomeTotals: true,
                    isSavingsTransfer: false
                });
            }
        }

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
async function openDetailsModal(record) {
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
    const balanceBefore = await calculateBalanceAtTransaction(record.date, record.id);
    const recordAmount = parseFloat(record.amount) || 0;
    let balanceAfter = balanceBefore;
    if (record.type === 'income') {
        balanceAfter = balanceBefore + recordAmount;
    } else if (record.type === 'spending') {
        balanceAfter = balanceBefore - recordAmount;
    } else if (record.type === 'provisional') {
        balanceAfter = balanceBefore - recordAmount;
    } else if (record.type === 'account_receivable' && !record.collected) {
        balanceAfter = balanceBefore - getAROutstandingAmount(record);
    } else if (record.type === 'account_payable') {
        balanceAfter = balanceBefore;
    } else {
        balanceAfter = record.type === 'income' ? balanceBefore + recordAmount : balanceBefore - recordAmount;
    }

    const typeDisplayName = record.type === 'income' ? 'Income'
        : record.type === 'spending' ? 'Spending'
            : record.type === 'account_receivable' ? 'AR'
                : record.type === 'account_payable' ? 'Account Payable'
                    : record.type === 'provisional' ? 'Provisional (Held Funds)'
                        : record.type;

    const itemLabel = record.type === 'income' ? 'Source (Where money came from)' : 'Item (What was purchased)';
    const itemValue = record.type === 'income' ? record.category : (record.item || record.category);

    const timeRecorded = record.timestamp ? new Date(record.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    const itemName = (record.item || '').trim().toLowerCase();
    const categoryName = (record.category || '').trim().toLowerCase();
    const isSameName = itemName === categoryName;

    let detailsHTML = `
        <div class="detail-row">
            <span class="detail-label">Date & Time Recorded</span>
            <span class="detail-value">${record.date}${timeRecorded ? ' at ' + timeRecorded : ''}</span>
        </div>
        ${record.type === 'income' || !isSameName ? `
        <div class="detail-row">
            <span class="detail-label">${record.type === 'income' ? 'Source & Category' : 'Item & Category'}</span>
            <span class="detail-value">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="color: ${record.type === 'income' ? '#059669' : '#dc2626'}; font-weight: 500;">
                        ${record.type === 'income' ? record.category : (record.item || record.category)}
                    </div>
                    ${!isSameName ? `
                    <div style="color: #6b7280; font-size: 0.85rem;">
                        ${record.category}
                    </div>
                    ` : ''}
                </div>
            </span>
        </div>
        ` : `
        <div class="detail-row">
            <span class="detail-label">Item</span>
            <span class="detail-value" style="color: #dc2626; font-weight: 500;">${record.item || record.category}</span>
        </div>
        `}
        <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value ${record.type}">${record.type === 'income' ? '+' : (record.type === 'account_receivable' || record.type === 'account_payable' ? '' : '-')}$${formatCurrency(parseFloat(record.amount))}</span>
        </div>
        ${record.type === 'provisional' ? `
        <div class="detail-row">
            <span class="detail-label">Held (unresolved)</span>
            <span class="detail-value">$${formatCurrency(getProvisionalHeld(record))}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value">${record.status === 'closed' ? 'Closed' : record.status === 'partially_resolved' ? 'Partial' : 'Open'}</span>
        </div>
        ` : ''}
        ${record.type === 'account_payable' ? `
        <div class="detail-row">
            <span class="detail-label">Paid / Remaining</span>
            <span class="detail-value">$${formatCurrency(parseFloat(record.paidAmount) || 0)} / $${formatCurrency(getAPOutstandingAmount(record))}</span>
        </div>
        ` : ''}
        <div class="detail-row">
            <span class="detail-label">Transaction Type</span>
            <span class="detail-value ${record.type}">${typeDisplayName}</span>
        </div>
        ${record.person ? `
        <div class="detail-row">
            <span class="detail-label">Person</span>
            <span class="detail-value">${record.person}</span>
        </div>
        ` : ''}
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
        ${record.savingsAccountId ? `
        <div class="detail-row">
            <span class="detail-label">Savings Account</span>
            <span class="detail-value">${savingsAccounts.find(acc => acc.id === parseInt(record.savingsAccountId))?.name || 'Unknown'}</span>
        </div>
        ` : ''}
        ${record.quantity ? `
        <div class="detail-row">
            <span class="detail-label">Quantity</span>
            <span class="detail-value">${record.quantity}</span>
        </div>
        ` : ''}
        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Amount Details & Impact</div>
        <div class="detail-row" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 1rem; border-radius: var(--radius-sm); margin: 0.5rem 0;">
            <div style="font-size: 0.875rem; line-height: 1.6;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <div><strong>Opening Balance:</strong></div>
                    <div style="text-align: right;">$${formatCurrency(balanceBefore)}</div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.5rem; background: ${record.savingsAccountId ? '#fef2f2' : 'white'}; border-radius: 4px; ${record.savingsAccountId ? 'border: 1px solid #ef4444;' : ''}">
                    ${record.savingsAccountId ? '<div style="grid-column: 1/-1; font-size: 0.65rem; color: #b91c1c; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Savings Transaction</div>' : ''}
                    <div><strong>Transaction:</strong></div>
                    <div style="text-align: right; font-weight: 600; color: ${record.type === 'income' ? '#059669' : '#dc2626'};">
                        ${record.type === 'income' ? '+' : '-'}$${formatCurrency(parseFloat(record.amount))}
                    </div>
                    ${isCombined && record.combinedTransactions ? `
                    <div style="grid-column: 1 / -1; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e2e8f0;">
                        <div style="font-weight: 600; margin-bottom: 0.5rem; color: #6b7280; font-size: 0.85rem;">Breakdown:</div>
                        ${[...record.combinedTransactions]
                            // Sort savings transactions to the top
                            .sort((a, b) => {
                                const aSavings = !!(a.savingsAccountId || record.savingsAccountId);
                                const bSavings = !!(b.savingsAccountId || record.savingsAccountId);
                                if (aSavings && !bSavings) return -1;
                                if (!aSavings && bSavings) return 1;
                                return 0;
                            })
                            .map((transaction, index) => {
                                const amount = parseFloat(transaction.amount) || 0;
                                const quantity = parseInt(transaction.quantity) || 1;
                                const totalAmount = amount * quantity;
                                const isSavingsComponent = !!(transaction.savingsAccountId || record.savingsAccountId);
                                
                                return `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem; font-size: 0.8rem; margin-bottom: 0.25rem; ${isSavingsComponent ? 'border: 1px solid #ef4444; border-radius: 4px; padding: 4px; background: #fef2f2; position: relative;' : ''}">
                                ${isSavingsComponent ? '<div style="grid-column: 1/-1; font-size: 0.65rem; color: #b91c1c; font-weight: 600; text-transform: uppercase; margin-bottom: 2px;">Savings Allocation</div>' : ''}
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
        ${record.notes ? `
        <div class="detail-row">
            <span class="detail-label">Notes</span>
            <span class="detail-value notes">${record.notes.replace(/\[Return \$[\d.]+(\.\d+)?\]( .*)?/g, '').replace(/\[Held spend \$[\d.]+(\.\d+)? → .*?\]/g, '').split('\n').filter(line => line.trim()).join('\n').trim()}</span>
        </div>
        ` : ''}

        ${record.type === 'provisional' && record.resolutions && record.resolutions.length > 0 ? `
        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Resolution History</div>
        <div class="resolution-history" style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: var(--radius-sm); overflow: hidden;">
            ${record.resolutions.map((res, idx) => `
                <div class="resolution-item" style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; ${res.undone ? 'opacity: 0.5; background: #f8fafc;' : ''}">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <span class="badge-${res.action === 'return' ? 'income' : 'spending'}" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: 700;">
                                ${res.action === 'return' ? 'Return' : 'Spend'}
                            </span>
                            <span style="font-weight: 600; color: var(--primary-color); font-size: 0.9rem;">$${formatCurrency(res.amount)}</span>
                            ${res.undone ? '<span style="font-size: 0.7rem; font-style: italic; color: #ef4444;">(Undone)</span>' : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: #64748b;">
                            ${res.date} ${res.category ? `• ${res.category}` : ''}
                        </div>
                        ${res.notes ? `<div style="font-size: 0.8rem; margin-top: 0.25rem; font-style: italic; color: #475569;">"${res.notes}"</div>` : ''}
                    </div>
                    ${!res.undone ? `
                        <button class="btn-icon undo-btn" onclick="event.stopPropagation(); showUndoProvisionalResolutionDialog(${record.id})" title="Undo this resolution" style="background: #fbbf24; color: #92400e; border-radius: 6px; width: 32px; height: 32px;">
                            <i class="fas fa-undo"></i>
                        </button>
                    ` : ''}
                </div>
            `).join('')}
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

    const editCategoryColorInput = document.getElementById('edit-category-color');
    if (editCategoryColorInput) {
        editCategoryColorInput.value = category.color || '#355872';
    }

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
    const color = document.getElementById('edit-category-color')?.value || '#355872';

    if (!name) {
        showToast('Please enter a category name', 'warning');
        return;
    }

    try {
        // Get the old category before updating
        const oldCategory = categories.find(c => c.id === id);

        // Update the category
        await updateRecord(STORE_CATEGORIES, { id, name, type, color });

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

    const editCategoryColorInput = document.getElementById('edit-category-color');
    if (editCategoryColorInput) {
        editCategoryColorInput.value = person.color || '#355872';
    }

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
    const color = document.getElementById('edit-category-color')?.value || '#355872';

    if (!name) {
        showToast('Please enter a person name', 'warning');
        return;
    }

    try {
        // Get the old person before updating
        const oldPerson = people.find(p => p.id === id);

        // Update the person
        await updateRecord(STORE_PEOPLE, { id, name, color });

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

    const collapsedLimit = window.innerWidth > 768 ? 3 : 2;
    const { categoryUsage, personUsage } = getUsageMaps();

    if (categories.length === 0) {
        categoryList.innerHTML = '<p style="grid-column: 1 / -1; text-align:center; padding: 2rem; color: var(--text-muted); width: 100%;">No categories defined</p>';
    } else {
        // Sort categories by usage frequency (descending), then alphabetically
        const sortedCategories = [...categories].sort((a, b) => {
            const usageA = categoryUsage[a.name] || 0;
            const usageB = categoryUsage[b.name] || 0;
            if (usageB !== usageA) {
                return usageB - usageA;
            }
            return compareStringsAlphabetically(a.name, b.name);
        });

        const visibleLimit = categoriesExpanded ? sortedCategories.length : collapsedLimit;
        const visibleCategories = sortedCategories.slice(0, visibleLimit);
        visibleCategories.forEach(cat => {
            const div = document.createElement('div');
            const catColor = cat.color || '#355872';
            const isIncome = cat.type === 'income';
            
            div.className = 'category-item colored';
            
            if (isIncome) {
                // Background color remains the selected category color (lighter tint)
                div.style.backgroundColor = getLighterColor(catColor, 0.18);
                // ONLY the border color is distinct green (success color)
                div.style.borderColor = '#10b981';
                div.style.borderWidth = '2px';
                div.style.borderStyle = 'solid';
                div.style.boxShadow = '0 4px 10px rgba(16, 185, 129, 0.06)';
            } else {
                div.style.backgroundColor = getLighterColor(catColor, 0.18);
                div.style.borderColor = getLighterColor(catColor, 0.35);
                div.style.borderWidth = '1px';
                div.style.borderStyle = 'solid';
                div.style.boxShadow = 'none';
            }

            const badgeBg = isIncome ? 'rgba(16, 185, 129, 0.12)' : getLighterColor(catColor, 0.25);
            const badgeColor = isIncome ? '#10b981' : catColor;
            const badgeBorder = isIncome ? '1px solid rgba(16, 185, 129, 0.3)' : `1px solid ${getLighterColor(catColor, 0.4)}`;
            const titleColor = catColor; // Selected category color for title

            const btnBg = 'rgba(0, 0, 0, 0.05)';

            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0; flex: 1;">
                    <div style="min-width: 0; flex: 1;">
                        <strong style="color: ${titleColor}; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.15rem; font-weight: 700;">${cat.name}</strong>
                        <span class="category-badge" style="background: ${badgeBg}; color: ${badgeColor}; border: ${badgeBorder}; padding: 0.15rem 0.5rem; font-size: 0.72rem; border-radius: var(--radius-sm); text-transform: capitalize; font-weight: 600;">${cat.type}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 0.4rem; flex-shrink: 0;">
                    <button class="btn-icon edit-btn" onclick="editCategory(${cat.id})" title="Edit Category" style="background: ${btnBg}; color: var(--text-main); border: none; border-radius: var(--radius-sm); width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.2s;">
                        <i class="fas fa-edit" style="font-size: 0.85rem;"></i>
                    </button>
                    <button class="btn-icon delete-btn" onclick="deleteCategory(${cat.id})" title="Delete Category" style="background: ${btnBg}; color: var(--text-main); border: none; border-radius: var(--radius-sm); width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.2s;">
                        <i class="fas fa-trash" style="font-size: 0.85rem;"></i>
                    </button>
                </div>
            `;
            categoryList.appendChild(div);
        });
    }

    // Update Show More button for categories
    if (showMoreCategoriesBtn) {
        if (categories.length > collapsedLimit) {
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
            // Sort people by usage frequency (descending), then alphabetically
            const sortedPeople = [...people].sort((a, b) => {
                const usageA = personUsage[a.name] || 0;
                const usageB = personUsage[b.name] || 0;
                if (usageB !== usageA) {
                    return usageB - usageA;
                }
                return compareStringsAlphabetically(a.name, b.name);
            });

            const visibleLimit = peopleExpanded ? sortedPeople.length : collapsedLimit;
            const visiblePeople = sortedPeople.slice(0, visibleLimit);
            visiblePeople.forEach(person => {
                const div = document.createElement('div');
                const personColor = person.color || '#355872';
                
                div.className = 'category-item colored';
                div.style.backgroundColor = getLighterColor(personColor, 0.18);
                div.style.borderColor = getLighterColor(personColor, 0.35);

                const btnBg = 'rgba(0, 0, 0, 0.05)';

                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0; flex: 1;">
                        <div style="min-width: 0; flex: 1;">
                            <strong style="color: ${personColor}; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700;">${person.name}</strong>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.4rem; flex-shrink: 0;">
                        <button class="btn-icon edit-btn" onclick="editPerson(${person.id})" title="Edit Person" style="background: ${btnBg}; color: var(--text-main); border: none; border-radius: var(--radius-sm); width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.2s;">
                            <i class="fas fa-edit" style="font-size: 0.85rem;"></i>
                        </button>
                        <button class="btn-icon delete-btn" onclick="deletePerson(${person.id})" title="Delete Person" style="background: ${btnBg}; color: var(--text-main); border: none; border-radius: var(--radius-sm); width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.2s;">
                            <i class="fas fa-trash" style="font-size: 0.85rem;"></i>
                        </button>
                    </div>
                `;
                personList.appendChild(div);
            });
        }

        // Update Show More button for people
        if (showMorePeopleBtn) {
            if (people.length > collapsedLimit) {
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
    const colorInput = document.getElementById('new-category-color');
    const name = nameInput.value.trim();
    const type = typeSelect.value;
    const color = colorInput ? colorInput.value : '#355872';

    if (name) {
        await add(STORE_CATEGORIES, { name, type, color });
        nameInput.value = '';
        if (colorInput) colorInput.value = '#355872';
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
    // For account_receivable, account_payable, and provisional, use spending categories
    const categoryType = (type === 'account_receivable' || type === 'account_payable' || type === 'provisional') ? 'spending' : type;
    const filtered = categories.filter(c => c.type === categoryType);
    
    // Sort by usage frequency
    const { categoryUsage } = getUsageMaps();
    filtered.sort((a, b) => {
        const usageA = categoryUsage[a.name] || 0;
        const usageB = categoryUsage[b.name] || 0;
        if (usageB !== usageA) {
            return usageB - usageA;
        }
        return compareStringsAlphabetically(a.name, b.name);
    });

    const currentValue = recordCategorySelect.value;
    recordCategorySelect.innerHTML = '<option value="">-- Select Category --</option>' +
        filtered.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    recordCategorySelect.value = currentValue;
}

function updatePersonDropdown() {
    if (!recordPersonSelect) return;
    
    // Sort by usage frequency
    const { personUsage } = getUsageMaps();
    const sortedPeople = [...people].sort((a, b) => {
        const usageA = personUsage[a.name] || 0;
        const usageB = personUsage[b.name] || 0;
        if (usageB !== usageA) {
            return usageB - usageA;
        }
        return compareStringsAlphabetically(a.name, b.name);
    });

    const selectedValue = recordPersonSelect.value;
    recordPersonSelect.innerHTML = '<option value="">Select Person (Optional)</option>' +
        sortedPeople.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    recordPersonSelect.value = selectedValue;
}

// Show More Toggle Functions
function toggleCategoriesVisibility() {
    categoriesExpanded = !categoriesExpanded;
    const collapsedLimit = window.innerWidth > 768 ? 3 : 2;
    categoriesVisible = categoriesExpanded ? categories.length : collapsedLimit;
    renderSettings();
}

function togglePeopleVisibility() {
    peopleExpanded = !peopleExpanded;
    const collapsedLimit = window.innerWidth > 768 ? 3 : 2;
    peopleVisible = peopleExpanded ? people.length : collapsedLimit;
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
    const colorInput = document.getElementById('new-person-color');
    const name = nameInput.value.trim();
    const color = colorInput ? colorInput.value : '#355872';

    if (name) {
        await add(STORE_PEOPLE, { name, color });
        nameInput.value = '';
        if (colorInput) colorInput.value = '#355872';
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
        budgetLimits: await getAll(STORE_BUDGET_LIMITS),
        recurringIncome: await getAll(STORE_RECURRING_INCOME),
        exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    a.download = `Floosy_${dateStr}_${timeStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    try {
        localStorage.setItem('floosyLastExportedAt', new Date().toISOString());
    } catch (error) {
        console.warn('Unable to save export timestamp', error);
    }
    updateExportStatusUI();
}

function getLastExportedAt() {
    try {
        const storedValue = localStorage.getItem('floosyLastExportedAt');
        return storedValue ? new Date(storedValue) : null;
    } catch (error) {
        return null;
    }
}

function updateExportStatusUI() {
    const label = document.getElementById('export-status');
    if (!label) return;

    const lastExportedAt = getLastExportedAt();
    if (!lastExportedAt || Number.isNaN(lastExportedAt.getTime())) {
        label.textContent = 'Never exported';
        label.className = 'export-status danger';
        return;
    }

    const now = new Date();
    const diffMs = now.getTime() - lastExportedAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
        label.textContent = '0d';
    } else if (diffDays === 1) {
        label.textContent = '1d';
    } else {
        label.textContent = `${diffDays}d`;
    }

    if (diffDays <= 3) {
        label.className = 'export-status fresh';
    } else if (diffDays <= 7) {
        label.className = 'export-status warning';
    } else {
        label.className = 'export-status danger';
    }
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
                    await clearStore(STORE_RECURRING_INCOME);
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
                    // import budget limits
                    if (data.budgetLimits) {
                        await clearStore(STORE_BUDGET_LIMITS);
                        for (const l of data.budgetLimits) {
                            delete l.id;
                            await add(STORE_BUDGET_LIMITS, l);
                        }
                    }
                    // import recurring income
                    if (data.recurringIncome) {
                        await clearStore(STORE_RECURRING_INCOME);
                        for (const ri of data.recurringIncome) {
                            delete ri.id;
                            await add(STORE_RECURRING_INCOME, ri);
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

// Global variable to store current AR being collected
let currentARCollection = null;
let currentIncomeCollection = null;

// Initialize AR collection card event listeners

function showARCollectionCard(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    const rootId = getARRootId(record);
    const group = getARGroupRecords(rootId);

    // Calculate total amount (use original amount if available, otherwise use current amount)
    const totalAmount = group.reduce((sum, r) => {
        const amt = parseFloat(r.originalAmount || r.amount) || 0;
        return sum + amt;
    }, 0);

    // Calculate already collected from all records in the group
    const alreadyCollected = group.length > 0
        ? Math.max(...group.map(r => parseFloat(r.collectedAmount) || 0))
        : 0;
    const remainingAmount = Math.max(0, totalAmount - alreadyCollected);

    // Check if already fully collected (has collected flag AND no remaining amount)
    if (record.collected === true && remainingAmount <= 0) {
        showToast('This AR has already been fully collected', 'info');
        return;
    }

    currentARCollection = {
        recordId: id,
        rootId: rootId,
        group: group,
        totalAmount: totalAmount,
        alreadyCollected: alreadyCollected,
        remainingAmount: remainingAmount
    };

    // Update UI
    document.getElementById('ar-total-amount').textContent = formatCurrency(totalAmount);
    document.getElementById('ar-remaining-amount').textContent = formatCurrency(remainingAmount);
    document.getElementById('ar-collected-amount').value = '';
    document.getElementById('ar-collected-amount').max = remainingAmount.toFixed(2);
    document.getElementById('ar-collected-amount').placeholder = `Enter amount (max $${remainingAmount.toFixed(2)})`;

    updateARProgress();

    // Show card and overlay
    const card = document.getElementById('ar-collection-card');
    const overlay = document.getElementById('ar-collection-overlay');
    card?.classList.add('active');
    overlay?.classList.add('active');

    // Focus input
    setTimeout(() => {
        document.getElementById('ar-collected-amount')?.focus();
    }, 100);
}

function hideARCollectionCard() {
    const card = document.getElementById('ar-collection-card');
    const overlay = document.getElementById('ar-collection-overlay');
    card?.classList.remove('active');
    overlay?.classList.remove('active');
    currentARCollection = null;
    
    // Reset write-off fields
    const writeoffBtn = document.getElementById('ar-writeoff-btn');
    const writeoffAmountInput = document.getElementById('ar-writeoff-amount');
    const writeoffCategorySelect = document.getElementById('ar-writeoff-category');
    const writeoffAmountGroup = document.getElementById('ar-writeoff-amount-group');
    const writeoffCategoryGroup = document.getElementById('ar-writeoff-category-group');
    
    if (writeoffBtn) {
        writeoffBtn.classList.remove('btn-primary');
        writeoffBtn.classList.add('btn-outline');
    }
    if (writeoffAmountInput) writeoffAmountInput.value = '';
    if (writeoffCategorySelect) writeoffCategorySelect.value = '';
    if (writeoffAmountGroup) writeoffAmountGroup.style.display = 'none';
    if (writeoffCategoryGroup) writeoffCategoryGroup.style.display = 'none';
}

function updateARProgress() {
    if (!currentARCollection) return;

    const amountInput = document.getElementById('ar-collected-amount');
    const collected = parseFloat(amountInput.value) || 0;
    const total = currentARCollection.totalAmount;
    const alreadyCollected = currentARCollection.alreadyCollected;

    const newTotalCollected = alreadyCollected + collected;
    const percentage = total > 0 ? (newTotalCollected / total) * 100 : 0;

    document.getElementById('ar-progress-fill').style.width = `${Math.min(percentage, 100)}%`;
    document.getElementById('ar-progress-text').textContent = `${percentage.toFixed(0)}% collected ($${newTotalCollected.toFixed(2)} of $${total.toFixed(2)})`;

    // Update remaining display (before confirmation)
    const remaining = total - newTotalCollected;
    document.getElementById('ar-remaining-amount').textContent = formatCurrency(Math.max(0, remaining));
}

async function processPartialARCollection() {
    if (!currentARCollection) return;

    const amountInput = document.getElementById('ar-collected-amount');
    const collectedAmount = parseFloat(amountInput.value);

    if (!collectedAmount || collectedAmount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    if (collectedAmount > currentARCollection.remainingAmount) {
        showToast(`Cannot collect more than remaining amount ($${currentARCollection.remainingAmount.toFixed(2)})`, 'error');
        return;
    }

    // Check for write-off
    const writeoffBtn = document.getElementById('ar-writeoff-btn');
    const writeoffAmountInput = document.getElementById('ar-writeoff-amount');
    const writeoffCategorySelect = document.getElementById('ar-writeoff-category');
    
    let writeoffAmount = 0;
    let writeoffCategory = null;
    
    // Check if write-off is active (button is in primary state)
    const isWriteoffActive = writeoffBtn?.classList.contains('btn-primary');
    
    if (isWriteoffActive) {
        writeoffAmount = parseFloat(writeoffAmountInput?.value) || 0;
        writeoffCategory = writeoffCategorySelect?.value || null;
        
        if (!writeoffAmount || writeoffAmount <= 0) {
            showToast('Please enter a valid write-off amount', 'error');
            return;
        }
        
        if (!writeoffCategory) {
            showToast('Please select a category for the write-off', 'error');
            return;
        }
        
        const totalAfterCollectionAndWriteoff = collectedAmount + writeoffAmount;
        if (totalAfterCollectionAndWriteoff > currentARCollection.remainingAmount) {
            showToast(`Collected + Write-off cannot exceed remaining amount ($${currentARCollection.remainingAmount.toFixed(2)})`, 'error');
            return;
        }
    }

    const { recordId, rootId, group, totalAmount, alreadyCollected } = currentARCollection;
    const newTotalCollected = alreadyCollected + collectedAmount;
    const isFullyCollected = (newTotalCollected + writeoffAmount) >= totalAmount;
    const remainingAfterCollection = totalAmount - newTotalCollected - writeoffAmount;
    const collectedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    try {
        // Update the AR record(s)
        for (const r of group) {
            // Preserve original amount on first collection
            if (!r.originalAmount) {
                r.originalAmount = parseFloat(r.amount) || 0;
            }

            r.collectedAmount = newTotalCollected;
            r.writeoffAmount = (r.writeoffAmount || 0) + writeoffAmount;

            if (isFullyCollected) {
                r.collected = true;
                r.collectedDate = formatDateLocal(new Date());
            }

            // Add collection note
            const collectionNote = `[Collected $${collectedAmount.toFixed(2)} on ${collectedDate}]`;
            if (!r.notes || !r.notes.includes(collectionNote)) {
                r.notes = r.notes ? `${r.notes}\n${collectionNote}` : collectionNote;
            }
            
            // Add write-off note if applicable
            if (writeoffAmount > 0) {
                const writeoffNote = `[Written off $${writeoffAmount.toFixed(2)} on ${collectedDate} - Category: ${writeoffCategory}]`;
                if (!r.notes || !r.notes.includes(writeoffNote)) {
                    r.notes = r.notes ? `${r.notes}\n${writeoffNote}` : writeoffNote;
                }
            }

            await updateRecord(STORE_RECORDS, r);
        }
        
        // Create a write-off record that returns to balance without affecting income
        if (writeoffAmount > 0) {
            const writeoffRecord = {
                type: 'income',
                category: writeoffCategory,
                amount: writeoffAmount,
                date: formatDateLocal(new Date()),
                notes: `Write-off from AR - forgiven amount (not actual income)`,
                excludeFromIncomeTotals: true, // This ensures it doesn't affect income totals
                isWriteoff: true,
                relatedARId: rootId
            };
            await add(STORE_RECORDS, writeoffRecord);
        }

        await refreshData();


        if (isFullyCollected) {
            let message = `Collected $${collectedAmount.toFixed(2)}`;
            if (writeoffAmount > 0) {
                message += ` - Written off $${writeoffAmount.toFixed(2)} (${writeoffCategory})`;
            }
            message += ` - AR fully resolved!`;
            showToast(message, 'success');
        } else {
            let message = `Collected $${collectedAmount.toFixed(2)}`;
            if (writeoffAmount > 0) {
                message += ` - Written off $${writeoffAmount.toFixed(2)} (${writeoffCategory})`;
            }
            message += ` - $${remainingAfterCollection.toFixed(2)} remaining`;
            showToast(message, 'success');
        }

        hideARCollectionCard();
    } catch (error) {
        console.error('Error processing AR collection:', error);
        showToast('Error processing collection: ' + error.message, 'error');
    }
}

async function collectAR(id) {
    // Show the collection card instead of immediately collecting
    showARCollectionCard(id);
}

async function undoCollectAR(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    const rootId = getARRootId(record);
    const group = getARGroupRecords(rootId);

    try {
        for (const r of group) {
            r.collected = false;
            r.collectedDate = null;
            r.collectedAmount = 0;
            r.originalAmount = null;

            // Remove all collection notes from notes (handles both old and new formats)
            if (r.notes) {
                // Remove new format: [Collected $X.XX on date]
                r.notes = r.notes.replace(/\n?\[Collected \$[\d.]+ on [^\]]+\]/g, '').trim();
                // Remove old format: [Collected on date]
                r.notes = r.notes.replace(/\n?\[Collected on [^\]]+\]/g, '').trim();
            }

            await updateRecord(STORE_RECORDS, r);
        }

        await refreshData();
        showToast('AR marked as pending', 'success');
    } catch (error) {
        console.error('Error undoing AR collection:', error);
        showToast('Error marking as pending: ' + error.message, 'error');
    }
}

// Make AR functions globally available
window.collectAR = collectAR;
window.undoCollectAR = undoCollectAR;
// Records tab uses uncollectAR; keep it as an alias to undo collection.
window.uncollectAR = undoCollectAR;
// Partial collection functions
window.showARCollectionCard = showARCollectionCard;
window.hideARCollectionCard = hideARCollectionCard;
window.processPartialARCollection = processPartialARCollection;

// --- Accounts Payable (mirror of A/R) ---
function getAPRootId(record) {
    if (!record) return null;
    let current = record;
    const seen = new Set();
    while (current && current.type === 'account_payable' && current.carriedForwardFrom) {
        if (seen.has(current.id)) break;
        seen.add(current.id);
        const parent = records.find(r => r.id === current.carriedForwardFrom);
        if (!parent) return current.carriedForwardFrom;
        current = parent;
    }
    return current?.id ?? record.id;
}

function getAPGroupRecords(rootId) {
    if (rootId == null) return [];
    return records.filter(r => r.type === 'account_payable' && getAPRootId(r) === rootId);
}

let currentAPCollection = null;

function showAPCollectionCard(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    const rootId = getAPRootId(record);
    const group = getAPGroupRecords(rootId);

    const totalAmount = group.reduce((sum, r) => {
        const amt = parseFloat(r.originalAmount || r.amount) || 0;
        return sum + amt;
    }, 0);

    const alreadyPaid = group.length > 0
        ? Math.max(...group.map(r => parseFloat(r.paidAmount) || 0))
        : 0;
    const remainingAmount = Math.max(0, totalAmount - alreadyPaid);

    if (record.paid === true && remainingAmount <= 0) {
        showToast('This debt has already been fully paid', 'info');
        return;
    }

    currentAPCollection = {
        recordId: id,
        rootId,
        group,
        totalAmount,
        alreadyPaid,
        remainingAmount
    };

    document.getElementById('ap-total-amount').textContent = formatCurrency(totalAmount);
    document.getElementById('ap-remaining-amount').textContent = formatCurrency(remainingAmount);
    const amountInput = document.getElementById('ap-paid-amount');
    if (amountInput) {
        amountInput.value = '';
        amountInput.max = remainingAmount.toFixed(2);
        amountInput.placeholder = `Enter amount (max $${remainingAmount.toFixed(2)})`;
    }
    updateAPProgress();

    document.getElementById('ap-collection-card')?.classList.add('active');
    document.getElementById('ap-collection-overlay')?.classList.add('active');
    setTimeout(() => document.getElementById('ap-paid-amount')?.focus(), 100);
}

function hideAPCollectionCard() {
    document.getElementById('ap-collection-card')?.classList.remove('active');
    document.getElementById('ap-collection-overlay')?.classList.remove('active');
    currentAPCollection = null;
    
    // Reset write-off fields
    const writeoffBtn = document.getElementById('ap-writeoff-btn');
    const writeoffAmountInput = document.getElementById('ap-writeoff-amount');
    const writeoffAmountGroup = document.getElementById('ap-writeoff-amount-group');
    
    if (writeoffBtn) {
        writeoffBtn.classList.remove('btn-primary');
        writeoffBtn.classList.add('btn-outline');
    }
    if (writeoffAmountInput) writeoffAmountInput.value = '';
    if (writeoffAmountGroup) writeoffAmountGroup.style.display = 'none';
}

function updateAPProgress() {
    if (!currentAPCollection) return;
    const amountInput = document.getElementById('ap-paid-amount');
    const paid = parseFloat(amountInput?.value) || 0;
    const total = currentAPCollection.totalAmount;
    const alreadyPaid = currentAPCollection.alreadyPaid;
    const newTotalPaid = alreadyPaid + paid;
    const percentage = total > 0 ? (newTotalPaid / total) * 100 : 0;
    const fill = document.getElementById('ap-progress-fill');
    const txt = document.getElementById('ap-progress-text');
    if (fill) fill.style.width = `${Math.min(percentage, 100)}%`;
    if (txt) txt.textContent = `${percentage.toFixed(0)}% paid ($${newTotalPaid.toFixed(2)} of $${total.toFixed(2)})`;
    const remEl = document.getElementById('ap-remaining-amount');
    if (remEl) remEl.textContent = formatCurrency(Math.max(0, total - newTotalPaid));
}

async function processPartialAPPayment() {
    if (!currentAPCollection) return;
    const amountInput = document.getElementById('ap-paid-amount');
    const paidAmount = parseFloat(amountInput?.value);
    if (!paidAmount || paidAmount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    if (paidAmount > currentAPCollection.remainingAmount) {
        showToast(`Cannot pay more than remaining amount ($${currentAPCollection.remainingAmount.toFixed(2)})`, 'error');
        return;
    }

    // Check for write-off
    const writeoffAmountInput = document.getElementById('ap-writeoff-amount');
    
    let writeoffAmount = 0;
    
    // Check if write-off is active (button is in primary state)
    const apWriteoffBtn = document.getElementById('ap-writeoff-btn');
    const isWriteoffActive = apWriteoffBtn?.classList.contains('btn-primary');
    
    if (isWriteoffActive) {
        writeoffAmount = parseFloat(writeoffAmountInput?.value) || 0;
        
        if (!writeoffAmount || writeoffAmount <= 0) {
            showToast('Please enter a valid write-off amount', 'error');
            return;
        }
        
        const totalAfterPaymentAndWriteoff = paidAmount + writeoffAmount;
        if (totalAfterPaymentAndWriteoff > currentAPCollection.remainingAmount) {
            showToast(`Paid + Write-off cannot exceed remaining amount ($${currentAPCollection.remainingAmount.toFixed(2)})`, 'error');
            return;
        }
    }

    const { group, totalAmount, alreadyPaid } = currentAPCollection;
    const newTotalPaid = alreadyPaid + paidAmount;
    const isFullyPaid = (newTotalPaid + writeoffAmount) >= totalAmount;
    const remainingAfter = totalAmount - newTotalPaid - writeoffAmount;
    const paidDateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    try {
        for (const r of group) {
            if (!r.originalAmount) {
                r.originalAmount = parseFloat(r.amount) || 0;
            }
            r.paidAmount = newTotalPaid;
            r.writeoffAmount = (r.writeoffAmount || 0) + writeoffAmount;
            if (isFullyPaid) {
                r.paid = true;
                r.paidDate = formatDateLocal(new Date());
            }
            r.remainingAmount = Math.max(0, totalAmount - newTotalPaid - writeoffAmount);
            const payNote = `[Paid $${paidAmount.toFixed(2)} on ${paidDateStr}]`;
            if (!r.notes || !r.notes.includes(payNote)) {
                r.notes = r.notes ? `${r.notes}\n${payNote}` : payNote;
            }
            
            // Add write-off note if applicable
            if (writeoffAmount > 0) {
                const writeoffNote = `[Written off $${writeoffAmount.toFixed(2)} on ${paidDateStr}]`;
                if (!r.notes || !r.notes.includes(writeoffNote)) {
                    r.notes = r.notes ? `${r.notes}\n${writeoffNote}` : writeoffNote;
                }
            }
            
            await updateRecord(STORE_RECORDS, r);
        }
        
        // Create a write-off record for AP (this is a spending reduction, not income)
        // For AP, write-off means the debt is forgiven, so it's like getting a discount
        // We record it as a negative spending (reduction in liability) without affecting income
        if (writeoffAmount > 0) {
            const writeoffRecord = {
                type: 'spending',
                category: 'Write-off',
                amount: -writeoffAmount, // Negative spending to reduce the liability
                date: formatDateLocal(new Date()),
                notes: `Write-off from AP - debt forgiven (reduction in liability)`,
                excludeFromSpendingTotals: true, // This ensures it doesn't affect spending totals
                isWriteoff: true,
                relatedAPId: currentAPCollection.rootId
            };
            await add(STORE_RECORDS, writeoffRecord);
        }
        
        await refreshData();
        if (isFullyPaid) {
            let message = `Paid $${paidAmount.toFixed(2)}`;
            if (writeoffAmount > 0) {
                message += ` - Written off $${writeoffAmount.toFixed(2)}`;
            }
            message += ` — debt fully settled`;
            showToast(message, 'success');
        } else {
            let message = `Paid $${paidAmount.toFixed(2)}`;
            if (writeoffAmount > 0) {
                message += ` - Written off $${writeoffAmount.toFixed(2)}`;
            }
            message += ` — $${remainingAfter.toFixed(2)} remaining`;
            showToast(message, 'success');
        }
        hideAPCollectionCard();
    } catch (error) {
        console.error('Error processing AP payment:', error);
        showToast('Error processing payment: ' + error.message, 'error');
    }
}

function payDebtAP(id) {
    showAPCollectionCard(id);
}

async function undoPayAP(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const rootId = getAPRootId(record);
    const group = getAPGroupRecords(rootId);
    try {
        for (const r of group) {
            r.paid = false;
            r.paidDate = null;
            r.paidAmount = 0;
            r.remainingAmount = parseFloat(r.amount) || 0;
            r.originalAmount = null;
            if (r.notes) {
                r.notes = r.notes.replace(/\n?\[Paid \$[\d.]+ on [^\]]+\]/g, '').trim();
            }
            await updateRecord(STORE_RECORDS, r);
        }
        await refreshData();
        showToast('AP payment reset', 'success');
    } catch (error) {
        console.error('Error undoing AP payment:', error);
        showToast('Error undoing payment: ' + error.message, 'error');
    }
}

window.payDebtAP = payDebtAP;
window.undoPayAP = undoPayAP;
window.showAPCollectionCard = showAPCollectionCard;
window.hideAPCollectionCard = hideAPCollectionCard;
window.processPartialAPPayment = processPartialAPPayment;

// --- Provisional (held funds) ---
let currentProvisionalResolve = null;

function populateProvisionalSpendCategories() {
    const sel = document.getElementById('prov-spend-category');
    const mixSel = document.getElementById('prov-mix-category');
    if (!sel) return;
    const spendingCats = categories.filter(c => c.type === 'spending');
    const options = '<option value="">Select category</option>' +
        spendingCats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    sel.innerHTML = options;
    if (mixSel) mixSel.innerHTML = options;
}

function populateProvisionalSpendPeople() {
    const sel = document.getElementById('prov-spend-person');
    const mixSel = document.getElementById('prov-mix-person');
    if (!sel) return;
    const options = '<option value="">Select person</option>' +
        people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    sel.innerHTML = options;
    if (mixSel) mixSel.innerHTML = options;
}

function showProvisionalResolveCard(id) {
    const record = records.find(r => r.id === id);
    if (!record || record.type !== 'provisional') return;
    refreshProvisionalDerivedFields(record);
    const held = getProvisionalHeld(record);
    if (held <= 0) {
        showToast('Nothing left to resolve on this provisional record', 'info');
        return;
    }
    currentProvisionalResolve = {
        recordId: id,
        heldRemaining: held,
        originalAmount: parseFloat(record.amount) || 0
    };
    document.getElementById('prov-original-amount').textContent = formatCurrency(currentProvisionalResolve.originalAmount);
    document.getElementById('prov-held-remaining').textContent = formatCurrency(held);
    const ra = document.getElementById('prov-return-amount');
    const sa = document.getElementById('prov-spend-amount');
    const notes = document.getElementById('prov-resolve-notes');
    const sp = document.getElementById('prov-spend-person');
    const msp = document.getElementById('prov-mix-spend-amount');
    const mr = document.getElementById('prov-mix-return-amount');
    const mcat = document.getElementById('prov-mix-category');
    const mp = document.getElementById('prov-mix-person');
    if (ra) ra.value = '';
    if (sa) sa.value = '';
    if (notes) notes.value = '';
    if (sp) sp.value = '';
    if (msp) msp.value = '';
    if (mr) mr.value = '';
    if (mcat) mcat.value = '';
    if (mp) mp.value = '';
    ra.max = held.toFixed(2);
    sa.max = held.toFixed(2);
    if (msp) msp.max = held.toFixed(2);
    if (mr) mr.max = held.toFixed(2);
    populateProvisionalSpendCategories();
    populateProvisionalSpendPeople();
    document.getElementById('provisional-resolve-card')?.classList.add('active');
    document.getElementById('provisional-resolve-overlay')?.classList.add('active');
}

function hideProvisionalResolveCard() {
    document.getElementById('provisional-resolve-card')?.classList.remove('active');
    document.getElementById('provisional-resolve-overlay')?.classList.remove('active');
    currentProvisionalResolve = null;
}

function resolveProvisional(id) {
    showProvisionalResolveCard(id);
}

async function processProvisionalReturn() {
    if (!currentProvisionalResolve) return;
    const record = records.find(r => r.id === currentProvisionalResolve.recordId);
    if (!record) return;
    refreshProvisionalDerivedFields(record);
    const held = getProvisionalHeld(record);
    const inp = document.getElementById('prov-return-amount');
    const amt = parseFloat(inp?.value);
    if (!amt || amt <= 0) {
        showToast('Enter a valid return amount', 'error');
        return;
    }
    if (amt > held + 0.0001) {
        showToast(`Return cannot exceed held amount ($${held.toFixed(2)})`, 'error');
        return;
    }
    const notesExtra = (document.getElementById('prov-resolve-notes')?.value || '').trim();
    if (!record.resolutions) record.resolutions = [];
    record.resolutions.push({
        date: formatDateLocal(new Date()),
        action: 'return',
        amount: amt,
        notes: notesExtra,
        timestamp: Date.now()
    });
    refreshProvisionalDerivedFields(record);
    
    try {
        await updateRecord(STORE_RECORDS, record);
        await refreshData();
        showToast(`Returned $${amt.toFixed(2)} to balance`, 'success');
        hideProvisionalResolveCard();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function processProvisionalSpend() {
    if (!currentProvisionalResolve) return;
    const record = records.find(r => r.id === currentProvisionalResolve.recordId);
    if (!record) return;
    refreshProvisionalDerivedFields(record);
    const held = getProvisionalHeld(record);
    const cat = document.getElementById('prov-spend-category')?.value;
    const person = document.getElementById('prov-spend-person')?.value;
    const amt = parseFloat(document.getElementById('prov-spend-amount')?.value);
    if (!cat) {
        showToast('Select a spending category', 'error');
        return;
    }
    if (!amt || amt <= 0) {
        showToast('Enter a valid spend amount', 'error');
        return;
    }
    if (amt > held + 0.0001) {
        showToast(`Spend cannot exceed held amount ($${held.toFixed(2)})`, 'error');
        return;
    }
    const notesExtra = (document.getElementById('prov-resolve-notes')?.value || '').trim();
    
    try {
        // 1. Create a derived spending transaction
        const derivedSpending = {
            date: formatDateLocal(new Date()),
            type: 'spending',
            category: cat,
            person: person || '',
            amount: amt,
            item: `Spend from Provisional: ${record.item || record.category}`,
            notes: notesExtra || `Resolved from provisional record #${record.id}`,
            timestamp: Date.now(),
            provisionalRef: record.id
        };
        
        const newRecordId = await add(STORE_RECORDS, derivedSpending);
        
        // 2. Add to resolutions
        if (!record.resolutions) record.resolutions = [];
        record.resolutions.push({
            date: derivedSpending.date,
            action: 'spend',
            amount: amt,
            category: cat,
            person: person || '',
            notes: notesExtra,
            derivedRecordId: newRecordId,
            timestamp: derivedSpending.timestamp
        });
        
        refreshProvisionalDerivedFields(record);
        
        await updateRecord(STORE_RECORDS, record);
        await refreshData();
        showToast(`Recorded $${amt.toFixed(2)} spending in ${cat}`, 'success');
        hideProvisionalResolveCard();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function processProvisionalMix() {
    if (!currentProvisionalResolve) return;
    const record = records.find(r => r.id === currentProvisionalResolve.recordId);
    if (!record) return;
    refreshProvisionalDerivedFields(record);
    const held = getProvisionalHeld(record);
    const cat = document.getElementById('prov-mix-category')?.value;
    const person = document.getElementById('prov-mix-person')?.value;
    const spendAmt = parseFloat(document.getElementById('prov-mix-spend-amount')?.value) || 0;
    const returnAmt = parseFloat(document.getElementById('prov-mix-return-amount')?.value) || 0;
    const total = spendAmt + returnAmt;
    
    if (!cat) {
        showToast('Select a spending category', 'error');
        return;
    }
    if (total <= 0) {
        showToast('Enter a valid spend or return amount', 'error');
        return;
    }
    if (total > held + 0.0001) {
        showToast(`Total cannot exceed held amount ($${held.toFixed(2)})`, 'error');
        return;
    }
    const notesExtra = (document.getElementById('prov-resolve-notes')?.value || '').trim();
    
    try {
        // Process spend portion if any
        if (spendAmt > 0) {
            const derivedSpending = {
                date: formatDateLocal(new Date()),
                type: 'spending',
                category: cat,
                person: person || '',
                amount: spendAmt,
                item: `Spend from Provisional: ${record.item || record.category}`,
                notes: notesExtra || `Resolved from provisional record #${record.id}`,
                timestamp: Date.now(),
                provisionalRef: record.id
            };
            
            const newRecordId = await add(STORE_RECORDS, derivedSpending);
            
            if (!record.resolutions) record.resolutions = [];
            record.resolutions.push({
                date: derivedSpending.date,
                action: 'spend',
                amount: spendAmt,
                category: cat,
                person: person || '',
                notes: notesExtra,
                derivedRecordId: newRecordId,
                timestamp: derivedSpending.timestamp
            });
        }
        
        // Process return portion if any
        if (returnAmt > 0) {
            if (!record.resolutions) record.resolutions = [];
            record.resolutions.push({
                date: formatDateLocal(new Date()),
                action: 'return',
                amount: returnAmt,
                notes: notesExtra,
                timestamp: Date.now()
            });
        }
        
        refreshProvisionalDerivedFields(record);
        
        await updateRecord(STORE_RECORDS, record);
        await refreshData();
        
        let message = '';
        if (spendAmt > 0 && returnAmt > 0) {
            message = `Spent $${spendAmt.toFixed(2)} and returned $${returnAmt.toFixed(2)}`;
        } else if (spendAmt > 0) {
            message = `Spent $${spendAmt.toFixed(2)}`;
        } else {
            message = `Returned $${returnAmt.toFixed(2)}`;
        }
        showToast(message, 'success');
        hideProvisionalResolveCard();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

let currentProvisionalUndo = null;

function showProvisionalUndoCard(recordId) {
    const record = records.find(r => r.id === recordId);
    if (!record || !record.resolutions) return;

    const availableResolutions = record.resolutions
        .map((res, idx) => ({ ...res, originalIndex: idx }))
        .filter(res => !res.undone);

    if (availableResolutions.length === 0) {
        showToast('No resolutions to undo', 'info');
        return;
    }

    currentProvisionalUndo = {
        recordId: recordId,
        resolutions: availableResolutions
    };

    const optionsContainer = document.getElementById('provisional-undo-options');
    optionsContainer.innerHTML = availableResolutions.map((res, idx) => {
        const actionText = res.action === 'return' ? 'Return' : 'Spend';
        const categoryText = res.category ? ` (${res.category})` : '';
        const personText = res.person ? ` • ${res.person}` : '';
        return `
            <div class="provisional-undo-option" onclick="selectProvisionalUndo(${idx})" style="padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 0.5rem; cursor: pointer; transition: all 0.2s; background: white;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span class="badge-${res.action === 'return' ? 'income' : 'spending'}" style="font-size: 0.7rem; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 700;">
                        ${actionText}
                    </span>
                    <span style="font-weight: 600; color: var(--primary-color); font-size: 1rem;">$${formatCurrency(res.amount)}</span>
                </div>
                <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem;">
                    ${res.date}${categoryText}${personText}
                </div>
                ${res.notes ? `<div style="font-size: 0.8rem; margin-top: 0.25rem; font-style: italic; color: #475569;">"${res.notes}"</div>` : ''}
            </div>
        `;
    }).join('');

    document.getElementById('provisional-undo-card')?.classList.add('active');
    document.getElementById('provisional-undo-overlay')?.classList.add('active');
}

function hideProvisionalUndoCard() {
    document.getElementById('provisional-undo-card')?.classList.remove('active');
    document.getElementById('provisional-undo-overlay')?.classList.remove('active');
    currentProvisionalUndo = null;
}

async function selectProvisionalUndo(index) {
    if (!currentProvisionalUndo) return;
    const resolution = currentProvisionalUndo.resolutions[index];
    if (!resolution) return;

    hideProvisionalUndoCard();
    await undoProvisionalResolution(currentProvisionalUndo.recordId, resolution.originalIndex);
}

async function showUndoProvisionalResolutionDialog(recordId) {
    const record = records.find(r => r.id === recordId);
    if (!record || !record.resolutions) return;

    const availableResolutions = record.resolutions
        .map((res, idx) => ({ ...res, originalIndex: idx }))
        .filter(res => !res.undone);

    if (availableResolutions.length === 0) {
        showToast('No resolutions to undo', 'info');
        return;
    }

    if (availableResolutions.length === 1) {
        // Only one resolution, undo it directly
        await undoProvisionalResolution(recordId, availableResolutions[0].originalIndex);
        return;
    }

    // Multiple resolutions, show selection card
    showProvisionalUndoCard(recordId);
}

async function undoProvisionalResolution(recordId, resolutionIndex) {
    const record = records.find(r => r.id === recordId);
    if (!record || !record.resolutions || !record.resolutions[resolutionIndex]) return;

    const resolution = record.resolutions[resolutionIndex];
    if (resolution.undone) return;

    if (resolution.action === 'spend') {
        // Find and delete derived spending transaction
        const derivedId = resolution.derivedRecordId;
        const derivedRecord = records.find(r => r.id === derivedId);

        if (derivedRecord) {
            // Block undo if derived transaction was modified (how to detect? simple check for now)
            // If amount or category changed, it's modified.
            if (parseFloat(derivedRecord.amount) !== resolution.amount || derivedRecord.category !== resolution.category) {
                showToast('Cannot undo: the associated spending transaction has been modified.', 'warning');
                return;
            }

            if (await showConfirm('Undo this spend resolution? The associated spending transaction will be deleted.')) {
                try {
                    await deleteRecord(derivedId);
                } catch (e) {
                    showToast('Error deleting derived record: ' + e.message, 'error');
                    return;
                }
            } else {
                return;
            }
        } else {
            // Even if derived record is gone, we might want to allow undoing the resolution status
            // but the user said "find and delete". If already gone, just continue?
            // Let's warn.
            if (!await showConfirm('The associated spending record was not found. Undo resolution anyway?')) {
                return;
            }
        }
    } else {
        // For return action
        if (!await showConfirm('Undo this return resolution?')) {
            return;
        }
    }

    resolution.undone = true;
    resolution.undoneAt = Date.now();
    refreshProvisionalDerivedFields(record);

    try {
        await updateRecord(STORE_RECORDS, record);
        await refreshData();
        showToast('Resolution undone successfully', 'success');

        // Re-open details modal to show updated state
        if (currentDetailRecordId === recordId) {
            await openDetailsModal(record);
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function undoLastProvisionalResolution(recordId) {
    const record = records.find(r => r.id === recordId);
    if (!record || !record.resolutions || record.resolutions.length === 0) return;
    
    // Find last resolution that isn't undone
    let lastIdx = -1;
    for (let i = record.resolutions.length - 1; i >= 0; i--) {
        if (!record.resolutions[i].undone) {
            lastIdx = i;
            break;
        }
    }
    
    if (lastIdx !== -1) {
        await undoProvisionalResolution(recordId, lastIdx);
    }
}

window.undoLastProvisionalResolution = undoLastProvisionalResolution;
window.undoProvisionalResolution = undoProvisionalResolution;
window.showUndoProvisionalResolutionDialog = showUndoProvisionalResolutionDialog;
window.showProvisionalUndoCard = showProvisionalUndoCard;
window.hideProvisionalUndoCard = hideProvisionalUndoCard;
window.selectProvisionalUndo = selectProvisionalUndo;

window.resolveProvisional = resolveProvisional;
window.showProvisionalResolveCard = showProvisionalResolveCard;
window.hideProvisionalResolveCard = hideProvisionalResolveCard;
window.processProvisionalReturn = processProvisionalReturn;
window.processProvisionalSpend = processProvisionalSpend;
window.processProvisionalMix = processProvisionalMix;

// Make upcoming income functions globally available
window.editUpcomingIncome = editUpcomingIncome;
window.deleteUpcomingIncome = deleteUpcomingIncome;
window.showUpcomingIncomeDetails = showUpcomingIncomeDetails;
window.collectIncome = collectIncome;
window.undoRecurringIncome = undoRecurringIncome;
window.moveSavingsAccount = moveSavingsAccount;

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
        if (r.type === 'spending' || r.type === 'provisional') {
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
                        const amount = r.type === 'provisional' ? getProvisionalHeld(r) : (parseFloat(r.amount) || 0);
                        if (amount > 0) {
                            monthlySpending[r.category] = (monthlySpending[r.category] || 0) + amount;
                        }
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

    // Show max 3 budget limits with "Show More" functionality
    const maxBudgetItems = 3;
    const budgetItemsToShow = sortedLimits.slice(0, maxBudgetItems);
    
    budgetItemsToShow.forEach(limit => {
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

    // Add "Show More" button if there are more budget limits
    if (sortedLimits.length > maxBudgetItems) {
        const showMoreBtn = document.createElement('button');
        showMoreBtn.className = 'btn btn-outline show-more-btn';
        showMoreBtn.textContent = `Show More (${sortedLimits.length - maxBudgetItems} more)`;
        showMoreBtn.style.width = '100%';
        showMoreBtn.style.marginTop = '0.75rem';
        
        // Store reference to dynamically added items
        const addedItems = [];
        
        showMoreBtn.onclick = () => {
            // Show all budget limits
            const remainingItems = sortedLimits.slice(maxBudgetItems);
            remainingItems.forEach(limit => {
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
                container.insertBefore(item, showMoreBtn);
                addedItems.push(item);
            });
            showMoreBtn.textContent = 'Show Less';
            showMoreBtn.onclick = () => {
                // Hide back to max items
                addedItems.forEach(item => {
                    container.removeChild(item);
                });
                addedItems.length = 0; // Clear the array
                showMoreBtn.textContent = `Show More (${sortedLimits.length - maxBudgetItems} more)`;
                showMoreBtn.onclick = arguments.callee;
            };
        };
        container.appendChild(showMoreBtn);
    }
}

function openBudgetLimitModal(limit = null) {
    const modalTitle = document.getElementById('budget-limit-modal-title');
    const categorySelect = document.getElementById('budget-limit-category');
    const amountInput = document.getElementById('budget-limit-amount');
    const thresholdInput = document.getElementById('budget-limit-threshold');
    const idInput = document.getElementById('budget-limit-id');

    // Populate categories (only spending categories) sorted by usage frequency
    const { categoryUsage } = getUsageMaps();
    const spendingCategories = categories.filter(c => c.type === 'spending').sort((a, b) => {
        const usageA = categoryUsage[a.name] || 0;
        const usageB = categoryUsage[b.name] || 0;
        if (usageB !== usageA) {
            return usageB - usageA;
        }
        return compareStringsAlphabetically(a.name, b.name);
    });
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
    if (budgetLimits.length === 0) {
        showToast('No budget limits found to reset', 'warning');
        return;
    }
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
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Get a set of templateIds already received this month
    const receivedThisMonth = new Set();
    records.forEach(r => {
        if (r.fromRecurringTemplate && r.type === 'income' && !r.isProjected) {
            const rDate = new Date(r.date);
            if (rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear) {
                receivedThisMonth.add(parseInt(r.fromRecurringTemplate));
            }
        }
    });

    // Get regular upcoming records (next 5 days) - only projected/expected income
    const upcomingRecords = records.filter(r => {
        const recordDate = new Date(r.date);
        return r.isProjected && recordDate > now && recordDate <= fiveDaysFromNow;
    });

    // Generate recurring income occurrences (next 5 days)
    const recurringOccurrences = [];
    recurringIncomeTemplates.forEach(template => {
        if (receivedThisMonth.has(template.id)) return; // Skip if already received

        const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const nextMonth = now.getMonth() + 1;
        const nextYear = now.getFullYear() + (nextMonth > 11 ? 1 : 0);
        const adjustedNextMonth = nextMonth % 12;
        const nextMonthKey = `${nextYear}-${String(adjustedNextMonth + 1).padStart(2, '0')}`;

        // Current month occurrence
        if (!template.ignoredOccurrences || !template.ignoredOccurrences.includes(currentMonthKey)) {
            const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), template.dayOfMonth);
            if (currentMonthDate > now && currentMonthDate <= fiveDaysFromNow) {
                recurringOccurrences.push({
                    date: formatDateLocal(currentMonthDate),
                    amount: template.amount,
                    category: template.category,
                    item: template.source,
                    type: 'income',
                    isRecurring: true
                });
            }
        }

        // Check next month occurrence (if within 5 days)
        if (!template.ignoredOccurrences || !template.ignoredOccurrences.includes(nextMonthKey)) {
            const nextMonthDate = new Date(nextYear, adjustedNextMonth, template.dayOfMonth);
            if (nextMonthDate > now && nextMonthDate <= fiveDaysFromNow) {
                recurringOccurrences.push({
                    date: formatDateLocal(nextMonthDate),
                    amount: template.amount,
                    category: template.category,
                    item: template.source,
                    type: 'income',
                    isRecurring: true
                });
            }
        }
    });

    // Combine and sort
    const upcoming = [...upcomingRecords, ...recurringOccurrences].sort((a, b) => new Date(a.date) - new Date(b.date));

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
            dateLabel = '1 day left';
        } else {
            const timeDiff = dateObj.getTime() - now.getTime();
            const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            dateLabel = `${daysLeft} days left`;
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
        const signColorClass = isIncome ? 'positive' : 'negative';
        item.innerHTML = `
            <span class="upcoming-date">${dateLabel}</span>
            <span class="upcoming-amount">
                <span class="currency-sign ${signColorClass}">${amountPrefix}$</span>
                <span class="amount-value">${formatCurrency(amount)}</span>
            </span>
            <span class="upcoming-desc">${isIncome ? '💰' : '💸'} ${description}</span>
        `;
        listContainer.appendChild(item);
    });
}

function renderMonthCountdown() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate days until first of next month
    const firstOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const daysUntilFirstOfMonth = Math.ceil((firstOfNextMonth - now) / (1000 * 60 * 60 * 24));

    // Update DOM element
    const firstOfMonthElement = document.getElementById('first-of-month-countdown');

    if (firstOfMonthElement) {
        firstOfMonthElement.textContent = `${daysUntilFirstOfMonth} days`;
    }
}

function renderUpcomingIncome() {
    const container = document.getElementById('upcoming-income-list');
    if (!container) return;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Build a map of templateId -> received record id for THIS month
    // This lets us detect which recurring incomes have already been received
    const receivedThisMonth = {};
    records.forEach(r => {
        if (r.fromRecurringTemplate && r.type === 'income' && !r.isProjected) {
            const rDate = new Date(r.date);
            if (rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear) {
                // Store the record id so we can delete it on undo
                const numericTemplateId = parseInt(r.fromRecurringTemplate);
                if (!Number.isNaN(numericTemplateId)) {
                    receivedThisMonth[numericTemplateId] = r.id;
                }
            }
        }
    });

    // Get regular upcoming income and AR (next 30 days)
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

    // Generate recurring income occurrences for next 30 days
    // Also include current month occurrences even if their day has passed (so we can show received state)
    const recurringOccurrences = [];
    recurringIncomeTemplates.forEach(template => {
        const numericId = template.id;
        const alreadyReceived = receivedThisMonth.hasOwnProperty(numericId);
        
        const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const nextMonth = now.getMonth() + 1;
        const nextYear = now.getFullYear() + (nextMonth > 11 ? 1 : 0);
        const adjustedNextMonth = nextMonth % 12;
        const nextMonthKey = `${nextYear}-${String(adjustedNextMonth + 1).padStart(2, '0')}`;

        // Current month occurrence
        if (!template.ignoredOccurrences || !template.ignoredOccurrences.includes(currentMonthKey)) {
            const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), template.dayOfMonth);
            if (currentMonthDate > now && currentMonthDate <= thirtyDaysFromNow) {
                // Future this month - show normally or as received
                recurringOccurrences.push({
                    id: template.id,
                    date: formatDateLocal(currentMonthDate),
                    amount: template.amount,
                    category: template.category,
                    projectedSource: template.source,
                    notes: template.notes,
                    isRecurring: true,
                    isProjected: true,
                    templateId: template.id,
                    dayOfMonth: template.dayOfMonth,
                    receivedRecordId: alreadyReceived ? receivedThisMonth[numericId] : null
                });
            } else if (currentMonthDate.getMonth() === currentMonth && currentMonthDate.getFullYear() === currentYear) {
                // Day has passed this month - only show if received (so user can undo)
                // or if it's today
                if (alreadyReceived || currentMonthDate.toDateString() === now.toDateString()) {
                    recurringOccurrences.push({
                        id: template.id,
                        date: formatDateLocal(currentMonthDate),
                        amount: template.amount,
                        category: template.category,
                        projectedSource: template.source,
                        notes: template.notes,
                        isRecurring: true,
                        isProjected: true,
                        templateId: template.id,
                        dayOfMonth: template.dayOfMonth,
                        receivedRecordId: alreadyReceived ? receivedThisMonth[numericId] : null
                    });
                }
            }
        }

        // Check next month occurrence
        if (!template.ignoredOccurrences || !template.ignoredOccurrences.includes(nextMonthKey)) {
            const nextMonthDate = new Date(nextYear, adjustedNextMonth, template.dayOfMonth);
            if (nextMonthDate > now && nextMonthDate <= thirtyDaysFromNow) {
                recurringOccurrences.push({
                    id: template.id + '_next', // Unique ID for this occurrence
                    date: formatDateLocal(nextMonthDate),
                    amount: template.amount,
                    category: template.category,
                    projectedSource: template.source,
                    notes: template.notes,
                    isRecurring: true,
                    isProjected: true,
                    templateId: template.id,
                    dayOfMonth: template.dayOfMonth,
                    receivedRecordId: null // Next month can't be received yet
                });
            }
        }
    });

    // Combine all upcoming income items
    const allUpcomingIncome = [...upcomingIncome, ...recurringOccurrences];

    if (allUpcomingIncome.length === 0) {
        container.innerHTML = `
            <div class="upcoming-income-empty">
                <i class="fas fa-calendar"></i>
                <p>No upcoming income or receivables</p>
            </div>
        `;
        return;
    }

    // Split into pending and collected this month
    const pendingUpcoming = allUpcomingIncome.filter(r => !r.receivedRecordId);
    const collectedUpcoming = allUpcomingIncome.filter(r => !!r.receivedRecordId);

    // Further split pending into AR and regular income
    const pendingAR = pendingUpcoming.filter(r => r.type === 'account_receivable');
    const pendingIncome = pendingUpcoming.filter(r => r.type !== 'account_receivable');

    // Sort pending items by most near to be upcoming first
    pendingIncome.sort((a, b) => new Date(a.date) - new Date(b.date));
    pendingAR.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Sort collected items too
    collectedUpcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

    container.innerHTML = '';

    // Helper function to format date as "May 1 2026"
    const formatExpectedDate = (dateStr) => {
        const date = new Date(dateStr);
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${monthNames[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
    };

    // Helper function to render a single card item
    const createUpcomingCard = (r) => {
        const dateObj = new Date(r.date);
        const isToday = dateObj.toDateString() === now.toDateString();
        const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === dateObj.toDateString();
        const isReceivedThisMonth = !!r.receivedRecordId;

        // Calculate days remaining instead of showing the date
        let dateLabel;
        if (isReceivedThisMonth) {
            dateLabel = '✓ Received';
        } else if (isToday) {
            dateLabel = 'Today';
        } else if (isTomorrow) {
            dateLabel = '1 day left';
        } else {
            const timeDiff = dateObj.getTime() - now.getTime();
            const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            if (daysLeft < 0) {
                dateLabel = 'Overdue';
            } else {
                dateLabel = `${daysLeft} days left`;
            }
        }

        const isAR = r.type === 'account_receivable';
        const isProjected = r.isProjected;
        const isRecurring = r.isRecurring;
        const amount = parseFloat(r.amount) || 0;
        const description = r.projectedSource || r.item || r.category;
        const expectedDate = formatExpectedDate(r.date);

        // Find chosen category color
        const cat = categories.find(c => c.name === r.category);
        const catColor = cat ? cat.color : '#355872'; // Fallback to primary color

        // Generate appropriate icon and label
        let iconClass = 'fa-arrow-trend-up';
        let statusLabel = '';
        if (isAR) {
            iconClass = 'fa-hand-holding-dollar';
            statusLabel = ' (Receivable)';
        } else if (isRecurring) {
            iconClass = isReceivedThisMonth ? 'fa-check-circle' : 'fa-calendar-check';
            statusLabel = ' (Recurring)';
        } else if (isProjected) {
            iconClass = 'fa-calendar-check';
            statusLabel = ' (Expected)';
        }

        // Build action buttons based on received state
        let actionButtons = '';
        if (isReceivedThisMonth) {
            // Show Undo button for received items
            actionButtons = `
                <button class="undo-btn" onclick="event.stopPropagation(); undoRecurringIncome(${r.receivedRecordId})" title="Undo - delete the recorded income">
                    <i class="fas fa-undo"></i> Undo
                </button>
            `;
        } else {
            actionButtons = `
                ${!isAR ? `<button class="btn-icon edit-btn" onclick="event.stopPropagation(); editUpcomingIncome(${r.id}, ${isRecurring})" title="${isRecurring ? 'Edit Recurring' : 'Edit'}"><i class="fas fa-pen"></i></button>` : ''}
                <button class="btn-icon delete-btn" onclick="event.stopPropagation(); deleteUpcomingIncome(${r.id}, ${isRecurring})" title="${isRecurring ? 'Delete Recurring' : 'Delete'}"><i class="fas fa-trash"></i></button>
                ${isAR ? `<button class="collect-btn" onclick="event.stopPropagation(); collectAR(${r.id})" title="Mark as Collected">Collect</button>` : ''}
                ${(isRecurring || isProjected) && !isAR ? `<button class="collect-btn" onclick="event.stopPropagation(); collectIncome(${typeof r.id === 'string' ? `'${r.id}'` : r.id}, ${isRecurring}, '${r.date}')" title="Mark as Received">Received</button>` : ''}
            `;
        }

        const item = document.createElement('div');
        item.className = `upcoming-income-item ${isAR ? 'upcoming-ar-item' : ''} ${isProjected ? 'upcoming-projected' : ''} ${isRecurring ? 'upcoming-recurring' : ''} ${isReceivedThisMonth ? 'received-this-month' : ''}`;
        
        // Dynamic background styling based on category color
        if (!isReceivedThisMonth) {
            item.style.backgroundColor = getLighterColor(catColor, 0.08);
            item.style.border = `1px solid ${catColor}`;
        }

        // Setup badge for next occurrence if collected & recurring
        let awaitingBadgeHtml = '';
        if (isReceivedThisMonth && isRecurring && r.dayOfMonth) {
            const getNextMonthDateLabel = (day) => {
                const today = new Date();
                let nextMonth = today.getMonth() + 1;
                let nextYear = today.getFullYear() + (nextMonth > 11 ? 1 : 0);
                nextMonth = nextMonth % 12;
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const suffix = (d) => {
                    if (d > 3 && d < 21) return 'th';
                    switch (d % 10) {
                        case 1:  return "st";
                        case 2:  return "nd";
                        case 3:  return "rd";
                        default: return "th";
                    }
                };
                return `${monthNames[nextMonth]} ${day}${suffix(day)}`;
            };
            awaitingBadgeHtml = `<span class="awaiting-badge"><i class="fas fa-arrows-spin"></i> Awaiting ${getNextMonthDateLabel(r.dayOfMonth)}</span>`;
        }

        item.innerHTML = `
            <div class="income-info" onclick="showUpcomingIncomeDetails(${typeof r.id === 'string' ? `'${r.id}'` : r.id}, ${isRecurring})">
                <div class="income-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="income-details">
                    <div class="income-header-row">
                        <span class="income-name">${description}</span>
                        ${!isReceivedThisMonth ? `<span class="income-expected-date">${expectedDate}</span>` : ''}
                    </div>
                    <span class="income-date">${dateLabel}${statusLabel}</span>
                    ${awaitingBadgeHtml}
                </div>
            </div>
            <div class="income-actions">
                <span class="income-amount">+$${formatCurrency(amount)}</span>
                ${actionButtons}
            </div>
        `;

        // Accent the icon background and color using the category color if pending
        const iconEl = item.querySelector('.income-icon');
        if (iconEl && !isReceivedThisMonth) {
            iconEl.style.backgroundColor = getLighterColor(catColor, 0.16);
            iconEl.style.color = catColor;
        }

        return item;
    };

    // Render AR section
    if (pendingAR.length > 0) {
        const arSection = document.createElement('div');
        arSection.className = 'ar-upcoming-section';
        arSection.innerHTML = `
            <div class="ar-section-header">
                <h4><i class="fas fa-hand-holding-dollar"></i> Accounts Receivable</h4>
                <span class="ar-count-badge">${pendingAR.length}</span>
            </div>
            <div class="ar-upcoming-list" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
        `;
        const arList = arSection.querySelector('.ar-upcoming-list');
        
        // Show max 4 AR items with "Show More" functionality
        const maxARItems = 4;
        const arItemsToShow = pendingAR.slice(0, maxARItems);
        arItemsToShow.forEach(r => {
            arList.appendChild(createUpcomingCard(r));
        });

        // Add "Show More" button if there are more AR items
        if (pendingAR.length > maxARItems) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = 'btn btn-outline show-more-btn';
            showMoreBtn.textContent = `Show More (${pendingAR.length - maxARItems} more)`;
            showMoreBtn.onclick = () => {
                // Show all AR items
                const remainingItems = pendingAR.slice(maxARItems);
                remainingItems.forEach(r => {
                    arList.appendChild(createUpcomingCard(r));
                });
                showMoreBtn.textContent = 'Show Less';
                showMoreBtn.onclick = () => {
                    // Hide back to max items
                    while (arList.children.length > maxARItems) {
                        arList.removeChild(arList.lastChild);
                    }
                    showMoreBtn.textContent = `Show More (${pendingAR.length - maxARItems} more)`;
                    showMoreBtn.onclick = arguments.callee;
                };
            };
            arSection.appendChild(showMoreBtn);
        }

        container.appendChild(arSection);
    }

    // Render Expected Income section
    if (pendingIncome.length > 0) {
        const incomeSection = document.createElement('div');
        incomeSection.className = 'expected-income-section';
        incomeSection.innerHTML = `
            <div class="expected-income-header">
                <h4><i class="fas fa-calendar-check"></i> Expected Income</h4>
                <span class="expected-income-count-badge">${pendingIncome.length}</span>
            </div>
            <div class="expected-income-list" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
        `;
        const incomeList = incomeSection.querySelector('.expected-income-list');
        
        // Show max 4 expected income items with "Show More" functionality
        const maxIncomeItems = 4;
        const incomeItemsToShow = pendingIncome.slice(0, maxIncomeItems);
        incomeItemsToShow.forEach(r => {
            incomeList.appendChild(createUpcomingCard(r));
        });

        // Add "Show More" button if there are more income items
        if (pendingIncome.length > maxIncomeItems) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = 'btn btn-outline show-more-btn';
            showMoreBtn.textContent = `Show More (${pendingIncome.length - maxIncomeItems} more)`;
            showMoreBtn.onclick = () => {
                // Show all income items
                const remainingItems = pendingIncome.slice(maxIncomeItems);
                remainingItems.forEach(r => {
                    incomeList.appendChild(createUpcomingCard(r));
                });
                showMoreBtn.textContent = 'Show Less';
                showMoreBtn.onclick = () => {
                    // Hide back to max items
                    while (incomeList.children.length > maxIncomeItems) {
                        incomeList.removeChild(incomeList.lastChild);
                    }
                    showMoreBtn.textContent = `Show More (${pendingIncome.length - maxIncomeItems} more)`;
                    showMoreBtn.onclick = arguments.callee;
                };
            };
            incomeSection.appendChild(showMoreBtn);
        }

        container.appendChild(incomeSection);
    }

    // Render collected items under a separate beautiful sub-section
    if (collectedUpcoming.length > 0) {
        const collectedSection = document.createElement('div');
        collectedSection.className = 'collected-upcoming-section';
        collectedSection.innerHTML = `
            <div class="collected-section-header">
                <h4><i class="fas fa-circle-check"></i> Collected This Month (Waiting for Next Month)</h4>
                <span class="collected-count-badge">${collectedUpcoming.length}</span>
            </div>
            <div class="collected-upcoming-list" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
        `;
        const collectedList = collectedSection.querySelector('.collected-upcoming-list');
        
        // Show max 2 collected items with "Show More" functionality
        const maxCollectedItems = 2;
        const collectedItemsToShow = collectedUpcoming.slice(0, maxCollectedItems);
        collectedItemsToShow.forEach(r => {
            collectedList.appendChild(createUpcomingCard(r));
        });

        // Add "Show More" button if there are more collected items
        if (collectedUpcoming.length > maxCollectedItems) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = 'btn btn-outline show-more-btn';
            showMoreBtn.textContent = `Show More (${collectedUpcoming.length - maxCollectedItems} more)`;
            showMoreBtn.onclick = () => {
                // Show all collected items
                const remainingItems = collectedUpcoming.slice(maxCollectedItems);
                remainingItems.forEach(r => {
                    collectedList.appendChild(createUpcomingCard(r));
                });
                showMoreBtn.textContent = 'Show Less';
                showMoreBtn.onclick = () => {
                    // Hide back to max items
                    while (collectedList.children.length > maxCollectedItems) {
                        collectedList.removeChild(collectedList.lastChild);
                    }
                    showMoreBtn.textContent = `Show More (${collectedUpcoming.length - maxCollectedItems} more)`;
                    showMoreBtn.onclick = arguments.callee;
                };
            };
            collectedSection.appendChild(showMoreBtn);
        }

        container.appendChild(collectedSection);
    }

    // Show empty state if no items at all
    if (pendingAR.length === 0 && pendingIncome.length === 0 && collectedUpcoming.length === 0) {
        container.innerHTML = `
            <div class="upcoming-income-empty">
                <i class="fas fa-calendar"></i>
                <p>No upcoming income or receivables</p>
            </div>
        `;
    }
}

// ========================================
// UPCOMING INCOME MODAL FUNCTIONS
// ========================================

function openUpcomingIncomeModal() {
    if (!upcomingIncomeModal) return;

    // Reset form
    upcomingIncomeForm.reset();

    // Remove any edit ID fields
    const regularEditIdField = document.getElementById('upcoming-income-edit-id');
    if (regularEditIdField) regularEditIdField.remove();
    const recurringEditIdField = document.getElementById('upcoming-income-recurring-edit-id');
    if (recurringEditIdField) recurringEditIdField.remove();

    // Reset modal title
    upcomingIncomeModal.querySelector('h2').textContent = 'Add Expected Income';

    // Set default day of month (e.g., today's day + 1, or 1 if end of month)
    const today = new Date();
    const defaultDay = Math.min(today.getDate() + 1, 28);
    upcomingIncomeDateInput.value = defaultDay;

    // Auto-check recurring since all expected incomes are day-of-month based
    if (upcomingIncomeRecurringCheckbox) {
        upcomingIncomeRecurringCheckbox.checked = true;
        const wrapper = upcomingIncomeRecurringCheckbox.closest('.recurring-checkbox-wrapper');
        if (wrapper) wrapper.classList.add('active');
    }

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

    let source = upcomingIncomeSourceInput.value.trim();
    const dayOfMonth = parseInt(upcomingIncomeDateInput.value);
    const amount = parseFloat(upcomingIncomeAmountInput.value);
    const category = upcomingIncomeCategorySelect.value;
    const notes = upcomingIncomeNotesInput.value.trim();
    const isRecurring = upcomingIncomeRecurringCheckbox?.checked || false;
    const id = document.getElementById('upcoming-income-edit-id')?.value;
    const isRecurringEditId = document.getElementById('upcoming-income-recurring-edit-id')?.value;

    // Use category as source if source is empty
    if (!source && category) {
        source = category;
    }

    if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) {
        showToast('Please enter a valid day of month (1-31)', 'error');
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount greater than 0', 'error');
        return;
    }

    if (!category || category === "") {
        showToast('Please select a category', 'error');
        return;
    }

    try {
        if (isRecurring) {
            // Save as recurring income template
            const templateData = {
                source: source,
                dayOfMonth: dayOfMonth,
                amount: amount,
                category: category,
                notes: notes,
                createdAt: new Date().toISOString()
            };

            if (isRecurringEditId) {
                templateData.id = parseInt(isRecurringEditId);
                await updateRecord(STORE_RECURRING_INCOME, templateData);
                showToast('Recurring income updated successfully', 'success');
            } else {
                await add(STORE_RECURRING_INCOME, templateData);
                showToast('Recurring income added - will appear every month on day ' + dayOfMonth, 'success');
            }
        } else {
            // Save as one-time expected income record with a future date based on dayOfMonth
            const now = new Date();
            let targetDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
            // If that day has already passed this month, schedule for next month
            if (targetDate <= now) {
                targetDate = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
            }
            const dateStr = formatDateLocal(targetDate);

            const data = {
                formatType: 'single',
                type: 'income',
                date: dateStr,
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

            if (id) {
                data.id = parseInt(id);
                await updateRecord(STORE_RECORDS, data);
                showToast('Expected income updated successfully', 'success');
            } else {
                await add(STORE_RECORDS, data);
                showToast('Expected income added successfully', 'success');
            }
        }
        closeUpcomingIncomeModal();
        await refreshData();
        renderBudget();
    } catch (error) {
        console.error('Error saving upcoming income:', error);
        showToast('Error saving expected income: ' + error.message, 'error');
    }
}

function editUpcomingIncome(id, isRecurring = false) {
    if (isRecurring) {
        // Edit recurring template - extract numeric ID from possible "1_next" format
        const numericId = parseInt(id);
        const template = recurringIncomeTemplates.find(t => t.id === numericId);
        if (!template) return;

        // Populate form with template data
        upcomingIncomeSourceInput.value = template.source || '';
        // Set day of month directly
        upcomingIncomeDateInput.value = template.dayOfMonth;
        upcomingIncomeAmountInput.value = template.amount;
        upcomingIncomeNotesInput.value = template.notes || '';

        // Check the recurring checkbox
        if (upcomingIncomeRecurringCheckbox) {
            upcomingIncomeRecurringCheckbox.checked = true;
        }

        // Populate category dropdown
        const incomeCategories = categories.filter(c => c.type === 'income');
        upcomingIncomeCategorySelect.innerHTML = '<option value="">Select Category</option>' +
            incomeCategories.map(c => `<option value="${c.name}" ${c.name === template.category ? 'selected' : ''}>${c.name}</option>`).join('');

        // Add hidden field for recurring edit mode
        let recurringEditIdField = document.getElementById('upcoming-income-recurring-edit-id');
        if (!recurringEditIdField) {
            recurringEditIdField = document.createElement('input');
            recurringEditIdField.type = 'hidden';
            recurringEditIdField.id = 'upcoming-income-recurring-edit-id';
            upcomingIncomeForm.appendChild(recurringEditIdField);
        }
        recurringEditIdField.value = id;

        // Remove regular edit id field if exists
        const regularEditIdField = document.getElementById('upcoming-income-edit-id');
        if (regularEditIdField) regularEditIdField.remove();

        // Update modal title
        upcomingIncomeModal.querySelector('h2').textContent = 'Edit Recurring Income';
        upcomingIncomeModal.classList.add('active');
    } else {
        // Edit regular expected income record
        const record = records.find(r => r.id === id);
        if (!record) return;

        // Populate form with existing data
        upcomingIncomeSourceInput.value = record.projectedSource || '';
        // Extract day of month from the date string
        const recordDate = new Date(record.date);
        upcomingIncomeDateInput.value = recordDate.getDate();
        upcomingIncomeAmountInput.value = record.amount;
        upcomingIncomeNotesInput.value = record.notes?.replace(`Expected Income: ${record.projectedSource}. `, '')?.replace(`Expected Income: ${record.projectedSource}`, '') || '';

        // Uncheck the recurring checkbox
        if (upcomingIncomeRecurringCheckbox) {
            upcomingIncomeRecurringCheckbox.checked = false;
        }

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

        // Remove recurring edit id field if exists
        const recurringEditIdField = document.getElementById('upcoming-income-recurring-edit-id');
        if (recurringEditIdField) recurringEditIdField.remove();

        // Update modal title
        upcomingIncomeModal.querySelector('h2').textContent = 'Edit Expected Income';
        upcomingIncomeModal.classList.add('active');
    }
}

async function deleteUpcomingIncome(id, isRecurring = false) {
    const confirmMessage = isRecurring
        ? 'Delete this recurring income? It will no longer appear in future months.'
        : 'Delete this expected income?';

    if (await showConfirm(confirmMessage)) {
        try {
            if (isRecurring) {
                // Extract numeric ID from possible "1_next" format
                const numericId = parseInt(id);
                await remove(STORE_RECURRING_INCOME, numericId);
                showToast('Recurring income deleted', 'success');
            } else {
                await remove(STORE_RECORDS, id);
                showToast('Expected income deleted', 'success');
            }
            await refreshData();
            renderBudget();
        } catch (error) {
            console.error('Error deleting upcoming income:', error);
            showToast('Error deleting expected income: ' + error.message, 'error');
        }
    }
}

function showUpcomingIncomeDetails(id, isRecurring = false) {
    let record, template, dateObj, dateStr, source, category, amount, notes;

    if (isRecurring) {
        // Find the recurring template
        template = recurringIncomeTemplates.find(t => t.id === id);
        if (!template) return;
        source = template.source;
        category = template.category;
        amount = template.amount;
        notes = template.notes;
        // Use current month occurrence date for display
        const now = new Date();
        dateObj = new Date(now.getFullYear(), now.getMonth(), template.dayOfMonth);
        dateStr = `Day ${template.dayOfMonth} of every month`;
    } else {
        record = records.find(r => r.id === id);
        if (!record) return;
        source = record.projectedSource;
        category = record.category;
        amount = record.amount;
        notes = record.notes;
        dateObj = new Date(record.date);
        dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    const isAR = !isRecurring && record?.type === 'account_receivable';
    const isProjected = !isRecurring && record?.isProjected;

    // Create floating popup
    let popup = document.getElementById('upcoming-income-details-popup');
    if (popup) popup.remove();

    const title = isAR ? 'AR' : (isRecurring ? 'Recurring Income' : (isProjected ? 'Expected Income' : 'Upcoming Income'));
    const recurringInfo = isRecurring ? `
                <div class="detail-row">
                    <span class="detail-label">Recurring</span>
                    <span class="detail-value">Monthly on day ${template.dayOfMonth}</span>
                </div>
                ` : '';

    popup = document.createElement('div');
    popup.id = 'upcoming-income-details-popup';
    popup.className = 'upcoming-income-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>${title}</h3>
                <button class="btn-icon close-popup" onclick="document.getElementById('upcoming-income-details-popup').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="popup-body">
                <div class="detail-row">
                    <span class="detail-label">Source</span>
                    <span class="detail-value">${source || category}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date</span>
                    <span class="detail-value">${dateStr}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Amount</span>
                    <span class="detail-value income-amount">+$${formatCurrency(parseFloat(amount) || 0)}</span>
                </div>
                ${category ? `
                <div class="detail-row">
                    <span class="detail-label">Category</span>
                    <span class="detail-value">${category}</span>
                </div>
                ` : ''}
                ${notes ? `
                <div class="detail-row">
                    <span class="detail-label">Notes</span>
                    <span class="detail-value notes-text">${notes}</span>
                </div>
                ` : ''}
                ${isAR ? `
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value ${record.collected ? 'collected' : 'pending'}">${record.collected ? 'Collected' : 'Pending'}</span>
                </div>
                ` : ''}
                ${recurringInfo}
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

// Function to collect/mark income as received (creates actual income record)
async function collectIncome(id, isRecurring = false, occurrenceDate) {
    let source, amount, category, notes, templateId;

    if (isRecurring) {
        // Extract numeric ID from possible "1_next" format
        const numericId = parseInt(id);
        const template = recurringIncomeTemplates.find(t => t.id === numericId);
        if (!template) return;
        source = template.source;
        amount = parseFloat(template.amount) || 0;
        category = template.category;
        notes = template.notes;
        templateId = numericId;
    } else {
        const record = records.find(r => r.id === id || r.id === parseInt(id));
        if (!record) return;
        source = record.projectedSource || record.item || record.category;
        amount = parseFloat(record.amount) || 0;
        category = record.category;
        notes = record.notes;
        templateId = null;
    }

    showIncomeCollectionCard({
        id,
        isRecurring,
        source,
        amount,
        category,
        notes,
        templateId,
        occurrenceDate
    });
}

function showIncomeCollectionCard(data) {
    currentIncomeCollection = data;

    // Update UI
    document.getElementById('income-expected-amount').textContent = `+$${formatCurrency(data.amount)}`;
    document.getElementById('income-collection-source').textContent = data.source;
    
    const receivedInput = document.getElementById('income-received-amount');
    receivedInput.value = '';
    receivedInput.placeholder = `Enter amount (expected $${data.amount.toFixed(2)})`;
    
    const sameAmountBtn = document.getElementById('income-receive-same-btn');
    if (sameAmountBtn) {
        sameAmountBtn.innerHTML = `<i class="fas fa-check"></i> Same Amount ($${formatCurrency(data.amount)})`;
    }

    // Show card and overlay
    const card = document.getElementById('income-collection-card');
    const overlay = document.getElementById('income-collection-overlay');
    card?.classList.add('active');
    overlay?.classList.add('active');

    // Focus input
    setTimeout(() => {
        receivedInput?.focus();
    }, 100);
}

function hideIncomeCollectionCard() {
    const card = document.getElementById('income-collection-card');
    const overlay = document.getElementById('income-collection-overlay');
    card?.classList.remove('active');
    overlay?.classList.remove('active');
    currentIncomeCollection = null;
}

async function processIncomeCollection() {
    if (!currentIncomeCollection) return;

    const receivedInput = document.getElementById('income-received-amount');
    const receivedAmount = parseFloat(receivedInput.value);

    if (isNaN(receivedAmount) || receivedAmount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    const { id, isRecurring, source, amount, category, notes, templateId } = currentIncomeCollection;
    const todayDate = formatDateLocal(new Date());

    try {
        if (isRecurring) {
            // Create an actual income record from template
            const incomeRecord = {
                formatType: 'single',
                type: 'income',
                date: todayDate,
                timestamp: Date.now(),
                item: '',
                category: category,
                person: '',
                amount: receivedAmount,
                quantity: '1',
                notes: notes ? `Received recurring income: ${source}. ${notes}` : `Received recurring income: ${source}`,
                isProjected: false,
                projectedSource: source,
                fromRecurringTemplate: templateId
            };

            await add(STORE_RECORDS, incomeRecord);
            
            // If amount changed, add a note about it
            if (Math.abs(receivedAmount - amount) > 0.01) {
                showToast(`Income recorded: $${receivedAmount.toFixed(2)} (Expected $${amount.toFixed(2)})`, 'success');
            } else {
                showToast('Income recorded successfully', 'success');
            }
        } else {
            // Convert regular projected record to actual
            const record = records.find(r => r.id === id);
            if (record) {
                const originalAmount = parseFloat(record.amount) || 0;
                record.amount = receivedAmount;
                record.isProjected = false;
                record.date = todayDate;
                record.timestamp = Date.now();
                
                // Add note if amount changed
                if (Math.abs(receivedAmount - originalAmount) > 0.01) {
                    const changeNote = `[Actual amount received: $${receivedAmount.toFixed(2)}, Expected: $${originalAmount.toFixed(2)}]`;
                    record.notes = record.notes ? `${record.notes}\n${changeNote}` : changeNote;
                }

                await updateRecord(STORE_RECORDS, record);
                showToast('Income recorded successfully', 'success');
            }
        }

        hideIncomeCollectionCard();
        await refreshData();
        renderBudget();
    } catch (error) {
        console.error('Error processing income collection:', error);
        showToast('Error recording income: ' + error.message, 'error');
    }
}

// Function to undo a received recurring income (deletes the recorded income record)
async function undoRecurringIncome(recordId) {
    if (await showConfirm('Undo this received income? The recorded income transaction will be deleted.')) {
        try {
            await remove(STORE_RECORDS, recordId);
            showToast('Income record removed', 'success');
            await refreshData();
            renderBudget();
            // Also re-render dashboard if visible
            if (document.getElementById('dashboard')?.classList.contains('active')) {
                renderDashboard();
            }
        } catch (error) {
            console.error('Error undoing recurring income:', error);
            showToast('Error undoing income: ' + error.message, 'error');
        }
    }
}
