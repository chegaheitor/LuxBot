import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  RoleSelectMenuBuilder, 
  ChannelType, 
  PermissionFlagsBits 
} from 'discord.js';
import { savePendingRecruta, updateRecrutaStatus, getGlobalRecrutamentoConfig } from '../database.js';
import { sendLog } from '../logs.js';

function hasRecrutamentoPermission(interaction, config) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  if (config && config.cargosStaffIds && Array.isArray(config.cargosStaffIds)) {
    return config.cargosStaffIds.some(roleId => interaction.member.roles.cache.has(roleId));
  }
  return false;
}

export const data = new SlashCommandBuilder()
  .setName('criarrecrutamento')
  .setDescription('Cria o painel de recrutamento no canal configurado no /painelconfig.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const success = await criarPainelRecrutamento(interaction.client, interaction.guild);
    if (success) {
      await interaction.reply({ 
        content: `✅ Painel de recrutamento enviado com sucesso no canal configurado!`, 
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: '❌ Configurações de Recrutamento incompletas! Configure no `/painelconfig` primeiro.', 
        ephemeral: true 
      });
    }
  } catch (error) {
    console.error('Erro ao executar o comando /criarrecrutamento:', error);
    await interaction.reply({ 
      content: '❌ Ocorreu um erro ao criar o painel de recrutamento.', 
      ephemeral: true 
    });
  }
}

export async function criarPainelRecrutamento(client, guild) {
  try {
    const config = getGlobalRecrutamentoConfig();
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    if (!config || !config.canalPainelId || !config.canalPedidosId || !config.canalLogsNegadoId) {
      return false;
    }

    const canalPainel = guild.channels.cache.get(config.canalPainelId)
      || await guild.channels.fetch(config.canalPainelId).catch(() => null);
    if (!canalPainel || canalPainel.type !== ChannelType.GuildText) return false;

    // Criação do embed inicial do painel de recrutamento
    const embed = new EmbedBuilder()
      .setTitle('✨ PEÇA SEU SET ✨')
      .setDescription(
        'Para ser recrutado, preencha o formulário abaixo\n\n' +
        '🔠 NOME\n' +
        '💳 ID\n' +
        '📞 TELEFONE\n' +
        '📋 ID DE QUEM RECRUTOU\n' +
        '💼 CARGO\n\n' +
        'Seja muito bem vindo a Lux!'
      )
      .setColor(2326507)
      .setFooter({ text: `LuxBot Recrutamento • ${dataAtual} • criado por chegaheitor` })
      .setTimestamp();

    // Guardamos os IDs do canal de pedidos e logs_negado no customId do botão
    const button = new ButtonBuilder()
      .setCustomId(`embed_pedir_set_btn_${config.canalPedidosId}_${config.canalLogsNegadoId}`)
      .setLabel('Pedir set')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅');

    const row = new ActionRowBuilder().addComponents(button);

    // Envia o painel de recrutamento no canal especificado
    await canalPainel.send({ embeds: [embed], components: [row] });
    return true;
  } catch (error) {
    console.error('Erro ao criar painel de recrutamento:', error);
    return false;
  }
}

// Método para tratar interações relativas a este comando (botões, menus e modais)
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. Tratar cliques nos botões
  if (interaction.isButton()) {
    
    // Botão de solicitar recrutamento (Membro comum)
    if (customId.startsWith('embed_pedir_set_btn_')) {
      try {
        const parts = customId.replace('embed_pedir_set_btn_', '').split('_');
        const canalPedidosId = parts[0];
        const canalLogsNegadoId = parts[1];

        // Criar formulário modal de inscrição
        const modal = new ModalBuilder()
          .setCustomId(`embed_pedir_set_modal_${canalPedidosId}_${canalLogsNegadoId}`)
          .setTitle('✨ Pedido de Set - Lux ✨');

        const nomeInput = new TextInputBuilder()
          .setCustomId('nome_input')
          .setLabel('🔠 NOME')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite seu nome completo')
          .setRequired(true);

        const idInput = new TextInputBuilder()
          .setCustomId('id_input')
          .setLabel('💳 ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite seu ID no jogo')
          .setRequired(true);

        const telefoneInput = new TextInputBuilder()
          .setCustomId('telefone_input')
          .setLabel('📞 TELEFONE')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite seu telefone (ex: 11 99999-9999)')
          .setRequired(true);

        const recrutadorInput = new TextInputBuilder()
          .setCustomId('recrutador_input')
          .setLabel('📋 ID DE QUEM RECRUTOU')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite o ID de quem recrutou você')
          .setRequired(true);

        const cargoInput = new TextInputBuilder()
          .setCustomId('cargo_input')
          .setLabel('💼 CARGO')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite o cargo que deseja (ex: Recruta, Soldado)')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nomeInput),
          new ActionRowBuilder().addComponents(idInput),
          new ActionRowBuilder().addComponents(telefoneInput),
          new ActionRowBuilder().addComponents(recrutadorInput),
          new ActionRowBuilder().addComponents(cargoInput)
        );

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao abrir o modal de recrutamento:', error);
        await interaction.reply({ content: 'Ocorreu um erro ao abrir o formulário.', ephemeral: true });
      }
    }

    // Botão de recusar/negar o recrutamento (Admin)
    if (customId.startsWith('embed_negar_btn_')) {
      try {
        const parts = customId.replace('embed_negar_btn_', '').split('_');
        const userId = parts[0];
        const canalLogsNegadoId = parts[1];

        // Verificar permissões
        const config = getGlobalRecrutamentoConfig();
        const hasPermission = hasRecrutamentoPermission(interaction, config);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para gerenciar este recrutamento!', ephemeral: true });
        }

        // Exibir modal pedindo a justificativa
        const modal = new ModalBuilder()
          .setCustomId(`embed_negar_modal_${userId}_${canalLogsNegadoId}`)
          .setTitle('❌ Justificativa de Recusa ❌');

        const motivoInput = new TextInputBuilder()
          .setCustomId('motivo_input')
          .setLabel('MOTIVO DA NEGAÇÃO')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explique o motivo de recusar este recrutamento...')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao clicar no botão Negar:', error);
        await interaction.reply({ content: 'Ocorreu um erro ao abrir o formulário de justificativa.', ephemeral: true });
      }
    }
  }

  // 2. Tratar interações com menus de seleção de cargo (Role Select Menu)
  if (interaction.isRoleSelectMenu()) {
    if (customId.startsWith('embed_aprovar_select_')) {
      try {
        const userId = customId.replace('embed_aprovar_select_', '');
        const cargoId = interaction.values[0];

        // Verificar permissões
        const config = getGlobalRecrutamentoConfig();
        const hasPermission = hasRecrutamentoPermission(interaction, config);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para gerenciar este recrutamento!', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) {
          return await interaction.reply({ content: 'Erro: Não foi possível encontrar esse usuário no servidor. Talvez ele tenha saído.', ephemeral: true });
        }

        // Tentar adicionar o cargo
        await member.roles.add(cargoId);

        const role = interaction.guild.roles.cache.get(cargoId);
        const cargoNome = role ? role.name : 'Cargo Atribuído';

        // Atualizar status no banco com a role real do Discord
        updateRecrutaStatus(userId, 'ACEITO', {
          cargo: cargoNome,
          cargoAprovadoId: cargoId,
          processadoPorId: interaction.user.id
        });

        // Modificar embed
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setTitle('✨ PEDIDO DE SET ACEITO ✨')
          .setColor(3066993);

        await interaction.update({
          content: `✅ Pedido aceito por <@${interaction.user.id}>! O cargo <@&${cargoId}> foi adicionado para <@${userId}>.`,
          embeds: [updatedEmbed],
          components: []
        });

        // Enviar log de aprovação
        const logEmbed = new EmbedBuilder()
          .setTitle('✅ Recrutamento Aprovado')
          .setColor(3066993)
          .setDescription(`O administrador <@${interaction.user.id}> aprovou o pedido de set do usuário <@${userId}> (${userId}).`)
          .addFields({ name: '💼 Cargo Adicionado:', value: `<@&${cargoId}>` })
          .setTimestamp();
        await sendLog(interaction.client, interaction.guild, 'registroembed', logEmbed);
      } catch (error) {
        console.error('Erro ao aceitar recrutamento:', error);
        await interaction.reply({ content: 'Ocorreu um erro ao adicionar o cargo. Verifique a hierarquia de cargos do bot.', ephemeral: true });
      }
    }
  }

  // 3. Tratar submissões de modais
  if (interaction.isModalSubmit()) {
    
    // Modal de preencher a justificativa de negação
    if (customId.startsWith('embed_negar_modal_')) {
      try {
        const parts = customId.replace('embed_negar_modal_', '').split('_');
        const userId = parts[0];
        const canalLogsNegadoId = parts[1];
        const motivo = interaction.fields.getTextInputValue('motivo_input');

        // Atualizar banco
        updateRecrutaStatus(userId, 'NEGADO', {
          motivoRecusa: motivo,
          processadoPorId: interaction.user.id
        });

        // Modificar embed
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setTitle('❌ PEDIDO DE SET NEGADO ❌')
          .setColor(15158332);

        await interaction.update({
          content: `❌ Pedido recusado por <@${interaction.user.id}>. Motivo: *${motivo}*`,
          embeds: [updatedEmbed],
          components: []
        });

        // Enviar log de negação
        const logEmbed = new EmbedBuilder()
          .setTitle('❌ Recrutamento Recusado')
          .setColor(15158332)
          .setDescription(`O administrador <@${interaction.user.id}> recusou o pedido de set do usuário <@${userId}> (${userId}).`)
          .addFields({ name: '📝 Motivo da Recusa:', value: motivo })
          .setTimestamp();
        await sendLog(interaction.client, interaction.guild, 'registroembed', logEmbed);

        // Enviar log de recusa
        const logsChannel = await interaction.guild.channels.fetch(canalLogsNegadoId).catch(() => null);

        if (logsChannel) {
          const denialEmbed = new EmbedBuilder()
            .setTitle('📢 STATUS DO RECRUTAMENTO 📢')
            .setDescription(
              `Olá <@${userId}>,\n\n` +
              `Agradecemos muito pelo seu interesse em fazer parte da **Lux**, porém o seu pedido de recrutamento foi **negado** no momento. 😔\n\n` +
              `📝 **Motivo:** ${motivo}\n\n` +
              `Não desanime! Fique de olho em novas oportunidades.`
            )
            .setColor(15158332)
            .setFooter({ text: `LuxBot Recrutamento • ${dataAtual} • criado por chegaheitor` })
            .setTimestamp();

          await logsChannel.send({ content: `<@${userId}>`, embeds: [denialEmbed] });
        }
      } catch (error) {
        console.error('Erro ao processar modal de recusa:', error);
        await interaction.reply({ content: 'Ocorreu um erro ao processar a recusa.', ephemeral: true });
      }
    }

    // Modal de preencher dados cadastrais (Membro)
    if (customId.startsWith('embed_pedir_set_modal_')) {
      try {
        const parts = customId.replace('embed_pedir_set_modal_', '').split('_');
        const canalPedidosId = parts[0];
        const canalLogsNegadoId = parts[1];

        const nome = interaction.fields.getTextInputValue('nome_input');
        const id = interaction.fields.getTextInputValue('id_input');
        const telefone = interaction.fields.getTextInputValue('telefone_input');
        const recrutador = interaction.fields.getTextInputValue('recrutador_input');
        const cargoDesejado = interaction.fields.getTextInputValue('cargo_input');

        const user = interaction.user;

        // Salvar recruta pendente
        const recrutaData = {
          discordId: user.id,
          tag: user.tag,
          nome: nome,
          gameId: id,
          telefone: telefone,
          recrutadorId: recrutador,
          cargo: cargoDesejado
        };
        savePendingRecruta(recrutaData);

        // Criar embed de revisão
        const responseEmbed = new EmbedBuilder()
          .setTitle('✨ NOVO PEDIDO DE SET ✨')
          .setDescription(
            `👤 Discord user:\n<@${user.id}> (${user.id})\n\n` +
            `🔠 NOME\n${nome}\n\n` +
            `💳 ID\n${id}\n\n` +
            `📞 TELEFONE\n${telefone}\n\n` +
            `📋 ID DE QUEM RECRUTOU\n${recrutador}\n\n` +
            `💼 CARGO\n${cargoDesejado}\n\n`
          )
          .setColor(2326507)
          .setFooter({ text: `LuxBot Recrutamento • ${dataAtual} • criado por chegaheitor` })
          .setTimestamp();

        // Criar select de cargo e botão negar
        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId(`embed_aprovar_select_${user.id}`)
          .setPlaceholder('Selecione o cargo para ACEITAR...')
          .setMinValues(1)
          .setMaxValues(1);

        const denyButton = new ButtonBuilder()
          .setCustomId(`embed_negar_btn_${user.id}_${canalLogsNegadoId}`)
          .setLabel('Negar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✖️');

        const rowSelect = new ActionRowBuilder().addComponents(roleSelect);
        const rowButton = new ActionRowBuilder().addComponents(denyButton);

        const canalPedidos = await interaction.guild.channels.fetch(canalPedidosId);

        if (canalPedidos) {
          await canalPedidos.send({ embeds: [responseEmbed], components: [rowSelect, rowButton] });
          await interaction.reply({ content: 'Seu pedido de set foi enviado com sucesso! Aguarde a revisão dos administradores. ✅', ephemeral: true });

          // Enviar log de novo pedido
          const logEmbed = new EmbedBuilder()
            .setTitle('📝 Novo Pedido de Set')
            .setColor(3447003)
            .setDescription(`O usuário <@${user.id}> (${user.id}) solicitou recrutamento.`)
            .addFields(
              { name: '🔠 Nome:', value: nome, inline: true },
              { name: '💳 ID:', value: id, inline: true },
              { name: '📞 Telefone:', value: telefone, inline: true },
              { name: '📋 Recrutado por:', value: recrutador, inline: true },
              { name: '💼 Cargo Desejado:', value: cargoDesejado, inline: true }
            )
            .setTimestamp();
          await sendLog(interaction.client, interaction.guild, 'registroembed', logEmbed);
        } else {
          await interaction.reply({ content: 'Erro: O canal configurado para receber os pedidos não foi encontrado.', ephemeral: true });
        }
      } catch (error) {
        console.error('Erro ao processar modal de inscrição:', error);
        await interaction.reply({ content: 'Ocorreu um erro ao enviar o seu pedido de set. Por favor, tente novamente.', ephemeral: true });
      }
    }
  }
}
