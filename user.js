// File: models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true // No two users can have the same email
  },
  password: {
    type: String,
    required: true
  },
  // --- THIS IS THE LOCK FEATURE ---
  deviceId: {
    type: String,
    required: true, 
    unique: true // This is the magic line! It prevents two users from having the same Device ID.
  },
  // -------------------------------
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
