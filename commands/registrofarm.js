import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { getRecrutas, saveFarmPanel, getFarmPanel, saveFarmChannel, getFarmChannel, deleteFarmChannel, hasActiveFarmChannel, getActiveFarmChannel, addConfirmedFarm, addPaidMeta, removeConfirmedFarm, removePaidMeta } from '../database.js';

export const data = new SlashCommandBuilder()
  .setName('registrofarm')
  .setDescription('Envia o painel de solicitação de pasta de farm.')
  .addChannelOption(option =>
    option.setName('canal_painel')
      .setDescription('O canal onde a mensagem com o botão de criar pasta de farm será enviada')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addChannelOption(option =>
    option.setName('categoria')
      .setDescription('A categoria sob a qual as pastas de farm serão criadas')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildCategory)
  )
  .addRoleOption(option =>
    option.setName('cargo_admin_1')
      .setDescription('Cargo autorizado a gerenciar as metas e farms')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_admin_2')
      .setDescription('Segundo cargo autorizado a gerenciar as metas e farms (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_admin_3')
      .setDescription('Terceiro cargo autorizado a gerenciar as metas e farms (opcional)')
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    const canalPainel = interaction.options.getChannel('canal_painel');
    const categoria = interaction.options.getChannel('categoria');

    const adminRole1 = interaction.options.getRole('cargo_admin_1');
    const adminRole2 = interaction.options.getRole('cargo_admin_2');
    const adminRole3 = interaction.options.getRole('cargo_admin_3');

    const cargosAdminIds = [adminRole1.id];
    if (adminRole2) cargosAdminIds.push(adminRole2.id);
    if (adminRole3) cargosAdminIds.push(adminRole3.id);

    // Salvar as configurações de farm no banco
    saveFarmPanel({
      painelCanalId: canalPainel.id,
      categoriaId: categoria.id,
      cargosAdminIds: cargosAdminIds
    });

    const embed = new EmbedBuilder()
      .setTitle('PASTA DE FARM')
      .setDescription('Solicite aqui a sua pasta de farm.')
      .setColor(2326507)
      .setFooter({ text: 'Lux Farm • Bot criado por chegaheitor' });

    const button = new ButtonBuilder()
      .setCustomId('farm_abrir_pasta_btn')
      .setLabel('Abrir/Acessar pasta de farm')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📦');

    const row = new ActionRowBuilder().addComponents(button);

    await canalPainel.send({ embeds: [embed], components: [row] });

    await interaction.reply({
      content: `Painel de solicitação de pasta de farm enviado no canal ${canalPainel}!`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Erro ao executar o comando /registrofarm:', error);
    await interaction.reply({
      content: 'Ocorreu um erro ao criar o painel de farm.',
      ephemeral: true
    });
  }
}

// Método para tratar interações relativas a este comando
export async function handleInteraction(interaction) {
  const { customId } = interaction;

  // 1. Tratar botões
  if (interaction.isButton()) {

    // Botão de Solicitar Pasta (Membro)
    if (customId === 'farm_abrir_pasta_btn') {
      try {
        const userId = interaction.user.id;

        // A. Verificar se o membro está aprovado no sistema de recrutamento
        const recrutas = getRecrutas();
        const recruta = recrutas.find(r => r.discordId === userId && r.status === 'ACEITO');

        if (!recruta) {
          return await interaction.reply({
            content: '❌ Você precisa estar cadastrado e aprovado no sistema de recrutamento antes de abrir uma pasta de farm!',
            ephemeral: true
          });
        }

        // B. Verificar se ele já possui uma pasta de farm ativa
        const activeChannel = getActiveFarmChannel(userId);
        if (activeChannel) {
          return await interaction.reply({
            content: `❌ Você já possui uma pasta de farm ativa! Acesse aqui: <#${activeChannel.canalId}>`,
            ephemeral: true
          });
        }

        // C. Obter a configuração do painel
        const config = getFarmPanel(interaction.channelId);
        if (!config) {
          return await interaction.reply({
            content: 'Erro: Configuração do painel de farm não encontrada no banco de dados.',
            ephemeral: true
          });
        }

        // D. Criar o canal de texto
        const guild = interaction.guild;
        const channelName = `📦┃${recruta.nome}-farm`;

        const permissionOverwrites = [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: userId, // Dono do farm
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ];

        // Adicionar cargos admin autorizados
        config.cargosAdminIds.forEach(roleId => {
          permissionOverwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AddReactions
            ]
          });
        });

        const newChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: config.categoriaId,
          permissionOverwrites: permissionOverwrites
        });

        // E. Registrar canal ativo no banco
        saveFarmChannel({
          canalId: newChannel.id,
          donoId: userId,
          donoNome: recruta.nome,
          categoriaId: config.categoriaId,
          cargosAdminIds: config.cargosAdminIds
        });

        // F. Enviar embed de boas-vindas no novo canal
        const farmWelcomeEmbed = new EmbedBuilder()
          .setTitle(`📦 ${recruta.nome.toUpperCase()} - FARM`)
          .setDescription('Nesta pasta você irá colocar o farm que fizer.')
          .setColor(2326507)
          .setFooter({ text: 'Lux Farm • Use os botões abaixo' });

        const btnAdd = new ButtonBuilder()
          .setCustomId('farm_adicionar_btn')
          .setLabel('Adicionar Farm')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🌾');

        const btnMeta = new ButtonBuilder()
          .setCustomId('farm_bati_meta_btn')
          .setLabel('Bati a Meta')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✨');

        const btnDelete = new ButtonBuilder()
          .setCustomId('farm_apagar_pasta_btn')
          .setLabel('Apagar pasta de meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(btnAdd, btnMeta, btnDelete);

        await newChannel.send({ content: `<@${userId}>`, embeds: [farmWelcomeEmbed], components: [row] });

        // G. Responder privadamente
        await interaction.reply({
          content: `Sua pasta de farm foi criada com sucesso! Acesse aqui: ${newChannel}`,
          ephemeral: true
        });

      } catch (error) {
        console.error('Erro ao abrir canal de farm:', error);
        await interaction.reply({ content: 'Ocorreu um erro ao criar a sua pasta de farm.', ephemeral: true });
      }
    }

    // Botão Adicionar Farm (Membro)
    if (customId === 'farm_adicionar_btn') {
      try {
        // Envia o select menu de forma ephemeral
        const select = new StringSelectMenuBuilder()
          .setCustomId('farm_adicionar_select')
          .setPlaceholder('Escolha o recurso que farmou...')
          .addOptions(
            { label: 'Ferro', description: 'Farm de Ferro', value: 'Ferro' },
            { label: 'Madeira', description: 'Farm de Madeira', value: 'Madeira' },
            { label: 'Ouro', description: 'Farm de Ouro', value: 'Ouro' },
            { label: 'Dinheiro', description: 'Farm de Dinheiro', value: 'Dinheiro' },
            { label: 'Outros', description: 'Outro recurso não tabelado', value: 'Outros' }
          );

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({
          content: 'Selecione abaixo o recurso adicionado:',
          components: [row],
          ephemeral: true
        });
      } catch (error) {
        console.error('Erro ao clicar em Adicionar Farm:', error);
        await interaction.reply({ content: 'Erro ao abrir menu de recursos.', ephemeral: true });
      }
    }

    // Botão Confirmar Farm (Admin)
    if (customId.startsWith('farm_confirmar_btn_')) {
      try {
        const parts = customId.replace('farm_confirmar_btn_', '').split('_');
        const userId = parts[0];
        const item = parts[1];
        const quantidade = parts[2];
        const dataStr = parts[3];

        // Verificar permissões
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = channelConfig && channelConfig.cargosAdminIds
          ? channelConfig.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId))
          : interaction.member.permissions.has('Administrator');

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para confirmar este farm!', ephemeral: true });
        }

        // Salvar farm no banco de dados local do perfil do usuário
        addConfirmedFarm(userId, {
          item: item,
          quantidade: quantidade,
          data: dataStr,
          confirmadoPor: interaction.user.id
        });

        // Adicionar reação ✅ na mensagem original
        await interaction.message.react('✅').catch(() => null);

        // Atualizar embed mostrando status confirmado
        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('✅ FARM CONFIRMADO ✅')
            .setColor(3066993)
            .setDescription(
              `👤 **Enviado por:** <@${userId}>\n` +
              `📦 **Recurso:** ${item}\n` +
              `🔢 **Quantidade:** ${quantidade}\n` +
              `📅 **Data:** ${dataStr}\n\n` +
              `✅ **Confirmado por:** <@${interaction.user.id}>`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('✅ FARM CONFIRMADO ✅')
            .setColor(3066993)
            .setDescription(
              `👤 **Enviado por:** <@${userId}>\n` +
              `📦 **Recurso:** ${item}\n` +
              `🔢 **Quantidade:** ${quantidade}\n` +
              `📅 **Data:** ${dataStr}\n\n` +
              `✅ **Confirmado por:** <@${interaction.user.id}>`
            );
        }

        const desconfirmBtn = new ButtonBuilder()
          .setCustomId(`farm_desconfirmar_btn_${userId}_${item}_${quantidade}_${dataStr}`)
          .setLabel('Desconfirmar Farm')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('↩️');

        const row = new ActionRowBuilder().addComponents(desconfirmBtn);

        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

      } catch (error) {
        console.error('Erro ao confirmar farm:', error);
        await interaction.reply({ content: 'Erro ao processar a confirmação do farm.', ephemeral: true });
      }
    }

    // Botão Desconfirmar Farm (Admin)
    if (customId.startsWith('farm_desconfirmar_btn_')) {
      try {
        const parts = customId.replace('farm_desconfirmar_btn_', '').split('_');
        const userId = parts[0];
        const item = parts[1];
        const quantidade = parts[2];
        const dataStr = parts[3];

        // Verificar permissões
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = channelConfig && channelConfig.cargosAdminIds
          ? channelConfig.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId))
          : interaction.member.permissions.has('Administrator');

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para desconfirmar este farm!', ephemeral: true });
        }

        // Remover do banco
        removeConfirmedFarm(userId, item, quantidade, dataStr);

        // Remover reação ✅
        const reaction = interaction.message.reactions.cache.get('✅');
        if (reaction) {
          await reaction.users.remove(interaction.client.user.id).catch(() => null);
        }

        // Reverter embed
        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('🌾 NOVO FARM DECLARADO 🌾')
            .setColor(2326507)
            .setDescription(
              `👤 **Enviado por:** <@${userId}>\n` +
              `📦 **Recurso:** ${item}\n` +
              `🔢 **Quantidade:** ${quantidade}\n` +
              `📅 **Data:** ${dataStr}\n\n` +
              `Aguardando confirmação de um administrador.`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('🌾 NOVO FARM DECLARADO 🌾')
            .setColor(2326507)
            .setDescription(
              `👤 **Enviado por:** <@${userId}>\n` +
              `📦 **Recurso:** ${item}\n` +
              `🔢 **Quantidade:** ${quantidade}\n` +
              `📅 **Data:** ${dataStr}\n\n` +
              `Aguardando confirmação de um administrador.`
            );
        }

        // Reverter botão
        const confirmBtn = new ButtonBuilder()
          .setCustomId(`farm_confirmar_btn_${userId}_${item}_${quantidade}_${dataStr}`)
          .setLabel('Confirmar Farm')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✔️');

        const row = new ActionRowBuilder().addComponents(confirmBtn);

        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

      } catch (error) {
        console.error('Erro ao desconfirmar farm:', error);
        await interaction.reply({ content: 'Erro ao desconfirmar o farm.', ephemeral: true });
      }
    }

    // Botão Bati a Meta (Membro)
    if (customId === 'farm_bati_meta_btn') {
      try {
        const channelConfig = getFarmChannel(interaction.channelId);
        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Canal não registrado no sistema.', ephemeral: true });
        }

        const now = new Date();
        const timestamp = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const embed = new EmbedBuilder()
          .setTitle('✨ META BATIDA ✨')
          .setDescription(
            `👤 **Membro:** <@${channelConfig.donoId}>\n` +
            `📅 **Data/Hora:** ${timestamp}\n\n` +
            `Aguardando a confirmação do pagamento pelos administradores.`
          )
          .setColor(3066993)
          .setFooter({ text: 'Lux Farm' });

        const btnPagar = new ButtonBuilder()
          .setCustomId(`farm_pagar_meta_btn_${channelConfig.donoId}`)
          .setLabel('Pagar Meta')
          .setStyle(ButtonStyle.Success)
          .setEmoji('�');

        const btnIncompleta = new ButtonBuilder()
          .setCustomId(`farm_meta_incompleta_btn_${channelConfig.donoId}`)
          .setLabel('Meta Incompleta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚠️');

        const row = new ActionRowBuilder().addComponents(btnPagar, btnIncompleta);

        await interaction.reply({ embeds: [embed], components: [row] });
      } catch (error) {
        console.error('Erro ao clicar em Bati a Meta:', error);
        await interaction.reply({ content: 'Erro ao declarar meta batida.', ephemeral: true });
      }
    }

    // Botão PAGAR META (Admin)
    if (customId.startsWith('farm_pagar_meta_btn_')) {
      try {
        const donoId = customId.replace('farm_pagar_meta_btn_', '');

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = channelConfig && channelConfig.cargosAdminIds
          ? channelConfig.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId))
          : interaction.member.permissions.has('Administrator');

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para gerenciar esta meta!', ephemeral: true });
        }

        const now = new Date();
        const dataPagamento = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Registrar meta paga
        addPaidMeta(donoId, {
          pagoPor: interaction.user.id,
          data: dataPagamento
        });

        // Reagir com 💲 (conforme requisitado)
        await interaction.message.react('💲').catch(() => null);

        // Obter data da mensagem original
        const msgDate = interaction.message.createdAt || new Date();
        const dataMensagem = msgDate.toLocaleDateString('pt-BR') + ' às ' + msgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('💲 META PAGA 💲')
            .setColor(3066993)
            .setDescription(
              `👤 **Membro:** <@${donoId}>\n` +
              `📅 **Data da Meta:** ${dataMensagem}\n` +
              `💲 **Pago por:** <@${interaction.user.id}>\n` +
              `📆 **Data do Pagamento:** ${dataPagamento}`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('💲 META PAGA 💲')
            .setColor(3066993)
            .setDescription(
              `👤 **Membro:** <@${donoId}>\n` +
              `📅 **Data da Meta:** ${dataMensagem}\n` +
              `💲 **Pago por:** <@${interaction.user.id}>\n` +
              `📆 **Data do Pagamento:** ${dataPagamento}`
            );
        }

        const desconfirmMetaBtn = new ButtonBuilder()
          .setCustomId(`farm_desconfirmar_meta_btn_${donoId}`)
          .setLabel('Desconfirmar Meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('↩️');

        const row = new ActionRowBuilder().addComponents(desconfirmMetaBtn);

        // Desativar botões e atualizar a mensagem informando a data da mensagem
        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

      } catch (error) {
        console.error('Erro ao pagar meta:', error);
        await interaction.reply({ content: 'Erro ao processar o pagamento da meta.', ephemeral: true });
      }
    }

    // Botão Meta Incompleta (Admin)
    if (customId.startsWith('farm_meta_incompleta_btn_')) {
      try {
        const donoId = customId.replace('farm_meta_incompleta_btn_', '');

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = channelConfig && channelConfig.cargosAdminIds
          ? channelConfig.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId))
          : interaction.member.permissions.has('Administrator');

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para gerenciar esta meta!', ephemeral: true });
        }

        // Abre modal para escrever o motivo
        const modal = new ModalBuilder()
          .setCustomId(`farm_meta_incompleta_modal_${donoId}`)
          .setTitle('⚠️ Meta Incompleta ⚠️');

        const motivoInput = new TextInputBuilder()
          .setCustomId('motivo_input')
          .setLabel('MOTIVO DO ERRO')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explique o que está errado com a meta do farm...')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao clicar em Meta Incompleta:', error);
        await interaction.reply({ content: 'Erro ao abrir formulário de erro de meta.', ephemeral: true });
      }
    }

    // Botão Apagar Pasta de Farm (Admin)
    if (customId === 'farm_apagar_pasta_btn') {
      try {
        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = channelConfig && channelConfig.cargosAdminIds
          ? channelConfig.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId))
          : interaction.member.permissions.has('Administrator');

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para apagar esta pasta!', ephemeral: true });
        }

        // Envia mensagem de confirmação apenas para quem clicou (ephemeral)
        const confirmBtn = new ButtonBuilder()
          .setCustomId('farm_confirmar_apagar_btn')
          .setLabel('Confirmar Exclusão da Pasta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(confirmBtn);

        await interaction.reply({
          content: '⚠️ **ATENÇÃO:** Você tem certeza de que deseja apagar esta pasta de farm? Todos os registros do canal serão excluídos.',
          components: [row],
          ephemeral: true
        });
      } catch (error) {
        console.error('Erro ao clicar em Apagar Pasta:', error);
        await interaction.reply({ content: 'Erro ao abrir confirmação de exclusão.', ephemeral: true });
      }
    }

    // Botão Confirmar Apagar Canal (Admin)
    if (customId === 'farm_confirmar_apagar_btn') {
      try {
        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = channelConfig && channelConfig.cargosAdminIds
          ? channelConfig.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId))
          : interaction.member.permissions.has('Administrator');

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para executar esta ação!', ephemeral: true });
        }

        // Remover do banco
        deleteFarmChannel(interaction.channelId);

        // Deletar o canal correspondente
        const channel = interaction.channel;
        await interaction.reply({ content: 'Apagando pasta em 3 segundos...', ephemeral: true });
        setTimeout(async () => {
          await channel.delete().catch(() => null);
        }, 3000);

      } catch (error) {
        console.error('Erro ao deletar canal de farm:', error);
        await interaction.reply({ content: 'Erro ao apagar pasta de farm.', ephemeral: true });
      }
    }
  }

  // 2. Tratar menus de seleção
  if (interaction.isStringSelectMenu()) {
    if (customId === 'farm_adicionar_select') {
      try {
        const itemSelecionado = interaction.values[0];
        const channelConfig = getFarmChannel(interaction.channelId);

        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Pasta de farm não configurada no banco.', ephemeral: true });
        }

        // Abre modal para quantidade e data
        const modal = new ModalBuilder()
          .setCustomId(`farm_adicionar_modal_${itemSelecionado}`)
          .setTitle(`🌾 Adicionar Farm: ${itemSelecionado}`);

        const qtdInput = new TextInputBuilder()
          .setCustomId('qtd_input')
          .setLabel('QUANTIDADE')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite a quantidade do recurso (ex: 500, 15k)')
          .setRequired(true);

        const now = new Date();
        const dataFormatada = now.toLocaleDateString('pt-BR');

        const dataInput = new TextInputBuilder()
          .setCustomId('data_input')
          .setLabel('DATA DO FARM')
          .setStyle(TextInputStyle.Short)
          .setValue(dataFormatada)
          .setPlaceholder('DD/MM/AAAA')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(qtdInput),
          new ActionRowBuilder().addComponents(dataInput)
        );

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao processar select de farm:', error);
        await interaction.reply({ content: 'Erro ao abrir formulário de quantidade.', ephemeral: true });
      }
    }
  }

  // 3. Tratar submissões de modais
  if (interaction.isModalSubmit()) {

    // Modal de Adicionar Farm
    if (customId.startsWith('farm_adicionar_modal_')) {
      try {
        const item = customId.replace('farm_adicionar_modal_', '');
        const quantidade = interaction.fields.getTextInputValue('qtd_input');
        const dataStr = interaction.fields.getTextInputValue('data_input');

        const channelConfig = getFarmChannel(interaction.channelId);
        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Canal não cadastrado.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle('🌾 NOVO FARM DECLARADO 🌾')
          .setDescription(
            `👤 **Enviado por:** <@${channelConfig.donoId}>\n` +
            `📦 **Recurso:** ${item}\n` +
            `🔢 **Quantidade:** ${quantidade}\n` +
            `📅 **Data:** ${dataStr}\n\n` +
            `Aguardando confirmação de um administrador.`
          )
          .setColor(2326507)
          .setFooter({ text: 'Lux Farm' });

        const confirmBtn = new ButtonBuilder()
          .setCustomId(`farm_confirmar_btn_${channelConfig.donoId}_${item}_${quantidade}_${dataStr}`)
          .setLabel('Confirmar Farm')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✔️');

        const row = new ActionRowBuilder().addComponents(confirmBtn);

        await interaction.reply({ embeds: [embed], components: [row] });
      } catch (error) {
        console.error('Erro ao enviar declaração de farm:', error);
        await interaction.reply({ content: 'Erro ao registrar declaração de farm.', ephemeral: true });
      }
    }

    // Modal de Justificativa de Meta Incompleta
    if (customId.startsWith('farm_meta_incompleta_modal_')) {
      try {
        const donoId = customId.replace('farm_meta_incompleta_modal_', '');
        const motivo = interaction.fields.getTextInputValue('motivo_input');

        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('⚠️ META INCOMPLETA ⚠️')
            .setColor(15158332)
            .setDescription(
              originalEmbed.description +
              `\n\n❌ **Marcada como Incompleta por:** <@${interaction.user.id}>\n` +
              `📝 **Motivo:** *${motivo}*`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('⚠️ META INCOMPLETA ⚠️')
            .setColor(15158332)
            .setDescription(
              `👤 **Membro:** <@${donoId}>\n` +
              `❌ **Marcada como Incompleta por:** <@${interaction.user.id}>\n` +
              `📝 **Motivo:** *${motivo}*`
            );
        }

        // Desativar botões da mensagem de aprovação de meta
        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: []
        });

        // Responder ao admin de forma oculta (ephemeral)
        await interaction.followUp({
          content: `⚠️ Meta incompleta! Justificativa enviada.`,
          ephemeral: true
        });

        // Envia notificação bonita no canal marcando o usuário dono da pasta
        const now = new Date();
        const timestamp = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const channelNotificationEmbed = new EmbedBuilder()
          .setTitle('⚠️ PEDIDO DE META INCORRETO ⚠️')
          .setDescription(
            `Olá <@${donoId}>, seu pedido de meta foi marcado como **incompleta/errada**!\n\n` +
            `📝 **Motivo:** *${motivo}*\n` +
            `👮 **Verificado por:** <@${interaction.user.id}>\n` +
            `📅 **Data/Hora:** ${timestamp}\n\n` +
            `Por favor, realize a correção dos valores ou lance os farms corretos.`
          )
          .setColor(15158332)
          .setFooter({ text: 'Lux Farm' });

        await interaction.channel.send({
          content: `<@${donoId}>`,
          embeds: [channelNotificationEmbed]
        });
      } catch (error) {
        console.error('Erro ao enviar justificativa de meta errada:', error);
        await interaction.reply({ content: 'Erro ao processar erro de meta.', ephemeral: true });
      }
    }
  }
}
