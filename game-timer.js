class GameTimer {
  constructor() {
    this.gameState = {
      currentSession: null,
      isRunning: false,
      openBettingStart: null,
      openBettingEnd: null,
      openResult: null,
      closeBettingStart: null,
      closeBettingEnd: null,
      closeResult: null
    };
    
    // Game cycle durations (in minutes)
    this.CYCLE_DURATION = 35;
    this.OPEN_BETTING_DURATION = 12;
    this.CLOSE_BETTING_DURATION = 16;
    this.RESULT_DELAY = 3;
  }

  startGameCycle() {
    if (this.gameState.isRunning) return;
    
    this.gameState.isRunning = true;
    this.gameState.currentSession = Date.now();
    
    // Set timings for current cycle
    const now = new Date();
    
    // Open betting phase
    this.gameState.openBettingStart = now;
    this.gameState.openBettingEnd = new Date(now.getTime() + this.OPEN_BETTING_DURATION * 60000);
    this.gameState.openResult = new Date(this.gameState.openBettingEnd.getTime() + this.RESULT_DELAY * 60000);
    
    // Close betting phase
    this.gameState.closeBettingStart = this.gameState.openResult;
    this.gameState.closeBettingEnd = new Date(this.gameState.closeBettingStart.getTime() + this.CLOSE_BETTING_DURATION * 60000);
    this.gameState.closeResult = new Date(this.gameState.closeBettingEnd.getTime() + this.RESULT_DELAY * 60000);
    
    return this.gameState;
  }

  stopGameCycle() {
    this.gameState.isRunning = false;
    return this.gameState;
  }

  getCurrentPhase() {
    if (!this.gameState.isRunning) return 'stopped';
    
    const now = new Date();
    
    if (now < this.gameState.openBettingEnd) {
      return 'open_betting';
    } else if (now < this.gameState.openResult) {
      return 'open_result_pending';
    } else if (now < this.gameState.closeBettingEnd) {
      return 'close_betting';
    } else if (now < this.gameState.closeResult) {
      return 'close_result_pending';
    } else {
      // Auto start next cycle
      this.startGameCycle();
      return 'new_cycle';
    }
  }

  getTimeRemaining() {
    const phase = this.getCurrentPhase();
    const now = new Date();
    let target;
    
    switch (phase) {
      case 'open_betting':
        target = this.gameState.openBettingEnd;
        break;
      case 'open_result_pending':
        target = this.gameState.openResult;
        break;
      case 'close_betting':
        target = this.gameState.closeBettingEnd;
        break;
      case 'close_result_pending':
        target = this.gameState.closeResult;
        break;
      default:
        return 0;
    }
    
    return Math.max(0, target - now);
  }

  shouldAutoReset() {
    const now = new Date();
    return now.getHours() >= 22; // Auto reset after 10 PM
  }
}

module.exports = GameTimer;
