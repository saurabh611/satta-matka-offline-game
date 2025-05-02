const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '..', 'db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('Created db directory');
} else {
  console.log('db directory already exists');
}

const dbFile = path.join(dbDir, 'database.sqlite');

if (!fs.existsSync(dbFile)) {
  // Create empty file
  fs.writeFileSync(dbFile, '');
  console.log('Created database.sqlite file');
} else {
  console.log('database.sqlite file already exists');
}
