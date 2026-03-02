const DB_NAME = 'HouseSpendingDB';
const DB_VERSION = 3; // bumped to support savings stores
const STORE_RECORDS = 'records';
const STORE_CATEGORIES = 'categories';
const STORE_PEOPLE = 'people';

// new stores for savings feature
const STORE_SAVINGS_ACCOUNTS = 'savingsAccounts';
const STORE_SAVINGS_TRANSACTIONS = 'savingsTransactions';

let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_RECORDS)) {
                db.createObjectStore(STORE_RECORDS, { keyPath: 'id', autoIncrement: true });
            }
            
            if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
                db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id', autoIncrement: true });
            }

            if (!db.objectStoreNames.contains(STORE_PEOPLE)) {
                db.createObjectStore(STORE_PEOPLE, { keyPath: 'id', autoIncrement: true });
            }

            // create savings stores if upgrading
            if (!db.objectStoreNames.contains(STORE_SAVINGS_ACCOUNTS)) {
                db.createObjectStore(STORE_SAVINGS_ACCOUNTS, { keyPath: 'id', autoIncrement: true });
            }

            if (!db.objectStoreNames.contains(STORE_SAVINGS_TRANSACTIONS)) {
                db.createObjectStore(STORE_SAVINGS_TRANSACTIONS, { keyPath: 'id', autoIncrement: true });
            }
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
    await seedDefaultCategories();
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
