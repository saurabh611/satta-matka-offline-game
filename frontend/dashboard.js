// Socket.io connection
const socket = io();

// Game state
let currentUser = null;
let gameState = null;
let resultMode = 'manual';
let timerInterval = null;

// DOM Elements
const authSection = document.getElementById('auth-section');
const gameInterface = document.getElementById('game-interface');
const adminPanel = document.getElementById('admin-panel');
const walletBalance = document.getElementById('wallet-balance');
const currentPhase = document.getElementById('current-phase');
const timeRemaining = document.getElementById('time-remaining');
const lastResult = document.getElementById('last-result');
const connectedUsers = document.getElementById('connected-users');
const resultsHistory = document.getElementById('results-history');
const resultModal = document.getElementById('result-modal');
const resultDisplay = document.getElementById('result-display');
const walletModal = document.getElementById('wallet-modal');
const walletUserSelect = document.getElementById('wallet-user');

// Authentication
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    socket.emit('auth', { username, password });
}

async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Registration successful! Please login.');
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Registration failed: ' + err.message);
    }
}

function logout() {
    currentUser = null;
    socket.disconnect();
    showAuthSection();
}

function showAuthSection() {
    authSection.classList.remove('hidden');
    gameInterface.classList.add('hidden');
}

function showGameInterface() {
    authSection.classList.add('hidden');
    gameInterface.classList.remove('hidden');
}

// Game Controls
function startGame() {
    socket.emit('start_game');
}

function stopGame() {
    socket.emit('stop_game');
}

function setResultMode(mode) {
    resultMode = mode;
    if (mode === 'auto') {
        // In auto mode, results will be generated automatically
        socket.emit('set_auto_result', true);
    }
}

// Betting
function placeBet() {
    const betType = document.getElementById('bet-type').value;
    const number = document.getElementById('bet-number').value;
    const amount = parseFloat(document.getElementById('bet-amount').value);
    
    if (!number || !amount) {
        alert('Please enter both number and amount');
        return;
    }
    
    socket.emit('place_bet', { betType, number, amount });
}

// Wallet Management
function showWalletManagement() {
    updateWalletUserList();
    walletModal.classList.remove('hidden');
}

function closeWalletModal() {
    walletModal.classList.add('hidden');
}

function updateWallet(type) {
    const userId = walletUserSelect.value;
    const amount = parseFloat(document.getElementById('wallet-amount').value);
    
    if (!userId || !amount) {
        alert('Please select user and enter amount');
        return;
    }
    
    socket.emit('update_wallet', { userId, amount, type });
}

function updateWalletUserList() {
    // Clear existing options
    walletUserSelect.innerHTML = '';
    
    // Add connected users to select
    const users = Array.from(connectedUsers.children);
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.dataset.userId;
        option.textContent = user.textContent;
        walletUserSelect.appendChild(option);
    });
}

// Result Display
function showResult(result) {
    resultDisplay.textContent = result;
    resultModal.classList.remove('hidden');
}

function closeResultModal() {
    resultModal.classList.add('hidden');
}

// Timer Display
function updateTimer(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    timeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Socket Event Handlers
socket.on('auth_success', (user) => {
    currentUser = user;
    showGameInterface();
    
    if (user.role === 'admin') {
        adminPanel.classList.remove('hidden');
    }
});

socket.on('auth_error', (data) => {
    alert(data.message);
});

socket.on('game_state', (state) => {
    gameState = state;
    currentPhase.textContent = state.phase;
    updateTimer(state.timeRemaining);
});

socket.on('user_list', (users) => {
    connectedUsers.innerHTML = users.map(user => 
        `<div data-user-id="${user.id}" class="p-2 hover:bg-gray-100 rounded">
            ${user.username} (${user.role})
        </div>`
    ).join('');
});

socket.on('wallet_updated', (data) => {
    if (data.userId === currentUser.id) {
        walletBalance.textContent = `₹${data.amount}`;
    }
});

socket.on('bet_placed', (data) => {
    if (data.success) {
        alert('Bet placed successfully!');
        document.getElementById('bet-number').value = '';
        document.getElementById('bet-amount').value = '';
    }
});

socket.on('bet_error', (data) => {
    alert(data.message);
});

socket.on('result_updated', (data) => {
    const result = `${data.openPanna} - ${data.jodi} - ${data.closePanna}`;
    lastResult.textContent = result;
    showResult(result);
    
    // Update results history
    const resultDiv = document.createElement('div');
    resultDiv.className = 'p-2 bg-gray-50 rounded';
    resultDiv.textContent = result;
    resultsHistory.insertBefore(resultDiv, resultsHistory.firstChild);
    
    // Keep only last 5 results
    while (resultsHistory.children.length > 5) {
        resultsHistory.removeChild(resultsHistory.lastChild);
    }
});

// Initialize
window.onload = () => {
    // Load latest results
    fetch('/api/results/latest')
        .then(res => res.json())
        .then(results => {
            resultsHistory.innerHTML = results.map(result => 
                `<div class="p-2 bg-gray-50 rounded">
                    ${result.open_result} - ${result.jodi_result} - ${result.close_result}
                </div>`
            ).join('');
        })
        .catch(console.error);
    
    // Start game state updates
    setInterval(() => {
        if (currentUser) {
            socket.emit('get_game_state');
        }
    }, 1000);
};
