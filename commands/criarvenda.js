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
import { getGlobalVendaConfig, addVenda, getVendaPanel } from '../database.js';
import { sendLog } from '../logs.js';

function hasVendaPermission(interaction, config) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  if (config && config.cargosPermitidosIds && Array.isArray(config.cargosPermitidosIds)) {
    return config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId));
  }
  return false;
}

export const data = new SlashCommandBuilder()
  .setName('criarvenda')
  .setDescription('Cria o painel de registro de vendas no fórum configurado no /painelconfig.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const success = await criarPainelVenda(interaction.client, interaction.guild);
    if (success) {
      await interaction.reply({
        content: '✅ Painel de vendas criado com sucesso no fórum configurado!',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: '❌ Configurações de Vendas incompletas! Configure o canal de fórum no `/painelconfig` primeiro.',
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Erro ao executar o comando /criarvenda:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao criar o painel de vendas.',
      ephemeral: true
    }).catch(() => null);
  }
}

export async function criarPainelVenda(client, guild) {
  try {
    const config = getGlobalVendaConfig();
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    if (!config || !config.forumCanalId) return false;

    const canalForum = guild.channels.cache.get(config.forumCanalId)
      || await guild.channels.fetch(config.forumCanalId).catch(() => null);
    if (!canalForum || canalForum.type !== ChannelType.GuildForum) return false;

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

    const thread = await canalForum.threads.create({
      name: '🛒┃Painel de Vendas',
      message: {
        embeds: [welcomeEmbed],
        components: [row]
      }
    });

    await thread.pin().catch(() => null);
    return true;
  } catch (error) {
    console.error('Erro ao criar painel de venda:', error);
    return false;
  }
}
// Trata as intera├º├Áes iniciadas por venda_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. Bot├úo Nova Venda clicado
  if (customId === 'venda_nova_btn') {
    try {
      const forumId = interaction.channel.parentId;
      if (!forumId) {
        return await interaction.reply({
          content: 'ÔØî Erro: Este painel n├úo foi localizado dentro de um canal de f├│rum.',
          ephemeral: true
        });
      }

      const config = getVendaPanel(forumId);
      if (!config) {
        return await interaction.reply({
          content: 'ÔØî Erro: Configura├º├úo de vendas deste f├│rum n├úo localizada no banco de dados.',
          ephemeral: true
        });
      }

      // Verificar permiss├úo de cargos
      const hasPermission = hasVendaPermission(interaction, config);

      if (!hasPermission) {
        return await interaction.reply({
          content: 'ÔØî Voc├¬ n├úo tem o cargo autorizado para registrar vendas!',
          ephemeral: true
        });
      }

      // Abrir modal de venda (5 campos)
      const modal = new ModalBuilder()
        .setCustomId('venda_nova_modal')
        .setTitle('­ƒøì´©Å Registrar Nova Venda');

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
      console.error('Erro ao abrir modal de vendas:', error);
      await interaction.reply({
        content: 'ÔØî Ocorreu um erro ao abrir o formul├írio de venda.',
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
      const dataVenda = interaction.fields.getTextInputValue('data_input').trim();
      const parceria = interaction.fields.getTextInputValue('parceria_input').trim();

      const saleEmbed = new EmbedBuilder()
        .setTitle('­ƒøì´©Å NOVA VENDA REGISTRADA ­ƒøì´©Å')
        .setDescription('Mais uma venda realizada com sucesso!')
        .addFields(
          { name: '­ƒæñ Cliente:', value: cliente, inline: true },
          { name: '­ƒöó Quantidade:', value: qtd, inline: true },
          { name: '­ƒÆ░ Valor:', value: valor, inline: true },
          { name: '­ƒôà Data da Venda:', value: dataVenda, inline: true },
          { name: '­ƒñØ Parceria:', value: parceria, inline: true },
          { name: '­ƒÆ╝ Vendedor:', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setColor(2326507)
        .setFooter({ text: `LuxBot Vendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      const btnConfirmar = new ButtonBuilder()
        .setCustomId(`venda_confirmar_btn_${interaction.user.id}`)
        .setLabel('Confirmar Venda')
        .setStyle(ButtonStyle.Success)
        .setEmoji('Ô£ö´©Å');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('venda_excluir_btn')
        .setLabel('Excluir Venda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('­ƒùæ´©Å');

      const rowButtons = new ActionRowBuilder().addComponents(btnConfirmar, btnExcluir);

      // Criar novo t├│pico no f├│rum correspondente
      const newThread = await forumChannel.threads.create({
        name: `­ƒøì´©ÅÔöâVenda - ${cliente} - ${dataVenda}`,
        message: {
          embeds: [saleEmbed],
          components: [rowButtons]
        }
      });

      // Salvar venda no banco para estat├¡sticas do /perfil
      addVenda(interaction.user.id, interaction.user.tag, {
        data: dataVenda,
        threadUrl: newThread.url
      });

      await interaction.reply({
        content: `Ô£à Venda registrada com sucesso! Novo t├│pico criado: ${newThread}`,
        ephemeral: true
      });

      // Enviar log de nova venda
      const logEmbed = new EmbedBuilder()
        .setTitle('­ƒøì´©Å VENDA REGISTRADA ­ƒøì´©Å')
        .setColor(3066993)
        .setDescription(`O membro <@${interaction.user.id}> registrou uma nova venda no f├│rum ${forumChannel}.`)
        .addFields(
          { name: '­ƒæñ Cliente:', value: cliente, inline: true },
          { name: '­ƒöó Quantidade:', value: qtd, inline: true },
          { name: '­ƒÆ░ Valor:', value: valor, inline: true },
          { name: '­ƒôà Data:', value: dataVenda, inline: true },
          { name: '­ƒñØ Parceria:', value: parceria, inline: true }
        )
        .setFooter({ text: `LuxBot Vendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registrovenda', logEmbed);

    } catch (error) {
      console.error('Erro ao processar submiss├úo de modal de vendas:', error);
      await interaction.reply({
        content: 'ÔØî Ocorreu um erro ao processar o registro da sua venda.',
        ephemeral: true
      });
    }
    return;
  }

  // 3. Bot├úo Confirmar Venda clicado
  if (customId.startsWith('venda_confirmar_btn_')) {
    try {
      const vendedorId = customId.replace('venda_confirmar_btn_', '');
      const forumId = interaction.channel.parentId;

      const config = getVendaPanel(forumId);
      const hasPermission = hasVendaPermission(interaction, config);

      if (!hasPermission) {
        return await interaction.reply({
          content: 'ÔØî Voc├¬ n├úo tem permiss├úo para confirmar esta venda!',
          ephemeral: true
        });
      }

      // Reagir com ­ƒÆ©
      await interaction.message.react('­ƒÆ©').catch(() => null);

      // Editar embed
      const originalEmbed = interaction.message.embeds[0];
      let updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setTitle('Ô£à VENDA CONFIRMADA Ô£à')
        .setColor(3066993)
        .addFields({ name: 'Ô£ö´©Å Confirmado por:', value: `<@${interaction.user.id}>`, inline: true });

      const btnDesconfirmar = new ButtonBuilder()
        .setCustomId(`venda_desconfirmar_btn_${vendedorId}`)
        .setLabel('Desconfirmar Venda')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('Ôå®´©Å');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('venda_excluir_btn')
        .setLabel('Excluir Venda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('­ƒùæ´©Å');

      const rowButtons = new ActionRowBuilder().addComponents(btnDesconfirmar, btnExcluir);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [rowButtons]
      });

      // Log de confirma├º├úo
      const logEmbed = new EmbedBuilder()
        .setTitle('Ô£à VENDA CONFIRMADA Ô£à')
        .setColor(3066993)
        .setDescription(`O administrador <@${interaction.user.id}> confirmou a venda realizada por <@${vendedorId}> no f├│rum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Vendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registrovenda', logEmbed);

    } catch (error) {
      console.error('Erro ao confirmar venda:', error);
      await interaction.reply({ content: 'ÔØî Erro ao confirmar venda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 4. Bot├úo Excluir Venda clicado
  if (customId === 'venda_excluir_btn') {
    try {
      const forumId = interaction.channel.parentId;

      const config = getVendaPanel(forumId);
      const hasPermission = hasVendaPermission(interaction, config);

      if (!hasPermission) {
        return await interaction.reply({
          content: 'ÔØî Voc├¬ n├úo tem permiss├úo para excluir esta venda!',
          ephemeral: true
        });
      }

      const thread = interaction.channel;

      // Enviar log antes de deletar o canal
      const logEmbed = new EmbedBuilder()
        .setTitle('­ƒùæ´©Å VENDA EXCLU├ìDA ­ƒùæ´©Å')
        .setColor(15158332)
        .setDescription(`O administrador <@${interaction.user.id}> excluiu o t├│pico de venda **${thread.name}** no f├│rum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Vendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registrovenda', logEmbed);

      // Deletar o canal/thread correspondente
      await interaction.reply({ content: 'Excluindo t├│pico de venda...', ephemeral: true });
      await thread.delete().catch(() => null);

    } catch (error) {
      console.error('Erro ao excluir venda:', error);
      await interaction.reply({ content: 'ÔØî Erro ao excluir venda.', ephemeral: true }).catch(() => null);
    }
    return;
  }

  // 5. Bot├úo Desconfirmar Venda clicado
  if (customId.startsWith('venda_desconfirmar_btn_')) {
    try {
      const vendedorId = customId.replace('venda_desconfirmar_btn_', '');
      const forumId = interaction.channel.parentId;

      const config = getVendaPanel(forumId);
      const hasPermission = hasVendaPermission(interaction, config);

      if (!hasPermission) {
        return await interaction.reply({
          content: 'ÔØî Voc├¬ n├úo tem permiss├úo para desconfirmar esta venda!',
          ephemeral: true
        });
      }

      // Remover rea├º├úo ­ƒÆ©
      const reaction = interaction.message.reactions.cache.find(r => r.emoji.name === '­ƒÆ©');
      if (reaction) {
        await reaction.users.remove(interaction.client.user.id).catch(() => null);
      }

      // Reverter embed
      const originalEmbed = interaction.message.embeds[0];
      
      // Remover campo "Confirmado por" do embed
      const cleanFields = originalEmbed.fields.filter(f => !f.name.includes('Confirmado por'));

      const revertedEmbed = new EmbedBuilder()
        .setTitle('­ƒøì´©Å NOVA VENDA REGISTRADA ­ƒøì´©Å')
        .setDescription(originalEmbed.description || 'Mais uma venda realizada com sucesso!')
        .addFields(cleanFields)
        .setColor(2326507) // Cor verde original
        .setFooter(originalEmbed.footer ? { text: originalEmbed.footer.text } : null)
        .setTimestamp(originalEmbed.timestamp ? new Date(originalEmbed.timestamp) : null);

      const btnConfirmar = new ButtonBuilder()
        .setCustomId(`venda_confirmar_btn_${vendedorId}`)
        .setLabel('Confirmar Venda')
        .setStyle(ButtonStyle.Success)
        .setEmoji('Ô£ö´©Å');

      const btnExcluir = new ButtonBuilder()
        .setCustomId('venda_excluir_btn')
        .setLabel('Excluir Venda')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('­ƒùæ´©Å');

      const rowButtons = new ActionRowBuilder().addComponents(btnConfirmar, btnExcluir);

      await interaction.update({
        embeds: [revertedEmbed],
        components: [rowButtons]
      });

      // Log de desconfirma├º├úo
      const logEmbed = new EmbedBuilder()
        .setTitle('Ôå®´©Å VENDA DESCONFIRMADA Ôå®´©Å')
        .setColor(3447003)
        .setDescription(`O administrador <@${interaction.user.id}> desconfirmou a venda de <@${vendedorId}> no f├│rum <#${forumId}>.`)
        .setFooter({ text: `LuxBot Vendas ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registrovenda', logEmbed);

    } catch (error) {
      console.error('Erro ao desconfirmar venda:', error);
      await interaction.reply({ content: 'ÔØî Erro ao desconfirmar venda.', ephemeral: true }).catch(() => null);
    }
  }
}
