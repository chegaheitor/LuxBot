import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} from 'discord.js';
import { getOrCreateRecruta, getActiveFarmChannel, deleteRecruta } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('Visualiza o perfil e estatísticas completas de um membro.')
  .addUserOption(option =>
    option.setName('membro')
      .setDescription('O membro que você deseja consultar')
      .setRequired(true)
  );

// Gera o Embed unificado do perfil
export function generatePerfilEmbed(targetUser, recruta) {
  const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 256 });
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  
  const farmChannel = getActiveFarmChannel(targetUser.id);
  const farmFolderStr = farmChannel ? `<#${farmChannel.canalId}>` : '❌ Nenhuma pasta ativa';

  const activeWarnings = recruta.warnings ? recruta.warnings.filter(w => w.active).length : 0;
  const totalAusencias = recruta.ausencias ? recruta.ausencias.length : 0;
  const totalVendas = recruta.vendas ? recruta.vendas.length : 0;
  const totalEncomendas = recruta.encomendas ? recruta.encomendas.length : 0;
  const totalMetas = recruta.metas ? recruta.metas.length : 0;

  const embed = new EmbedBuilder()
    .setAuthor({ name: `Perfil de ${targetUser.username}`, iconURL: avatarUrl })
    .setTitle('👤 PERFIL DO MEMBRO 👤')
    .setThumbnail(avatarUrl)
    .setDescription('Informações de registro de membro e histórico de atividades no banco de dados da Lux.')
    .setColor(3447003) // Azul
    .addFields(
      { name: '🔠 Nome Personagem', value: recruta.nome || 'Não registrado', inline: true },
      { name: '💳 ID no Jogo', value: recruta.gameId || 'Nenhum', inline: true },
      { name: '💼 Cargo na Guilda', value: recruta.cargo || 'Nenhum', inline: true },
      { name: '✨ Status do Set', value: recruta.status || 'NÃO_REGISTRADO', inline: true },
      { name: '📞 Telefone', value: recruta.telefone || 'Não informado', inline: true },
      { name: '📋 Recrutador (ID)', value: recruta.recrutadorId || 'Não informado', inline: true },
      { name: '📁 Pasta de Farm', value: farmFolderStr, inline: false },
      { 
        name: '📊 Estatísticas de Atividade', 
        value: 
          `• ⚠️ **Advertências Ativas:** \`${activeWarnings} / 3\`\n` +
          `• 🌾 **Metas de Farm:** \`${totalMetas}\` meta(s) declarada(s)\n` +
          `• 🔴 **Ausências:** \`${totalAusencias}\` registro(s)\n` +
          `• 🛍️ **Vendas:** \`${totalVendas}\` venda(s)\n` +
          `• 📦 **Encomendas:** \`${totalEncomendas}\` encomenda(s)`
      }
    )
    .setFooter({ text: `LuxBot Perfil • ${dataAtual} • criado por chegaheitor` })
    .setTimestamp();

  return embed;
}

export async function execute(interaction) {
  try {
    const targetUser = interaction.options.getUser('membro');
    const recruta = getOrCreateRecruta(targetUser.id, targetUser.tag);

    const embed = generatePerfilEmbed(targetUser, recruta);
    
    // Botão de Excluir Perfil
    const deleteBtn = new ButtonBuilder()
      .setCustomId(`perfil_deletar_btn_${targetUser.id}`)
      .setLabel('Apagar Perfil')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️');

    const row = new ActionRowBuilder().addComponents(deleteBtn);

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Erro ao executar /perfil:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao buscar o perfil do membro.',
      ephemeral: true
    });
  }
}

// Trata as interações iniciadas por perfil_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. Clique no botão de Apagar Perfil
  if (customId.startsWith('perfil_deletar_btn_')) {
    try {
      const targetUserId = customId.replace('perfil_deletar_btn_', '');

      // Verificar permissão: somente o próprio usuário ou administradores
      const isSelf = interaction.user.id === targetUserId;
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isSelf && !isAdmin) {
        return await interaction.reply({
          content: '❌ Apenas o próprio membro ou administradores podem apagar este perfil!',
          ephemeral: true
        });
      }

      // Embed de confirmação de exclusão
      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ CONFIRMAÇÃO DE EXCLUSÃO ⚠️')
        .setDescription(
          `Você está prestes a apagar o perfil do usuário <@${targetUserId}> (${targetUserId}).\n\n` +
          `**Esta ação é irreversível!** Todos os dados cadastrais, logs de ausências, farms, vendas, encomendas e advertências desse membro serão permanentemente removidos.`
        )
        .setColor(15158332) // Vermelho
        .setFooter({ text: `LuxBot Perfil • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      const btnConfirmar = new ButtonBuilder()
        .setCustomId(`perfil_deletar_confirmar_${targetUserId}_${interaction.user.id}`)
        .setLabel('Confirmar Exclusão')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('✅');

      const btnCancelar = new ButtonBuilder()
        .setCustomId(`perfil_deletar_cancelar_${targetUserId}_${interaction.user.id}`)
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✖️');

      const row = new ActionRowBuilder().addComponents(btnConfirmar, btnCancelar);

      await interaction.update({
        embeds: [confirmEmbed],
        components: [row]
      });

    } catch (error) {
      console.error('Erro ao processar clique em apagar perfil:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao abrir a confirmação de exclusão.',
        ephemeral: true
      }).catch(() => null);
    }
    return;
  }

  // 2. Confirmação de Exclusão
  if (customId.startsWith('perfil_deletar_confirmar_')) {
    try {
      const parts = customId.replace('perfil_deletar_confirmar_', '').split('_');
      const targetUserId = parts[0];
      const executorId = parts[1];

      // Apenas quem iniciou o processo de exclusão pode confirmar
      if (interaction.user.id !== executorId) {
        return await interaction.reply({
          content: '❌ Apenas o usuário que iniciou a exclusão pode confirmar esta ação!',
          ephemeral: true
        });
      }

      // Executar exclusão do banco
      deleteRecruta(targetUserId);

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ PERFIL EXCLUÍDO ✅')
        .setDescription(`O perfil do usuário <@${targetUserId}> foi apagado com sucesso do banco de dados do LuxBot.`)
        .setColor(3066993) // Verde
        .setFooter({ text: `LuxBot Perfil • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      await interaction.update({
        embeds: [successEmbed],
        components: []
      });

      // Enviar log de exclusão de perfil
      const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ Perfil Excluído')
        .setColor(15158332)
        .setDescription(`O administrador/membro <@${interaction.user.id}> excluiu permanentemente a ficha de cadastro de <@${targetUserId}> (${targetUserId}).`)
        .setTimestamp();

      await sendLog(interaction.client, guild, 'perfil', logEmbed);

    } catch (error) {
      console.error('Erro ao confirmar exclusão de perfil:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao excluir o perfil do membro.',
        ephemeral: true
      }).catch(() => null);
    }
    return;
  }

  // 3. Cancelamento de Exclusão
  if (customId.startsWith('perfil_deletar_cancelar_')) {
    try {
      const parts = customId.replace('perfil_deletar_cancelar_', '').split('_');
      const targetUserId = parts[0];
      const executorId = parts[1];

      // Apenas quem iniciou o processo de exclusão pode cancelar
      if (interaction.user.id !== executorId) {
        return await interaction.reply({
          content: '❌ Apenas o usuário que iniciou a exclusão pode cancelar esta ação!',
          ephemeral: true
        });
      }

      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
      if (!targetUser) {
        return await interaction.update({
          content: '❌ Não foi possível carregar as informações do usuário para restaurar o perfil.',
          embeds: [],
          components: []
        });
      }

      const recruta = getOrCreateRecruta(targetUserId, targetUser.tag);
      const embed = generatePerfilEmbed(targetUser, recruta);

      const deleteBtn = new ButtonBuilder()
        .setCustomId(`perfil_deletar_btn_${targetUserId}`)
        .setLabel('Apagar Perfil')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const row = new ActionRowBuilder().addComponents(deleteBtn);

      await interaction.update({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Erro ao cancelar exclusão de perfil:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao restaurar o perfil.',
        ephemeral: true
      }).catch(() => null);
    }
    return;
  }
}
