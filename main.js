const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

const isDev = process.env.NODE_ENV === 'development';

// Get local IP address
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
};

let mainWindow;
let role = 'user'; // default role

// Parse command line args for role
const args = process.argv.slice(1);
args.forEach(arg => {
  if (arg.startsWith('--role=')) {
    role = arg.split('=')[1];
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (role === 'admin') {
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'admin.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'user.html'));
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  if (role === 'admin') {
    // Start backend server only on admin
    const express = require('express');
    const http = require('http');
    const { Server } = require('socket.io');
    const sqlite3 = require('sqlite3').verbose();
    const expressApp = express();
    const server = http.createServer(expressApp);
    const io = new Server(server);

    const db = new sqlite3.Database(path.join(__dirname, 'db', 'database.sqlite'), (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Connected to SQLite database');
        // Initialize DB tables here or import from backend/server.js
      }
    });

    const PORT = 8000;
    server.listen(PORT, () => {
      console.log(`Server running on http://${getLocalIP()}:${PORT}`);
    });

    io.on('connection', (socket) => {
      console.log('Client connected');
      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('get-local-ip', () => {
  return getLocalIP();
});
