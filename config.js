require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || '8156079110:AAHWYYrBk8DkDjAnuQ9I0Fk-0NcQgA9KuQk',
  ADMIN_ID: process.env.ADMIN_ID || '1804574038',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/referbot',
  
  // Admin Panel Login (Cap1432)
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'cap1432',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'cap1432',
  
  // Session Secret
  SESSION_SECRET: process.env.SESSION_SECRET || 'your_secret_key_here_change_it',
  
  // Bot Username
  BOT_USERNAME: '@Refer_and_earn000_bot',
  
  // Bonus Settings (Admin panel se change ho sakte hain)
  WELCOME_BONUS: parseFloat(process.env.WELCOME_BONUS) || 5,
  REFER_BONUS: parseFloat(process.env.REFER_BONUS) || 1.5,
  MIN_WITHDRAW: parseFloat(process.env.MIN_WITHDRAW) || 20,
  
  // Welcome Message (Admin se set hoga)
  WELCOME_MESSAGE: process.env.WELCOME_MESSAGE || '🎉 *Swagat Hai {name}!*\\n\\n💎 Refer & Earn Bot mein aapka swagat hai!\\n\\n📌 *Pehle Ye Karo:*\\nNiche diye sare channels join karo aur *₹5 instant* pao!',
  
  // Channels
  CHANNELS: [
    { id: '@YourChannel1', link: 'https://t.me/+Bn4o5bn-QY84NGJl', name: 'Channel 1 — Main' },
    { id: '@YourChannel2', link: 'https://t.me/captain_earn', name: 'Channel 2 — Updates' },

  ]
};
