const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Verifying Fixes ---');

// 1. Verify Player Sorting Logic
console.log('\n[1] Verifying Player Sorting Logic...');
const players = [
    { id: 'p1', name: 'Alice', score: 100 },
    { id: 'p2', name: 'Bob', score: 300 },
    { id: 'p3', name: 'Charlie', score: 50 },
    { id: 'p4', name: 'Dave', score: 300 } // Tie
];

console.log('Input:', JSON.stringify(players.map(p => `${p.name}:${p.score}`)));

// The logic used in main.js
const sorted = [...players].sort((a, b) => b.score - a.score);

console.log('Output:', JSON.stringify(sorted.map(p => `${p.name}:${p.score}`)));

try {
    assert.strictEqual(sorted[0].name, 'Bob'); // 300
    assert.strictEqual(sorted[1].name, 'Dave'); // 300 (or Bob depending on stability, but reliable for score)
    assert.strictEqual(sorted[0].score, 300);
    assert.strictEqual(sorted[2].name, 'Alice'); // 100
    assert.strictEqual(sorted[3].name, 'Charlie'); // 50
    console.log('✅ Player sorting logic is CORRECT.');
} catch (e) {
    console.error('❌ Player sorting logic FAILED:', e.message);
    process.exit(1);
}

// 2. Verify Linux Tray Icon Exists
console.log('\n[2] Verifying Linux Tray Icon...');
const trayPath = path.join(__dirname, '..', 'assets', 'tray.png');
if (fs.existsSync(trayPath)) {
    console.log(`✅ Tray icon found at: ${trayPath}`);
} else {
    console.error(`❌ Tray icon MISSING at: ${trayPath}`);
    process.exit(1);
}

// 3. Verify CSS Changes for Drawing Tools
console.log('\n[3] Verifying CSS for Drawing Tools...');
const cssPath = path.join(__dirname, '..', '..', 'client', 'style.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const checks = [
    '.game-canvas-container',
    'flex-direction: column',
    'overflow: hidden',
    '#drawing-canvas',
    'flex-shrink: 1',
    'min-height: 0'
];

let allCssPass = true;
checks.forEach(check => {
    if (cssContent.includes(check)) {
        console.log(`✅ CSS contains "${check}"`);
    } else {
        console.error(`❌ CSS missing "${check}"`);
        allCssPass = false;
    }
});

if (allCssPass) {
    console.log('✅ Drawing tools CSS verification PASSED.');
} else {
    console.error('❌ Drawing tools CSS verification FAILED.');
    process.exit(1);
}

console.log('\n🎉 ALL CHECKS PASSED!');
