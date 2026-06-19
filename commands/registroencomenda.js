import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ChannelType 
} from 'discord.js';
import { saveEncomendaPanel, getEncomendaPanel, addEncomenda } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('registroencomenda')
  .setDescription('Envia o painel de registro de encomendas para o fórum selecionado.')
  .addChannelOption(option =>
    option.setName('canal_forum')
      .setDescription('O canal de fórum onde as encomendas serão registradas')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildForum)
  )
  .addRoleOption(option =>
    option.setName('cargo_1')
      .setDescription('Cargo autorizado a registrar encomendas')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_2')
      .setDescription('Segundo cargo autorizado a registrar encomendas (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_3')
      .setDescription('Terceiro cargo autorizado a registrar encomendas (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_4')
      .setDescription('Quarto cargo autorizado a registrar encomendas (opcional)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const canalForum = interaction.options.getChannel('canal_forum');
    const role1 = interaction.options.getRole('cargo_1');
    const role2 = interaction.options.getRole('cargo_2');
    const role3 = interaction.options.getRole('cargo_3');
    const role4 = interaction.options.getRole('cargo_4');

    if (canalForum.type !== ChannelType.GuildForum) {
      return await interaction.reply({
        content: '❌ O canal selecionado precisa ser do tipo **Fórum**!',
        ephemeral: true
      });
    }

    const cargosPermitidosIds = [role1.id];
    if (role2) cargosPermitidosIds.push(role2.id);
    if (role3) cargosPermitidosIds.push(role3.id);
    if (role4) cargosPermitidosIds.push(role4.id);

    // Salvar configuração no banco
    saveEncomendaPanel({
      forumCanalId: canalForum.id,
      cargosPermitidosIds: cargosPermitidosIds
    });

    const welcomeEmbed = new EmbedBuilder()
      .setTitle('📦 REGISTRO DE ENCOMENDAS 📦')
      .setDescription(
        'Use este painel para registrar e acompanhar o status de encomendas da corporação.\n\n' +
        'Clique no botão **Registrar Encomenda** abaixo para abrir o formulário.'
      )
      .setColor(2326507)
      .setFooter({ text: 'Lux Encomendas • Bot por chegaheitor' })
      .setTimestamp();

    const btnNovaEncomenda = new ButtonBuilder()
      .setCustomId('encomenda_nova_btn')
      .setLabel('Registrar Encomenda')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📦');

    const row = new ActionRowBuilder().addComponents(btnNovaEncomenda);

    // Criar o tópico inicial do Painel de Encomendas no canal do Fórum
    const thread = await canalForum.threads.create({
      name: '📦┃Painel de Encomendas',
      message: {
        embeds: [welcomeEmbed],
        components: [row]
      }
    });

    // Fixar o tópico criado no Fórum
    await thread.pin().catch(() => null);

    await interaction.reply({
      content: `✅ Painel de encomendas configurado e publicado com sucesso no fórum! Acesse o tópico: ${thread}`,
      ephemeral: true
    });

    // Enviar log de configuração de encomendas
    const logEmbed = new EmbedBuilder()
      .setTitle('⚙️ Painel de Encomenda Configurado')
      .setColor(3066993)
      .setDescription(`O administrador <@${interaction.user.id}> configurou o painel de encomendas no fórum ${canalForum}.`)
      .addFields({
        name: '💼 Cargos Autorizados:',
        value: cargosPermitidosIds.map(id => `<@&${id}>`).join(', ')
      })
      .setTimestamp();

    await sendLog(interaction.client, interaction.guild, 'registroencomenda', logEmbed);

  } catch (error) {
    console.error('Erro ao executar o comando /registroencomenda:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao configurar o painel de encomendas no fórum.',
      ephemeral: true
    });
  }
}

// Trata as interações de encomenda_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;

  // 1. Botão Registrar Encomenda clicado
  if (customId === 'encomenda_nova_btn') {
    try {
      const forumId = interaction.channel.parentId;
      if (!forumId) {
        return await interaction.reply({
          content: '❌ Erro: Este painel não foi localizado dentro de um canal de fórum.',
          ephemeral: true
        });
      }

      const config = getEncomendaPanel(forumId);
      if (!config) {
        return await interaction.reply({
          content: '❌ Erro: Configuração de encomendas deste fórum não localizada no banco de dados.',
          ephemeral: true
        });
      }

      // Verificar permissão de cargos
      const hasPermission = config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem o cargo autorizado para registrar encomendas!',
          ephemeral: true
        });
      }

      // Abrir modal de encomenda (5 campos)
      const modal = new ModalBuilder()
        .setCustomId('encomenda_nova_modal')
        .setTitle('📦 Registrar Nova Encomenda');

      const clienteInput = new TextInputBuilder()
        .setCustomId('cliente_input')
        .setLabel('PARA QUEM É')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Digite o nome ou ID do cliente')
        .setRequired(true);

      const qtdInput = new TextInputBuilder()
        .setCustomId('qtd_input')
        .setLabel('QUANTIDADE')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 200 madeira, 5k ferro')
        .setRequired(true);

      const valorInput = new TextInputBuilder()
        .setCustomId('valor_input')
        .setLabel('VALOR')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Digite o valor da encomenda')
        .setRequired(true);

      const dataInput = new TextInputBuilder()
        .setCustomId('data_input')
        .setLabel('DATA DE ENTREGA')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: DD/MM/AAAA ou Hoje à noite')
        .setRequired(true);

      const parceriaInput = new TextInputBuilder()
        .setCustomId('parceria_input')
        .setLabel('PARCERIA (SIM/NÃO)')
        .setStyle(TextInputStyle.Short)
        .setValue('Não')
        .setPlaceholder('Digite Sim ou Não')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(clienteInput),
        new ActionRowBuilder().addComponents(qtdInput),
        new ActionRowBuilder().addComponents(valorInput),
        new ActionRowBuilder().addComponents(dataInput),
        new ActionRowBuilder().addComponents(parceriaInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Erro ao abrir modal de encomendas:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao abrir o formulário de encomenda.',
        ephemeral: true
      });
    }
    return;
  }

  // 2. Modal Submetido (Status: Pendente)
  if (customId === 'encomenda_nova_modal') {
    try {
      const forumId = interaction.channel.parentId;
      if (!forumId) {
        return await interaction.reply({
          content: '❌ Erro: Não foi possível obter o canal do fórum.',
          ephemeral: true
        });
      }

      const forumChannel = guild.channels.cache.get(forumId) || await guild.channels.fetch(forumId).catch(() => null);
      if (!forumChannel) {
        return await interaction.reply({
          content: '❌ Erro: Canal de Fórum não localizado.',
          ephemeral: true
        });
      }

      const cliente = interaction.fields.getTextInputValue('cliente_input').trim();
      const qtd = interaction.fields.getTextInputValue('qtd_input').trim();
      const valor = interaction.fields.getTextInputValue('valor_input').trim();
      const dataEntrega = interaction.fields.getTextInputValue('data_input').trim();
      const parceria = interaction.fields.getTextInputValue('parceria_input').trim();

      const orderEmbed = new EmbedBuilder()
        .setTitle('⏳ ENCOMENDA PENDENTE ⏳')
        .setDescription('Nova encomenda registrada e aguardando produção.')
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Entrega até:', value: dataEntrega, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true },
          { name: '💼 Registrado por:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'ℹ️ Status:', value: '⏳ Pendente', inline: true }
        )
        .setColor(15844367) // Dourado/Amarelo
        .setFooter({ text: 'Lux Encomendas' })
        .setTimestamp();

      // Botões do Estado Pendente: Iniciar Produção e Excluir Encomenda
      const btnProduzir = new ButtonBuilder()
        .setCustomId(`encomenda_produzir_btn_${interaction.user.id}`)
        .setLabel('Iniciar Produção')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛠️');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const rowButtons = new ActionRowBuilder().addComponents(btnProduzir, btnExcluir);

      // Criar novo tópico no fórum correspondente
      const newThread = await forumChannel.threads.create({
        name: `⏳┃Pendente - ${cliente} - ${dataEntrega}`,
        message: {
          embeds: [orderEmbed],
          components: [rowButtons]
        }
      });

      // Salvar encomenda no banco para estatísticas do /perfil
      addEncomenda(interaction.user.id, interaction.user.tag, {
        data: dataEntrega,
        threadUrl: newThread.url
      });

      await interaction.reply({
        content: `✅ Encomenda registrada com sucesso! Novo tópico criado: ${newThread}`,
        ephemeral: true
      });

      // Enviar log de nova encomenda
      const logEmbed = new EmbedBuilder()
        .setTitle('📦 Encomenda Registrada')
        .setColor(15844367)
        .setDescription(`O membro <@${interaction.user.id}> registrou uma nova encomenda no fórum ${forumChannel}.`)
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Entrega:', value: dataEntrega, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true }
        )
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao processar submissão de modal de encomendas:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao processar o registro da sua encomenda.',
        ephemeral: true
      });
    }
    return;
  }

  // 3. Botão Iniciar Produção clicado (Vai para Estado: Em Produção)
  if (customId.startsWith('encomenda_produzir_btn_')) {
    try {
      const donoId = customId.replace('encomenda_produzir_btn_', '');
      const forumId = interaction.channel.parentId;

      const config = getEncomendaPanel(forumId);
      const hasPermission = config && config.cargosPermitidosIds
        ? config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para iniciar a produção desta encomenda!',
          ephemeral: true
        });
      }

      const originalEmbed = interaction.message.embeds[0];
      const fields = originalEmbed.fields;

      const getFieldValue = (namePart) => {
        const f = fields.find(field => field.name.toLowerCase().includes(namePart.toLowerCase()));
        return f ? f.value : 'Desconhecido';
      };

      const cliente = getFieldValue('Cliente');
      const qtd = getFieldValue('Quantidade');
      const valor = getFieldValue('Valor');
      const dataEntrega = getFieldValue('Entrega');
      const parceria = getFieldValue('Parceria');
      const vendedorMencao = getFieldValue('Registrado');

      // Limpar reações antigas e reagir com 🛠️
      await interaction.message.reactions.removeAll().catch(() => null);
      await interaction.message.react('🛠️').catch(() => null);

      // Atualizar nome do tópico/canal
      await interaction.channel.setName(`🛠️┃Produção - ${cliente} - ${dataEntrega}`).catch(() => null);

      // Novo embed em produção
      const updatedEmbed = new EmbedBuilder()
        .setTitle('🛠️ ENCOMENDA EM PRODUÇÃO 🛠️')
        .setDescription('A fabricação dos itens solicitados foi iniciada.')
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Entrega até:', value: dataEntrega, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true },
          { name: '💼 Registrado por:', value: vendedorMencao, inline: true },
          { name: '🛠️ Produção por:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'ℹ️ Status:', value: '🛠️ Em Produção', inline: true }
        )
        .setColor(3447003) // Azul
        .setFooter({ text: 'Lux Encomendas' })
        .setTimestamp();

      // Botões do Estado Em Produção: Entregar Encomenda, Voltar a Pendente e Excluir Encomenda
      const btnEntregar = new ButtonBuilder()
        .setCustomId(`encomenda_entregar_btn_${donoId}`)
        .setLabel('Entregar Encomenda')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const btnVoltar = new ButtonBuilder()
        .setCustomId(`encomenda_pendente_btn_${donoId}`)
        .setLabel('Voltar a Pendente')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏳');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const rowButtons = new ActionRowBuilder().addComponents(btnEntregar, btnVoltar, btnExcluir);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [rowButtons]
      });

      // Enviar log de produção
      const logEmbed = new EmbedBuilder()
        .setTitle('🛠️ Encomenda em Produção')
        .setColor(3447003)
        .setDescription(`O membro <@${interaction.user.id}> iniciou a produção da encomenda de ${cliente} no fórum <#${forumId}>.`)
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao iniciar produção de encomenda:', error);
      await interaction.reply({ content: '❌ Erro ao iniciar produção da encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 4. Botão Entregar Encomenda clicado (Vai para Estado: Entregue)
  if (customId.startsWith('encomenda_entregar_btn_')) {
    try {
      const donoId = customId.replace('encomenda_entregar_btn_', '');
      const forumId = interaction.channel.parentId;

      const config = getEncomendaPanel(forumId);
      const hasPermission = config && config.cargosPermitidosIds
        ? config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para entregar esta encomenda!',
          ephemeral: true
        });
      }

      const originalEmbed = interaction.message.embeds[0];
      const statusField = originalEmbed.fields.find(f => f.name.toLowerCase().includes('status'));
      const isProducing = originalEmbed.title.toLowerCase().includes('produção') 
        || (statusField && statusField.value.toLowerCase().includes('produção'));

      if (!isProducing) {
        return await interaction.reply({
          content: '❌ Esta encomenda precisa ser iniciada em produção antes de poder ser entregue!',
          ephemeral: true
        });
      }

      const fields = originalEmbed.fields;
      const getFieldValue = (namePart) => {
        const f = fields.find(field => field.name.toLowerCase().includes(namePart.toLowerCase()));
        return f ? f.value : 'Desconhecido';
      };

      const cliente = getFieldValue('Cliente');
      const qtd = getFieldValue('Quantidade');
      const valor = getFieldValue('Valor');
      const dataEntrega = getFieldValue('Entrega');
      const parceria = getFieldValue('Parceria');
      const vendedorMencao = getFieldValue('Registrado');
      const produtorMencao = getFieldValue('Produção por');

      // Limpar reações antigas e reagir com ✅
      await interaction.message.reactions.removeAll().catch(() => null);
      await interaction.message.react('✅').catch(() => null);

      // Atualizar nome do tópico/canal
      await interaction.channel.setName(`✅┃Entregue - ${cliente} - ${dataEntrega}`).catch(() => null);

      // Novo embed entregue
      const updatedEmbed = new EmbedBuilder()
        .setTitle('✅ ENCOMENDA ENTREGUE ✅')
        .setDescription('Encomenda entregue ao cliente e finalizada.')
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Entrega até:', value: dataEntrega, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true },
          { name: '💼 Registrado por:', value: vendedorMencao, inline: true },
          { name: '🛠️ Produzido por:', value: produtorMencao, inline: true },
          { name: '🎁 Entregue por:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'ℹ️ Status:', value: '✅ Entregue', inline: true }
        )
        .setColor(3066993) // Verde
        .setFooter({ text: 'Lux Encomendas' })
        .setTimestamp();

      // Botões do Estado Entregue: Voltar a Pendente e Excluir Encomenda
      const btnVoltar = new ButtonBuilder()
        .setCustomId(`encomenda_pendente_btn_${donoId}`)
        .setLabel('Voltar a Pendente')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏳');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const rowButtons = new ActionRowBuilder().addComponents(btnVoltar, btnExcluir);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [rowButtons]
      });

      // Enviar log de entrega
      const logEmbed = new EmbedBuilder()
        .setTitle('✅ Encomenda Entregue')
        .setColor(3066993)
        .setDescription(`O membro <@${interaction.user.id}> marcou a encomenda de ${cliente} como entregue no fórum <#${forumId}>.`)
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao entregar encomenda:', error);
      await interaction.reply({ content: '❌ Erro ao entregar encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 5. Botão Voltar para Pendente clicado (Reverte para Pendente)
  if (customId.startsWith('encomenda_pendente_btn_')) {
    try {
      const donoId = customId.replace('encomenda_pendente_btn_', '');
      const forumId = interaction.channel.parentId;

      const config = getEncomendaPanel(forumId);
      const hasPermission = config && config.cargosPermitidosIds
        ? config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para redefinir o status desta encomenda!',
          ephemeral: true
        });
      }

      const originalEmbed = interaction.message.embeds[0];
      const fields = originalEmbed.fields;

      const getFieldValue = (namePart) => {
        const f = fields.find(field => field.name.toLowerCase().includes(namePart.toLowerCase()));
        return f ? f.value : 'Desconhecido';
      };

      const cliente = getFieldValue('Cliente');
      const qtd = getFieldValue('Quantidade');
      const valor = getFieldValue('Valor');
      const dataEntrega = getFieldValue('Entrega');
      const parceria = getFieldValue('Parceria');
      const vendedorMencao = getFieldValue('Registrado');

      // Limpar todas as reações
      await interaction.message.reactions.removeAll().catch(() => null);

      // Reverter nome do tópico/canal
      await interaction.channel.setName(`⏳┃Pendente - ${cliente} - ${dataEntrega}`).catch(() => null);

      // Reverter embed para pendente
      const revertedEmbed = new EmbedBuilder()
        .setTitle('⏳ ENCOMENDA PENDENTE ⏳')
        .setDescription('Encomenda restaurada ao status pendente.')
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Entrega até:', value: dataEntrega, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true },
          { name: '💼 Registrado por:', value: vendedorMencao, inline: true },
          { name: 'ℹ️ Status:', value: '⏳ Pendente', inline: true }
        )
        .setColor(15844367) // Dourado
        .setFooter({ text: 'Lux Encomendas' })
        .setTimestamp();

      // Botões do Estado Pendente: Iniciar Produção e Excluir Encomenda
      const btnProduzir = new ButtonBuilder()
        .setCustomId(`encomenda_produzir_btn_${donoId}`)
        .setLabel('Iniciar Produção')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛠️');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const rowButtons = new ActionRowBuilder().addComponents(btnProduzir, btnExcluir);

      await interaction.update({
        embeds: [revertedEmbed],
        components: [rowButtons]
      });

      // Enviar log de reversão
      const logEmbed = new EmbedBuilder()
        .setTitle('⏳ Encomenda Voltou a Pendente')
        .setColor(15844367)
        .setDescription(`O membro <@${interaction.user.id}> redefiniu o status da encomenda de ${cliente} para pendente.`)
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao reverter encomenda para pendente:', error);
      await interaction.reply({ content: '❌ Erro ao reverter status da encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 6. Botão Excluir Encomenda clicado
  if (customId === 'encomenda_excluir_btn') {
    try {
      const forumId = interaction.channel.parentId;

      const config = getEncomendaPanel(forumId);
      const hasPermission = config && config.cargosPermitidosIds
        ? config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para excluir esta encomenda!',
          ephemeral: true
        });
      }

      const thread = interaction.channel;

      // Enviar log de exclusão
      const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ Encomenda Excluída')
        .setColor(15158332)
        .setDescription(`O administrador <@${interaction.user.id}> excluiu o tópico de encomenda **${thread.name}** no fórum <#${forumId}>.`)
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

      // Deletar thread
      await interaction.reply({ content: 'Excluindo tópico de encomenda...', ephemeral: true });
      await thread.delete().catch(() => null);

    } catch (error) {
      console.error('Erro ao excluir encomenda:', error);
      await interaction.reply({ content: '❌ Erro ao excluir encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }
}
