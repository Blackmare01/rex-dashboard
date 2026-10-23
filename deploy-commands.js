const { REST, Routes } = require('discord.js');
require('./bot-env');
const { commands } = require('./commands');

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.REX_TEST_GUILD_ID;
if (!token || !clientId) {
  console.error('Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID in .dev.vars or the environment.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);
rest.put(route, { body: commands })
  .then(() => console.log(`Registered ${commands.length} Rex slash commands${guildId ? ' for the test server' : ' globally'}.`))
  .catch(error => { console.error('Could not register Rex commands:', error.message); process.exitCode = 1; });
