import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { 
  getAdvConfig, 
  addWarning, 
  getOrCreateRecruta, 
  revokeWarningByMessageId, 
  denyWarningRevocation, 
  getWarningByMessageId 
} from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('adv')
  .setDescription('Aplica uma advertência oficial a um membro.')
  .addUserOption(option =>
    option.setName('membro')
      .setDescription('O membro que receberá a advertência')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('motivo')
      .setDescription('O motivo da advertência')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('ate_quando')
      .setDescription('Duração/validade da advertência (ex: 7 dias, permanente, 30/06/2026)')
      .setRequired(true)
  );

export async function execute(interaction) {
  try {
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const config = getAdvConfig();

    if (!config) {
      return await interaction.reply({
        content: '❌ O sistema de advertências não está configurado! Peça para um administrador configurar usando o comando `/configadv`.',
        ephemeral: true
      });
    }

    const hasPermission = config.cargosStaffIds.some(roleId => interaction.member.roles.cache.has(roleId))
      || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasPermission) {
      return await interaction.reply({
        content: '❌ Você não tem cargo de Staff autorizado para aplicar advertências!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('membro');
    const motivo = interaction.options.getString('motivo').trim();
    const ateQuando = interaction.options.getString('ate_quando').trim();

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return await interaction.reply({
        content: '❌ Membro não encontrado no servidor!',
        ephemeral: true
      });
    }

    // Calcular nível de advertência localmente
    const recruta = getOrCreateRecruta(targetUser.id, targetUser.tag);
    const activeCountBefore = recruta.warnings ? recruta.warnings.filter(w => w.active).length : 0;
    const activeCount = Math.min(activeCountBefore + 1, 3);

    // Gerenciamento de cargos
    const getRolesForLevel = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return [val];
    };

    const rolesLevel1 = getRolesForLevel(config.cargo1Id);
    const rolesLevel2 = getRolesForLevel(config.cargo2Id);
    const rolesLevel3 = getRolesForLevel(config.cargo3Id);

    let rolesToAdd = [];
    let rolesToRemove = [];

    if (activeCount === 1) {
      rolesToAdd = rolesLevel1;
      rolesToRemove = [...rolesLevel2, ...rolesLevel3];
    } else if (activeCount === 2) {
      rolesToAdd = rolesLevel2;
      rolesToRemove = [...rolesLevel1, ...rolesLevel3];
    } else if (activeCount >= 3) {
      rolesToAdd = rolesLevel3;
      rolesToRemove = [...rolesLevel1, ...rolesLevel2];
    }

    // Aplicar alterações de cargos
    for (const rId of rolesToAdd) {
      if (rId && !member.roles.cache.has(rId)) {
        await member.roles.add(rId).catch(err => console.error('Erro ao adicionar cargo de advertência:', err));
      }
    }
    for (const rId of rolesToRemove) {
      if (rId && member.roles.cache.has(rId)) {
        await member.roles.remove(rId).catch(err => console.error('Erro ao remover cargo de advertência anterior:', err));
      }
    }

    // Anúncio público no canal de advertências
    const channel = await interaction.guild.channels.fetch(config.canalId).catch(() => null);
    let roleName = 'Nenhum';
    if (rolesToAdd.length > 0) {
      roleName = rolesToAdd.map(rId => {
        const r = interaction.guild.roles.cache.get(rId);
        return r ? `${r}` : 'Cargo Advertência';
      }).join(', ');
    }

    const pubEmbed = new EmbedBuilder()
      .setTitle('⚠️ ADVERTÊNCIA APLICADA ⚠️')
      .setDescription(`O membro ${targetUser} recebeu uma advertência oficial no servidor.`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setColor(15158332) // Vermelho
      .addFields(
        { name: '👤 Membro Advertido:', value: `${targetUser} (${targetUser.id})`, inline: true },
        { name: '✍️ Aplicado por:', value: `<@${interaction.user.id}>`, inline: true },
        { name: '⚠️ Nível de Advertência:', value: `**${activeCount} / 3**`, inline: true },
        { name: '📝 Motivo:', value: motivo, inline: false },
        { name: '📅 Validade:', value: ateQuando, inline: true },
        { name: '💼 Cargo Recebido:', value: roleName, inline: true }
      )
      .setFooter({ text: `LuxBot Advertências • ${dataAtual} • criado por chegaheitor` })
      .setTimestamp();

    const btnRevogar = new ButtonBuilder()
      .setCustomId('adv_solicitar_revogacao_btn')
      .setLabel('Revogar ADV')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚖️');

    const row = new ActionRowBuilder().addComponents(btnRevogar);

    let msgId = null;
    if (channel) {
      const msg = await channel.send({ embeds: [pubEmbed], components: [row] }).catch(err => console.error('Erro ao enviar mensagem de advertência:', err));
      if (msg) msgId = msg.id;
    }

    // Adiciona advertência no banco de dados
    addWarning(targetUser.id, targetUser.tag, {
      reason: motivo,
      authorId: interaction.user.id,
      ateQuando: ateQuando,
      messageId: msgId
    });

    // Responder de forma privada para o executor
    await interaction.reply({
      content: `✅ Advertência aplicada com sucesso para ${targetUser}! Nível atual: **${activeCount} / 3**.`,
      ephemeral: true
    });

    // Enviar log de advertência
    const logEmbed = new EmbedBuilder()
      .setTitle('⚠️ Advertência Aplicada')
      .setColor(15158332)
      .setDescription(`<@${interaction.user.id}> aplicou uma advertência em ${targetUser}.`)
      .addFields(
        { name: '👤 Advertido:', value: `${targetUser}`, inline: true },
        { name: '🔢 Advertências Ativas:', value: `**${activeCount} / 3**`, inline: true },
        { name: '📅 Validade:', value: ateQuando, inline: true },
        { name: '📝 Motivo:', value: motivo, inline: false }
      )
      .setTimestamp();

    await sendLog(interaction.client, interaction.guild, 'adv', logEmbed);

  } catch (error) {
    console.error('Erro ao aplicar advertência:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao aplicar a advertência.',
      ephemeral: true
    }).catch(() => null);
  }
}

// Trata as interações iniciadas por adv_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. Clique no botão de solicitar revogação
  if (interaction.isButton() && customId === 'adv_solicitar_revogacao_btn') {
    try {
      const messageId = interaction.message.id;
      const result = getWarningByMessageId(messageId);

      if (!result) {
        return await interaction.reply({
          content: '❌ Configurações desta advertência não localizadas no banco de dados.',
          ephemeral: true
        });
      }

      const { recruta, warning } = result;

      // Somente o usuário que recebeu a advertência pode clicar
      if (recruta.discordId !== interaction.user.id) {
        return await interaction.reply({
          content: '❌ Apenas o membro que recebeu esta advertência pode solicitar a sua revogação!',
          ephemeral: true
        });
      }

      if (!warning.active) {
        return await interaction.reply({
          content: '❌ Esta advertência já foi revogada ou removida!',
          ephemeral: true
        });
      }

      // Abre modal pedindo o motivo
      const modal = new ModalBuilder()
        .setCustomId(`adv_revogacao_solicitar_modal_${messageId}`)
        .setTitle('Solicitar Revogação de ADV');

      const motivoInput = new TextInputBuilder()
        .setCustomId('motivo_revogacao_input')
        .setLabel('POR QUE VOCÊ ESTÁ REVOGANDO A ADV?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Explique detalhadamente o motivo para solicitar a análise da revogação desta advertência...')
        .setMinLength(10)
        .setMaxLength(500)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
      return await interaction.showModal(modal);

    } catch (error) {
      console.error('Erro ao processar botão de revogação:', error);
      await interaction.reply({ content: '❌ Erro ao abrir formulário de revogação.', ephemeral: true }).catch(() => null);
    }
  }

  // 2. Submissão do modal de solicitação de revogação
  if (interaction.isModalSubmit() && customId.startsWith('adv_revogacao_solicitar_modal_')) {
    try {
      const originalMessageId = customId.replace('adv_revogacao_solicitar_modal_', '');
      const motivoSolicitado = interaction.fields.getTextInputValue('motivo_revogacao_input').trim();

      const result = getWarningByMessageId(originalMessageId);
      if (!result) {
        return await interaction.reply({
          content: '❌ Esta advertência não foi encontrada no banco de dados.',
          ephemeral: true
        });
      }

      const { warning } = result;
      const config = getAdvConfig();

      if (!config || !config.canalRevogacaoId) {
        return await interaction.reply({
          content: '❌ O canal de revogações da Staff não está configurado!',
          ephemeral: true
        });
      }

      const canalRevogacao = await guild.channels.fetch(config.canalRevogacaoId).catch(() => null);
      if (!canalRevogacao) {
        return await interaction.reply({
          content: '❌ Canal de revogações não localizado no servidor.',
          ephemeral: true
        });
      }

      const reqEmbed = new EmbedBuilder()
        .setTitle('⚖️ SOLICITAÇÃO DE REVOGAÇÃO ⚖️')
        .setDescription(`O membro <@${interaction.user.id}> solicitou análise e revogação de sua advertência.`)
        .setColor(15844367) // Amarelo
        .addFields(
          { name: '👤 Membro:', value: `<@${interaction.user.id}> (${interaction.user.id})`, inline: true },
          { name: '📝 Motivo Original:', value: warning.reason || 'Desconhecido', inline: true },
          { name: '📅 Validade original:', value: warning.ateQuando || 'Não informada', inline: true },
          { name: '💬 Motivo alegado para Revogar:', value: motivoSolicitado, inline: false },
          { name: '🔗 Link da ADV original:', value: `[Clique para ir à mensagem](https://discord.com/channels/${guild.id}/${interaction.channel.id}/${originalMessageId})`, inline: false }
        )
        .setFooter({ text: `LuxBot Advertências • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      const btnAceitar = new ButtonBuilder()
        .setCustomId(`adv_revogacao_aceitar_${originalMessageId}_${interaction.user.id}`)
        .setLabel('Aceitar')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const btnNegar = new ButtonBuilder()
        .setCustomId(`adv_revogacao_negar_${originalMessageId}_${interaction.user.id}`)
        .setLabel('Negar')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

      const row = new ActionRowBuilder().addComponents(btnAceitar, btnNegar);

      await canalRevogacao.send({ embeds: [reqEmbed], components: [row] });

      await interaction.reply({
        content: '✅ Sua solicitação foi enviada para o canal da Staff com sucesso! Aguarde a análise.',
        ephemeral: true
      });

    } catch (error) {
      console.error('Erro ao enviar solicitação de revogação:', error);
      await interaction.reply({ content: '❌ Erro ao enviar a solicitação.', ephemeral: true }).catch(() => null);
    }
  }

  // 3. Staff clica em "Aceitar"
  if (interaction.isButton() && customId.startsWith('adv_revogacao_aceitar_')) {
    try {
      const config = getAdvConfig();
      const hasPermission = config.cargosStaffIds.some(roleId => interaction.member.roles.cache.has(roleId))
        || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão de Staff para aceitar solicitações!',
          ephemeral: true
        });
      }

      const parts = customId.replace('adv_revogacao_aceitar_', '').split('_');
      const originalMessageId = parts[0];
      const warnedUserId = parts[1];

      // Revoga no banco de dados
      const activeCount = revokeWarningByMessageId(warnedUserId, originalMessageId, interaction.user.id);

      if (activeCount === null) {
        return await interaction.reply({
          content: '❌ Esta advertência já foi revogada ou não foi encontrada no banco!',
          ephemeral: true
        });
      }

      // Remover ou ajustar os cargos do membro
      const member = await guild.members.fetch(warnedUserId).catch(() => null);
      if (member) {
        const getRolesForLevel = (val) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          return [val];
        };

        const rolesLevel1 = getRolesForLevel(config.cargo1Id);
        const rolesLevel2 = getRolesForLevel(config.cargo2Id);
        const rolesLevel3 = getRolesForLevel(config.cargo3Id);

        let rolesToAdd = [];
        let rolesToRemove = [];

        if (activeCount === 0) {
          rolesToRemove = [...rolesLevel1, ...rolesLevel2, ...rolesLevel3];
        } else if (activeCount === 1) {
          rolesToAdd = rolesLevel1;
          rolesToRemove = [...rolesLevel2, ...rolesLevel3];
        } else if (activeCount === 2) {
          rolesToAdd = rolesLevel2;
          rolesToRemove = [...rolesLevel1, ...rolesLevel3];
        }

        for (const rId of rolesToAdd) {
          if (rId && !member.roles.cache.has(rId)) {
            await member.roles.add(rId).catch(err => console.error(err));
          }
        }
        for (const rId of rolesToRemove) {
          if (rId && member.roles.cache.has(rId)) {
            await member.roles.remove(rId).catch(err => console.error(err));
          }
        }
      }

      // Atualiza a mensagem original do /adv
      const originalChannel = await guild.channels.fetch(config.canalId).catch(() => null);
      if (originalChannel) {
        const origMsg = await originalChannel.messages.fetch(originalMessageId).catch(() => null);
        if (origMsg && origMsg.embeds.length > 0) {
          const origEmbed = origMsg.embeds[0];
          const updatedEmbed = EmbedBuilder.from(origEmbed)
            .setTitle('⚠️ ADVERTÊNCIA REVOGADA ⚠️')
            .setColor(0x808080) // Cinza
            .setDescription(`A advertência de <@${warnedUserId}> foi **REVOGADA** pela Staff.`)
            .addFields({ name: '⚖️ Revogada por:', value: `<@${interaction.user.id}>`, inline: true });

          await origMsg.edit({ embeds: [updatedEmbed], components: [] }).catch(err => console.error(err));
        }
      }

      // Atualiza a mensagem do canal de análise de revogações
      const acceptedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(3066993) // Verde
        .setTitle('⚖️ REVOGAÇÃO ACEITA ⚖️')
        .addFields({ name: '✅ Decisão:', value: `Aceita por <@${interaction.user.id}> em ${new Date().toLocaleDateString('pt-BR')}` })
        .setFooter({ text: `LuxBot Advertências • ${dataAtual} • criado por chegaheitor` });

      await interaction.update({ embeds: [acceptedEmbed], components: [] });

      // Envia log do bot
      const logEmbed = new EmbedBuilder()
        .setTitle('⚖️ Advertência Revogada por Solicitação')
        .setColor(3066993)
        .setDescription(`<@${interaction.user.id}> aceitou a revogação da advertência de <@${warnedUserId}>.`)
        .addFields(
          { name: '👤 Membro Beneficiado:', value: `<@${warnedUserId}>`, inline: true },
          { name: '🔢 Advertências Ativas Restantes:', value: `**${activeCount} / 3**`, inline: true }
        )
        .setTimestamp();

      await sendLog(interaction.client, guild, 'removeradv', logEmbed);

    } catch (error) {
      console.error('Erro ao aceitar revogação:', error);
      await interaction.reply({ content: '❌ Erro ao aceitar a revogação.', ephemeral: true }).catch(() => null);
    }
  }

  // 4. Staff clica em "Negar"
  if (interaction.isButton() && customId.startsWith('adv_revogacao_negar_')) {
    try {
      const config = getAdvConfig();
      const hasPermission = config.cargosStaffIds.some(roleId => interaction.member.roles.cache.has(roleId))
        || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão de Staff para negar solicitações!',
          ephemeral: true
        });
      }

      const parts = customId.replace('adv_revogacao_negar_', '').split('_');
      const originalMessageId = parts[0];
      const warnedUserId = parts[1];

      // Abre modal exigindo o motivo do indeferimento
      const modal = new ModalBuilder()
        .setCustomId(`adv_revogacao_negar_modal_${originalMessageId}_${warnedUserId}`)
        .setTitle('Negar Revogação');

      const motivoNegacaoInput = new TextInputBuilder()
        .setCustomId('motivo_negacao_input')
        .setLabel('POR QUE ESTÁ NEGANDO A REVOGAÇÃO?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Informe o motivo detalhado para manter a advertência aplicada...')
        .setMinLength(5)
        .setMaxLength(500)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(motivoNegacaoInput));
      return await interaction.showModal(modal);

    } catch (error) {
      console.error('Erro ao processar botão de negar revogação:', error);
      await interaction.reply({ content: '❌ Erro ao abrir formulário de recusa.', ephemeral: true }).catch(() => null);
    }
  }

  // 5. Submissão do modal de negação de revogação
  if (interaction.isModalSubmit() && customId.startsWith('adv_revogacao_negar_modal_')) {
    try {
      const config = getAdvConfig();
      const parts = customId.replace('adv_revogacao_negar_modal_', '').split('_');
      const originalMessageId = parts[0];
      const warnedUserId = parts[1];

      const motivoNegacao = interaction.fields.getTextInputValue('motivo_negacao_input').trim();

      // Salva no banco de dados a negação
      const success = denyWarningRevocation(warnedUserId, originalMessageId, interaction.user.id, motivoNegacao);

      if (!success) {
        return await interaction.reply({
          content: '❌ Não foi possível registrar a negação da revogação (advertência não localizada).',
          ephemeral: true
        });
      }

      // Edita mensagem original do /adv para constar que a tentativa foi negada
      const originalChannel = await guild.channels.fetch(config.canalId).catch(() => null);
      if (originalChannel) {
        const origMsg = await originalChannel.messages.fetch(originalMessageId).catch(() => null);
        if (origMsg && origMsg.embeds.length > 0) {
          const origEmbed = origMsg.embeds[0];
          const updatedEmbed = EmbedBuilder.from(origEmbed)
            .addFields(
              { name: '⚖️ Tentativa de Revogação:', value: `❌ Negada por <@${interaction.user.id}>`, inline: true },
              { name: '📝 Motivo da Negação:', value: motivoNegacao, inline: false }
            );

          await origMsg.edit({ embeds: [updatedEmbed], components: [] }).catch(err => console.error(err));
        }
      }

      // Edita a solicitação no canal de revogações
      const deniedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(15158332) // Vermelho
        .setTitle('⚖️ REVOGAÇÃO NEGADA ⚖️')
        .addFields(
          { name: '❌ Decisão:', value: `Negada por <@${interaction.user.id}> em ${new Date().toLocaleDateString('pt-BR')}` },
          { name: '📝 Motivo da Negação:', value: motivoNegacao, inline: false }
        )
        .setFooter({ text: `LuxBot Advertências • ${dataAtual} • criado por chegaheitor` });

      await interaction.update({ embeds: [deniedEmbed], components: [] });

      // Envia log do bot
      const logEmbed = new EmbedBuilder()
        .setTitle('⚖️ Revogação de Advertência Negada')
        .setColor(15158332)
        .setDescription(`<@${interaction.user.id}> recusou a solicitação de revogação da advertência de <@${warnedUserId}>.`)
        .addFields(
          { name: '👤 Membro:', value: `<@${warnedUserId}>`, inline: true },
          { name: '📝 Motivo da Recusa:', value: motivoNegacao, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.client, guild, 'removeradv', logEmbed);

    } catch (error) {
      console.error('Erro ao processar modal de negação:', error);
      await interaction.reply({ content: '❌ Erro ao negar a revogação.', ephemeral: true }).catch(() => null);
    }
  }
}
