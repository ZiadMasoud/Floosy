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
