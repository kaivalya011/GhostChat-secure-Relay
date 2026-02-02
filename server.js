require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE CONNECTION ---
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("❌ ERROR: MONGO_URI is missing in Render Environment Variables.");
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ Connected to MongoDB Atlas'))
        .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// --- USER SCHEMA ---
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    deviceId: { type: String, required: true },
    myId: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

io.on('connection', (socket) => {
    
    // 1. LOGIN ATTEMPT
    socket.on('login_attempt', async ({ email, deviceId }) => {
        email = email.toLowerCase().trim();

        try {
            // Check if device is linked to another email
            const deviceCheck = await User.findOne({ deviceId: deviceId });
            if (deviceCheck && deviceCheck.email !== email) {
                socket.emit('login_error', 'Security Alert: This device is registered to a different account.');
                return;
            }

            // Find or Create User
            let user = await User.findOne({ email: email });

            if (!user) {
                // If trying to register new email on used device
                if (deviceCheck) {
                     socket.emit('login_error', 'This device already has an account.'); 
                     return;
                }
                
                // Create New User
                const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
                user = new User({ email, deviceId, myId: newId });
                await user.save();
            }

            // Success
            socket.join(user.myId); 
            socket.emit('login_success', { myId: user.myId, email: user.email });

        } catch (err) {
            console.error(err);
            socket.emit('login_error', 'Server Error. Please try again.');
        }
    });

    // 2. GLOBAL LOBBY
    socket.on('join_global', () => socket.join('global_lobby'));
    
    socket.on('global_message', (data) => {
        io.to('global_lobby').emit('receive_global', data);
    });

    // 3. PRIVATE REQUESTS
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
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
