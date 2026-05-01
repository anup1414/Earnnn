require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || '8156079110:AABWYYRk8DkDjAnuQ9I0Fk-ONcQgA9KuQK',
  ADMIN_ID: process.env.ADMIN_ID || '1804574038',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/referbot',
  
  // Admin Panel Login
  ADMIN_USERNAME: 'cap1432',
  ADMIN_PASSWORD: 'cap1432',
  
  // Session Secret
  SESSION_SECRET: 'cap1432_super_secret_key_2025',
  
  // Bot Username
  BOT_USERNAME: '@Refer_and_earn000_bot',
  
  // Bonus Settings
  WELCOME_BONUS: 5,
  REFER_BONUS: 1.5,
  MIN_WITHDRAW: 20,
  
  // Welcome Message
  WELCOME_MESSAGE: '🎉 *Swagat Hai {name}!* 🎉\n\n💎 Refer & Earn Bot mein aapka swagat hai!\n\n📌 *Pehle Ye Karo:*\n⭐ Niche diye sare channels join karo\n⭐ *₹5 instant* welcome bonus pao!',
  
  // Channels - YAHAN FIX KIYA
  CHANNELS: [
    { id: '@bn405bn-QY84NGJ1', link: 'https://t.me/+81o9PhdsxF5hOTI9', name: 'Channel 1 - Main' },
    { id: '@captain_earn', link: 'https://t.me/captain_earn', name: 'Channel 2 - Updates' }
  ]
};
