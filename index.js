// ─── CHANNEL MANAGEMENT ROUTES ───────────────────────────────────────────────

// Channels page
app.get('/channels', isAuthenticated, async (req, res) => {
  const channels = await Channel.find({});
  res.render('channels', { channels });
});

// Add channel
app.post('/channels/add', isAuthenticated, async (req, res) => {
  const { channelId, link, name } = req.body;
  
  // Validate
  if (!channelId || !link || !name) {
    return res.redirect('/channels');
  }
  
  await Channel.create({
    channelId: channelId.trim(),
    link: link.trim(),
    name: name.trim(),
    isActive: true
  });
  
  res.redirect('/channels');
});

// Toggle channel active/inactive
app.post('/channels/toggle', isAuthenticated, async (req, res) => {
  const { channelId, isActive } = req.body;
  await Channel.findByIdAndUpdate(channelId, { isActive: isActive === 'true' });
  res.redirect('/channels');
});

// Delete channel
app.post('/channels/delete', isAuthenticated, async (req, res) => {
  const { channelId } = req.body;
  await Channel.findByIdAndDelete(channelId);
  res.redirect('/channels');
});

// Test verification for a user
app.post('/channels/test', isAuthenticated, async (req, res) => {
  const { userId } = req.body;
  const channels = await Channel.find({ isActive: true });
  const results = [];
  
  for (const ch of channels) {
    try {
      let chatId = ch.channelId;
      // Convert @username to proper format for getChatMember
      if (ch.channelId.startsWith('@')) {
        chatId = ch.channelId;
      }
      const member = await bot.getChatMember(chatId, userId);
      results.push({
        name: ch.name,
        status: member.status,
        isMember: ['member', 'administrator', 'creator'].includes(member.status)
      });
    } catch (error) {
      results.push({
        name: ch.name,
        status: 'ERROR',
        isMember: false,
        error: error.message
      });
    }
  }
  
  let resultHtml = '<h3>Test Results:</h3><ul>';
  results.forEach(r => {
    resultHtml += `<li>${r.name}: ${r.isMember ? '✅ Member' : '❌ Not Member'} (${r.status})</li>`;
  });
  resultHtml += '</ul><a href="/channels">Back</a>';
  
  res.send(resultHtml);
});

// Update the checkAllChannels function to use database channels
async function checkAllChannels(userId) {
  const channels = await Channel.find({ isActive: true });
  if (channels.length === 0) return true; // No channels to check
  
  for (const ch of channels) {
    try {
      let chatId = ch.channelId;
      if (ch.channelId.startsWith('@')) {
        chatId = ch.channelId;
      }
      const member = await bot.getChatMember(chatId, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) {
        return false;
      }
    } catch (error) {
      console.error(`Error checking channel ${ch.name}:`, error.message);
      return false;
    }
  }
  return true;
}

// Update channelButtons function to use database channels
async function channelButtons() {
  const channels = await Channel.find({ isActive: true });
  const buttons = channels.map(ch => [{ text: `📢 ${ch.name}`, url: ch.link }]);
  buttons.push([{ text: '✅ Joined — Verify Karo', callback_data: 'verify_join' }]);
  return { inline_keyboard: buttons };
}
