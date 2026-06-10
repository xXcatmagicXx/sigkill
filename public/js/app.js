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
    
    // --- 1. Calculate Dynamic Thread Generation ---
    let threadRate = "+2";
    let rateColor = "#00ff41";
    if (me.statuses.includes('Overclocked')) { threadRate = "+6"; }
    else if (me.statuses.includes('Congested')) { threadRate = "+1"; rateColor = "#ff3333"; }
    
    if (me.statuses.includes('Mining')) {
        let currentInt = parseInt(threadRate.replace('+', ''));
        threadRate = "+" + (currentInt + 1);
    }

    const threadPct = (me.threads / me.maxThreads) * 100;
    const cpuBar = document.getElementById('my-cpu');
    if (cpuBar) {
        cpuBar.style.width = `${threadPct}%`;
        cpuBar.innerHTML = `THREADS: ${me.threads}/${me.maxThreads} <span style="color: ${rateColor}; font-size: 0.8rem; margin-left: 5px;">(${threadRate}/turn)</span>`;
    }

    // --- 2. Dynamic UI Thread Costs & Disable Logic ---
    const moveCosts = {
        'syn_flood': 1, 'sql_inject': 3, 'ransomware': 5, 'ddos': 'ALL', 'rm_rf': 8,
        'packet_sniff': 1, 'honeypot': 3, 'firewall': 2, 'ip_spoof': 3, 'kill_process': 4,
        'overclock': 0, 'flush_dns': 1, 'restore_backup': 3, 'crypto_miner': 3, 'zero_day': 4
    };
    const setupMoves = ['overclock', 'flush_dns', 'restore_backup', 'crypto_miner', 'zero_day'];

    if (myRole !== 'spectator') {
        document.querySelectorAll('.action-btn').forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick');
            if (!onclickAttr) return;
            const moveMatch = onclickAttr.match(/'([^']+)'/);
            if (!moveMatch) return;
            const moveId = moveMatch[1];
            
            let currentCost = moveCosts[moveId];
            let isEncrypted = me.statuses.includes('Encrypted') && setupMoves.includes(moveId);
            
            const costSpan = btn.querySelector('.btn-cost');
            if (isEncrypted && typeof currentCost === 'number' && currentCost > 0) {
                let numCost = currentCost * 2;
                costSpan.innerText = `COST: ${numCost} THREADS`;
                costSpan.style.color = '#ff3333';
                btn.disabled = (me.threads < numCost);
            } else {
                costSpan.innerText = `Cost: ${currentCost} ${currentCost === 1 ? 'Thread' : 'Threads'}`;
                costSpan.style.color = ''; 
                if (currentCost === 'ALL') {
                    btn.disabled = (me.threads === 0);
                } else {
                    btn.disabled = (me.threads < currentCost);
                }
            }
        });
    }

    // --- 3. Render Status Effects & Tooltips ---
    const generateStatusHTML = (statuses, firewallTurns) => {
        let html = '';
        statuses.forEach(s => {
            let desc = ""; let bg = "error-bg";
            if (s === 'Encrypted') { desc = "Setup & Recovery costs doubled."; }
            else if (s === 'Congested') { desc = "Thread regen reduced."; }
            else if (s === 'Traced') { desc = "Next attack takes +50% DMG."; }
            else if (s === 'Overclocked') { desc = "Regen 4 Threads AND gain +1 Max Thread."; bg = "defense-bg"; }
            else if (s === 'Mining') { desc = "+1 Passive Thread regen."; bg = "defense-bg"; }
            else if (s === 'Weaponized') { desc = "Next attack ignores defenses & destroys 2 Max Threads."; bg = "defense-bg"; }
            html += `<div class="status-badge ${bg}">${s}<span class="tooltip-text">${desc}</span></div>`;
        });
        if (firewallTurns > 0) {
            html += `<div class="status-badge defense-bg">Firewall (${firewallTurns}T)<span class="tooltip-text">Blocks 100% of the next attack, then shatters.</span></div>`;
        }
        return html;
    };

    const myStatusDiv = document.getElementById('my-statuses');
    if (myStatusDiv) myStatusDiv.innerHTML = generateStatusHTML(me.statuses, me.firewallTurns);
    
    const oppStatusDiv = document.getElementById('opp-statuses');
    if (oppStatusDiv) oppStatusDiv.innerHTML = generateStatusHTML(opp.statuses, opp.firewallTurns);
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