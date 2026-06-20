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
  StringSelectMenuBuilder, 
  ChannelType 
} from 'discord.js';
import { saveBau, getBau, getBauItems } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('registrobau')
  .setDescription('Cria um baú/inventário interativo no canal selecionado.')
  .addChannelOption(option =>
    option.setName('canal')
      .setDescription('O canal de texto onde o baú será criado')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addStringOption(option =>
    option.setName('nome')
      .setDescription('Nome do baú (ex: Baú de Recursos, Baú de Armas)')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_1')
      .setDescription('Primeiro cargo autorizado a interagir com o baú')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_2')
      .setDescription('Segundo cargo autorizado (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_3')
      .setDescription('Terceiro cargo autorizado (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_4')
      .setDescription('Quarto cargo autorizado (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_5')
      .setDescription('Quinto cargo autorizado (opcional)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const canal = interaction.options.getChannel('canal');
    const nome = interaction.options.getString('nome');
    
    const role1 = interaction.options.getRole('cargo_1');
    const role2 = interaction.options.getRole('cargo_2');
    const role3 = interaction.options.getRole('cargo_3');
    const role4 = interaction.options.getRole('cargo_4');
    const role5 = interaction.options.getRole('cargo_5');

    const cargosPermitidosIds = [role1.id];
    if (role2) cargosPermitidosIds.push(role2.id);
    if (role3) cargosPermitidosIds.push(role3.id);
    if (role4) cargosPermitidosIds.push(role4.id);
    if (role5) cargosPermitidosIds.push(role5.id);

    const embed = new EmbedBuilder()
      .setTitle(`📦 BAÚ: ${nome.toUpperCase()} 📦`)
      .setDescription('**Conteúdo do Baú:**\n*Nenhum item armazenado no momento.*')
      .setColor(12096338) // Cor de madeira terrosa
      .setFooter({ text: 'Lux Baú • Inventário Controlado' })
      .setTimestamp();

    const btnAdicionar = new ButtonBuilder()
      .setCustomId('bau_adicionar_btn')
      .setLabel('Adicionar')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('➕');

    const btnRetirar = new ButtonBuilder()
      .setCustomId('bau_retirar_btn')
      .setLabel('Retirar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('➖');

    const row = new ActionRowBuilder().addComponents(btnAdicionar, btnRetirar);

    // Envia a mensagem do baú no canal selecionado
    const msg = await canal.send({
      embeds: [embed],
      components: [row]
    });

    // Fixar a mensagem principal no canal do baú
    await msg.pin().catch(() => null);

    // Salvar baú inicializado no banco
    saveBau({
      messageId: msg.id,
      canalId: canal.id,
      nome: nome,
      cargosPermitidosIds: cargosPermitidosIds,
      itens: {}
    });

    await interaction.reply({
      content: `✅ Baú **${nome}** criado e enviado com sucesso no canal ${canal}!`,
      ephemeral: true
    });

    // Enviar log de configuração do baú
    const logEmbed = new EmbedBuilder()
      .setTitle('⚙️ Baú Configurado')
      .setColor(3066993)
      .setDescription(`O administrador <@${interaction.user.id}> configurou o baú **${nome}** no canal ${canal}.`)
      .addFields({
        name: '💼 Cargos Autorizados:',
        value: cargosPermitidosIds.map(id => `<@&${id}>`).join(', ')
      })
      .setTimestamp();

    await sendLog(interaction.client, interaction.guild, 'registrobau', logEmbed);

  } catch (error) {
    console.error('Erro ao executar o comando /registrobau:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao criar o baú.',
      ephemeral: true
    });
  }
}

// Trata as interações iniciadas por bau_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const channelId = interaction.channel.id;
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
      const hasPermission = chest.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

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
          .setTitle('📥 Item Adicionado ao Baú')
          .setColor(3066993) // Verde
          .setDescription(`O membro <@${interaction.user.id}> adicionou itens ao baú **${chest.nome}**.`)
          .addFields(
            { name: '📦 Item:', value: item, inline: true },
            { name: '🔢 Quantidade Adicionada:', value: qtd.toLocaleString('pt-BR'), inline: true },
            { name: '📉 Estoque Anterior:', value: qtyAnterior.toLocaleString('pt-BR'), inline: true },
            { name: '📈 Novo Estoque Total:', value: qtyNova.toLocaleString('pt-BR'), inline: true }
          )
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

        await sendLog(interaction.client, guild, 'registrobau', botLogEmbed);
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
          .setTitle('📤 Item Retirado do Baú')
          .setColor(15158332) // Vermelho
          .setDescription(`O membro <@${interaction.user.id}> retirou itens do baú **${chest.nome}**.`)
          .addFields(
            { name: '📦 Item:', value: item, inline: true },
            { name: '🔢 Quantidade Retirada:', value: qtd.toLocaleString('pt-BR'), inline: true },
            { name: '📈 Estoque Anterior:', value: qtyAnterior.toLocaleString('pt-BR'), inline: true },
            { name: '📉 Estoque Restante:', value: qtyNova.toLocaleString('pt-BR'), inline: true }
          )
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

        await sendLog(interaction.client, guild, 'registrobau', botLogEmbed);
      }

    } catch (error) {
      console.error('Erro na submissão de modal do baú:', error);
      await interaction.reply({ content: '❌ Erro ao processar a movimentação no baú.', ephemeral: true }).catch(() => null);
    }
  }
}
