const DB_NAME = 'HouseSpendingDB';
const DB_VERSION = 7; // bumped to support recurring income templates
const STORE_RECORDS = 'records';
const STORE_CATEGORIES = 'categories';
const STORE_PEOPLE = 'people';

// new stores for savings feature
const STORE_SAVINGS_ACCOUNTS = 'savingsAccounts';
const STORE_SAVINGS_TRANSACTIONS = 'savingsTransactions';

// new store for budget limits
const STORE_BUDGET_LIMITS = 'budgetLimits';

// new store for monthly balance carry-over settings
const STORE_MONTHLY_BALANCE_SETTINGS = 'monthlyBalanceSettings';

// new store for recurring income templates
const STORE_RECURRING_INCOME = 'recurringIncome';

let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const oldVersion = event.oldVersion;
            const newVersion = event.newVersion;
            console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

            // Migration handler - ensures all stores exist for each version upgrade
            const ensureStore = (storeName) => {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                    console.log(`Created store: ${storeName}`);
                    return true;
                }
                return false;
            };

            // Version 1: Initial stores
            ensureStore(STORE_RECORDS);
            ensureStore(STORE_CATEGORIES);
            ensureStore(STORE_PEOPLE);

            // Version 2: Added savings stores
            ensureStore(STORE_SAVINGS_ACCOUNTS);
            ensureStore(STORE_SAVINGS_TRANSACTIONS);

            // Version 3: Added budget limits
            ensureStore(STORE_BUDGET_LIMITS);

            // Version 4-5: Reserved

            // Version 6: Added monthly balance settings
            ensureStore(STORE_MONTHLY_BALANCE_SETTINGS);

            // Version 7: Added recurring income
            ensureStore(STORE_RECURRING_INCOME);

            console.log('Database upgrade complete. Stores:', Array.from(db.objectStoreNames));
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            reject('IndexedDB error: ' + event.target.errorCode);
        };
    });
}

// Generic CRUD operations
async function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function add(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function updateRecord(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function remove(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function resetDB() {
    await clearStore(STORE_RECORDS);
    await clearStore(STORE_CATEGORIES);
    await clearStore(STORE_PEOPLE);
    await clearStore(STORE_SAVINGS_ACCOUNTS);
    await clearStore(STORE_SAVINGS_TRANSACTIONS);
    await clearStore(STORE_BUDGET_LIMITS);
    await clearStore(STORE_MONTHLY_BALANCE_SETTINGS);
    await clearStore(STORE_RECURRING_INCOME);
    await seedDefaultCategories();
}

// Monthly balance carry-over functions
async function getMonthlyBalanceSettings(year, month) {
    const settings = await getAll(STORE_MONTHLY_BALANCE_SETTINGS);
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    return settings.find(s => s.monthKey === monthKey);
}

async function setMonthlyBalanceCarryOver(year, month, carryOver, remainingBalance = 0) {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    const settings = await getAll(STORE_MONTHLY_BALANCE_SETTINGS);
    const existing = settings.find(s => s.monthKey === monthKey);
    
    const data = {
        monthKey,
        year,
        month,
        carryOver, // boolean: whether to carry over previous month's balance
        remainingBalance, // the balance amount to carry over (if carryOver is true)
        updatedAt: new Date().toISOString()
    };
    
    if (existing) {
        data.id = existing.id;
        await updateRecord(STORE_MONTHLY_BALANCE_SETTINGS, data);
    } else {
        await add(STORE_MONTHLY_BALANCE_SETTINGS, data);
    }
}

async function getPreviousMonthCarriedBalance(year, month) {
    // Get previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    
    const settings = await getAll(STORE_MONTHLY_BALANCE_SETTINGS);
    const monthKey = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
    const prevSetting = settings.find(s => s.monthKey === monthKey);
    
    // Only return balance if carryOver is enabled
    if (prevSetting && prevSetting.carryOver) {
        return prevSetting.remainingBalance || 0;
    }
    return 0;
}

async function clearRecordsByDateRange(startDate, endDate) {
    const records = await getAll(STORE_RECORDS);
    const toDelete = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= startDate && recordDate <= endDate;
    });
    
    for (const record of toDelete) {
        await remove(STORE_RECORDS, record.id);
    }
    return toDelete.length;
}

async function clearSavingsTransactionsByDateRange(startDate, endDate) {
    const transactions = await getAll(STORE_SAVINGS_TRANSACTIONS);
    const toDelete = transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= startDate && txDate <= endDate;
    });
    
    for (const tx of toDelete) {
        await remove(STORE_SAVINGS_TRANSACTIONS, tx.id);
    }
    return toDelete.length;
}

async function clearCurrentMonthData() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    let recordsDeleted = 0;
    let savingsDeleted = 0;
    
    recordsDeleted = await clearRecordsByDateRange(startOfMonth, endOfMonth);
    savingsDeleted = await clearSavingsTransactionsByDateRange(startOfMonth, endOfMonth);
    
    return { recordsDeleted, savingsDeleted };
}

async function selectiveReset(options) {
    const {
        resetType,
        startDate,
        endDate,
        resetRecords,
        resetSavings,
        resetCategories,
        resetPeople
    } = options;
    
    let recordsDeleted = 0;
    let savingsDeleted = 0;
    
    if (resetRecords) {
        if (resetType === 'all') {
            await clearStore(STORE_RECORDS);
            recordsDeleted = -1; // Indicates all records cleared
        } else if (resetType === 'month') {
            const result = await clearCurrentMonthData();
            recordsDeleted = result.recordsDeleted;
        } else if (resetType === 'period' && startDate && endDate) {
            recordsDeleted = await clearRecordsByDateRange(startDate, endDate);
        }
    }
    
    if (resetSavings) {
        if (resetType === 'all') {
            await clearStore(STORE_SAVINGS_ACCOUNTS);
            await clearStore(STORE_SAVINGS_TRANSACTIONS);
            savingsDeleted = -1; // Indicates all savings cleared
        } else if (resetType === 'month') {
            const result = await clearCurrentMonthData();
            savingsDeleted = result.savingsDeleted;
        } else if (resetType === 'period' && startDate && endDate) {
            savingsDeleted = await clearSavingsTransactionsByDateRange(startDate, endDate);
        }
    }
    
    if (resetCategories) {
        await clearStore(STORE_CATEGORIES);
        await seedDefaultCategories();
    }
    
    if (resetPeople) {
        await clearStore(STORE_PEOPLE);
    }
    
    return { recordsDeleted, savingsDeleted };
}

async function seedDefaultCategories() {
    const categories = await getAll(STORE_CATEGORIES);
    if (categories.length === 0) {
        const defaults = [
            { name: 'Rent/Mortgage', type: 'spending' },
            { name: 'Groceries', type: 'spending' },
            { name: 'Utilities', type: 'spending' },
            { name: 'Transport', type: 'spending' },
            { name: 'Entertainment', type: 'spending' },
            { name: 'Salary', type: 'income' },
            { name: 'Freelance', type: 'income' },
            { name: 'Investment', type: 'income' }
        ];
        for (const cat of defaults) {
            await add(STORE_CATEGORIES, cat);
        }
    }
}
