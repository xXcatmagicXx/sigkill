const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/html/index.html'));
});

const rooms = {};

function createInitialState() {
    return {
        turn: 1,
        players: {
            p1: { id: null, name: null, hp: 100, threads: 4, maxThreads: 10, action: null, statuses: [] },
            p2: { id: null, name: null, hp: 100, threads: 4, maxThreads: 10, action: null, statuses: [] }
        }
    };
}

const moveSet = {
    'syn_flood': { type: 'aggression', cost: 1, dmg: 5, name: 'SYN Flood' },
    'sql_inject': { type: 'aggression', cost: 3, dmg: 20, name: 'SQL Injection' },
    'ransomware': { type: 'aggression', cost: 5, dmg: 15, name: 'Ransomware' },
    'ddos': { type: 'aggression', cost: 0, dmg: 0, name: 'DDoS Botnet' },
    'rm_rf': { type: 'aggression', cost: 7, dmg: 45, name: 'Recursive Delete' },
    'packet_sniff': { type: 'defense', cost: 1, dmg: 0, name: 'Packet Sniffer' },
    'honeypot': { type: 'defense', cost: 2, dmg: 0, name: 'Deploy Honeypot' },
    'firewall': { type: 'defense', cost: 2, dmg: 0, name: 'Hard Firewall' },
    'ip_spoof': { type: 'defense', cost: 3, dmg: 0, name: 'IP Spoofing' },
    'kill_process': { type: 'defense', cost: 4, dmg: 0, name: 'Kill Process' },
    'overclock': { type: 'setup', cost: 0, dmg: 0, name: 'Overclock CPU' },
    'flush_dns': { type: 'recovery', cost: 1, dmg: 0, name: 'Flush DNS' },
    'restore_backup': { type: 'recovery', cost: 3, dmg: 0, name: 'Restore Backup' },
    'crypto_miner': { type: 'setup', cost: 3, dmg: 0, name: 'Deploy Miner' },
    'zero_day': { type: 'setup', cost: 4, dmg: 0, name: 'Zero-Day R&D' }
};

function resolveTurn(roomCode) {
    let p1 = rooms[roomCode].players.p1;
    let p2 = rooms[roomCode].players.p2;
    let p1Move = moveSet[p1.action];
    let p2Move = moveSet[p2.action];
    let logs = []; // The colored log array

    logs.push({ type: 'system', text: `\n--- [ TURN ${rooms[roomCode].turn} CLASH ] ---` });

    if (!p1Move || !p2Move) return;

    // Dynamic Adjustments (DDoS uses all threads)
    if (p1.action === 'ddos') { p1Move.cost = p1.threads; p1Move.dmg = p1.threads * 5; }
    if (p2.action === 'ddos') { p2Move.cost = p2.threads; p2Move.dmg = p2.threads * 5; }

    // Pay Costs
    let p1Cost = p1.statuses.includes('Encrypted') && (p1Move.type === 'setup' || p1Move.type === 'recovery') ? p1Move.cost * 2 : p1Move.cost;
    let p2Cost = p2.statuses.includes('Encrypted') && (p2Move.type === 'setup' || p2Move.type === 'recovery') ? p2Move.cost * 2 : p2Move.cost;
    
    p1.threads = Math.max(0, p1.threads - p1Cost);
    p2.threads = Math.max(0, p2.threads - p2Cost);

    // Base Damage Pools
    let p1IncomingDmg = p2Move.type === 'aggression' ? p2Move.dmg : 0;
    let p2IncomingDmg = p1Move.type === 'aggression' ? p1Move.dmg : 0;

    // --- ZERO-DAY UNBLOCKABLE TRACKERS ---
    let p1Unblockable = p1Move.type === 'aggression' && p1.statuses.includes('Weaponized');
    let p2Unblockable = p2Move.type === 'aggression' && p2.statuses.includes('Weaponized');

    if (p1Unblockable) {
        logs.push({ type: 'aggression', text: `> [!] ${p1.name} deployed a Zero-Day! Attack is unblockable!` });
        p1.statuses = p1.statuses.filter(s => s !== 'Weaponized');
    }
    if (p2Unblockable) {
        logs.push({ type: 'aggression', text: `> [!] ${p2.name} deployed a Zero-Day! Attack is unblockable!` });
        p2.statuses = p2.statuses.filter(s => s !== 'Weaponized');
    }
    
    // Traced Modifiers
    if (p2Move.type === 'aggression' && p1.statuses.includes('Traced')) {
        p1IncomingDmg = Math.floor(p1IncomingDmg * 1.5);
        p1.statuses = p1.statuses.filter(s => s !== 'Traced');
    }
    if (p1Move.type === 'aggression' && p2.statuses.includes('Traced')) {
        p2IncomingDmg = Math.floor(p2IncomingDmg * 1.5);
        p2.statuses = p2.statuses.filter(s => s !== 'Traced');
    }

    // Evaluate Defenses & Interrupts
    let p1Success = true;
    let p2Success = true;

    // Kill Process
    if (p1.action === 'kill_process') {
        if (p2Move.type === 'setup' || p2Move.type === 'recovery') {
            logs.push({ type: 'defense', text: `> ${p1.name} executed Kill Process! ${p2.name}'s ${p2Move.name} was terminated.` });
            p2IncomingDmg += 15; p2Success = false;
        } else { logs.push({ type: 'defense', text: `> ${p1.name} executed Kill Process, but found no background tasks.` }); }
    }
    if (p2.action === 'kill_process') {
        if (p1Move.type === 'setup' || p1Move.type === 'recovery') {
            logs.push({ type: 'defense', text: `> ${p2.name} executed Kill Process! ${p1.name}'s ${p1Move.name} was terminated.` });
            p1IncomingDmg += 15; p1Success = false;
        } else { logs.push({ type: 'defense', text: `> ${p2.name} executed Kill Process, but found no background tasks.` }); }
    }

    // Packet Sniffers
    if (p1.action === 'packet_sniff') { p2.statuses.push('Traced'); logs.push({ type: 'defense', text: `> ${p1.name} injected a Packet Sniffer. ${p2.name} is Traced.` }); }
    if (p2.action === 'packet_sniff') { p1.statuses.push('Traced'); logs.push({ type: 'defense', text: `> ${p2.name} injected a Packet Sniffer. ${p1.name} is Traced.` }); }

    // --- UPGRADED BLOCKERS (Now respect Zero-Days) ---
    if (p1.action === 'honeypot') {
        if (p2Move.type === 'aggression' && !p2Unblockable) { logs.push({ type: 'defense', text: `> ${p1.name} deployed Honeypot! ${p2.name}'s attack was trapped! (20 Recoil)` }); p1IncomingDmg = 0; p2IncomingDmg += 20; }
        else if (p2Move.type === 'aggression' && p2Unblockable) { logs.push({ type: 'error', text: `> ${p1.name}'s Honeypot was bypassed by the Zero-Day!` }); }
        else { logs.push({ type: 'defense', text: `> ${p1.name} deployed Honeypot, but no intruders detected.` }); }
    }
    if (p1.action === 'firewall') {
        if (p2Move.type === 'aggression' && p2Unblockable) { logs.push({ type: 'error', text: `> ${p1.name}'s Firewall was shredded by the Zero-Day!` }); }
        else { logs.push({ type: 'defense', text: `> ${p1.name} raised Hard Firewall.` }); p1IncomingDmg = Math.floor(p1IncomingDmg * 0.4); }
    }
    if (p1.action === 'ip_spoof') {
        if (p2Move.type === 'aggression' && p2Unblockable) { logs.push({ type: 'error', text: `> ${p1.name}'s IP Spoofing was tracked through the Zero-Day!` }); }
        else { logs.push({ type: 'defense', text: `> ${p1.name} spoofed their IP! Evaded incoming attacks.` }); p1IncomingDmg = 0; }
    }

    if (p2.action === 'honeypot') {
        if (p1Move.type === 'aggression' && !p1Unblockable) { logs.push({ type: 'defense', text: `> ${p2.name} deployed Honeypot! ${p1.name}'s attack was trapped! (20 Recoil)` }); p2IncomingDmg = 0; p1IncomingDmg += 20; }
        else if (p1Move.type === 'aggression' && p1Unblockable) { logs.push({ type: 'error', text: `> ${p2.name}'s Honeypot was bypassed by the Zero-Day!` }); }
        else { logs.push({ type: 'defense', text: `> ${p2.name} deployed Honeypot, but no intruders detected.` }); }
    }
    if (p2.action === 'firewall') {
        if (p1Move.type === 'aggression' && p1Unblockable) { logs.push({ type: 'error', text: `> ${p2.name}'s Firewall was shredded by the Zero-Day!` }); }
        else { logs.push({ type: 'defense', text: `> ${p2.name} raised Hard Firewall.` }); p2IncomingDmg = Math.floor(p2IncomingDmg * 0.4); }
    }
    if (p2.action === 'ip_spoof') {
        if (p1Move.type === 'aggression' && p1Unblockable) { logs.push({ type: 'error', text: `> ${p2.name}'s IP Spoofing was tracked through the Zero-Day!` }); }
        else { logs.push({ type: 'defense', text: `> ${p2.name} spoofed their IP! Evaded incoming attacks.` }); p2IncomingDmg = 0; }
    }

    // Execute Successful Moves & Apply Statuses
    if (p1Success && p1Move.type !== 'defense') {
        if (p1Move.type === 'aggression') logs.push({ type: 'aggression', text: `> ${p1.name} executed ${p1Move.name}, dealing ${p2IncomingDmg} damage.` });
        if (p1.action === 'syn_flood') p2.statuses.push('Congested');
        if (p1.action === 'ransomware') p2.statuses.push('Encrypted');
        if (p1.action === 'overclock') { p1.statuses.push('Overclocked'); logs.push({ type: 'setup', text: `> ${p1.name} is Overclocking their CPU.` }); }
        if (p1.action === 'flush_dns') { p1.statuses = []; logs.push({ type: 'setup', text: `> ${p1.name} flushed DNS, clearing all statuses.` }); }
        if (p1.action === 'restore_backup') { p1.hp = Math.min(100, p1.hp + 25); logs.push({ type: 'setup', text: `> ${p1.name} restored from backup (+25 HP).` }); }
        if (p1.action === 'crypto_miner') { p1.statuses.push('Mining'); p1.hp -= 5; logs.push({ type: 'setup', text: `> ${p1.name} deployed a Crypto Miner (takes 5 dmg).` }); }
        if (p1.action === 'zero_day') { p1.statuses.push('Weaponized'); logs.push({ type: 'setup', text: `> ${p1.name} researched a Zero-Day exploit!` }); }
    }

    if (p2Success && p2Move.type !== 'defense') {
        if (p2Move.type === 'aggression') logs.push({ type: 'aggression', text: `> ${p2.name} executed ${p2Move.name}, dealing ${p1IncomingDmg} damage.` });
        if (p2.action === 'syn_flood') p1.statuses.push('Congested');
        if (p2.action === 'ransomware') p1.statuses.push('Encrypted');
        if (p2.action === 'overclock') { p2.statuses.push('Overclocked'); logs.push({ type: 'setup', text: `> ${p2.name} is Overclocking their CPU.` }); }
        if (p2.action === 'flush_dns') { p2.statuses = []; logs.push({ type: 'setup', text: `> ${p2.name} flushed DNS, clearing all statuses.` }); }
        if (p2.action === 'restore_backup') { p2.hp = Math.min(100, p2.hp + 25); logs.push({ type: 'setup', text: `> ${p2.name} restored from backup (+25 HP).` }); }
        if (p2.action === 'crypto_miner') { p2.statuses.push('Mining'); p2.hp -= 5; logs.push({ type: 'setup', text: `> ${p2.name} deployed a Crypto Miner (takes 5 dmg).` }); }
        if (p2.action === 'zero_day') { p2.statuses.push('Weaponized'); logs.push({ type: 'setup', text: `> ${p2.name} researched a Zero-Day exploit!` }); }
    }

    p1.statuses = [...new Set(p1.statuses)];
    p2.statuses = [...new Set(p2.statuses)];

    p1.hp = Math.max(0, p1.hp - p1IncomingDmg);
    p2.hp = Math.max(0, p2.hp - p2IncomingDmg);

    if (p1.hp === 0 || p2.hp === 0) {
        let resultMsg = "";
        if (p1.hp === 0 && p2.hp === 0) { resultMsg = "MUTUAL DESTRUCTION - DRAW"; logs.push({ type: 'error', text: `> FATAL ERROR: Both servers wiped.` }); }
        else if (p1.hp === 0) { resultMsg = `VICTORY: ${rooms[roomCode].players.p2.name} SECURED ROOT`; logs.push({ type: 'error', text: `> FATAL ERROR: ${rooms[roomCode].players.p1.name}'s system offline.` }); }
        else { resultMsg = `VICTORY: ${rooms[roomCode].players.p1.name} SECURED ROOT`; logs.push({ type: 'error', text: `> FATAL ERROR: ${rooms[roomCode].players.p2.name}'s system offline.` }); }

        io.to(roomCode).emit('terminalLog', logs);
        io.to(roomCode).emit('stateUpdate', rooms[roomCode]);
        io.to(roomCode).emit('gameOver', resultMsg);
        return; 
    }

    let p1Regen = p1.statuses.includes('Congested') ? 1 : (p1.statuses.includes('Overclocked') ? 6 : 2);
    let p2Regen = p2.statuses.includes('Congested') ? 1 : (p2.statuses.includes('Overclocked') ? 6 : 2);
    
    if (p1.statuses.includes('Mining')) p1Regen += 1;
    if (p2.statuses.includes('Mining')) p2Regen += 1;

    p1.threads = Math.min(p1.threads + p1Regen, p1.maxThreads);
    p2.threads = Math.min(p2.threads + p2Regen, p2.maxThreads);

    p1.statuses = p1.statuses.filter(s => s !== 'Congested' && s !== 'Overclocked');
    p2.statuses = p2.statuses.filter(s => s !== 'Congested' && s !== 'Overclocked');

    p1.action = null;
    p2.action = null;
    rooms[roomCode].turn++;

    io.to(roomCode).emit('terminalLog', logs);
    io.to(roomCode).emit('stateUpdate', rooms[roomCode]);
}

io.on('connection', (socket) => {
    
    socket.on('joinRoom', ({ nickname, roomCode }) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = createInitialState();
        }

        let room = rooms[roomCode];
        let role = null;

        if (!room.players.p1.id) {
            role = 'p1';
            room.players.p1.id = socket.id;
            room.players.p1.name = nickname;
        } else if (!room.players.p2.id) {
            role = 'p2';
            room.players.p2.id = socket.id;
            room.players.p2.name = nickname;
        } else {
            socket.emit('roomError', 'Subnet is full. Max 2 operators allowed.');
            return;
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.role = role;

        socket.emit('roomJoined', { role, roomCode, state: room });
        
        // System logs are now sent as arrays of objects!
        io.to(roomCode).emit('terminalLog', [{ type: 'system', text: `> ${nickname} has connected to the subnet.` }]);
        io.to(roomCode).emit('stateUpdate', room);
    });

    socket.on('lockIn', (data) => {
        const { actionId, roomCode } = data;
        let room = rooms[roomCode];
        
        if (!room || !socket.role) return;

        let player = room.players[socket.role];
        let move = moveSet[actionId];

        let trueCost = player.statuses.includes('Encrypted') && (move.type === 'setup' || move.type === 'recovery') ? move.cost * 2 : move.cost;

        if (actionId !== 'ddos' && player.threads < trueCost) {
            socket.emit('terminalLog', [{ type: 'error', text: `> [LOCAL ERROR] Insufficient Threads to compile ${move.name}.` }]);
            socket.emit('moveRejected'); 
            return; 
        }
        
        player.action = actionId;
        io.to(roomCode).emit('terminalLog', [{ type: 'neutral', text: `> ${player.name} locked in their payload...` }]);

        if (room.players.p1.action && room.players.p2.action) {
            setTimeout(() => resolveTurn(roomCode), 1000); 
        }
    });

    socket.on('disconnect', () => {
        if (socket.roomCode && rooms[socket.roomCode]) {
            let room = rooms[socket.roomCode];
            let disconnectedPlayerName = room.players[socket.role].name || 'operator';
            
            room.players[socket.role].id = null;
            room.players[socket.role].name = null;
            
            io.to(socket.roomCode).emit('terminalLog', [{ type: 'error', text: `> [WARNING] Connection lost with ${disconnectedPlayerName}.` }]);
            io.to(socket.roomCode).emit('stateUpdate', room);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Tactical Hub running on http://localhost:${PORT}`));