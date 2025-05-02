const { PannaLogic } = require('../panna-logic');
const GameTimer = require('../game-timer');

class SocketHandler {
  constructor(io, db) {
    this.io = io;
    this.db = db;
    this.gameTimer = new GameTimer();
    this.connectedUsers = new Map();
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Authentication
      socket.on('auth', async (data) => {
        try {
          const { username, password } = data;
          const user = await this.authenticateUser(username, password);
          if (user) {
            this.connectedUsers.set(socket.id, user);
            socket.emit('auth_success', {
              id: user.id,
              username: user.username,
              role: user.role
            });
            this.broadcastUserList();
          } else {
            socket.emit('auth_error', { message: 'Invalid credentials' });
          }
        } catch (err) {
          socket.emit('auth_error', { message: err.message });
        }
      });

      // Admin: Start Game
      socket.on('start_game', async () => {
        const user = this.connectedUsers.get(socket.id);
        if (user?.role === 'admin') {
          const gameState = this.gameTimer.startGameCycle();
          this.io.emit('game_started', gameState);
          await this.createGameSession(gameState);
        }
      });

      // Admin: Stop Game
      socket.on('stop_game', () => {
        const user = this.connectedUsers.get(socket.id);
        if (user?.role === 'admin') {
          const gameState = this.gameTimer.stopGameCycle();
          this.io.emit('game_stopped', gameState);
        }
      });

      // Admin: Set Result
      socket.on('set_result', async (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (user?.role === 'admin') {
          const { sessionId, openPanna, closePanna } = data;
          const jodi = PannaLogic.getJodiFromPannas(openPanna, closePanna);
          await this.updateGameResult(sessionId, openPanna, jodi, closePanna);
          await this.processWinningBets(sessionId);
          this.io.emit('result_updated', { sessionId, openPanna, jodi, closePanna });
        }
      });

      // Place Bet
      socket.on('place_bet', async (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (!user) return;

        try {
          const { betType, number, amount } = data;
          const currentPhase = this.gameTimer.getCurrentPhase();
          
          if (!['open_betting', 'close_betting'].includes(currentPhase)) {
            throw new Error('Betting is currently closed');
          }

          await this.placeBet(user.id, betType, number, amount, currentPhase);
          socket.emit('bet_placed', { success: true });
          this.broadcastGameState();
        } catch (err) {
          socket.emit('bet_error', { message: err.message });
        }
      });

      // Admin: Wallet Management
      socket.on('update_wallet', async (data) => {
        const admin = this.connectedUsers.get(socket.id);
        if (admin?.role !== 'admin') return;

        const { userId, amount, type } = data;
        try {
          await this.updateUserWallet(userId, amount, type);
          this.io.emit('wallet_updated', { userId, amount, type });
        } catch (err) {
          socket.emit('wallet_error', { message: err.message });
        }
      });

      // Get Game State
      socket.on('get_game_state', () => {
        const gameState = {
          ...this.gameTimer.gameState,
          phase: this.gameTimer.getCurrentPhase(),
          timeRemaining: this.gameTimer.getTimeRemaining()
        };
        socket.emit('game_state', gameState);
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        this.connectedUsers.delete(socket.id);
        this.broadcastUserList();
      });
    });
  }

  // Database Operations
  async authenticateUser(username, password) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, username, role FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });
  }

  async createGameSession(gameState) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO game_sessions (start_time, end_time, status) VALUES (?, ?, ?)',
        [gameState.openBettingStart, gameState.closeResult, 'running'],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });
  }

  async updateGameResult(sessionId, openPanna, jodi, closePanna) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE game_sessions SET open_result = ?, jodi_result = ?, close_result = ? WHERE id = ?',
        [openPanna, jodi, closePanna, sessionId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  }

  async placeBet(userId, betType, number, amount, phase) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Check wallet balance
        this.db.get(
          'SELECT balance FROM wallets WHERE user_id = ?',
          [userId],
          (err, row) => {
            if (err) {
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }

            if (!row || row.balance < amount) {
              this.db.run('ROLLBACK');
              reject(new Error('Insufficient balance'));
              return;
            }

            // Deduct amount from wallet
            this.db.run(
              'UPDATE wallets SET balance = balance - ? WHERE user_id = ?',
              [amount, userId],
              (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                // Place bet
                this.db.run(
                  'INSERT INTO bets (user_id, bet_type, number, amount, status) VALUES (?, ?, ?, ?, ?)',
                  [userId, betType, number, amount, 'pending'],
                  (err) => {
                    if (err) {
                      this.db.run('ROLLBACK');
                      reject(err);
                      return;
                    }

                    this.db.run('COMMIT');
                    resolve();
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  async updateUserWallet(userId, amount, type) {
    const operation = type === 'add' ? '+' : '-';
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE wallets SET balance = balance ${operation} ? WHERE user_id = ?`,
        [amount, userId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  }

  async processWinningBets(sessionId) {
    // Implementation for processing winning bets and updating wallets
    // This would involve checking bet numbers against results and applying payout multipliers
  }

  // Broadcasting Methods
  broadcastUserList() {
    const users = Array.from(this.connectedUsers.values()).map(u => ({
      id: u.id,
      username: u.username,
      role: u.role
    }));
    this.io.emit('user_list', users);
  }

  broadcastGameState() {
    const gameState = {
      ...this.gameTimer.gameState,
      phase: this.gameTimer.getCurrentPhase(),
      timeRemaining: this.gameTimer.getTimeRemaining()
    };
    this.io.emit('game_state', gameState);
  }
}

module.exports = SocketHandler;
