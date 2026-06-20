import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getBaus, getBau, deleteBau, saveBau, getBauItems } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('listarbau')
  .setDescription('Lista todos os baús criados e permite remover baús.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Helper para gerar o embed de listagem de baús
function generateListEmbed(baus) {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const embed = new EmbedBuilder()
    .setTitle('📋 BAÚS CADASTRADOS 📋')
    .setColor(12096338) // Cor terrosa/madeira
    .setFooter({ text: `LuxBot Listar Baú • ${dataAtual} • criado por chegaheitor` })
    .setTimestamp();

  if (baus.length === 0) {
    embed.setDescription('*Nenhum baú cadastrado no momento.*');
  } else {
    const listLines = baus.map((b, i) => {
      const uniqueItemsCount = Object.keys(b.itens || {}).filter(k => b.itens[k] > 0).length;
      return `**${i + 1}. 📦 ${b.nome}**\n   • Canal: <#${b.canalId}>\n   • Itens únicos cadastrados: \`${uniqueItemsCount}\`\n   • ID da Mensagem: \`${b.messageId}\``;
    }).join('\n\n');
    embed.setDescription(`Aqui estão todos os baús cadastrados no banco de dados:\n\n${listLines}`);
  }

  return embed;
}

export async function execute(interaction) {
  try {
    // Somente administradores podem usar
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ Somente membros com a permissão de Administrador podem utilizar este comando!',
        ephemeral: true
      });
    }

    const baus = getBaus();
    const embed = generateListEmbed(baus);

    const btnRemover = new ButtonBuilder()
      .setCustomId('listarbau_remover_btn')
      .setLabel('Remover Baú')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️')
      .setDisabled(baus.length === 0);

    const row = new ActionRowBuilder().addComponents(btnRemover);

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Erro ao executar o comando /listarbau:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao listar os baús.',
      ephemeral: true
    }).catch(() => null);
  }
}

// Trata as interações iniciadas por listarbau_ e bau_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // ==========================================
  // PARTE 1: GERENCIAMENTO DE BAÚS (APENAS ADMIN)
  // ==========================================
  if (customId.startsWith('listarbau_')) {
    // Somente administradores podem interagir com a exclusão de baús
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ Você não tem cargo de Administrador para realizar esta ação!',
        ephemeral: true
      });
    }

    // 1. Clique no botão de remover
    if (interaction.isButton() && customId === 'listarbau_remover_btn') {
      try {
        const baus = getBaus();
        if (baus.length === 0) {
          return await interaction.reply({
            content: '❌ Não existem baús para remover!',
            ephemeral: true
          });
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId('listarbau_remover_select')
          .setPlaceholder('Escolha o baú que deseja remover...');

        const options = baus.map(b => {
          const channel = guild.channels.cache.get(b.canalId);
          const channelName = channel ? `#${channel.name}` : `ID: ${b.canalId}`;
          return {
            label: b.nome,
            description: `Canal: ${channelName}`,
            value: b.messageId
          };
        });

        menu.addOptions(options);

        const rowSelect = new ActionRowBuilder().addComponents(menu);

        const btnCancelar = new ButtonBuilder()
          .setCustomId('listarbau_cancelar_btn')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌');

        const rowCancel = new ActionRowBuilder().addComponents(btnCancelar);

        await interaction.update({
          components: [rowSelect, rowCancel]
        });

      } catch (error) {
        console.error('Erro ao preparar menu de exclusão de baú:', error);
        await interaction.reply({ content: '❌ Erro ao abrir menu de exclusão.', ephemeral: true }).catch(() => null);
      }
      return;
    }

    // 2. Clique no botão cancelar
    if (interaction.isButton() && customId === 'listarbau_cancelar_btn') {
      try {
        const baus = getBaus();
        const embed = generateListEmbed(baus);

        const btnRemover = new ButtonBuilder()
          .setCustomId('listarbau_remover_btn')
          .setLabel('Remover Baú')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
          .setDisabled(baus.length === 0);

        const row = new ActionRowBuilder().addComponents(btnRemover);

        await interaction.update({
          embeds: [embed],
          components: [row]
        });

      } catch (error) {
        console.error('Erro ao cancelar exclusão de baú:', error);
      }
      return;
    }

    // 3. Seleção de baú no select menu
    if (interaction.isStringSelectMenu() && customId === 'listarbau_remover_select') {
      try {
        const messageId = interaction.values[0];
        const chest = getBau(messageId);

        if (!chest) {
          return await interaction.reply({
            content: '❌ O baú selecionado não foi localizado no banco de dados!',
            ephemeral: true
          });
        }

        // Deletar a mensagem do baú no Discord se ela existir
        const channel = await guild.channels.fetch(chest.canalId).catch(() => null);
        let msgDeletada = false;
        if (channel) {
          const msg = await channel.messages.fetch(messageId).catch(() => null);
          if (msg) {
            await msg.delete().catch(err => console.error('Erro ao deletar mensagem do baú:', err));
            msgDeletada = true;
          }
        }

        // Remover do banco de dados
        deleteBau(messageId);

        // Enviar log de exclusão
        const logEmbed = new EmbedBuilder()
          .setTitle('🗑️ Baú Removido')
          .setColor(15158332) // Vermelho
          .setDescription(`O administrador <@${interaction.user.id}> removeu completamente o baú **${chest.nome}**.`)
          .addFields(
            { name: '📦 Nome do Baú:', value: chest.nome, inline: true },
            { name: '📢 Canal de Origem:', value: `<#${chest.canalId}>`, inline: true },
            { name: '✉️ Mensagem Deletada:', value: msgDeletada ? 'Sim' : 'Não (Mensagem não localizada/deletada manualmente)', inline: true }
          )
          .setTimestamp();

        await sendLog(interaction.client, guild, 'listarbau', logEmbed);

        // Atualiza o painel do listarbau
        const updatedBaus = getBaus();
        const updatedEmbed = generateListEmbed(updatedBaus);

        const btnRemover = new ButtonBuilder()
          .setCustomId('listarbau_remover_btn')
          .setLabel('Remover Baú')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
          .setDisabled(updatedBaus.length === 0);

        const row = new ActionRowBuilder().addComponents(btnRemover);

        await interaction.update({
          embeds: [updatedEmbed],
          components: [row]
        });

        // Feedback efêmero de confirmação
        await interaction.followUp({
          content: `✅ O baú **${chest.nome}** foi removido com sucesso e seus dados foram excluídos!`,
          ephemeral: true
        });

      } catch (error) {
        console.error('Erro ao remover baú via select menu:', error);
        await interaction.reply({ content: '❌ Erro ao remover o baú selecionado.', ephemeral: true }).catch(() => null);
      }
    }
    return;
  }

  // ==========================================
  // PARTE 2: INTERAÇÃO DOS BAÚS ATIVOS (Membros Autorizados)
  // ==========================================
  if (customId.startsWith('bau_')) {
    const messageId = interaction.message ? interaction.message.id : null;

    // 1. Cliques nos Botões (Adicionar/Retirar)
    if (interaction.isButton()) {
      try {
        const chest = getBau(messageId);
        if (!chest) {
          return await interaction.reply({
            content: '❌ Erro: Configuração deste baú não localizada no banco de dados.',
            ephemeral: true
          });
        }

        // Verificar permissão
        const hasPermission = (chest && chest.cargosPermitidosIds && Array.isArray(chest.cargosPermitidosIds))
          ? chest.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId)) || interaction.member.permissions.has(PermissionFlagsBits.Administrator)
          : interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!hasPermission) {
          return await interaction.reply({
            content: '❌ Você não tem cargo autorizado para mexer neste baú!',
            ephemeral: true
          });
        }

        // Ação do Botão Adicionar
        if (customId === 'bau_adicionar_btn') {
          const materials = getBauItems();
          
          const menu = new StringSelectMenuBuilder()
            .setCustomId(`bau_adicionar_select_${messageId}`)
            .setPlaceholder('Escolha o item para ADICIONAR...')
            .addOptions(
              materials.map(m => ({
                label: m,
                value: m,
                emoji: '📦'
              }))
            );

          const row = new ActionRowBuilder().addComponents(menu);

          return await interaction.reply({
            content: 'Selecione abaixo o item que você deseja adicionar ao baú:',
            components: [row],
            ephemeral: true
          });
        }

        // Ação do Botão Retirar
        if (customId === 'bau_retirar_btn') {
          const itemsInChest = Object.entries(chest.itens).filter(([_, qty]) => qty > 0);

          if (itemsInChest.length === 0) {
            return await interaction.reply({
              content: '❌ Não há itens para retirar deste baú. Ele está vazio!',
              ephemeral: true
            });
          }

          const menu = new StringSelectMenuBuilder()
            .setCustomId(`bau_retirar_select_${messageId}`)
            .setPlaceholder('Escolha o item para RETIRAR...')
            .addOptions(
              itemsInChest.map(([item, qty]) => ({
                label: `${item} (Disponível: ${qty})`,
                value: item,
                emoji: '📦'
              }))
            );

          const row = new ActionRowBuilder().addComponents(menu);

          return await interaction.reply({
            content: 'Selecione abaixo o item que você deseja retirar do baú:',
            components: [row],
            ephemeral: true
          });
        }

      } catch (error) {
        console.error('Erro no botão do baú:', error);
        await interaction.reply({ content: '❌ Erro ao processar a ação no baú.', ephemeral: true }).catch(() => null);
      }
      return;
    }

    // 2. Interações de Seleção (Dropdown Select Menu)
    if (interaction.isStringSelectMenu()) {
      try {
        const selectedItem = interaction.values[0];

        if (customId.startsWith('bau_adicionar_select_')) {
          const chestMessageId = customId.replace('bau_adicionar_select_', '');
          
          const modal = new ModalBuilder()
            .setCustomId(`bau_adicionar_modal_${chestMessageId}_${selectedItem}`)
            .setTitle(`Adicionar: ${selectedItem}`);

          const qtdInput = new TextInputBuilder()
            .setCustomId('quantidade_input')
            .setLabel('QUANTIDADE A ADICIONAR')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Digite apenas números inteiros (ex: 50)')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(qtdInput));
          return await interaction.showModal(modal);
        }

        if (customId.startsWith('bau_retirar_select_')) {
          const chestMessageId = customId.replace('bau_retirar_select_', '');
          
          const modal = new ModalBuilder()
            .setCustomId(`bau_retirar_modal_${chestMessageId}_${selectedItem}`)
            .setTitle(`Retirar: ${selectedItem}`);

          const qtdInput = new TextInputBuilder()
            .setCustomId('quantidade_input')
            .setLabel('QUANTIDADE A RETIRAR')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Digite apenas números inteiros (ex: 20)')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(qtdInput));
          return await interaction.showModal(modal);
        }

      } catch (error) {
        console.error('Erro na seleção de item do baú:', error);
        await interaction.reply({ content: '❌ Erro ao processar a seleção de item.', ephemeral: true }).catch(() => null);
      }
      return;
    }

    // 3. Submissão de Modais (Quantidade)
    if (interaction.isModalSubmit()) {
      try {
        const quantidadeInput = interaction.fields.getTextInputValue('quantidade_input').trim();

        // Validação numérica
        if (!/^\d+$/.test(quantidadeInput)) {
          return await interaction.reply({
            content: '❌ Quantidade inválida! Por favor, digite apenas números inteiros positivos.',
            ephemeral: true
          });
        }

        const qtd = parseInt(quantidadeInput, 10);
        if (qtd <= 0) {
          return await interaction.reply({
            content: '❌ A quantidade informada precisa ser maior que zero!',
            ephemeral: true
          });
        }

        // Adicionar Modal Submetido
        if (customId.startsWith('bau_adicionar_modal_')) {
          const cleanId = customId.replace('bau_adicionar_modal_', '');
          const parts = cleanId.split('_');
          const chestMessageId = parts[0];
          const item = parts[1];

          const chest = getBau(chestMessageId);
          if (!chest) {
            return await interaction.reply({ content: '❌ Erro: Baú não localizado no banco.', ephemeral: true });
          }

          const channel = await guild.channels.fetch(chest.canalId).catch(() => null);
          if (!channel) {
            return await interaction.reply({ content: '❌ Erro: Canal do baú não localizado.', ephemeral: true });
          }

          const mainMessage = await channel.messages.fetch(chestMessageId).catch(() => null);
          if (!mainMessage) {
            return await interaction.reply({ content: '❌ Erro: Mensagem principal do baú não localizada.', ephemeral: true });
          }

          const qtyAnterior = chest.itens[item] || 0;
          const qtyNova = qtyAnterior + qtd;
          chest.itens[item] = qtyNova;
          saveBau(chest);

          // Atualizar Embed Principal
          const contentLines = Object.entries(chest.itens)
            .filter(([_, q]) => q > 0)
            .map(([it, q]) => `📦 **${it}:** \`${q.toLocaleString('pt-BR')}\``)
            .join('\n');

          const description = contentLines.length > 0
            ? `**Conteúdo do Baú:**\n\n${contentLines}`
            : `**Conteúdo do Baú:**\n*Nenhum item armazenado no momento.*`;

          const updatedEmbed = EmbedBuilder.from(mainMessage.embeds[0])
            .setDescription(description)
            .setTimestamp();

          await mainMessage.edit({ embeds: [updatedEmbed] });

          // Enviar Log Público no Canal do Baú
          const pubLog = new EmbedBuilder()
            .setTitle('📥 ITEM ADICIONADO AO BAÚ 📥')
            .setColor(3066993) // Verde
            .setDescription(`O membro <@${interaction.user.id}> adicionou itens ao baú **${chest.nome}**.`)
            .addFields(
              { name: '📦 Item:', value: item, inline: true },
              { name: '🔢 Quantidade Adicionada:', value: qtd.toLocaleString('pt-BR'), inline: true },
              { name: '📉 Estoque Anterior:', value: qtyAnterior.toLocaleString('pt-BR'), inline: true },
              { name: '📈 Novo Estoque Total:', value: qtyNova.toLocaleString('pt-BR'), inline: true }
            )
            .setFooter({ text: `LuxBot Baú • ${dataAtual} • criado por chegaheitor` })
            .setTimestamp();

          await channel.send({ embeds: [pubLog] });

          // Responder ao usuário
          await interaction.reply({
            content: `✅ Adicionado com sucesso: **${qtd.toLocaleString('pt-BR')}x ${item}** ao baú!`,
            ephemeral: true
          });

          // Enviar log do bot
          const botLogEmbed = new EmbedBuilder()
            .setTitle('📥 Depósito em Baú')
            .setColor(3066993)
            .setDescription(`O membro <@${interaction.user.id}> depositou itens no baú **${chest.nome}** (<#${chest.canalId}>).`)
            .addFields(
              { name: '📦 Item:', value: item, inline: true },
              { name: '🔢 Quantidade:', value: qtd.toLocaleString('pt-BR'), inline: true },
              { name: '📈 Estoque Total:', value: qtyNova.toLocaleString('pt-BR'), inline: true }
            )
            .setTimestamp();

          await sendLog(interaction.client, guild, 'listarbau', botLogEmbed);
        }

        // Retirar Modal Submetido
        if (customId.startsWith('bau_retirar_modal_')) {
          const cleanId = customId.replace('bau_retirar_modal_', '');
          const parts = cleanId.split('_');
          const chestMessageId = parts[0];
          const item = parts[1];

          const chest = getBau(chestMessageId);
          if (!chest) {
            return await interaction.reply({ content: '❌ Erro: Baú não localizado no banco.', ephemeral: true });
          }

          const qtyAnterior = chest.itens[item] || 0;
          if (qtd > qtyAnterior) {
            return await interaction.reply({
              content: `❌ Quantidade insuficiente! Este baú possui apenas **${qtyAnterior.toLocaleString('pt-BR')}** de **${item}**.`,
              ephemeral: true
            });
          }

          const channel = await guild.channels.fetch(chest.canalId).catch(() => null);
          if (!channel) {
            return await interaction.reply({ content: '❌ Erro: Canal do baú não localizado.', ephemeral: true });
          }

          const mainMessage = await channel.messages.fetch(chestMessageId).catch(() => null);
          if (!mainMessage) {
            return await interaction.reply({ content: '❌ Erro: Mensagem principal do baú não localizada.', ephemeral: true });
          }

          const qtyNova = qtyAnterior - qtd;
          chest.itens[item] = qtyNova;
          saveBau(chest);

          // Atualizar Embed Principal
          const contentLines = Object.entries(chest.itens)
            .filter(([_, q]) => q > 0)
            .map(([it, q]) => `📦 **${it}:** \`${q.toLocaleString('pt-BR')}\``)
            .join('\n');

          const description = contentLines.length > 0
            ? `**Conteúdo do Baú:**\n\n${contentLines}`
            : `**Conteúdo do Baú:**\n*Nenhum item armazenado no momento.*`;

          const updatedEmbed = EmbedBuilder.from(mainMessage.embeds[0])
            .setDescription(description)
            .setTimestamp();

          await mainMessage.edit({ embeds: [updatedEmbed] });

          // Enviar Log Público no Canal do Baú
          const pubLog = new EmbedBuilder()
            .setTitle('📤 ITEM RETIRADO DO BAÚ 📤')
            .setColor(15158332) // Vermelho
            .setDescription(`O membro <@${interaction.user.id}> retirou itens do baú **${chest.nome}**.`)
            .addFields(
              { name: '📦 Item:', value: item, inline: true },
              { name: '🔢 Quantidade Retirada:', value: qtd.toLocaleString('pt-BR'), inline: true },
              { name: '📈 Estoque Anterior:', value: qtyAnterior.toLocaleString('pt-BR'), inline: true },
              { name: '📉 Estoque Restante:', value: qtyNova.toLocaleString('pt-BR'), inline: true }
            )
            .setFooter({ text: `LuxBot Baú • ${dataAtual} • criado por chegaheitor` })
            .setTimestamp();

          await channel.send({ embeds: [pubLog] });

          // Responder ao usuário
          await interaction.reply({
            content: `✅ Retirado com sucesso: **${qtd.toLocaleString('pt-BR')}x ${item}** do baú!`,
            ephemeral: true
          });

          // Enviar log do bot
          const botLogEmbed = new EmbedBuilder()
            .setTitle('📤 Retirada de Baú')
            .setColor(15158332)
            .setDescription(`O membro <@${interaction.user.id}> retirou itens do baú **${chest.nome}** (<#${chest.canalId}>).`)
            .addFields(
              { name: '📦 Item:', value: item, inline: true },
              { name: '🔢 Quantidade:', value: qtd.toLocaleString('pt-BR'), inline: true },
              { name: '📉 Estoque Restante:', value: qtyNova.toLocaleString('pt-BR'), inline: true }
            )
            .setTimestamp();

          await sendLog(interaction.client, guild, 'listarbau', botLogEmbed);
        }

      } catch (error) {
        console.error('Erro na submissão de modal do baú:', error);
        await interaction.reply({ content: '❌ Erro ao processar a movimentação no baú.', ephemeral: true }).catch(() => null);
      }
    }
  }
}
