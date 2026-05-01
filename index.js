const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { User, Withdrawal, Settings, BroadcastLog } = require('./models');
const { BOT_TOKEN, ADMIN_ID, ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET, BOT_USERNAME, CHANNELS, WELCOME_BONUS, REFER_BONUS, MIN_WITHDRAW, WELCOME_MESSAGE } = require('./config');

// ─── EXPRESS APP ──────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// ─── TELEGRAM BOT ─────────────────────────────────────────────────────────────
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Helper: Get settings
async function getSetting(key, defaultValue) {
  const setting = await Settings.findOne({ key });
  return setting ? setting.value : defaultValue;
}

async function setSetting(key, value) {
  await Settings.findOneAndUpdate(
    { key },
    { key, value },
    { upsert: true, new: true }
  );
}

// Initialize default settings
async function initSettings() {
  await setSetting('welcome_bonus', WELCOME_BONUS);
  await setSetting('refer_bonus', REFER_BONUS);
  await setSetting('min_withdraw', MIN_WITHDRAW);
  await setSetting('welcome_message', WELCOME_MESSAGE);
}
initSettings();

// ─── BOT HELPERS ──────────────────────────────────────────────────────────────
async function checkAllChannels(userId) {
  for (const ch of CHANNELS) {
    try {
      const member = await bot.getChatMember(ch.id, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) return false;
    } catch { return false; }
  }
  return true;
}

function channelButtons() {
  const buttons = CHANNELS.map(ch => [{ text: `📢 ${ch.name}`, url: ch.link }]);
  buttons.push([{ text: '✅ Joined — Verify Karo', callback_data: 'verify_join' }]);
  return { inline_keyboard: buttons };
}

async function mainMenu(referCode) {
  const minWithdraw = await getSetting('min_withdraw', 20);
  return {
    inline_keyboard: [
      [{ text: '💰 Balance', callback_data: 'balance' }, { text: '🔗 Refer Link', callback_data: 'refer' }],
      [{ text: '💸 Withdraw', callback_data: 'withdraw' }, { text: '📊 Status', callback_data: 'status' }],
      [{ text: '🏆 Leaderboard', callback_data: 'leaderboard' }, { text: '📜 History', callback_data: 'history' }],
      [{ text: '🆘 Support', url: 'https://t.me/YourSupportUsername' }]
    ]
  };
}

// ─── BOT COMMANDS ─────────────────────────────────────────────────────────────
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const referParam = match[1].trim();
  const referrerId = referParam ? referParam.replace('_ref_', '') : null;

  let user = await User.findOne({ telegramId: userId });

  if (user && user.banned) {
    return bot.sendMessage(chatId, '❌ Aapko admin ne ban kar diya hai! Support se contact karo.');
  }

  if (!user) {
    user = new User({
      telegramId: userId,
      username: msg.from.username || '',
      firstName: msg.from.first_name || '',
      lastName: msg.from.last_name || '',
      balance: 0,
      referredBy: referrerId && referrerId !== String(userId) ? referrerId : null,
      referCode: String(userId),
      joinedChannels: false,
      pendingReferBonus: referrerId && referrerId !== String(userId) ? referrerId : null,
      ipHash: msg.from.id.toString(),
      deviceInfo: JSON.stringify({ language: msg.from.language_code })
    });
    await user.save();
  }

  const joined = await checkAllChannels(userId);

  if (!joined) {
    const welcomeMsg = await getSetting('welcome_message', WELCOME_MESSAGE);
    const formattedMsg = welcomeMsg.replace('{name}', msg.from.first_name);
    await bot.sendMessage(chatId, formattedMsg, { parse_mode: 'Markdown', reply_markup: channelButtons() });
    return;
  }

  if (!user.joinedChannels) {
    user.joinedChannels = true;
    const welcomeBonus = await getSetting('welcome_bonus', 5);
    user.balance += welcomeBonus;
    await user.save();
    
    await bot.sendMessage(chatId,
      `✅ *Verification Successful!*\n\n🎁 *₹${welcomeBonus} Welcome Bonus* aapke account mein add ho gaya!\n\n💰 Aapka Balance: *₹${user.balance.toFixed(2)}*`,
      { parse_mode: 'Markdown', reply_markup: await mainMenu(user.referCode) }
    );

    if (user.pendingReferBonus) {
      const referBonus = await getSetting('refer_bonus', 1.5);
      const referrer = await User.findOne({ telegramId: user.pendingReferBonus });
      if (referrer && !referrer.banned) {
        referrer.balance += referBonus;
        referrer.referCount = (referrer.referCount || 0) + 1;
        await referrer.save();
        await bot.sendMessage(referrer.telegramId,
          `🎉 *Refer Bonus Mila!*\n\n👤 ${user.firstName} ne aapka link use kiya!\n💰 *₹${referBonus} aapke account mein add!*`,
          { parse_mode: 'Markdown' }
        );
      }
      user.pendingReferBonus = null;
      await user.save();
    }
  } else {
    await bot.sendMessage(chatId,
      `👋 *Wapas Aaye ${msg.from.first_name}!*\n\n💰 Balance: *₹${user.balance.toFixed(2)}*`,
      { parse_mode: 'Markdown', reply_markup: await mainMenu(user.referCode) }
    );
  }
});

// Admin command: /addwelcome <message>
bot.onText(/\/addwelcome (.+)/, async (msg, match) => {
  if (String(msg.from.id) !== ADMIN_ID) return bot.sendMessage(msg.chat.id, '❌ Admin only!');
  const newMessage = match[1];
  await setSetting('welcome_message', newMessage);
  bot.sendMessage(msg.chat.id, `✅ Welcome message updated!\n\nNew message:\n${newMessage}`, { parse_mode: 'Markdown' });
});

// Other bot commands (balance, refer, etc.) - similar to before
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  await bot.answerCallbackQuery(query.id);
  
  const user = await User.findOne({ telegramId: userId });
  if (user && user.banned) return bot.sendMessage(chatId, '❌ Aapko ban kar diya gaya hai!');

  if (data === 'verify_join') {
    const joined = await checkAllChannels(userId);
    if (!joined) {
      return bot.sendMessage(chatId, `❌ *Abhi Join Nahi Kia!*\n\nSare channels join karo phir verify karo.`, { parse_mode: 'Markdown', reply_markup: channelButtons() });
    }
    if (!user) return;
    
    if (!user.joinedChannels) {
      user.joinedChannels = true;
      const welcomeBonus = await getSetting('welcome_bonus', 5);
      user.balance += welcomeBonus;
      await user.save();
      
      await bot.sendMessage(chatId,
        `✅ *Verification Successful!*\n\n🎁 *₹${welcomeBonus} Welcome Bonus* mila!\n💰 Balance: *₹${user.balance.toFixed(2)}*`,
        { parse_mode: 'Markdown', reply_markup: await mainMenu(user.referCode) }
      );
      
      if (user.pendingReferBonus) {
        const referBonus = await getSetting('refer_bonus', 1.5);
        const referrer = await User.findOne({ telegramId: user.pendingReferBonus });
        if (referrer && !referrer.banned) {
          referrer.balance += referBonus;
          referrer.referCount = (referrer.referCount || 0) + 1;
          await referrer.save();
          await bot.sendMessage(referrer.telegramId,
            `🎉 *Refer Bonus!*\n👤 ${user.firstName}\n💰 +₹${referBonus}`,
            { parse_mode: 'Markdown' }
          );
        }
        user.pendingReferBonus = null;
        await user.save();
      }
    }
    return;
  }
  
  // Handle other callbacks (balance, refer, withdraw, status, etc.)
  if (data === 'balance') {
    return bot.sendMessage(chatId, `💰 *Balance:* ₹${user.balance.toFixed(2)}`, { parse_mode: 'Markdown', reply_markup: await mainMenu(user.referCode) });
  }
  
  if (data === 'refer') {
    const link = `https://t.me/${BOT_USERNAME.replace('@', '')}?start=_ref_${user.referCode}`;
    const referBonus = await getSetting('refer_bonus', 1.5);
    return bot.sendMessage(chatId,
      `🔗 *Refer Link*\n\`${link}\`\n\n💰 Per Refer: *₹${referBonus}*\n👥 Total: *${user.referCount || 0}*`,
      { parse_mode: 'Markdown', reply_markup: await mainMenu(user.referCode) }
    );
  }
  
  if (data === 'withdraw') {
    const minWithdraw = await getSetting('min_withdraw', 20);
    if (user.balance < minWithdraw) {
      return bot.sendMessage(chatId, `❌ Minimum withdrawal: *₹${minWithdraw}*\n💰 Your balance: *₹${user.balance.toFixed(2)}*`, { parse_mode: 'Markdown' });
    }
    if (user.withdrawPending) {
      return bot.sendMessage(chatId, `⏳ Already a withdrawal pending!`);
    }
    user.awaitingUpi = true;
    await user.save();
    return bot.sendMessage(chatId, `💸 *Withdrawal Request*\nAmount: ₹${user.balance.toFixed(2)}\n\n📲 Type your UPI ID:`, { parse_mode: 'Markdown' });
  }
  
  if (data === 'status') {
    const withdrawals = await Withdrawal.find({ userId: userId }).sort({ createdAt: -1 }).limit(5);
    let wText = withdrawals.length ? withdrawals.map(w => `• ₹${w.amount} — ${w.status}`).join('\n') : 'No withdrawals yet';
    return bot.sendMessage(chatId, `📊 *Status*\n💰 Balance: ₹${user.balance.toFixed(2)}\n👥 Refers: ${user.referCount || 0}\n📜 Recent:\n${wText}`, { parse_mode: 'Markdown' });
  }
  
  if (data === 'leaderboard') {
    const top = await User.find({ banned: { $ne: true } }).sort({ referCount: -1 }).limit(10);
    const text = top.map((u, i) => `${i+1}. ${u.firstName} — ${u.referCount || 0} refers`).join('\n');
    return bot.sendMessage(chatId, `🏆 *Top Referrers*\n\n${text}`, { parse_mode: 'Markdown' });
  }
  
  if (data === 'history') {
    const withdrawals = await Withdrawal.find({ userId: userId }).sort({ createdAt: -1 }).limit(10);
    if (!withdrawals.length) return bot.sendMessage(chatId, '📜 No withdrawal history');
    const text = withdrawals.map(w => `• ₹${w.amount} | ${w.status} | ${new Date(w.createdAt).toLocaleDateString()}`).join('\n');
    return bot.sendMessage(chatId, `📜 *History*\n${text}`, { parse_mode: 'Markdown' });
  }
});

// Message handler for UPI
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const user = await User.findOne({ telegramId: userId });
  if (!user || !user.awaitingUpi) return;
  
  const upiId = msg.text.trim();
  if (!upiId.includes('@')) {
    return bot.sendMessage(chatId, `❌ Valid UPI ID! (example: name@paytm)`);
  }
  
  const amount = user.balance;
  user.balance = 0;
  user.awaitingUpi = false;
  user.withdrawPending = true;
  user.totalWithdrawn = (user.totalWithdrawn || 0) + amount;
  await user.save();
  
  const withdrawal = new Withdrawal({ userId: userId, upiId: upiId, amount: amount, status: 'pending' });
  await withdrawal.save();
  
  await bot.sendMessage(chatId, `✅ *Withdrawal Request Sent!*\n💰 ₹${amount.toFixed(2)}\n📲 ${upiId}\n⏳ Pending`, { parse_mode: 'Markdown' });
  
  await bot.sendMessage(ADMIN_ID,
    `🔔 *New Withdrawal!*\n👤 ${msg.from.first_name}\n💰 ₹${amount}\n📲 ${upiId}\n🆔 ${userId}`,
    { parse_mode: 'Markdown' }
  );
});

// ─── EXPRESS ROUTES (Admin Panel) ────────────────────────────────────────────

// Auth middleware
function isAuthenticated(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect('/login');
}

// Login page
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Invalid credentials!' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Dashboard
app.get('/dashboard', isAuthenticated, async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ banned: false });
  const totalWithdrawn = await Withdrawal.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
  
  res.render('dashboard', {
    totalUsers,
    activeUsers,
    totalWithdrawn: totalWithdrawn[0]?.total || 0,
    pendingWithdrawals
  });
});

// Users list
app.get('/users', isAuthenticated, async (req, res) => {
  const search = req.query.search || '';
  let query = {};
  if (search) {
    query = {
      $or: [
        { telegramId: search },
        { firstName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ]
    };
  }
  const users = await User.find(query).sort({ createdAt: -1 }).limit(100);
  res.render('users', { users, search });
});

// User details & actions
app.get('/user/:id', isAuthenticated, async (req, res) => {
  const user = await User.findOne({ telegramId: req.params.id });
  const withdrawals = await Withdrawal.find({ userId: req.params.id }).sort({ createdAt: -1 });
  if (!user) return res.send('User not found');
  res.render('user_detail', { user, withdrawals });
});

// Add balance
app.post('/user/addbalance', isAuthenticated, async (req, res) => {
  const { userId, amount } = req.body;
  const user = await User.findOne({ telegramId: userId });
  if (user) {
    user.balance += parseFloat(amount);
    await user.save();
    await bot.sendMessage(userId, `🎁 Admin ne *₹${amount}* add kar diya!\n💰 New Balance: *₹${user.balance.toFixed(2)}*`, { parse_mode: 'Markdown' });
  }
  res.redirect(`/user/${userId}`);
});

// Ban/Unban user
app.post('/user/toggleban', isAuthenticated, async (req, res) => {
  const { userId } = req.body;
  const user = await User.findOne({ telegramId: userId });
  if (user) {
    user.banned = !user.banned;
    await user.save();
    await bot.sendMessage(userId, user.banned ? '❌ You have been banned!' : '✅ You have been unbanned!');
  }
  res.redirect(`/user/${userId}`);
});

// Withdrawals list
app.get('/withdrawals', isAuthenticated, async (req, res) => {
  const status = req.query.status || 'pending';
  const withdrawals = await Withdrawal.find({ status }).sort({ createdAt: -1 });
  res.render('withdrawals', { withdrawals, status });
});

// Approve withdrawal
app.post('/withdraw/approve', isAuthenticated, async (req, res) => {
  const { withdrawalId, userId, amount } = req.body;
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (withdrawal) {
    withdrawal.status = 'paid';
    await withdrawal.save();
    
    const user = await User.findOne({ telegramId: userId });
    if (user) {
      user.withdrawPending = false;
      await user.save();
      await bot.sendMessage(userId, `✅ *Withdrawal Approved!*\n💰 ₹${amount} sent to your UPI!`, { parse_mode: 'Markdown' });
    }
  }
  res.redirect('/withdrawals');
});

// Reject withdrawal
app.post('/withdraw/reject', isAuthenticated, async (req, res) => {
  const { withdrawalId, userId, amount } = req.body;
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (withdrawal) {
    withdrawal.status = 'rejected';
    await withdrawal.save();
    
    const user = await User.findOne({ telegramId: userId });
    if (user) {
      user.balance += parseFloat(amount);
      user.withdrawPending = false;
      await user.save();
      await bot.sendMessage(userId, `❌ *Withdrawal Rejected*\n₹${amount} added back to your balance.`, { parse_mode: 'Markdown' });
    }
  }
  res.redirect('/withdrawals');
});

// Broadcast
app.get('/broadcast', isAuthenticated, (req, res) => {
  res.render('broadcast');
});

app.post('/broadcast/send', isAuthenticated, async (req, res) => {
  const { message } = req.body;
  const users = await User.find({ banned: false });
  let sent = 0, failed = 0;
  
  for (const user of users) {
    try {
      await bot.sendMessage(user.telegramId, `📢 *Admin Broadcast:*\n\n${message}`, { parse_mode: 'Markdown' });
      sent++;
    } catch { failed++; }
    await new Promise(r => setTimeout(r, 50));
  }
  
  await BroadcastLog.create({ message, sentCount: sent, failedCount: failed });
  res.redirect('/broadcast');
});

// Settings
app.get('/settings', isAuthenticated, async (req, res) => {
  const welcomeBonus = await getSetting('welcome_bonus', 5);
  const referBonus = await getSetting('refer_bonus', 1.5);
  const minWithdraw = await getSetting('min_withdraw', 20);
  const welcomeMessage = await getSetting('welcome_message', WELCOME_MESSAGE);
  
  res.render('settings', { welcomeBonus, referBonus, minWithdraw, welcomeMessage });
});

app.post('/settings/update', isAuthenticated, async (req, res) => {
  const { welcome_bonus, refer_bonus, min_withdraw, welcome_message } = req.body;
  await setSetting('welcome_bonus', parseFloat(welcome_bonus));
  await setSetting('refer_bonus', parseFloat(refer_bonus));
  await setSetting('min_withdraw', parseFloat(min_withdraw));
  await setSetting('welcome_message', welcome_message);
  res.redirect('/settings');
});

// Start Express server
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referbot')
  .then(() => {
    console.log('✅ MongoDB connected!');
    app.listen(PORT, () => {
      console.log(`✅ Admin Panel running on http://localhost:${PORT}`);
      console.log(`🔐 Login: cap1432 / cap1432`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));

module.exports = { bot, app };
