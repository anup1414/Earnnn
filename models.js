const mongoose = require('mongoose');

// User Model
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  balance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  referCount: { type: Number, default: 0 },
  referCode: { type: String, unique: true },
  referredBy: String,
  pendingReferBonus: String,
  joinedChannels: { type: Boolean, default: false },
  awaitingUpi: { type: Boolean, default: false },
  withdrawPending: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
  deviceInfo: { type: String, default: '{}' },
  ipHash: String,
}, { timestamps: true });

// Withdrawal Model
const withdrawalSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  upiId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'rejected'], default: 'pending' },
  adminNote: String,
}, { timestamps: true });

// Settings Model
const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// Channel Model - NEW
const channelSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true }, // Can be @username or numeric ID
  link: { type: String, required: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Broadcast Log Model
const broadcastSchema = new mongoose.Schema({
  message: String,
  sentCount: Number,
  failedCount: Number,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const Settings = mongoose.model('Settings', settingsSchema);
const Channel = mongoose.model('Channel', channelSchema);
const BroadcastLog = mongoose.model('BroadcastLog', broadcastSchema);

module.exports = { User, Withdrawal, Settings, Channel, BroadcastLog };
