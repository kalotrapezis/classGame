const os = require('os');
const interfaces = os.networkInterfaces();

console.log("=== Network Interfaces ===");
for (const name of Object.keys(interfaces)) {
    console.log(`\nInterface: ${name}`);
    for (const iface of interfaces[name]) {
        console.log(`  Family: ${iface.family}`);
        console.log(`  Address: ${iface.address}`);
        console.log(`  Internal: ${iface.internal}`);
        console.log(`  MAC: ${iface.mac}`);
    }
}
console.log("\n==========================");
