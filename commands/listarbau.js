import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';
import { getBaus, getBau, deleteBau } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('listarbau')
  .setDescription('Lista todos os baús criados e permite remover baús.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Helper para gerar o embed de listagem de baús
function generateListEmbed(baus) {
  const embed = new EmbedBuilder()
    .setTitle('📋 BAÚS CADASTRADOS 📋')
    .setColor(12096338) // Cor terrosa/madeira
    .setTimestamp();

  if (baus.length === 0) {
    embed.setDescription('*Nenhum baú cadastrado no momento.*');
  } else {
    const listLines = baus.map((b, i) => {
      const uniqueItemsCount = Object.keys(b.itens || {}).filter(k => b.itens[k] > 0).length;
      return `**${i + 1}. 📦 ${b.nome}**\n   • Canal: <#${b.canalId}>\n   • Itens únicos cadastrados: \`${uniqueItemsCount}\`\n   • ID da Mensagem: \`${b.messageId}\``;
    }).join('\n\n');
    embed.setDescription(`Aqui estão todos os baús cadastrados no banco de dados:\n\n${listLines}`);
  }

  return embed;
}

export async function execute(interaction) {
  try {
    // Somente administradores podem usar
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ Somente membros com a permissão de Administrador podem utilizar este comando!',
        ephemeral: true
      });
    }

    const baus = getBaus();
    const embed = generateListEmbed(baus);

    const btnRemover = new ButtonBuilder()
      .setCustomId('listarbau_remover_btn')
      .setLabel('Remover Baú')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️')
      .setDisabled(baus.length === 0);

    const row = new ActionRowBuilder().addComponents(btnRemover);

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Erro ao executar o comando /listarbau:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao listar os baús.',
      ephemeral: true
    }).catch(() => null);
  }
}

// Trata as interações iniciadas por listarbau_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;

  // Somente administradores podem interagir com a exclusão de baús
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({
      content: '❌ Você não tem cargo de Administrador para realizar esta ação!',
      ephemeral: true
    });
  }

  // 1. Clique no botão de remover
  if (interaction.isButton() && customId === 'listarbau_remover_btn') {
    try {
      const baus = getBaus();
      if (baus.length === 0) {
        return await interaction.reply({
          content: '❌ Não existem baús para remover!',
          ephemeral: true
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId('listarbau_remover_select')
        .setPlaceholder('Escolha o baú que deseja remover...');

      const options = baus.map(b => {
        const channel = guild.channels.cache.get(b.canalId);
        const channelName = channel ? `#${channel.name}` : `ID: ${b.canalId}`;
        return {
          label: b.nome,
          description: `Canal: ${channelName}`,
          value: b.messageId
        };
      });

      menu.addOptions(options);

      const rowSelect = new ActionRowBuilder().addComponents(menu);

      const btnCancelar = new ButtonBuilder()
        .setCustomId('listarbau_cancelar_btn')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

      const rowCancel = new ActionRowBuilder().addComponents(btnCancelar);

      await interaction.update({
        components: [rowSelect, rowCancel]
      });

    } catch (error) {
      console.error('Erro ao preparar menu de exclusão de baú:', error);
      await interaction.reply({ content: '❌ Erro ao abrir menu de exclusão.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 2. Clique no botão cancelar
  if (interaction.isButton() && customId === 'listarbau_cancelar_btn') {
    try {
      const baus = getBaus();
      const embed = generateListEmbed(baus);

      const btnRemover = new ButtonBuilder()
        .setCustomId('listarbau_remover_btn')
        .setLabel('Remover Baú')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
        .setDisabled(baus.length === 0);

      const row = new ActionRowBuilder().addComponents(btnRemover);

      await interaction.update({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Erro ao cancelar exclusão de baú:', error);
    }
    return;
  }

  // 3. Seleção de baú no select menu
  if (interaction.isStringSelectMenu() && customId === 'listarbau_remover_select') {
    try {
      const messageId = interaction.values[0];
      const chest = getBau(messageId);

      if (!chest) {
        return await interaction.reply({
          content: '❌ O baú selecionado não foi localizado no banco de dados!',
          ephemeral: true
        });
      }

      // Deletar a mensagem do baú no Discord se ela existir
      const channel = await guild.channels.fetch(chest.canalId).catch(() => null);
      let msgDeletada = false;
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          await msg.delete().catch(err => console.error('Erro ao deletar mensagem do baú:', err));
          msgDeletada = true;
        }
      }

      // Remover do banco de dados
      deleteBau(messageId);

      // Enviar log de exclusão
      const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ Baú Removido')
        .setColor(15158332) // Vermelho
        .setDescription(`O administrador <@${interaction.user.id}> removeu completamente o baú **${chest.nome}**.`)
        .addFields(
          { name: '📦 Nome do Baú:', value: chest.nome, inline: true },
          { name: '📢 Canal de Origem:', value: `<#${chest.canalId}>`, inline: true },
          { name: '✉️ Mensagem Deletada:', value: msgDeletada ? 'Sim' : 'Não (Mensagem não localizada/deletada manualmente)', inline: true }
        )
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registrobau', logEmbed);

      // Atualiza o painel do listarbau
      const updatedBaus = getBaus();
      const updatedEmbed = generateListEmbed(updatedBaus);

      const btnRemover = new ButtonBuilder()
        .setCustomId('listarbau_remover_btn')
        .setLabel('Remover Baú')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
        .setDisabled(updatedBaus.length === 0);

      const row = new ActionRowBuilder().addComponents(btnRemover);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [row]
      });

      // Feedback efêmero de confirmação
      await interaction.followUp({
        content: `✅ O baú **${chest.nome}** foi removido com sucesso e seus dados foram excluídos!`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Erro ao remover baú via select menu:', error);
      await interaction.reply({ content: '❌ Erro ao remover o baú selecionado.', ephemeral: true }).catch(() => null);
    }
  }
}
