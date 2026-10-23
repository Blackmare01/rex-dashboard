const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
require('./bot-env');

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN is missing. Add your bot token to .dev.vars, then run npm run bot again.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', readyClient => {
  console.log(`Rex is online as ${readyClient.user.tag}. Keep this terminal running while you test.`);
  console.log(`Connected to ${readyClient.guilds.cache.size} server(s): ${readyClient.guilds.cache.map(guild => `${guild.name} (${guild.id})`).join(', ') || 'none'}`);
});

function reasonOf(interaction) {
  return interaction.options.getString('reason') || `Requested by ${interaction.user.tag}`;
}

async function handleCommand(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: 'Use Rex commands inside a server.', ephemeral: true });
  }

  const { commandName } = interaction;
  if (commandName === 'ping') return interaction.reply(`Pong! ${client.ws.ping}ms`);
  if (commandName === 'help') return interaction.reply({
    content: '**Rex commands**\n`/dashboard`, `/ping`, `/serverinfo`, `/userinfo`, `/automod`\nModeration: `/warn`, `/timeout`, `/kick`, `/ban`, `/purge`',
    ephemeral: true
  });
  if (commandName === 'dashboard') {
    const dashboard = process.env.REX_DASHBOARD_URL || 'http://localhost:8788';
    return interaction.reply({ content: `Open the Rex dashboard: ${dashboard}`, ephemeral: true });
  }
  if (commandName === 'serverinfo') return interaction.reply({
    content: `**${interaction.guild.name}**\nMembers: ${interaction.guild.memberCount}\nServer ID: ${interaction.guildId}`,
    ephemeral: true
  });
  if (commandName === 'userinfo') {
    const user = interaction.options.getUser('member') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    return interaction.reply({ content: `**${user.tag}**\nUser ID: ${user.id}\nJoined: ${member?.joinedAt?.toLocaleDateString() || 'Unknown'}`, ephemeral: true });
  }
  if (commandName === 'automod') return interaction.reply({
    content: 'Rex is online. AutoMod dashboard settings are stored, but message filtering is not connected to the bot runtime yet.',
    ephemeral: true
  });

  const target = interaction.options.getMember('member');
  if (['warn', 'timeout', 'kick', 'ban'].includes(commandName)) {
    if (!target) return interaction.reply({ content: 'That member is no longer in this server.', ephemeral: true });
    if (target.id === interaction.user.id || target.id === client.user.id) return interaction.reply({ content: 'Choose another server member.', ephemeral: true });
    if (!target.manageable) return interaction.reply({ content: 'Rex cannot moderate that member. Check role order and bot permissions.', ephemeral: true });
    const reason = reasonOf(interaction);
    try {
      if (commandName === 'warn') {
        await target.send(`You were warned in **${interaction.guild.name}**. Reason: ${reason}`).catch(() => {});
        return interaction.reply(`⚠️ ${target.user.tag} was warned. Reason: ${reason}`);
      }
      if (commandName === 'timeout') {
        const minutes = interaction.options.getInteger('minutes');
        await target.timeout(minutes * 60_000, reason);
        return interaction.reply(`⏱️ ${target.user.tag} was timed out for ${minutes} minute(s). Reason: ${reason}`);
      }
      if (commandName === 'kick') {
        await target.kick(reason);
        return interaction.reply(`👢 ${target.user.tag} was kicked. Reason: ${reason}`);
      }
      await interaction.guild.members.ban(target.id, { reason });
      return interaction.reply(`🔨 ${target.user.tag} was banned. Reason: ${reason}`);
    } catch (error) {
      console.error(`/${commandName} failed:`, error.message);
      return interaction.reply({ content: 'Discord rejected that action. Check Rex’s permissions and role position.', ephemeral: true });
    }
  }

  if (commandName === 'purge') {
    if (!interaction.channel?.isTextBased() || !('bulkDelete' in interaction.channel)) return interaction.reply({ content: 'This command needs a regular text channel.', ephemeral: true });
    const amount = interaction.options.getInteger('amount');
    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({ content: `🧹 Deleted ${deleted.size} recent message(s). Messages older than 14 days are skipped by Discord.`, ephemeral: true });
    } catch (error) {
      console.error('/purge failed:', error.message);
      return interaction.reply({ content: 'Could not delete messages. Check Rex’s Manage Messages permission.', ephemeral: true });
    }
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try { await handleCommand(interaction); }
  catch (error) {
    console.error('Command failed:', error.message);
    const response = { content: 'Rex hit an error handling that command. Try again.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});

client.on('error', error => console.error('Discord connection error:', error.message));
process.on('SIGINT', () => { console.log('\nStopping Rex.'); client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
client.login(token).catch(error => {
  console.error('Rex could not connect to Discord. Check the bot token and Developer Portal settings:', error.message);
  process.exit(1);
});
