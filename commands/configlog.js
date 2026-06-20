import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ChannelSelectMenuBuilder, 
  ChannelType, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { saveLogChannel, getLogChannel } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('configlog')
  .setDescription('Configura os canais de logs para cada comando do bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Obtém dinamicamente todos os comandos da pasta commands/
function getCommandNames() {
  try {
    const commandsPath = path.resolve('commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    return commandFiles.map(file => file.replace('.js', ''));
  } catch (error) {
    console.error('Erro ao ler a pasta de comandos:', error);
    return [];
  }
}

// Constrói o Embed Principal de Logs
function buildLogConfigEmbed() {
  const commands = getCommandNames();
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  
  const statusLines = commands.map(cmd => {
    const channelId = getLogChannel(cmd);
    const channelText = channelId ? `<#${channelId}>` : '❌ *Não Configurado*';
    return `• **/${cmd}**: ${channelText}`;
  });

  return new EmbedBuilder()
    .setTitle('📋 CONFIGURAÇÃO DE LOGS 📋')
    .setDescription(
      'Associe cada comando a um canal de texto específico para receber os logs de suas ações. ' +
      'Se nenhum canal estiver configurado, os logs daquele comando serão desativados.\n\n' +
      '**Configuração Atual por Comando:**\n' +
      (statusLines.join('\n') || '*Nenhum comando localizado.*')
    )
    .setColor(3447003)
    .setFooter({ text: `LuxBot Configuração de Logs • ${dataAtual} • criado por chegaheitor` })
    .setTimestamp();
}

// Constrói o Select Menu para escolher qual comando configurar
function buildLogConfigSelect() {
  const commands = getCommandNames();
  
  if (commands.length === 0) return null;

  const options = commands.map(cmd => ({
    label: `/${cmd}`,
    description: `Configurar log do comando /${cmd}`,
    value: cmd
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('log_config_select_command')
    .setPlaceholder('Selecione o comando para configurar o canal...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

export async function execute(interaction) {
  try {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ Apenas administradores podem usar este comando.',
        ephemeral: true
      });
    }

    const embed = buildLogConfigEmbed();
    const row = buildLogConfigSelect();

    const payload = { embeds: [embed] };
    if (row) payload.components = [row];

    await interaction.reply(payload);
  } catch (error) {
    console.error('Erro ao executar /configlog:', error);
    await interaction.reply({ content: 'Erro ao abrir painel de logs.', ephemeral: true });
  }
}

// Trata as interações iniciadas pelo prefixo log_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. StringSelectMenu -> Selecionou qual comando quer configurar
  if (customId === 'log_config_select_command') {
    try {
      const selectedCommand = interaction.values[0];

      const embedSelect = new EmbedBuilder()
        .setTitle(`⚙️ CONFIGURAR LOG: /${selectedCommand.toUpperCase()} ⚙️`)
        .setDescription(
          `Selecione abaixo o canal de texto do Discord para onde serão enviados os logs de ações do comando **/${selectedCommand}**.\n\n` +
          `Para desativar os logs deste comando, clique em **Desativar Logs**.`
        )
        .setColor(3447003)
        .setFooter({ text: `LuxBot Configuração de Logs • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`log_config_select_channel_${selectedCommand}`)
        .setPlaceholder(`Selecione o canal para logs de /${selectedCommand}...`)
        .addChannelTypes(ChannelType.GuildText);

      const btnDesativar = new ButtonBuilder()
        .setCustomId(`log_config_disable_${selectedCommand}`)
        .setLabel('Desativar Logs')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const btnCancelar = new ButtonBuilder()
        .setCustomId('log_config_cancel')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary);

      const rowSelect = new ActionRowBuilder().addComponents(channelSelect);
      const rowButtons = new ActionRowBuilder().addComponents(btnDesativar, btnCancelar);

      await interaction.update({ embeds: [embedSelect], components: [rowSelect, rowButtons] });
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 2. Cancelou -> Volta para a lista principal
  if (customId === 'log_config_cancel') {
    try {
      const embed = buildLogConfigEmbed();
      const row = buildLogConfigSelect();
      await interaction.update({ embeds: [embed], components: row ? [row] : [] });
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 3. Desativou Logs -> Limpa o canal e volta para o principal
  if (customId.startsWith('log_config_disable_')) {
    try {
      const commandName = customId.replace('log_config_disable_', '');
      
      saveLogChannel(commandName, null);

      const embed = buildLogConfigEmbed();
      const row = buildLogConfigSelect();
      await interaction.update({ embeds: [embed], components: row ? [row] : [] });

      // Envia log de alteração de logs
      const logEmbed = new EmbedBuilder()
        .setTitle('📢 Configuração de Logs Desativada')
        .setColor(15158332)
        .setDescription(`O administrador <@${interaction.user.id}> desativou os logs para o comando **/${commandName}**.`)
        .setTimestamp();

      await sendLog(interaction.client, guild, 'configlog', logEmbed);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 4. ChannelSelectMenu -> Escolheu o canal
  if (customId.startsWith('log_config_select_channel_')) {
    try {
      const commandName = customId.replace('log_config_select_channel_', '');
      const selectedChannelId = interaction.values[0];

      saveLogChannel(commandName, selectedChannelId);

      const embed = buildLogConfigEmbed();
      const row = buildLogConfigSelect();
      await interaction.update({ embeds: [embed], components: row ? [row] : [] });

      // Envia log de alteração de logs
      const logEmbed = new EmbedBuilder()
        .setTitle('📢 Configuração de Logs Atualizada')
        .setColor(3066993)
        .setDescription(`O administrador <@${interaction.user.id}> configurou os logs do comando **/${commandName}** para o canal <#${selectedChannelId}>.`)
        .setTimestamp();

      await sendLog(interaction.client, guild, 'configlog', logEmbed);
    } catch (e) {
      console.error(e);
    }
    return;
  }
}
