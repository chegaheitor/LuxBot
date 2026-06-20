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
// Trata as intera├º├Áes de encomenda_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. Bot├úo Registrar Encomenda clicado
  if (customId === 'encomenda_nova_btn') {
    try {
      const forumId = interaction.channel.parentId;
      if (!forumId) {
        return await interaction.reply({
          content: 'ÔØî Erro: Este painel n├úo foi localizado dentro de um canal de f├│rum.',
          ephemeral: true
        });
      }

      const config = getEncomendaPanel(forumId);
      if (!config) {
        return await interaction.reply({
          content: 'ÔØî Erro: Configura├º├úo de encomendas deste f├│rum n├úo localizada no banco de dados.',
          ephemeral: true
        });
      }

      // Verificar permiss├úo de cargos
      const hasPermission = config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: 'ÔØî Voc├¬ n├úo tem o cargo autorizado para registrar encomendas!',
          ephemeral: true
        });
      }

      // Abrir modal de encomenda (5 campos)
      const modal = new ModalBuilder()
        .setCustomId('encomenda_nova_modal')
        .setTitle('­ƒôª Registrar Nova Encomenda');

      const clienteInput = new TextInputBuilder()
        .setCustomId('cliente_input')
        .setLabel('PARA QUEM ├ë')
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
        .setPlaceholder('Ex: DD/MM/AAAA ou Hoje ├á noite')
        .setRequired(true);

      const parceriaInput = new TextInputBuilder()
        .setCustomId('parceria_input')
        .setLabel('PARCERIA (SIM/N├âO)')
        .setStyle(TextInputStyle.Short)
        .setValue('N├úo')
        .setPlaceholder('Digite Sim ou N├úo')
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
        content: 'ÔØî Ocorreu um erro ao abrir o formul├írio de encomenda.',
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
          content: 'ÔØî Erro: N├úo foi poss├¡vel obter o canal do f├│rum.',
          ephemeral: true
        });
      }

      const forumChannel = guild.channels.cache.get(forumId) || await guild.channels.fetch(forumId).catch(() => null);
      if (!forumChannel) {
        return await interaction.reply({
          content: 'ÔØî Erro: Canal de F├│rum n├úo localizado.',
          ephemeral: true
        });
      }

      const cliente = interaction.fields.getTextInputValue('cliente_input').trim();
      const qtd = interaction.fields.getTextInputValue('qtd_input').trim();
      const valor = interaction.fields.getTextInputValue('valor_input').trim();
      const dataEntrega = interaction.fields.getTextInputValue('data_input').trim();
      const parceria = interaction.fields.getTextInputValue('parceria_input').trim();

      const orderEmbed = new EmbedBuilder()
        .setTitle('ÔÅ│ ENCOMENDA PENDENTE ÔÅ│')
        .setDescription('Nova encomenda registrada e aguardando produ├º├úo.')
        .addFields(
          { name: '­ƒæñ Cliente:', value: cliente, inline: true },
          { name: '­ƒöó Quantidade:', value: qtd, inline: true },
          { name: '­ƒÆ░ Valor:', value: valor, inline: true },
          { name: '­ƒôà Entrega at├®:', value: dataEntrega, inline: true },
          { name: '­ƒñØ Parceria:', value: parceria, inline: true },
          { name: '­ƒÆ╝ Registrado por:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Ôä╣´©Å Status:', value: 'ÔÅ│ Pendente', inline: true }
        )
        .setColor(15844367) // Dourado/Amarelo
        .setFooter({ text: `LuxBot Encomendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      // Bot├Áes do Estado Pendente: Iniciar Produ├º├úo e Excluir Encomenda
      const btnProduzir = new ButtonBuilder()
        .setCustomId(`encomenda_produzir_btn_${interaction.user.id}`)
        .setLabel('Iniciar Produ├º├úo')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('­ƒøá´©Å');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('­ƒùæ´©Å');

      const rowButtons = new ActionRowBuilder().addComponents(btnProduzir, btnExcluir);

      // Criar novo t├│pico no f├│rum correspondente
      const newThread = await forumChannel.threads.create({
        name: `ÔÅ│ÔöâPendente - ${cliente} - ${dataEntrega}`,
        message: {
          embeds: [orderEmbed],
          components: [rowButtons]
        }
      });

      // Salvar encomenda no banco para estat├¡sticas do /perfil
      addEncomenda(interaction.user.id, interaction.user.tag, {
        data: dataEntrega,
        threadUrl: newThread.url
      });

      await interaction.reply({
        content: `Ô£à Encomenda registrada com sucesso! Novo t├│pico criado: ${newThread}`,
        ephemeral: true
      });

      // Enviar log de nova encomenda
      const logEmbed = new EmbedBuilder()
        .setTitle('­ƒôª ENCOMENDA REGISTRADA ­ƒôª')
        .setColor(15844367)
        .setDescription(`O membro <@${interaction.user.id}> registrou uma nova encomenda no f├│rum ${forumChannel}.`)
        .addFields(
          { name: '­ƒæñ Cliente:', value: cliente, inline: true },
          { name: '­ƒöó Quantidade:', value: qtd, inline: true },
          { name: '­ƒÆ░ Valor:', value: valor, inline: true },
          { name: '­ƒôà Entrega:', value: dataEntrega, inline: true },
          { name: '­ƒñØ Parceria:', value: parceria, inline: true }
        )
        .setFooter({ text: `LuxBot Encomendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao processar submiss├úo de modal de encomendas:', error);
      await interaction.reply({
        content: 'ÔØî Ocorreu um erro ao processar o registro da sua encomenda.',
        ephemeral: true
      });
    }
    return;
  }

  // 3. Bot├úo Iniciar Produ├º├úo clicado (Vai para Estado: Em Produ├º├úo)
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
          content: 'ÔØî Voc├¬ n├úo tem permiss├úo para iniciar a produ├º├úo desta encomenda!',
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

      // Limpar rea├º├Áes antigas e reagir com ­ƒøá´©Å
      await interaction.message.reactions.removeAll().catch(() => null);
      await interaction.message.react('­ƒøá´©Å').catch(() => null);

      // Atualizar nome do t├│pico/canal
      await interaction.channel.setName(`­ƒøá´©ÅÔöâProdu├º├úo - ${cliente} - ${dataEntrega}`).catch(() => null);

      // Novo embed em produ├º├úo
      const updatedEmbed = new EmbedBuilder()
        .setTitle('­ƒøá´©Å ENCOMENDA EM PRODU├ç├âO ­ƒøá´©Å')
        .setDescription('A fabrica├º├úo dos itens solicitados foi iniciada.')
        .addFields(
          { name: '­ƒæñ Cliente:', value: cliente, inline: true },
          { name: '­ƒöó Quantidade:', value: qtd, inline: true },
          { name: '­ƒÆ░ Valor:', value: valor, inline: true },
          { name: '­ƒôà Entrega at├®:', value: dataEntrega, inline: true },
          { name: '­ƒñØ Parceria:', value: parceria, inline: true },
          { name: '­ƒÆ╝ Registrado por:', value: vendedorMencao, inline: true },
          { name: '­ƒøá´©Å Produ├º├úo por:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Ôä╣´©Å Status:', value: '­ƒøá´©Å Em Produ├º├úo', inline: true }
        )
        .setColor(3447003) // Azul
        .setFooter({ text: `LuxBot Encomendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      // Bot├Áes do Estado Em Produ├º├úo: Entregar Encomenda, Voltar a Pendente e Excluir Encomenda
      const btnEntregar = new ButtonBuilder()
        .setCustomId(`encomenda_entregar_btn_${donoId}`)
        .setLabel('Entregar Encomenda')
        .setStyle(ButtonStyle.Success)
        .setEmoji('Ô£à');

      const btnVoltar = new ButtonBuilder()
        .setCustomId(`encomenda_pendente_btn_${donoId}`)
        .setLabel('Voltar a Pendente')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('ÔÅ│');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('­ƒùæ´©Å');

      const rowButtons = new ActionRowBuilder().addComponents(btnEntregar, btnVoltar, btnExcluir);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [rowButtons]
      });

      // Enviar log de produ├º├úo
      const logEmbed = new EmbedBuilder()
        .setTitle('­ƒøá´©Å ENCOMENDA EM PRODU├ç├âO ­ƒøá´©Å')
        .setColor(3447003)
        .setDescription(`O membro <@${interaction.user.id}> iniciou a produ├º├úo da encomenda de ${cliente} no f├│rum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Encomendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao iniciar produ├º├úo de encomenda:', error);
      await interaction.reply({ content: 'ÔØî Erro ao iniciar produ├º├úo da encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 4. Bot├úo Entregar Encomenda clicado (Vai para Estado: Entregue)
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
          content: 'ÔØî Voc├¬ n├úo tem permiss├úo para entregar esta encomenda!',
          ephemeral: true
        });
      }

      const originalEmbed = interaction.message.embeds[0];
      const statusField = originalEmbed.fields.find(f => f.name.toLowerCase().includes('status'));
      const isProducing = originalEmbed.title.toLowerCase().includes('produ├º├úo') 
        || (statusField && statusField.value.toLowerCase().includes('produ├º├úo'));

      if (!isProducing) {
        return await interaction.reply({
          content: 'ÔØî Esta encomenda precisa ser iniciada em produ├º├úo antes de poder ser entregue!',
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
      const produtorMencao = getFieldValue('Produ├º├úo por');

      // Limpar rea├º├Áes antigas e reagir com Ô£à
      await interaction.message.reactions.removeAll().catch(() => null);
      await interaction.message.react('Ô£à').catch(() => null);

      // Atualizar nome do t├│pico/canal
      await interaction.channel.setName(`Ô£àÔöâEntregue - ${cliente} - ${dataEntrega}`).catch(() => null);

      // Novo embed entregue
      const updatedEmbed = new EmbedBuilder()
        .setTitle('Ô£à ENCOMENDA ENTREGUE Ô£à')
        .setDescription('Encomenda entregue ao cliente e finalizada.')
        .addFields(
          { name: '­ƒæñ Cliente:', value: cliente, inline: true },
          { name: '­ƒöó Quantidade:', value: qtd, inline: true },
          { name: '­ƒÆ░ Valor:', value: valor, inline: true },
          { name: '­ƒôà Entrega at├®:', value: dataEntrega, inline: true },
          { name: '­ƒñØ Parceria:', value: parceria, inline: true },
          { name: '­ƒÆ╝ Registrado por:', value: vendedorMencao, inline: true },
          { name: '­ƒøá´©Å Produzido por:', value: produtorMencao, inline: true },
          { name: '­ƒÄü Entregue por:', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Ôä╣´©Å Status:', value: 'Ô£à Entregue', inline: true }
        )
        .setColor(3066993) // Verde
        .setFooter({ text: `LuxBot Encomendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      // Bot├Áes do Estado Entregue: Voltar a Pendente e Excluir Encomenda
      const btnVoltar = new ButtonBuilder()
        .setCustomId(`encomenda_pendente_btn_${donoId}`)
        .setLabel('Voltar a Pendente')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('ÔÅ│');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('­ƒùæ´©Å');

      const rowButtons = new ActionRowBuilder().addComponents(btnVoltar, btnExcluir);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [rowButtons]
      });

      // Enviar log de entrega
      const logEmbed = new EmbedBuilder()
        .setTitle('Ô£à ENCOMENDA ENTREGUE Ô£à')
        .setColor(3066993)
        .setDescription(`O membro <@${interaction.user.id}> marcou a encomenda de ${cliente} como entregue no f├│rum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Encomendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao entregar encomenda:', error);
      await interaction.reply({ content: 'ÔØî Erro ao entregar encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 5. Bot├úo Voltar para Pendente clicado (Reverte para Pendente)
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
          content: 'ÔØî Voc├¬ n├úo tem permiss├úo para redefinir o status desta encomenda!',
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

      // Limpar todas as rea├º├Áes
      await interaction.message.reactions.removeAll().catch(() => null);

      // Reverter nome do t├│pico/canal
      await interaction.channel.setName(`ÔÅ│ÔöâPendente - ${cliente} - ${dataEntrega}`).catch(() => null);

      // Reverter embed para pendente
      const revertedEmbed = new EmbedBuilder()
        .setTitle('ÔÅ│ ENCOMENDA PENDENTE ÔÅ│')
        .setDescription('Encomenda restaurada ao status pendente.')
        .addFields(
          { name: '­ƒæñ Cliente:', value: cliente, inline: true },
          { name: '­ƒöó Quantidade:', value: qtd, inline: true },
          { name: '­ƒÆ░ Valor:', value: valor, inline: true },
          { name: '­ƒôà Entrega at├®:', value: dataEntrega, inline: true },
          { name: '­ƒñØ Parceria:', value: parceria, inline: true },
          { name: '­ƒÆ╝ Registrado por:', value: vendedorMencao, inline: true },
          { name: 'Ôä╣´©Å Status:', value: 'ÔÅ│ Pendente', inline: true }
        )
        .setColor(15844367) // Dourado
        .setFooter({ text: `LuxBot Encomendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      // Bot├Áes do Estado Pendente: Iniciar Produ├º├úo e Excluir Encomenda
      const btnProduzir = new ButtonBuilder()
        .setCustomId(`encomenda_produzir_btn_${donoId}`)
        .setLabel('Iniciar Produ├º├úo')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('­ƒøá´©Å');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('encomenda_excluir_btn')
        .setLabel('Excluir Encomenda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('­ƒùæ´©Å');

      const rowButtons = new ActionRowBuilder().addComponents(btnProduzir, btnExcluir);

      await interaction.update({
        embeds: [revertedEmbed],
        components: [rowButtons]
      });

      // Enviar log de revers├úo
      const logEmbed = new EmbedBuilder()
        .setTitle('ÔÅ│ ENCOMENDA VOLTOU A PENDENTE ÔÅ│')
        .setColor(15844367)
        .setDescription(`O membro <@${interaction.user.id}> redefiniu o status da encomenda de ${cliente} para pendente.`)
        .setFooter({ text: `LuxBot Encomendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

    } catch (error) {
      console.error('Erro ao reverter encomenda para pendente:', error);
      await interaction.reply({ content: 'ÔØî Erro ao reverter status da encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 6. Bot├úo Excluir Encomenda clicado
  if (customId === 'encomenda_excluir_btn') {
    try {
      const forumId = interaction.channel.parentId;

      const config = getEncomendaPanel(forumId);
      const hasPermission = config && config.cargosPermitidosIds
        ? config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: 'ÔØî Voc├¬ n├úo tem permiss├úo para excluir esta encomenda!',
          ephemeral: true
        });
      }

      const thread = interaction.channel;

      // Enviar log de exclus├úo
      const logEmbed = new EmbedBuilder()
        .setTitle('­ƒùæ´©Å ENCOMENDA EXCLU├ìDA ­ƒùæ´©Å')
        .setColor(15158332)
        .setDescription(`O administrador <@${interaction.user.id}> excluiu o t├│pico de encomenda **${thread.name}** no f├│rum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Encomendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroencomenda', logEmbed);

      // Deletar thread
      await interaction.reply({ content: 'Excluindo t├│pico de encomenda...', ephemeral: true });
      await thread.delete().catch(() => null);

    } catch (error) {
      console.error('Erro ao excluir encomenda:', error);
      await interaction.reply({ content: 'ÔØî Erro ao excluir encomenda.', ephemeral: true }).catch(() => null);
    }
    return;
  }
}
