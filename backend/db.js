const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

const defaultData = { companies: [], users: [], attendance: [] };

function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Generate simple unique ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

module.exports = { readDb, writeDb, generateId };
