const socket = io();

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const appContainer = document.getElementById('app-container');
const onlineCount = document.getElementById('online-count');
const chatArea = document.getElementById('chat-area');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');

let myDeviceId = null;

// 1. INITIALIZE FINGERPRINT (Runs immediately)
(async () => {
    // Load the library
    const fpPromise = import('https://openfpcdn.io/fingerprintjs/v3');
    const FingerprintJS = await fpPromise;
    const fp = await FingerprintJS.load();
    
    // Get the visitor identifier
    const result = await fp.get();
    myDeviceId = result.visitorId;

    // Enable the form now that we have the ID
    emailInput.placeholder = "Enter your Secure ID";
    emailInput.disabled = false;
    loginBtn.innerText = "Initialize Link";
    loginBtn.disabled = false;
    
    console.log("Device Fingerprint Generated:", myDeviceId);
})();

// 2. LOGIN LOGIC
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    
    if (email && myDeviceId) {
        // Send Email AND Fingerprint to server
        socket.emit('join_request', { 
            email: email, 
            deviceId: myDeviceId 
        });
    }
});

socket.on('login_error', (msg) => {
    loginError.innerText = msg;
    emailInput.style.borderColor = "#ff4444";
    // Shake animation for effect
    loginForm.classList.add('shake'); 
    setTimeout(() => loginForm.classList.remove('shake'), 500);
});

socket.on('login_success', (data) => {
    loginOverlay.style.display = 'none';
    appContainer.style.display = 'flex';
    onlineCount.innerText = data.userCount;

    // Welcome message
    addMessageToUI(`Identity confirmed: ${data.email}`, 'system');
});

// 3. CHAT LOGIC (Standard)
socket.on('chat_message', (data) => {
    if (loginOverlay.style.display === 'none') {
        const isMe = (data.senderId === socket.id);
        const type = isMe ? 'sent' : 'received';
        let content = data.text;
        
        if (!isMe) {
            content = `<small style="color:#8b5cf6; display:block; font-size:10px;">${data.email}</small>` + data.text;
        }
        addMessageToUI(content, type, !isMe);
    }
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = msgInput.value;
    if (msg.trim()) {
        socket.emit('chat_message', msg);
        msgInput.value = '';
    }
});

function addMessageToUI(text, type, allowHTML = false) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    if (type === 'system' || allowHTML) msgDiv.innerHTML = text;
    else msgDiv.innerText = text;
    chatArea.appendChild(msgDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}
