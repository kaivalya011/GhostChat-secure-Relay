const socket = io();

// UI Elements
const screens = {
    login: document.getElementById('screen-login'),
    home: document.getElementById('screen-home'),
    global: document.getElementById('screen-global'),
    private: document.getElementById('screen-private')
};

let myFingerprint = null;
let myChatId = null;
let currentRoom = null;

// 1. Initialize Fingerprint (Device ID)
(async () => {
    const fpPromise = FingerprintJS.load();
    const fp = await fpPromise;
    const result = await fp.get();
    myFingerprint = result.visitorId;
    console.log("Device ID:", myFingerprint);
})();

// 2. Login Logic
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email-input').value;
    
    if (!myFingerprint) {
        alert("Loading security check... wait a moment.");
        return;
    }
    document.getElementById('login-status').textContent = "Verifying...";
    socket.emit('login_attempt', { email, deviceId: myFingerprint });
});

socket.on('login_success', (data) => {
    myChatId = data.myId;
    document.getElementById('user-email-display').textContent = data.email;
    document.getElementById('my-id-display').textContent = myChatId;
    showScreen('home');
});

socket.on('login_error', (msg) => {
    document.getElementById('login-status').textContent = msg;
});

// 3. Navigation
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
}

// 4. Global Chat
document.getElementById('btn-global').addEventListener('click', () => {
    showScreen('global');
    socket.emit('join_global');
});
document.getElementById('btn-leave-global').addEventListener('click', () => showScreen('home'));

document.getElementById('global-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('global-input');
    if (input.value) {
        socket.emit('global_message', { msg: input.value, senderId: myChatId });
        input.value = '';
    }
});
socket.on('receive_global', (data) => addMessage('global-messages', data.senderId, data.msg));

// 5. Private Chat
document.getElementById('btn-connect').addEventListener('click', () => {
    const target = document.getElementById('target-id-input').value.toUpperCase();
    if(target.length === 6) {
        socket.emit('request_connection', { targetId: target, requesterId: myChatId });
        alert("Request sent!");
    }
});

socket.on('incoming_request', (requesterId) => {
    if(confirm(`User ${requesterId} wants to chat. Accept?`)) {
        socket.emit('accept_request', { requesterId, acceptorId: myChatId });
    }
});

socket.on('join_private_room', (room) => socket.emit('join_room_command', room));

socket.on('private_started', (room) => {
    currentRoom = room;
    showScreen('private');
});

document.getElementById('private-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('private-input');
    if (input.value) {
        addMessage('private-messages', "Me", input.value);
        socket.emit('private_message', { msg: input.value, room: currentRoom, senderId: myChatId });
        input.value = '';
    }
});
socket.on('receive_private', (data) => addMessage('private-messages', "Partner", data.msg));
document.getElementById('btn-leave-private').addEventListener('click', () => location.reload());

function addMessage(elId, sender, text) {
    const list = document.getElementById(elId);
    const item = document.createElement('li');
    const isMe = sender === myChatId || sender === "Me";
    item.textContent = `${isMe ? "Me" : sender}: ${text}`;
    item.className = isMe ? "msg-me" : "msg-other";
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
}
