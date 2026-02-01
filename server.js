require('dotenv').config(); // Load environment variables
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- 1. CONNECT TO MONGODB ---
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is missing in environment variables.");
    // We don't exit process so the server stays alive to show logs, 
    // but database features won't work until fixed.
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ Connected to MongoDB Atlas'))
        .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// --- 2. DEFINE DATABASE SCHEMA ---
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    deviceId: { type: String, required: true }, // The fingerprint
    myId: { type: String, required: true }      // The chat ID (e.g., X9J2K1)
});

const User = mongoose.model('User', userSchema);

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // --- LOGIN & REGISTRATION LOGIC ---
    socket.on('login_attempt', async ({ email, deviceId }) => {
        email = email.toLowerCase().trim();

        try {
            // SECURITY CHECK 1: Is this DEVICE linked to a different email?
            const deviceCheck = await User.findOne({ deviceId: deviceId });
            
            if (deviceCheck && deviceCheck.email !== email) {
                socket.emit('login_error', 'Security Alert: This device is already linked to another account (Email mismatch).');
                return;
            }

            // SECURITY CHECK 2: Is this EMAIL linked to a different device?
            // (Optional: strict mode)
            /* const emailCheck = await User.findOne({ email: email });
            if (emailCheck && emailCheck.deviceId !== deviceId) {
                socket.emit('login_error', 'This email is locked to another device.');
                return;
            } 
            */

            // Look for existing user
            let user = await User.findOne({ email: email });

            // If user doesn't exist, Create New
            if (!user) {
                // Double check device isn't taken (redundant but safe)
                if (deviceCheck) {
                     socket.emit('login_error', 'Device already registered.'); 
                     return;
                }

                const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
                user = new User({
                    email: email,
                    deviceId: deviceId,
                    myId: newId
                });
                await user.save();
                console.log(`New User Created: ${email} (${newId})`);
            }

            // Login Success
            socket.join(user.myId); // Join their private "Phone Number" channel
            
            socket.emit('login_success', { 
                myId: user.myId,
                email: user.email 
            });

        } catch (err) {
            console.error(err);
            socket.emit('login_error', 'Server Error: Database connection failed.');
        }
    });

    // --- GLOBAL LOBBY ---
    socket.on('join_global', () => {
        socket.join('global_lobby');
    });

    socket.on('global_message', (data) => {
        io.to('global_lobby').emit('receive_global', data);
    });

    // --- PRIVATE REQUESTS ---
    socket.on('request_connection', ({ targetId, requesterId }) => {
        io.to(targetId).emit('incoming_request', requesterId);
    });

    socket.on('accept_request', ({ requesterId, acceptorId }) => {
        const roomName = `private-${requesterId}-${acceptorId}`;
        socket.join(roomName);
        io.to(requesterId).emit('join_private_room', roomName);
        socket.emit('private_started', roomName);
    });

    socket.on('join_room_command', (roomName) => {
        socket.join(roomName);
        socket.emit('private_started', roomName);
    });

    socket.on('private_message', ({ msg, room, senderId }) => {
        socket.to(room).emit('receive_private', { msg, senderId });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
