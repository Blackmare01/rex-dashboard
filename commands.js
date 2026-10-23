const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Check whether Rex is responding.'),
  new SlashCommandBuilder().setName('help').setDescription('Show Rex command help.'),
  new SlashCommandBuilder().setName('dashboard').setDescription('Open the Rex server dashboard.'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Show information about this server.'),
  new SlashCommandBuilder().setName('userinfo').setDescription('Show information about a server member.')
    .addUserOption(option => option.setName('member').setDescription('Member to inspect').setRequired(false)),
  new SlashCommandBuilder().setName('automod').setDescription('Check AutoMod runtime status.'),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a member.')
    .addUserOption(option => option.setName('member').setDescription('Member to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for the warning').setRequired(true).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member.')
    .addUserOption(option => option.setName('member').setDescription('Member to timeout').setRequired(true))
    .addIntegerOption(option => option.setName('minutes').setDescription('Duration, from 1 to 10080 minutes').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addStringOption(option => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('kick').setDescription('Kick a member.')
    .addUserOption(option => option.setName('member').setDescription('Member to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member.')
    .addUserOption(option => option.setName('member').setDescription('Member to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('purge').setDescription('Delete recent messages in this channel.')
    .addIntegerOption(option => option.setName('amount').setDescription('Number of messages, 1 to 100').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(command => command.toJSON());

module.exports = { commands };
