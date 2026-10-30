let peer = null;
let conn = null;
let mySymbol = null; // 'X' lub 'O'
let isMyTurn = false;
let gameState = ['', '', '', '', '', '', '', '', ''];
let gameActive = false;

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Poziomo
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Pionowo
    [0, 4, 8], [2, 4, 6]             // Przekątne
];

// Elementy DOM
const myIdInput = document.getElementById('my-id');
const copyBtn = document.getElementById('copy-btn');
const peerIdInput = document.getElementById('peer-id-input');
const connectBtn = document.getElementById('connect-btn');
const statusBar = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');
const playerSymbolEl = document.getElementById('player-symbol');
const turnTextEl = document.getElementById('turn-text');
const cells = document.querySelectorAll('.cell');
const restartBtn = document.getElementById('restart-btn');

// Inicjalizacja PeerJS
function initPeer() {
    peer = new Peer();

    peer.on('open', (id) => {
        myIdInput.value = id;
        copyBtn.disabled = false;
        
        // Auto-połączenie przez URL z parametrem ?peer=ID
        const urlParams = new URLSearchParams(window.location.search);
        const remotePeerId = urlParams.get('peer');
        if (remotePeerId) {
            peerIdInput.value = remotePeerId;
            connectToPeer(remotePeerId);
        }
    });

    // Obsługa przychodzącego połączenia (Host = 'X')
    peer.on('connection', (connection) => {
        if (conn) {
            connection.close(); // Odrzuć jeśli już połączono
            return;
        }
        conn = connection;
        mySymbol = 'X';
        isMyTurn = true;
        setupConnection();
    });

    peer.on('error', (err) => {
        showStatus('Błąd: ' + err.type, false);
    });
}

// Łączenie z innym Peerem (Klient = 'O')
connectBtn.addEventListener('click', () => {
    const remoteId = peerIdInput.value.trim();
    if (remoteId) {
        connectToPeer(remoteId);
    }
});

function connectToPeer(remoteId) {
    showStatus('Łączenie...', false);
    conn = peer.connect(remoteId);
    mySymbol = 'O';
    isMyTurn = false;
    setupConnection();
}

// Konfiguracja zdarzeń połączenia
function setupConnection() {
    conn.on('open', () => {
        showStatus('Połączono z gracza!', true);
        startGame();
    });

    conn.on('data', (data) => {
        handleIncomingData(data);
    });

    conn.on('close', () => {
        showStatus('Przeciwnik rozłączył się', false);
        resetGame(false);
        conn = null;
    });
}

function showStatus(text, isConnected) {
    statusText.textContent = text;
    if (isConnected) {
        statusBar.className = 'status-bar connected';
    } else {
        statusBar.className = 'status-bar disconnected';
    }
}

// Kopiowanie ID
copyBtn.addEventListener('click', () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?peer=${myIdInput.value}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        copyBtn.textContent = 'Skopiowano Link!';
        setTimeout(() => copyBtn.textContent = 'Kopiuj ID', 2000);
    });
});

// Logika Gry
function startGame() {
    gameActive = true;
    gameState = ['', '', '', '', '', '', '', '', ''];
    playerSymbolEl.textContent = mySymbol;
    updateTurnUI();
    
    cells.forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell';
    });
    
    restartBtn.disabled = true;
}

function updateTurnUI() {
    if (!gameActive) return;
    if (isMyTurn) {
        turnTextEl.textContent = 'Twoja tura!';
        turnTextEl.style.color = 'var(--accent)';
    } else {
        turnTextEl.textContent = 'Ruch przeciwnika...';
        turnTextEl.style.color = 'var(--text-muted)';
    }
}

cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const index = cell.getAttribute('data-index');

        if (gameState[index] !== '' || !isMyTurn || !gameActive) return;

        makeMove(index, mySymbol);
        
        // Wyślij ruch do przeciwnika
        if (conn && conn.open) {
            conn.send({
                type: 'MOVE',
                index: index,
                symbol: mySymbol
            });
        }

        isMyTurn = false;
        updateTurnUI();
        checkResult();
    });
});

function makeMove(index, symbol) {
    gameState[index] = symbol;
    const cell = cells[index];
    cell.textContent = symbol;
    cell.classList.add(symbol.toLowerCase());
}

function handleIncomingData(data) {
    if (data.type === 'MOVE') {
        makeMove(data.index, data.symbol);
        isMyTurn = true;
        updateTurnUI();
        checkResult();
    } else if (data.type === 'RESTART') {
        startGame();
    }
}

function checkResult() {
    let roundWon = false;
    let winningCombo = [];

    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {
            roundWon = true;
            winningCombo = [a, b, c];
            break;
        }
    }

    if (roundWon) {
        gameActive = false;
        winningCombo.forEach(idx => cells[idx].classList.add('winner'));
        
        const winnerSymbol = gameState[winningCombo[0]];
        if (winnerSymbol === mySymbol) {
            turnTextEl.textContent = 'Wygrałeś! 🎉';
            turnTextEl.style.color = 'var(--success)';
        } else {
            turnTextEl.textContent = 'Przegrałeś! 😞';
            turnTextEl.style.color = 'var(--danger)';
        }
        
        restartBtn.disabled = false;
        return;
    }

    // Remis
    if (!gameState.includes('')) {
        gameActive = false;
        turnTextEl.textContent = 'Remis! 🤝';
        turnTextEl.style.color = 'var(--text-main)';
        restartBtn.disabled = false;
    }
}

// Reset gry
restartBtn.addEventListener('click', () => {
    if (conn && conn.open) {
        conn.send({ type: 'RESTART' });
    }
    startGame();
});

// Uruchomienie aplikacji
initPeer();