import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder
} from 'discord.js';
import { getOrCreateRecruta, getActiveFarmChannel, deleteRecruta, updateRecruta, getGlobalPerfilConfig, getRecrutas } from '../database.js';
import { sendLog } from '../logs.js';

function hasPerfilPessoalPermission(interaction) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  const config = getGlobalPerfilConfig();
  if (config && config.cargosPessoalIds && Array.isArray(config.cargosPessoalIds)) {
    return config.cargosPessoalIds.some(roleId => interaction.member.roles.cache.has(roleId));
  }
  return false;
}

function hasPerfilAdminPermission(interaction) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  const config = getGlobalPerfilConfig();
  if (config && config.cargosAdminIds && Array.isArray(config.cargosAdminIds)) {
    return config.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId));
  }
  return false;
}

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
      { name: '📋 Recrutador', value: recruta.recrutadorId ? `<@${recruta.recrutadorId}>` : 'Não informado', inline: true },
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
    .setFooter({ text: `LuxBot Perfil • criado por chegaheitor` })
    .setTimestamp();

  return embed;
}

export async function execute(interaction) {
  try {
    const recrutas = getRecrutas();
    const isAccepted = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      recrutas.some(r => r.discordId === interaction.user.id && r.status === 'ACEITO');

    if (!isAccepted) {
      return await interaction.reply({
        content: '❌ Você precisa ter seu recrutamento aceito para usar este comando!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('membro');
    const recruta = getOrCreateRecruta(targetUser.id, targetUser.tag);

    const embed = generatePerfilEmbed(targetUser, recruta);
    
    // Botões de Ação
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`perfil_edit_nome_${targetUser.id}`).setLabel('Alterar Nome').setStyle(ButtonStyle.Primary).setEmoji('🔠'),
      new ButtonBuilder().setCustomId(`perfil_edit_id_${targetUser.id}`).setLabel('Alterar ID').setStyle(ButtonStyle.Primary).setEmoji('💳'),
      new ButtonBuilder().setCustomId(`perfil_edit_telefone_${targetUser.id}`).setLabel('Alterar Telefone').setStyle(ButtonStyle.Primary).setEmoji('📞')
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`perfil_edit_cargo_${targetUser.id}`).setLabel('Alterar Cargo').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
      new ButtonBuilder().setCustomId(`perfil_edit_recrutador_${targetUser.id}`).setLabel('Alterar Recrutador').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
      new ButtonBuilder().setCustomId(`perfil_toggle_set_${targetUser.id}`).setLabel('Alterar Set').setStyle(ButtonStyle.Success).setEmoji('✨'),
      new ButtonBuilder().setCustomId(`perfil_deletar_btn_${targetUser.id}`).setLabel('Apagar Perfil').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2]
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

  const recrutas = getRecrutas();
  const isAccepted = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
    recrutas.some(r => r.discordId === interaction.user.id && r.status === 'ACEITO');

  if (!isAccepted) {
    return await interaction.reply({
      content: '❌ Você precisa ter seu recrutamento aceito para interagir com o bot!',
      ephemeral: true
    });
  }

  // Submissão de modais
  if (interaction.isModalSubmit()) {
    if (customId.startsWith('perfil_modal_nome_')) {
      try {
        const targetUserId = customId.replace('perfil_modal_nome_', '');
        const novoNome = interaction.fields.getTextInputValue('nome_input').trim();
        
        updateRecruta(targetUserId, { nome: novoNome });
        const recruta = getOrCreateRecruta(targetUserId);

        // Alterar nickname no servidor para NOME | ID
        const member = await guild.members.fetch(targetUserId).catch(() => null);
        if (member) {
          const newNickname = `${novoNome} | ${recruta.gameId || ''}`;
          if (newNickname.length <= 32) {
            await member.setNickname(newNickname).catch(e => console.error('Erro ao alterar apelido:', e));
          } else {
            await member.setNickname(newNickname.substring(0, 32)).catch(e => console.error('Erro ao alterar apelido (truncado):', e));
          }
        }
        
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        const embed = generatePerfilEmbed(targetUser, recruta);
        
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perfil_edit_nome_${targetUserId}`).setLabel('Alterar Nome').setStyle(ButtonStyle.Primary).setEmoji('🔠'),
          new ButtonBuilder().setCustomId(`perfil_edit_id_${targetUserId}`).setLabel('Alterar ID').setStyle(ButtonStyle.Primary).setEmoji('💳'),
          new ButtonBuilder().setCustomId(`perfil_edit_telefone_${targetUserId}`).setLabel('Alterar Telefone').setStyle(ButtonStyle.Primary).setEmoji('📞')
        );
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perfil_edit_cargo_${targetUserId}`).setLabel('Alterar Cargo').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
          new ButtonBuilder().setCustomId(`perfil_edit_recrutador_${targetUserId}`).setLabel('Alterar Recrutador').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
          new ButtonBuilder().setCustomId(`perfil_toggle_set_${targetUserId}`).setLabel('Alterar Set').setStyle(ButtonStyle.Success).setEmoji('✨'),
          new ButtonBuilder().setCustomId(`perfil_deletar_btn_${targetUserId}`).setLabel('Apagar Perfil').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );
        
        await interaction.update({ embeds: [embed], components: [row1, row2] });
        return await interaction.followUp({ content: `✅ Nome de <@${targetUserId}> alterado para **${novoNome}** com sucesso!`, ephemeral: true });
      } catch (error) {
        console.error(error);
      }
      return;
    }
    
    if (customId.startsWith('perfil_modal_id_')) {
      try {
        const targetUserId = customId.replace('perfil_modal_id_', '');
        const novoId = interaction.fields.getTextInputValue('id_input').trim();
        
        updateRecruta(targetUserId, { gameId: novoId });
        const recruta = getOrCreateRecruta(targetUserId);

        // Alterar nickname no servidor para NOME | ID
        const member = await guild.members.fetch(targetUserId).catch(() => null);
        if (member) {
          const newNickname = `${recruta.nome || ''} | ${novoId}`;
          if (newNickname.length <= 32) {
            await member.setNickname(newNickname).catch(e => console.error('Erro ao alterar apelido:', e));
          } else {
            await member.setNickname(newNickname.substring(0, 32)).catch(e => console.error('Erro ao alterar apelido (truncado):', e));
          }
        }
        
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        const embed = generatePerfilEmbed(targetUser, recruta);
        
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perfil_edit_nome_${targetUserId}`).setLabel('Alterar Nome').setStyle(ButtonStyle.Primary).setEmoji('🔠'),
          new ButtonBuilder().setCustomId(`perfil_edit_id_${targetUserId}`).setLabel('Alterar ID').setStyle(ButtonStyle.Primary).setEmoji('💳'),
          new ButtonBuilder().setCustomId(`perfil_edit_telefone_${targetUserId}`).setLabel('Alterar Telefone').setStyle(ButtonStyle.Primary).setEmoji('📞')
        );
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perfil_edit_cargo_${targetUserId}`).setLabel('Alterar Cargo').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
          new ButtonBuilder().setCustomId(`perfil_edit_recrutador_${targetUserId}`).setLabel('Alterar Recrutador').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
          new ButtonBuilder().setCustomId(`perfil_toggle_set_${targetUserId}`).setLabel('Alterar Set').setStyle(ButtonStyle.Success).setEmoji('✨'),
          new ButtonBuilder().setCustomId(`perfil_deletar_btn_${targetUserId}`).setLabel('Apagar Perfil').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );
        
        await interaction.update({ embeds: [embed], components: [row1, row2] });
        return await interaction.followUp({ content: `✅ ID de <@${targetUserId}> alterado para **${novoId}** com sucesso!`, ephemeral: true });
      } catch (error) {
        console.error(error);
      }
      return;
    }

    if (customId.startsWith('perfil_modal_telefone_')) {
      try {
        const targetUserId = customId.replace('perfil_modal_telefone_', '');
        const novoTel = interaction.fields.getTextInputValue('telefone_input').trim();
        
        updateRecruta(targetUserId, { telefone: novoTel });
        
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        const recruta = getOrCreateRecruta(targetUserId);
        const embed = generatePerfilEmbed(targetUser, recruta);
        
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perfil_edit_nome_${targetUserId}`).setLabel('Alterar Nome').setStyle(ButtonStyle.Primary).setEmoji('🔠'),
          new ButtonBuilder().setCustomId(`perfil_edit_id_${targetUserId}`).setLabel('Alterar ID').setStyle(ButtonStyle.Primary).setEmoji('💳'),
          new ButtonBuilder().setCustomId(`perfil_edit_telefone_${targetUserId}`).setLabel('Alterar Telefone').setStyle(ButtonStyle.Primary).setEmoji('📞')
        );
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perfil_edit_cargo_${targetUserId}`).setLabel('Alterar Cargo').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
          new ButtonBuilder().setCustomId(`perfil_edit_recrutador_${targetUserId}`).setLabel('Alterar Recrutador').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
          new ButtonBuilder().setCustomId(`perfil_toggle_set_${targetUserId}`).setLabel('Alterar Set').setStyle(ButtonStyle.Success).setEmoji('✨'),
          new ButtonBuilder().setCustomId(`perfil_deletar_btn_${targetUserId}`).setLabel('Apagar Perfil').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );
        
        await interaction.update({ embeds: [embed], components: [row1, row2] });
        return await interaction.followUp({ content: `✅ Telefone de <@${targetUserId}> alterado para **${novoTel}** com sucesso!`, ephemeral: true });
      } catch (error) {
        console.error(error);
      }
      return;
    }
  }

  // Submissão de Select Menus (User Select / Role Select)
  if (interaction.isUserSelectMenu() && customId.startsWith('perfil_select_recrutador_')) {
    try {
      const targetUserId = customId.replace('perfil_select_recrutador_', '');
      const recrutadorId = interaction.values[0];
      
      updateRecruta(targetUserId, { recrutadorId: recrutadorId });
      
      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
      const recruta = getOrCreateRecruta(targetUserId);
      const embed = generatePerfilEmbed(targetUser, recruta);
      
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`perfil_edit_nome_${targetUserId}`).setLabel('Alterar Nome').setStyle(ButtonStyle.Primary).setEmoji('🔠'),
        new ButtonBuilder().setCustomId(`perfil_edit_id_${targetUserId}`).setLabel('Alterar ID').setStyle(ButtonStyle.Primary).setEmoji('💳'),
        new ButtonBuilder().setCustomId(`perfil_edit_telefone_${targetUserId}`).setLabel('Alterar Telefone').setStyle(ButtonStyle.Primary).setEmoji('📞')
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`perfil_edit_cargo_${targetUserId}`).setLabel('Alterar Cargo').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
        new ButtonBuilder().setCustomId(`perfil_edit_recrutador_${targetUserId}`).setLabel('Alterar Recrutador').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
        new ButtonBuilder().setCustomId(`perfil_toggle_set_${targetUserId}`).setLabel('Alterar Set').setStyle(ButtonStyle.Success).setEmoji('✨'),
        new ButtonBuilder().setCustomId(`perfil_deletar_btn_${targetUserId}`).setLabel('Apagar Perfil').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
      );
      
      await interaction.update({
        content: null,
        embeds: [embed],
        components: [row1, row2]
      });
      return await interaction.followUp({ content: `✅ Recrutador de <@${targetUserId}> alterado para <@${recrutadorId}> com sucesso!`, ephemeral: true });
    } catch (error) {
      console.error(error);
    }
    return;
  }

  if (interaction.isRoleSelectMenu() && customId.startsWith('perfil_select_cargo_')) {
    try {
      const targetUserId = customId.replace('perfil_select_cargo_', '');
      const cargoId = interaction.values[0];
      
      const role = interaction.guild.roles.cache.get(cargoId);
      const cargoNome = role ? role.name : 'Cargo Discord';
      
      const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (member && role) {
        await member.roles.add(role.id).catch(() => null);
      }
      
      updateRecruta(targetUserId, { cargo: cargoNome });
      
      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
      const recruta = getOrCreateRecruta(targetUserId);
      const embed = generatePerfilEmbed(targetUser, recruta);
      
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`perfil_edit_nome_${targetUserId}`).setLabel('Alterar Nome').setStyle(ButtonStyle.Primary).setEmoji('🔠'),
        new ButtonBuilder().setCustomId(`perfil_edit_id_${targetUserId}`).setLabel('Alterar ID').setStyle(ButtonStyle.Primary).setEmoji('💳'),
        new ButtonBuilder().setCustomId(`perfil_edit_telefone_${targetUserId}`).setLabel('Alterar Telefone').setStyle(ButtonStyle.Primary).setEmoji('📞')
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`perfil_edit_cargo_${targetUserId}`).setLabel('Alterar Cargo').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
        new ButtonBuilder().setCustomId(`perfil_edit_recrutador_${targetUserId}`).setLabel('Alterar Recrutador').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
        new ButtonBuilder().setCustomId(`perfil_toggle_set_${targetUserId}`).setLabel('Alterar Set').setStyle(ButtonStyle.Success).setEmoji('✨'),
        new ButtonBuilder().setCustomId(`perfil_deletar_btn_${targetUserId}`).setLabel('Apagar Perfil').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
      );
      
      await interaction.update({
        content: null,
        embeds: [embed],
        components: [row1, row2]
      });
      return await interaction.followUp({ content: `✅ Cargo de <@${targetUserId}> alterado para **${cargoNome}** com sucesso!`, ephemeral: true });
    } catch (error) {
      console.error(error);
    }
    return;
  }

  // 1. Clique no botão de Apagar Perfil
  if (customId.startsWith('perfil_deletar_btn_')) {
    try {
      const targetUserId = customId.replace('perfil_deletar_btn_', '');

      // Verificar permissão
      if (!hasPerfilAdminPermission(interaction)) {
        return await interaction.reply({
          content: '❌ Você não tem a permissão administrativa de Perfil necessária para excluir perfis!',
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
        .setFooter({ text: `LuxBot Perfil • criado por chegaheitor` })
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
        .setFooter({ text: `LuxBot Perfil • criado por chegaheitor` })
        .setTimestamp();

      await interaction.update({
        embeds: [successEmbed],
        components: []
      });

      // Enviar log de exclusão de perfil
      const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ PERFIL EXCLUÍDO 🗑️')
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

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`perfil_edit_nome_${targetUserId}`).setLabel('Alterar Nome').setStyle(ButtonStyle.Primary).setEmoji('🔠'),
        new ButtonBuilder().setCustomId(`perfil_edit_id_${targetUserId}`).setLabel('Alterar ID').setStyle(ButtonStyle.Primary).setEmoji('💳'),
        new ButtonBuilder().setCustomId(`perfil_edit_telefone_${targetUserId}`).setLabel('Alterar Telefone').setStyle(ButtonStyle.Primary).setEmoji('📞')
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`perfil_edit_cargo_${targetUserId}`).setLabel('Alterar Cargo').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
        new ButtonBuilder().setCustomId(`perfil_edit_recrutador_${targetUserId}`).setLabel('Alterar Recrutador').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
        new ButtonBuilder().setCustomId(`perfil_toggle_set_${targetUserId}`).setLabel('Alterar Set').setStyle(ButtonStyle.Success).setEmoji('✨'),
        new ButtonBuilder().setCustomId(`perfil_deletar_btn_${targetUserId}`).setLabel('Apagar Perfil').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
      );

      await interaction.update({
        embeds: [embed],
        components: [row1, row2]
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

  // 4. Cliques nos botões de edição
  if (customId.startsWith('perfil_edit_nome_')) {
    const targetUserId = customId.replace('perfil_edit_nome_', '');
    if (!hasPerfilPessoalPermission(interaction)) {
      return await interaction.reply({ content: '❌ Você não tem a permissão necessária para alterar os dados pessoais deste perfil!', ephemeral: true });
    }
    
    const modal = new ModalBuilder()
      .setCustomId(`perfil_modal_nome_${targetUserId}`)
      .setTitle('🔠 Alterar Nome');
      
    const nameInput = new TextInputBuilder()
      .setCustomId('nome_input')
      .setLabel('NOVO NOME')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Digite o novo nome do personagem')
      .setRequired(true);
      
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    return await interaction.showModal(modal);
  }

  if (customId.startsWith('perfil_edit_id_')) {
    const targetUserId = customId.replace('perfil_edit_id_', '');
    if (!hasPerfilPessoalPermission(interaction)) {
      return await interaction.reply({ content: '❌ Você não tem a permissão necessária para alterar os dados pessoais deste perfil!', ephemeral: true });
    }
    
    const modal = new ModalBuilder()
      .setCustomId(`perfil_modal_id_${targetUserId}`)
      .setTitle('💳 Alterar ID');
      
    const idInput = new TextInputBuilder()
      .setCustomId('id_input')
      .setLabel('NOVO ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Digite o novo ID do jogo')
      .setRequired(true);
      
    modal.addComponents(new ActionRowBuilder().addComponents(idInput));
    return await interaction.showModal(modal);
  }

  if (customId.startsWith('perfil_edit_telefone_')) {
    const targetUserId = customId.replace('perfil_edit_telefone_', '');
    if (!hasPerfilPessoalPermission(interaction)) {
      return await interaction.reply({ content: '❌ Você não tem a permissão necessária para alterar os dados pessoais deste perfil!', ephemeral: true });
    }
    
    const modal = new ModalBuilder()
      .setCustomId(`perfil_modal_telefone_${targetUserId}`)
      .setTitle('📞 Alterar Telefone');
      
    const telInput = new TextInputBuilder()
      .setCustomId('telefone_input')
      .setLabel('NOVO TELEFONE')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Digite o novo telefone')
      .setRequired(true);
      
    modal.addComponents(new ActionRowBuilder().addComponents(telInput));
    return await interaction.showModal(modal);
  }

  if (customId.startsWith('perfil_edit_recrutador_')) {
    const targetUserId = customId.replace('perfil_edit_recrutador_', '');
    if (!hasPerfilAdminPermission(interaction)) {
      return await interaction.reply({ content: '❌ Você não tem permissão administrativa para alterar o recrutador deste perfil!', ephemeral: true });
    }
    
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(`perfil_select_recrutador_${targetUserId}`)
      .setPlaceholder('Selecione quem recrutou esta pessoa...')
      .setMinValues(1)
      .setMaxValues(1);
      
    const btnVoltar = new ButtonBuilder()
      .setCustomId(`perfil_voltar_card_${targetUserId}`)
      .setLabel('Voltar ao Perfil')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');
      
    const rowSelect = new ActionRowBuilder().addComponents(userSelect);
    const rowBtn = new ActionRowBuilder().addComponents(btnVoltar);
    
    return await interaction.update({
      content: 'Escolha abaixo o membro do servidor que realizou o recrutamento:',
      components: [rowSelect, rowBtn],
      embeds: []
    });
  }

  if (customId.startsWith('perfil_edit_cargo_')) {
    const targetUserId = customId.replace('perfil_edit_cargo_', '');
    if (!hasPerfilAdminPermission(interaction)) {
      return await interaction.reply({ content: '❌ Você não tem permissão administrativa para alterar o cargo deste perfil!', ephemeral: true });
    }
    
    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId(`perfil_select_cargo_${targetUserId}`)
      .setPlaceholder('Selecione o cargo do discord...')
      .setMinValues(1)
      .setMaxValues(1);
      
    const btnVoltar = new ButtonBuilder()
      .setCustomId(`perfil_voltar_card_${targetUserId}`)
      .setLabel('Voltar ao Perfil')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');
      
    const rowSelect = new ActionRowBuilder().addComponents(roleSelect);
    const rowBtn = new ActionRowBuilder().addComponents(btnVoltar);
    
    return await interaction.update({
      content: 'Escolha abaixo o cargo correspondente do Discord:',
      components: [rowSelect, rowBtn],
      embeds: []
    });
  }

  if (customId.startsWith('perfil_voltar_card_')) {
    const targetUserId = customId.replace('perfil_voltar_card_', '');
    const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return await interaction.reply({ content: 'Erro ao carregar usuário.', ephemeral: true });
    
    const recruta = getOrCreateRecruta(targetUserId);
    const embed = generatePerfilEmbed(targetUser, recruta);
    
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`perfil_edit_nome_${targetUserId}`).setLabel('Alterar Nome').setStyle(ButtonStyle.Primary).setEmoji('🔠'),
      new ButtonBuilder().setCustomId(`perfil_edit_id_${targetUserId}`).setLabel('Alterar ID').setStyle(ButtonStyle.Primary).setEmoji('💳'),
      new ButtonBuilder().setCustomId(`perfil_edit_telefone_${targetUserId}`).setLabel('Alterar Telefone').setStyle(ButtonStyle.Primary).setEmoji('📞')
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`perfil_edit_cargo_${targetUserId}`).setLabel('Alterar Cargo').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
      new ButtonBuilder().setCustomId(`perfil_edit_recrutador_${targetUserId}`).setLabel('Alterar Recrutador').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
      new ButtonBuilder().setCustomId(`perfil_toggle_set_${targetUserId}`).setLabel('Alterar Set').setStyle(ButtonStyle.Success).setEmoji('✨'),
      new ButtonBuilder().setCustomId(`perfil_deletar_btn_${targetUserId}`).setLabel('Apagar Perfil').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );
    
    return await interaction.update({
      content: null,
      embeds: [embed],
      components: [row1, row2]
    });
  }

  if (customId.startsWith('perfil_toggle_set_')) {
    const targetUserId = customId.replace('perfil_toggle_set_', '');
    if (!hasPerfilAdminPermission(interaction)) {
      return await interaction.reply({ content: '❌ Você não tem permissão administrativa para alterar o status do set deste perfil!', ephemeral: true });
    }
    
    const recruta = getOrCreateRecruta(targetUserId);
    const currentStatus = recruta.status || 'NÃO_REGISTRADO';
    
    const isApproved = ['ACEITO', 'APROVADO'].includes(currentStatus.toUpperCase());
    const newStatus = isApproved ? 'REVOGADO' : 'ACEITO';
    
    updateRecruta(targetUserId, { status: newStatus });
    
    const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
    const updatedRecruta = getOrCreateRecruta(targetUserId);
    const embed = generatePerfilEmbed(targetUser, updatedRecruta);
    
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`perfil_edit_nome_${targetUserId}`).setLabel('Alterar Nome').setStyle(ButtonStyle.Primary).setEmoji('🔠'),
      new ButtonBuilder().setCustomId(`perfil_edit_id_${targetUserId}`).setLabel('Alterar ID').setStyle(ButtonStyle.Primary).setEmoji('💳'),
      new ButtonBuilder().setCustomId(`perfil_edit_telefone_${targetUserId}`).setLabel('Alterar Telefone').setStyle(ButtonStyle.Primary).setEmoji('📞')
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`perfil_edit_cargo_${targetUserId}`).setLabel('Alterar Cargo').setStyle(ButtonStyle.Secondary).setEmoji('💼'),
      new ButtonBuilder().setCustomId(`perfil_edit_recrutador_${targetUserId}`).setLabel('Alterar Recrutador').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
      new ButtonBuilder().setCustomId(`perfil_toggle_set_${targetUserId}`).setLabel('Alterar Set').setStyle(ButtonStyle.Success).setEmoji('✨'),
      new ButtonBuilder().setCustomId(`perfil_deletar_btn_${targetUserId}`).setLabel('Apagar Perfil').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );
    
    await interaction.update({
      embeds: [embed],
      components: [row1, row2]
    });
    return await interaction.followUp({ content: `✅ Status do set de <@${targetUserId}> alterado para **${newStatus}**!`, ephemeral: true });
  }
}

