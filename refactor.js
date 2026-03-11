const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Replace alerts
code = code.replace(/alert\(([^)]+)\)/g, (match, p1) => {
    let type = 'info';
    let p1L = p1.toLowerCase();
    if (p1L.includes('error') || p1L.includes('failed')) type = 'error';
    else if (p1L.includes('please') || p1L.includes('invalid')) type = 'warning';
    else if (p1L.includes('success') || p1L.includes('complete')) type = 'success';
    
    if (type === 'info') return `showToast(${p1})`;
    return `showToast(${p1}, '${type}')`;
});

// Replace confirms (only the ones not yet replaced)
code = code.replace(/if\s*\(\!confirm\(([^)]+)\)\)/g, 'if (!(await showConfirm($1)))');
code = code.replace(/if\s*\(confirm\(([^)]+)\)\)/g, 'if (await showConfirm($1))');

fs.writeFileSync('app.js', code);
console.log('Refactoring complete');
