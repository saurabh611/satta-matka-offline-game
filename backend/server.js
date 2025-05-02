const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const SocketHandler = require('./socket-handler');
const os = require('os');

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

class GameServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupDatabase();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupDatabase() {
    const dbPath = path.join(__dirname, '..', 'db', 'database.sqlite');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Connected to SQLite database');
        this.initializeDatabase();
      }
    });
  }

  initializeDatabase() {
    this.db.serialize(() => {
      // Users table
      this.db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Create default admin user if not exists
      this.db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (err) {
          console.error('Error checking admin user:', err);
          return;
        }
        
        if (!row) {
          this.db.run(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            ['admin', 'admin123', 'admin'],
            (err) => {
              if (err) {
                console.error('Error creating admin user:', err);
              } else {
                console.log('Default admin user created');
              }
            }
          );
        }
      });

      // Wallets table
      this.db.run(`CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        balance DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);

      // Bets table
      this.db.run(`CREATE TABLE IF NOT EXISTS bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        game_session_id INTEGER,
        bet_type TEXT,
        number TEXT,
        amount DECIMAL(10,2),
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(game_session_id) REFERENCES game_sessions(id)
      )`);

      // Game sessions table
      this.db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time DATETIME,
        end_time DATETIME,
        open_result TEXT,
        jodi_result TEXT,
        close_result TEXT,
        status TEXT DEFAULT 'running',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    });
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '..', 'frontend')));
  }

  setupRoutes() {
    // API Routes
    this.app.post('/api/register', async (req, res) => {
      const { username, password } = req.body;
      
      try {
        await this.createUser(username, password);
        res.json({ success: true });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });

    this.app.get('/api/results/latest', async (req, res) => {
      try {
        const results = await this.getLatestResults();
        res.json(results);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Serve static files from frontend directory
    this.app.use(express.static(path.join(__dirname, '..', 'frontend')));

    // Serve index.html for all other routes
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    });
  }

  // Database operations
  createUser(username, password) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Create user
        this.db.run(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [username, password, 'user'],
          function(err) {
            if (err) {
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }

            const userId = this.lastID;

            // Create wallet for user
            this.db.run(
              'INSERT INTO wallets (user_id, balance) VALUES (?, ?)',
              [userId, 0],
              (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                this.db.run('COMMIT');
                resolve(userId);
              }
            );
          }
        );
      });
    });
  }

  getLatestResults(limit = 5) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM game_sessions 
         WHERE status = 'completed' 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });
  }

  start(port) {
    // Initialize socket handler
    this.socketHandler = new SocketHandler(this.io, this.db);

    // Start server
    this.server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}

module.exports = GameServer;

// Create and start server instance if this file is run directly
if (require.main === module) {
    const server = new GameServer();
    const PORT = 8000;
    server.start(PORT);
    console.log(`Server running at http://${getLocalIP()}:${PORT}`);
}
