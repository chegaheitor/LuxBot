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
import { saveVendaPanel, getVendaPanel, addVenda } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('registrovenda')
  .setDescription('Envia o painel de registro de vendas para o fórum selecionado.')
  .addChannelOption(option =>
    option.setName('canal_forum')
      .setDescription('O canal de fórum onde as vendas serão registradas')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildForum)
  )
  .addRoleOption(option =>
    option.setName('cargo_1')
      .setDescription('Cargo autorizado a registrar vendas')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_2')
      .setDescription('Segundo cargo autorizado a registrar vendas (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_3')
      .setDescription('Terceiro cargo autorizado a registrar vendas (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_4')
      .setDescription('Quarto cargo autorizado a registrar vendas (opcional)')
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
    saveVendaPanel({
      forumCanalId: canalForum.id,
      cargosPermitidosIds: cargosPermitidosIds
    });

    const welcomeEmbed = new EmbedBuilder()
      .setTitle('🛒 REGISTRO DE VENDAS 🛒')
      .setDescription(
        'Use este painel para registrar todas as vendas da corporação.\n\n' +
        'Clique no botão **Nova Venda** abaixo para abrir o formulário.'
      )
      .setColor(2326507)
      .setFooter({ text: `LuxBot Vendas • ${dataAtual} • criado por chegaheitor` })
      .setTimestamp();

    const btnNovaVenda = new ButtonBuilder()
      .setCustomId('venda_nova_btn')
      .setLabel('Nova Venda')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🛍️');

    const row = new ActionRowBuilder().addComponents(btnNovaVenda);

    // Criar o tópico inicial do Painel de Vendas no canal do Fórum
    const thread = await canalForum.threads.create({
      name: '🛒┃Painel de Vendas',
      message: {
        embeds: [welcomeEmbed],
        components: [row]
      }
    });

    // Fixar o tópico criado no Fórum
    await thread.pin().catch(() => null);

    await interaction.reply({
      content: `✅ Painel de vendas configurado e publicado com sucesso no fórum! Acesse o tópico: ${thread}`,
      ephemeral: true
    });

    // Enviar log de configuração de vendas
    const logEmbed = new EmbedBuilder()
      .setTitle('⚙️ PAINEL DE VENDA CONFIGURADO ⚙️')
      .setColor(3066993)
      .setDescription(`O administrador <@${interaction.user.id}> configurou o painel de vendas no fórum ${canalForum}.`)
      .addFields({
        name: '💼 Cargos Autorizados:',
        value: cargosPermitidosIds.map(id => `<@&${id}>`).join(', ')
      })
      .setFooter({ text: `LuxBot Vendas • ${dataAtual} • criado por chegaheitor` })
      .setTimestamp();

    await sendLog(interaction.client, interaction.guild, 'registrovenda', logEmbed);

  } catch (error) {
    console.error('Erro ao executar o comando /registrovenda:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao configurar o painel de vendas no fórum.',
      ephemeral: true
    });
  }
}

// Trata as interações iniciadas por venda_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. Botão Nova Venda clicado
  if (customId === 'venda_nova_btn') {
    try {
      const forumId = interaction.channel.parentId;
      if (!forumId) {
        return await interaction.reply({
          content: '❌ Erro: Este painel não foi localizado dentro de um canal de fórum.',
          ephemeral: true
        });
      }

      const config = getVendaPanel(forumId);
      if (!config) {
        return await interaction.reply({
          content: '❌ Erro: Configuração de vendas deste fórum não localizada no banco de dados.',
          ephemeral: true
        });
      }

      // Verificar permissão de cargos
      const hasPermission = config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem o cargo autorizado para registrar vendas!',
          ephemeral: true
        });
      }

      // Abrir modal de venda (5 campos)
      const modal = new ModalBuilder()
        .setCustomId('venda_nova_modal')
        .setTitle('🛍️ Registrar Nova Venda');

      const clienteInput = new TextInputBuilder()
        .setCustomId('cliente_input')
        .setLabel('PARA QUEM VENDEU')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Digite o nome ou ID do comprador')
        .setRequired(true);

      const qtdInput = new TextInputBuilder()
        .setCustomId('qtd_input')
        .setLabel('QUANTIDADE QUE VENDEU')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 500k, 50 sets, 10 armas')
        .setRequired(true);

      const valorInput = new TextInputBuilder()
        .setCustomId('valor_input')
        .setLabel('VALOR QUE VENDEU')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Digite o valor recebido (ex: 500k, R$ 50.000)')
        .setRequired(true);

      const now = new Date();
      const dataFormatada = now.toLocaleDateString('pt-BR');

      const dataInput = new TextInputBuilder()
        .setCustomId('data_input')
        .setLabel('QUANDO VENDEU')
        .setStyle(TextInputStyle.Short)
        .setValue(dataFormatada)
        .setPlaceholder('DD/MM/AAAA')
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
      console.error('Erro ao abrir modal de vendas:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao abrir o formulário de venda.',
        ephemeral: true
      });
    }
    return;
  }

  // 2. Modal Submetido
  if (customId === 'venda_nova_modal') {
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
      const dataVenda = interaction.fields.getTextInputValue('data_input').trim();
      const parceria = interaction.fields.getTextInputValue('parceria_input').trim();

      const saleEmbed = new EmbedBuilder()
        .setTitle('🛍️ NOVA VENDA REGISTRADA 🛍️')
        .setDescription('Mais uma venda realizada com sucesso!')
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Data da Venda:', value: dataVenda, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true },
          { name: '💼 Vendedor:', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setColor(2326507)
        .setFooter({ text: `LuxBot Vendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      const btnConfirmar = new ButtonBuilder()
        .setCustomId(`venda_confirmar_btn_${interaction.user.id}`)
        .setLabel('Confirmar Venda')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✔️');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('venda_excluir_btn')
        .setLabel('Excluir Venda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const rowButtons = new ActionRowBuilder().addComponents(btnConfirmar, btnExcluir);

      // Criar novo tópico no fórum correspondente
      const newThread = await forumChannel.threads.create({
        name: `🛍️┃Venda - ${cliente} - ${dataVenda}`,
        message: {
          embeds: [saleEmbed],
          components: [rowButtons]
        }
      });

      // Salvar venda no banco para estatísticas do /perfil
      addVenda(interaction.user.id, interaction.user.tag, {
        data: dataVenda,
        threadUrl: newThread.url
      });

      await interaction.reply({
        content: `✅ Venda registrada com sucesso! Novo tópico criado: ${newThread}`,
        ephemeral: true
      });

      // Enviar log de nova venda
      const logEmbed = new EmbedBuilder()
        .setTitle('🛍️ VENDA REGISTRADA 🛍️')
        .setColor(3066993)
        .setDescription(`O membro <@${interaction.user.id}> registrou uma nova venda no fórum ${forumChannel}.`)
        .addFields(
          { name: '👤 Cliente:', value: cliente, inline: true },
          { name: '🔢 Quantidade:', value: qtd, inline: true },
          { name: '💰 Valor:', value: valor, inline: true },
          { name: '📅 Data:', value: dataVenda, inline: true },
          { name: '🤝 Parceria:', value: parceria, inline: true }
        )
        .setFooter({ text: `LuxBot Vendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registrovenda', logEmbed);

    } catch (error) {
      console.error('Erro ao processar submissão de modal de vendas:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao processar o registro da sua venda.',
        ephemeral: true
      });
    }
    return;
  }

  // 3. Botão Confirmar Venda clicado
  if (customId.startsWith('venda_confirmar_btn_')) {
    try {
      const vendedorId = customId.replace('venda_confirmar_btn_', '');
      const forumId = interaction.channel.parentId;

      const config = getVendaPanel(forumId);
      const hasPermission = config && config.cargosPermitidosIds
        ? config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para confirmar esta venda!',
          ephemeral: true
        });
      }

      // Reagir com 💸
      await interaction.message.react('💸').catch(() => null);

      // Editar embed
      const originalEmbed = interaction.message.embeds[0];
      let updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setTitle('✅ VENDA CONFIRMADA ✅')
        .setColor(3066993)
        .addFields({ name: '✔️ Confirmado por:', value: `<@${interaction.user.id}>`, inline: true });

      const btnDesconfirmar = new ButtonBuilder()
        .setCustomId(`venda_desconfirmar_btn_${vendedorId}`)
        .setLabel('Desconfirmar Venda')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('venda_excluir_btn')
        .setLabel('Excluir Venda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const rowButtons = new ActionRowBuilder().addComponents(btnDesconfirmar, btnExcluir);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [rowButtons]
      });

      // Log de confirmação
      const logEmbed = new EmbedBuilder()
        .setTitle('✅ VENDA CONFIRMADA ✅')
        .setColor(3066993)
        .setDescription(`O administrador <@${interaction.user.id}> confirmou a venda realizada por <@${vendedorId}> no fórum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Vendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registrovenda', logEmbed);

    } catch (error) {
      console.error('Erro ao confirmar venda:', error);
      await interaction.reply({ content: '❌ Erro ao confirmar venda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 4. Botão Excluir Venda clicado
  if (customId === 'venda_excluir_btn') {
    try {
      const forumId = interaction.channel.parentId;

      const config = getVendaPanel(forumId);
      const hasPermission = config && config.cargosPermitidosIds
        ? config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para excluir esta venda!',
          ephemeral: true
        });
      }

      const thread = interaction.channel;

      // Enviar log antes de deletar o canal
      const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ VENDA EXCLUÍDA 🗑️')
        .setColor(15158332)
        .setDescription(`O administrador <@${interaction.user.id}> excluiu o tópico de venda **${thread.name}** no fórum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Vendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registrovenda', logEmbed);

      // Deletar o canal/thread correspondente
      await interaction.reply({ content: 'Excluindo tópico de venda...', ephemeral: true });
      await thread.delete().catch(() => null);

    } catch (error) {
      console.error('Erro ao excluir venda:', error);
      await interaction.reply({ content: '❌ Erro ao excluir venda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 5. Botão Desconfirmar Venda clicado
  if (customId.startsWith('venda_desconfirmar_btn_')) {
    try {
      const vendedorId = customId.replace('venda_desconfirmar_btn_', '');
      const forumId = interaction.channel.parentId;

      const config = getVendaPanel(forumId);
      const hasPermission = config && config.cargosPermitidosIds
        ? config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem permissão para desconfirmar esta venda!',
          ephemeral: true
        });
      }

      // Remover reação 💸
      const reaction = interaction.message.reactions.cache.find(r => r.emoji.name === '💸');
      if (reaction) {
        await reaction.users.remove(interaction.client.user.id).catch(() => null);
      }

      // Reverter embed
      const originalEmbed = interaction.message.embeds[0];
      
      // Remover campo "Confirmado por" do embed
      const cleanFields = originalEmbed.fields.filter(f => !f.name.includes('Confirmado por'));

      const revertedEmbed = new EmbedBuilder()
        .setTitle('🛍️ NOVA VENDA REGISTRADA 🛍️')
        .setDescription(originalEmbed.description || 'Mais uma venda realizada com sucesso!')
        .addFields(cleanFields)
        .setColor(2326507) // Cor verde original
        .setFooter(originalEmbed.footer ? { text: originalEmbed.footer.text } : null)
        .setTimestamp(originalEmbed.timestamp ? new Date(originalEmbed.timestamp) : null);

      const btnConfirmar = new ButtonBuilder()
        .setCustomId(`venda_confirmar_btn_${vendedorId}`)
        .setLabel('Confirmar Venda')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✔️');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('venda_excluir_btn')
        .setLabel('Excluir Venda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

      const rowButtons = new ActionRowBuilder().addComponents(btnConfirmar, btnExcluir);

      await interaction.update({
        embeds: [revertedEmbed],
        components: [rowButtons]
      });

      // Log de desconfirmação
      const logEmbed = new EmbedBuilder()
        .setTitle('↩️ VENDA DESCONFIRMADA ↩️')
        .setColor(3447003)
        .setDescription(`O administrador <@${interaction.user.id}> desconfirmou a venda de <@${vendedorId}> no fórum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Vendas • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registrovenda', logEmbed);

    } catch (error) {
      console.error('Erro ao desconfirmar venda:', error);
      await interaction.reply({ content: '❌ Erro ao desconfirmar venda.', ephemeral: true }).catch(() => null);
    }
  }
}
