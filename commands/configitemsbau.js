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
  StringSelectMenuBuilder 
} from 'discord.js';
import { saveBauItems, getBauItems } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('configitemsbau')
  .setDescription('Painel de configuração de itens disponíveis no baú.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Função auxiliar para construir o Embed Principal
function buildConfigEmbed() {
  const itens = getBauItems();
  return new EmbedBuilder()
    .setTitle('⚙️ CONFIGURAÇÃO DE ITENS DO BAÚ')
    .setDescription(
      'Abaixo estão listados os itens atualmente cadastrados para o baú. ' +
      'Eles aparecerão nos menus de seleção para os membros ao realizar adições.\n\n' +
      'Use os botões abaixo para gerenciar os itens.'
    )
    .addFields({
      name: '📦 Itens Cadastrados:',
      value: itens.map((it, i) => `${i + 1}. **${it}**`).join('\n') || 'Nenhum item cadastrado.'
    })
    .setColor(12096338) // Cor de madeira
    .setFooter({ text: 'Lux Baú Config' })
    .setTimestamp();
}

// Função auxiliar para construir os botões principais
function buildConfigButtons() {
  const btnAdicionar = new ButtonBuilder()
    .setCustomId('configitemsbau_btn_adicionar')
    .setLabel('Adicionar Item')
    .setStyle(ButtonStyle.Success)
    .setEmoji('➕');

  const btnRemover = new ButtonBuilder()
    .setCustomId('configitemsbau_btn_remover')
    .setLabel('Remover Item')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('➖');

  const btnResetar = new ButtonBuilder()
    .setCustomId('configitemsbau_btn_resetar')
    .setLabel('Resetar Padrão')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🔄');

  return new ActionRowBuilder().addComponents(btnAdicionar, btnRemover, btnResetar);
}

export async function execute(interaction) {
  try {
    // Garantir permissão
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ Apenas administradores podem usar este comando.',
        ephemeral: true
      });
    }

    const embed = buildConfigEmbed();
    const row = buildConfigButtons();

    await interaction.reply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Erro ao executar /configitemsbau:', error);
    await interaction.reply({ content: 'Erro ao abrir painel de configuração de itens do baú.', ephemeral: true });
  }
}

// Handler para processar as interações iniciadas por configitemsbau_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;

  // 1. Botão Adicionar Item -> Abre Modal
  if (customId === 'configitemsbau_btn_adicionar') {
    try {
      const modal = new ModalBuilder()
        .setCustomId('configitemsbau_modal_adicionar')
        .setTitle('➕ Adicionar Novo Item ao Baú');

      const itemInput = new TextInputBuilder()
        .setCustomId('item_nome')
        .setLabel('Nome do Item')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Colete, Glock, Platina')
        .setMinLength(1)
        .setMaxLength(30)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(itemInput));
      await interaction.showModal(modal);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 2. Modal Submetido -> Salva item e atualiza embed
  if (customId === 'configitemsbau_modal_adicionar') {
    try {
      const novoItem = interaction.fields.getTextInputValue('item_nome').trim();
      const itens = getBauItems();

      if (itens.map(i => i.toLowerCase()).includes(novoItem.toLowerCase())) {
        return await interaction.reply({
          content: `❌ O item **${novoItem}** já está cadastrado!`,
          ephemeral: true
        });
      }

      itens.push(novoItem);
      saveBauItems(itens);

      const embed = buildConfigEmbed();
      const row = buildConfigButtons();

      await interaction.update({ embeds: [embed], components: [row] });

      // Envia Log
      const logEmbed = new EmbedBuilder()
        .setTitle('📦 Item de Baú Adicionado')
        .setColor(3066993)
        .setDescription(`O administrador <@${interaction.user.id}> adicionou um novo item à lista do baú.`)
        .addFields({ name: '🆕 Item:', value: novoItem })
        .setTimestamp();
      
      await sendLog(interaction.client, guild, 'configitemsbau', logEmbed);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 3. Botão Remover Item -> Mostra Select Menu no Embed
  if (customId === 'configitemsbau_btn_remover') {
    try {
      const itens = getBauItems();
      if (itens.length === 0) {
        return await interaction.reply({ content: '❌ Não há itens cadastrados para remover.', ephemeral: true });
      }

      const embedRemover = new EmbedBuilder()
        .setTitle('➖ REMOVER ITEM DO BAÚ')
        .setDescription('Selecione abaixo o item que deseja excluir da lista de itens disponíveis do baú.')
        .setColor(15158332)
        .setTimestamp();

      const options = itens.map(i => ({
        label: i,
        value: i
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId('configitemsbau_select_remover')
        .setPlaceholder('Escolha o item para remover...')
        .addOptions(options);

      const btnCancelar = new ButtonBuilder()
        .setCustomId('configitemsbau_btn_cancelar_remover')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary);

      const rowSelect = new ActionRowBuilder().addComponents(select);
      const rowBtn = new ActionRowBuilder().addComponents(btnCancelar);

      await interaction.update({ embeds: [embedRemover], components: [rowSelect, rowBtn] });
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 4. Cancelar Remoção -> Volta ao Embed Principal
  if (customId === 'configitemsbau_btn_cancelar_remover') {
    try {
      const embed = buildConfigEmbed();
      const row = buildConfigButtons();
      await interaction.update({ embeds: [embed], components: [row] });
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 5. Select Menu Selecionado -> Remove e volta ao Embed Principal
  if (customId === 'configitemsbau_select_remover') {
    try {
      const itemParaRemover = interaction.values[0];
      let itens = getBauItems();

      itens = itens.filter(i => i !== itemParaRemover);
      saveBauItems(itens);

      const embed = buildConfigEmbed();
      const row = buildConfigButtons();

      await interaction.update({ embeds: [embed], components: [row] });

      // Envia Log
      const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ Item de Baú Removido')
        .setColor(15158332)
        .setDescription(`O administrador <@${interaction.user.id}> removeu um item da lista do baú.`)
        .addFields({ name: '❌ Item Removido:', value: itemParaRemover })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'configitemsbau', logEmbed);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 6. Botão Resetar -> Volta aos padrões e atualiza
  if (customId === 'configitemsbau_btn_resetar') {
    try {
      const padrao = ['Ferro', 'Madeira', 'Armas', 'Munição', 'Kits', 'Dinheiro', 'Outros'];
      saveBauItems(padrao);

      const embed = buildConfigEmbed();
      const row = buildConfigButtons();

      await interaction.update({ embeds: [embed], components: [row] });

      // Envia Log
      const logEmbed = new EmbedBuilder()
        .setTitle('🔄 Itens do Baú Resetados')
        .setColor(3447003)
        .setDescription(`O administrador <@${interaction.user.id}> resetou a lista de itens do baú para os padrões.`)
        .addFields({ name: '📦 Itens Atuais:', value: padrao.join(', ') })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'configitemsbau', logEmbed);
    } catch (e) {
      console.error(e);
    }
    return;
  }
}
