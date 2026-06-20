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
import { getGlobalEncomendaConfig, addEncomenda } from '../database.js';
import { sendLog } from '../logs.js';

function hasEncomendaPermission(interaction, config) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  if (config && config.cargosPermitidosIds && Array.isArray(config.cargosPermitidosIds)) {
    return config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId));
  }
  return false;
}

function hasEncomendaStaffPermission(interaction, config) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  if (config && config.cargosStaffIds && Array.isArray(config.cargosStaffIds)) {
    return config.cargosStaffIds.some(roleId => interaction.member.roles.cache.has(roleId));
  }
  return false;
}

export const data = new SlashCommandBuilder()
  .setName('criarencomenda')
  .setDescription('Cria o painel de registro de encomendas no fórum configurado no /painelconfig.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const success = await criarPainelEncomenda(interaction.client, interaction.guild);
    if (success) {
      await interaction.reply({
        content: '✅ Painel de encomendas criado com sucesso no fórum configurado!',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: '❌ Configurações de Encomendas incompletas! Configure o canal de fórum no `/painelconfig` primeiro.',
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Erro ao executar o comando /criarencomenda:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao criar o painel de encomendas.',
      ephemeral: true
    }).catch(() => null);
  }
}

export async function criarPainelEncomenda(client, guild) {
  try {
    const config = getGlobalEncomendaConfig();
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    if (!config || !config.forumCanalId) return false;

    const canalForum = guild.channels.cache.get(config.forumCanalId)
      || await guild.channels.fetch(config.forumCanalId).catch(() => null);
    if (!canalForum || canalForum.type !== ChannelType.GuildForum) return false;

    const welcomeEmbed = new EmbedBuilder()
      .setTitle('📦 REGISTRO DE ENCOMENDAS 📦')
      .setDescription(
        'Use este painel para registrar e acompanhar o andamento das encomendas da corporação.\n\n' +
        'Clique no botão **Registrar Encomenda** abaixo para abrir o formulário.'
      )
      .setColor(2326507)
      .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
      .setTimestamp();

    const btnNovaEncomenda = new ButtonBuilder()
      .setCustomId('encomenda_nova_btn')
      .setLabel('Registrar Encomenda')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🛍️');

    const row = new ActionRowBuilder().addComponents(btnNovaEncomenda);

    const thread = await canalForum.threads.create({
      name: '📦┃Painel de Encomendas',
      message: {
        embeds: [welcomeEmbed],
        components: [row]
      }
    });

    await thread.pin().catch(() => null);
    return true;
  } catch (error) {
    console.error('Erro ao criar painel de encomenda:', error);
    return false;
  }
}
// Trata as interações de encomenda_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

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

      const config = getGlobalEncomendaConfig();
      if (!config) {
        return await interaction.reply({
          content: '❌ Erro: Configuração de encomendas não localizada no banco de dados. Configure no `/painelconfig` primeiro.',
          ephemeral: true
        });
      }

      // Verificar permissão de cargos
      const hasPermission = hasEncomendaPermission(interaction, config);

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
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      // Botões do Estado Pendente: Iniciar Produção e Excluir Encomenda
      const btnProduzir = new ButtonBuilder()
        .setCustomId(`encomenda_produzir_btn_${interaction.user.id}`)
        .setLabel('Iniciar Produção')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🏭');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const rowButtons = new ActionRowBuilder().addComponents(btnProduzir, btnExcluir);

      // Criar novo tópico no fórum correspondente
      const newThread = await forumChannel.threads.create({
        name: `⏳ Pendente - ${cliente} - ${dataEntrega}`,
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
        .setTitle('📦 ENCOMENDA REGISTRADA 📦')
        .setColor(15844367)
        .setDescription(`O membro <@${interaction.user.id}> registrou uma nova encomenda no fórum ${forumChannel}.`)
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Entrega:', value: dataEntrega, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true }
        )
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
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

      const config = getGlobalEncomendaConfig();
      const hasPermission = hasEncomendaStaffPermission(interaction, config);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para iniciar a produção desta encomenda!',
          ephemeral: true
        });
      }

      const originalEmbed = interaction.message.embeds[0];
      if (!originalEmbed) {
        return await interaction.reply({
          content: '❌ Erro: Não foi possível obter os dados da encomenda. O embed não foi encontrado.',
          ephemeral: true
        });
      }
      const fields = originalEmbed.fields || [];

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

      // Limpar reações antigas e reagir com 🏭
      await interaction.message.reactions.removeAll().catch(() => null);
      await interaction.message.react('🏭').catch(() => null);

      // Atualizar nome do tópico/canal
      await interaction.channel.setName(`🏭 Produção - ${cliente} - ${dataEntrega}`).catch(() => null);

      // Novo embed em produção
      const updatedEmbed = new EmbedBuilder()
        .setTitle('🏭 ENCOMENDA EM PRODUÇÃO 🏭')
        .setDescription('A fabricação dos itens solicitados foi iniciada.')
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Entrega até:', value: dataEntrega, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true },
          { name: '💼 Registrado por:', value: vendedorMencao, inline: true },
          { name: '🏭 Produção por:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'ℹ️ Status:', value: '🏭 Em Produção', inline: true }
        )
        .setColor(3447003) // Azul
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
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
        .setTitle('🏭 ENCOMENDA EM PRODUÇÃO 🏭')
        .setColor(3447003)
        .setDescription(`O membro <@${interaction.user.id}> iniciou a produção da encomenda de ${cliente} no fórum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
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

      const config = getGlobalEncomendaConfig();
      const hasPermission = hasEncomendaStaffPermission(interaction, config);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para entregar esta encomenda!',
          ephemeral: true
        });
      }

      const originalEmbed = interaction.message.embeds[0];
      if (!originalEmbed) {
        return await interaction.reply({
          content: '❌ Erro: Não foi possível obter os dados da encomenda. O embed não foi encontrado.',
          ephemeral: true
        });
      }
      const statusField = originalEmbed.fields ? originalEmbed.fields.find(f => f.name.toLowerCase().includes('status')) : null;
      const isProducing = (originalEmbed.title && originalEmbed.title.toLowerCase().includes('produção'))
        || (statusField && statusField.value.toLowerCase().includes('produção'));

      if (!isProducing) {
        return await interaction.reply({
          content: '❌ Esta encomenda precisa ser iniciada em produção antes de poder ser entregue!',
          ephemeral: true
        });
      }

      const fields = originalEmbed.fields || [];
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
      await interaction.channel.setName(`✅ Entregue - ${cliente} - ${dataEntrega}`).catch(() => null);

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
          { name: '🏭 Produzido por:', value: produtorMencao, inline: true },
          { name: '🎁 Entregue por:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'ℹ️ Status:', value: '✅ Entregue', inline: true }
        )
        .setColor(3066993) // Verde
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      // Botões do Estado Entregue: Voltar a Pendente, Voltar para Produção e Excluir Encomenda
      const btnVoltar = new ButtonBuilder()
        .setCustomId(`encomenda_pendente_btn_${donoId}`)
        .setLabel('Voltar a Pendente')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏳');

      const btnVoltarProd = new ButtonBuilder()
        .setCustomId(`encomenda_voltar_producao_btn_${donoId}`)
        .setLabel('Voltar para Produção')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🏭');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const rowButtons = new ActionRowBuilder().addComponents(btnVoltar, btnVoltarProd, btnExcluir);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [rowButtons]
      });

      // Enviar log de entrega
      const logEmbed = new EmbedBuilder()
        .setTitle('✅ ENCOMENDA ENTREGUE ✅')
        .setColor(3066993)
        .setDescription(`O membro <@${interaction.user.id}> marcou a encomenda de ${cliente} como entregue no fórum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
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

      const config = getGlobalEncomendaConfig();
      const hasPermission = hasEncomendaStaffPermission(interaction, config);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para redefinir o status desta encomenda!',
          ephemeral: true
        });
      }

      const originalEmbed = interaction.message.embeds[0];
      if (!originalEmbed) {
        return await interaction.reply({
          content: '❌ Erro: Não foi possível obter os dados da encomenda. O embed não foi encontrado.',
          ephemeral: true
        });
      }
      const fields = originalEmbed.fields || [];

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
      await interaction.channel.setName(`⏳ Pendente - ${cliente} - ${dataEntrega}`).catch(() => null);

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
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      // Botões do Estado Pendente: Iniciar Produção e Excluir Encomenda
      const btnProduzir = new ButtonBuilder()
        .setCustomId(`encomenda_produzir_btn_${donoId}`)
        .setLabel('Iniciar Produção')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🏭');

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
        .setTitle('⏳ ENCOMENDA VOLTOU A PENDENTE ⏳')
        .setColor(15844367)
        .setDescription(`O membro <@${interaction.user.id}> redefiniu o status da encomenda de ${cliente} para pendente.`)
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao reverter encomenda para pendente:', error);
      await interaction.reply({ content: '❌ Erro ao reverter status da encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 5b. Botão Voltar para Produção clicado (Reverte para Em Produção)
  if (customId.startsWith('encomenda_voltar_producao_btn_')) {
    try {
      const donoId = customId.replace('encomenda_voltar_producao_btn_', '');
      const forumId = interaction.channel.parentId;

      const config = getGlobalEncomendaConfig();
      const hasPermission = hasEncomendaStaffPermission(interaction, config);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para redefinir o status desta encomenda!',
          ephemeral: true
        });
      }

      const originalEmbed = interaction.message.embeds[0];
      if (!originalEmbed) {
        return await interaction.reply({
          content: '❌ Erro: Não foi possível obter os dados da encomenda. O embed não foi encontrado.',
          ephemeral: true
        });
      }
      const fields = originalEmbed.fields || [];

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

      // Limpar reações antigas e reagir com 🏭
      await interaction.message.reactions.removeAll().catch(() => null);
      await interaction.message.react('🏭').catch(() => null);

      // Atualizar nome do tópico/canal
      await interaction.channel.setName(`🏭 Produção - ${cliente} - ${dataEntrega}`).catch(() => null);

      // Embed em produção
      const updatedEmbed = new EmbedBuilder()
        .setTitle('🏭 ENCOMENDA EM PRODUÇÃO 🏭')
        .setDescription('A fabricação dos itens solicitados foi reiniciada.')
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Entrega até:', value: dataEntrega, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true },
          { name: '💼 Registrado por:', value: vendedorMencao, inline: true },
          { name: '🏭 Produção por:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'ℹ️ Status:', value: '🏭 Em Produção', inline: true }
        )
        .setColor(3447003) // Azul
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
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

      // Enviar log
      const logEmbed = new EmbedBuilder()
        .setTitle('🏭 ENCOMENDA VOLTOU A PRODUÇÃO 🏭')
        .setColor(3447003)
        .setDescription(`O membro <@${interaction.user.id}> redefiniu o status da encomenda de ${cliente} para produção.`)
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao reverter encomenda para produção:', error);
      await interaction.reply({ content: '❌ Erro ao reverter status da encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 6. Botão Excluir Encomenda clicado
  if (customId === 'encomenda_excluir_btn') {
    try {
      const forumId = interaction.channel.parentId;

      const config = getGlobalEncomendaConfig();
      const hasPermission = hasEncomendaStaffPermission(interaction, config);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para excluir esta encomenda!',
          ephemeral: true
        });
      }

      const thread = interaction.channel;

      // Enviar log de exclusão
      const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ ENCOMENDA EXCLUÍDA 🗑️')
        .setColor(15158332)
        .setDescription(`O administrador <@${interaction.user.id}> excluiu o tópico de encomenda **${thread.name}** no fórum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Encomendas • ${dataAtual} • criado por chegaheitor` })
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
