const socket = io();
let myRole = 'spectator';
let pendingMove = null;
let isLockedIn = false;
let myRoom = null;

// ==========================================
// 1. LOBBY & AUTHENTICATION
// ==========================================

window.joinLobby = function() {
    const nickname = document.getElementById('nickname-input').value.trim();
    const roomCode = document.getElementById('room-input').value.trim();
    
    if (!nickname || !roomCode) {
        document.getElementById('login-error').innerText = "[ERROR] Missing credentials.";
        document.getElementById('login-error').classList.remove('hidden');
        return;
    }

    // Send credentials to server
    socket.emit('joinRoom', { nickname, roomCode });
}

socket.on('roomJoined', (data) => {
    myRole = data.role;
    myRoom = data.roomCode;
    
    // 1. Grab the Blast Door and slam it down
    const wipe = document.getElementById('page-transition');
    wipe.classList.add('active');
    
    // 2. Wait 500ms for the door to cover the screen
    setTimeout(() => {
        // Hide login, show game (happens invisibly behind the door)
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        
        // Initial UI render
        updateUI(data.state);
        
        // 3. Lift the door back up 300ms later to reveal the dashboard
        setTimeout(() => {
            wipe.classList.remove('active');
        }, 300);
        
    }, 500); 
});

socket.on('roomError', (msg) => {
    document.getElementById('login-error').innerText = `[ERROR] ${msg}`;
    document.getElementById('login-error').classList.remove('hidden');
});

// ==========================================
// 2. COMBAT MECHANICS (YOMI STYLE)
// ==========================================

window.selectMove = function(moveId) {
    if (isLockedIn || myRole === 'spectator') return;
    pendingMove = moveId;
    document.getElementById('selected-move').innerText = moveId.toUpperCase();
}

window.lockIn = function() {
    if (!pendingMove || isLockedIn) return;
    isLockedIn = true;
    
    const btn = document.getElementById('lock-btn');
    btn.innerText = "AWAITING OPPONENT...";
    btn.classList.add('locked');
    
    // Include the room code so the server knows where to apply the move
    socket.emit('lockIn', { actionId: pendingMove, roomCode: myRoom });
}

// ==========================================
// 3. SERVER STATE SYNCHRONIZATION
// ==========================================

socket.on('stateUpdate', (state) => {
    updateUI(state);
    
    // Reset Lock-in state for the new turn after a clash
    isLockedIn = false;
    pendingMove = null;
    document.getElementById('selected-move').innerText = 'NONE';
    
    const btn = document.getElementById('lock-btn');
    btn.innerText = "LOCK IN PAYLOAD";
    btn.classList.remove('locked');
});

socket.on('moveRejected', () => {
    isLockedIn = false; // Free the client logic
    pendingMove = null; // Clear the invalid move
    
    // Reset the UI Selection
    document.getElementById('selected-move').innerText = 'NONE';
    
    // Unlock the button and return it to its original state
    const btn = document.getElementById('lock-btn');
    btn.innerText = "LOCK IN PAYLOAD";
    btn.classList.remove('locked');
});

// Stream real-time events to logging container with colors
socket.on('terminalLog', (logArray) => {
    const stream = document.getElementById('log-stream');
    
    logArray.forEach(log => {
        const entry = document.createElement('div');
        entry.innerText = log.text;
        
        // Apply the exact CSS class based on the move type
        if (log.type) {
            entry.classList.add(`text-${log.type}`);
        }
        
        stream.appendChild(entry);
    });
    
    stream.scrollTop = stream.scrollHeight; // Auto-scroll to bottom
});

function updateUI(state) {
    document.getElementById('turn-num').innerText = state.turn;
    
    const me = state.players[myRole === 'p2' ? 'p2' : 'p1']; 
    const opp = state.players[myRole === 'p2' ? 'p1' : 'p2'];

    // Update Display Names
    document.getElementById('my-role').innerText = me.name || myRole.toUpperCase();
    document.querySelector('.player-stats.right h2').innerText = opp.name || 'AWAITING OPPONENT...';

    // Update HP Bars
    document.getElementById('my-hp').style.width = `${me.hp}%`;
    document.getElementById('my-hp').innerText = `${me.hp}%`;
    document.getElementById('opp-hp').style.width = `${opp.hp}%`;
    document.getElementById('opp-hp').innerText = `${opp.hp}%`;
    
    // Update Resource Bar (Now using Threads)
    const threadPct = (me.threads / me.maxThreads) * 100;
    const cpuBar = document.getElementById('my-cpu');
    if (cpuBar) {
        cpuBar.style.width = `${threadPct}%`;
        cpuBar.innerText = `THREADS: ${me.threads}/${me.maxThreads}`;
    }

    // Render Status Effects
    const myStatusDiv = document.getElementById('my-statuses');
    if (myStatusDiv) {
        myStatusDiv.innerHTML = me.statuses.map(s => `<span class="status-badge">${s}</span>`).join('');
    }
    const oppStatusDiv = document.getElementById('opp-statuses');
    if (oppStatusDiv) {
        oppStatusDiv.innerHTML = opp.statuses.map(s => `<span class="status-badge">${s}</span>`).join('');
    }
}

// Game Over Logic
// Game Over Logic - The SIGKILL Sequence
socket.on('gameOver', (data) => {
    isLockedIn = true; 
    const { resultMsg, fatalityTarget } = data; // Unpack the server data
    
    // Disable the lock-in button immediately
    const btn = document.getElementById('lock-btn');
    btn.innerText = "PROCESS TERMINATED";
    btn.style.backgroundColor = "#ff2a2a";
    btn.style.color = "#000";
    btn.style.borderColor = "#ff2a2a";
    btn.style.cursor = "not-allowed";

    const stream = document.getElementById('log-stream');
    
    // Lowered initial pause to 150ms to prevent browser throttling on inactive tabs
    setTimeout(() => {
        const cmd = document.createElement('div');
        cmd.className = 'sigkill-text';
        // NEW: Dynamically insert the loser's name into the terminal command!
        cmd.innerText = `> sudo kill -9 $(pidof ${fatalityTarget}_kernel)`;
        stream.appendChild(cmd);
        stream.scrollTop = stream.scrollHeight;

        setTimeout(() => {
            const endBlock = document.createElement('div');
            endBlock.className = 'glitch-block';
            
            if (resultMsg.includes("DRAW")) {
                endBlock.innerText = `[ KERNEL PANIC ]\n${resultMsg}`;
            } else {
                endBlock.innerText = `[ ROOT PRIVILEGES GRANTED ]\n${resultMsg}`;
            }
            
            stream.appendChild(endBlock);
            stream.scrollTop = stream.scrollHeight;
        }, 800); 

    }, 150); 
});