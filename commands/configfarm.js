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
import { saveFarmMaterials, getFarmMaterials } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('configfarm')
  .setDescription('Painel de configuração de materiais de farm.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Função auxiliar para construir o Embed Principal
function buildConfigEmbed() {
  const materiais = getFarmMaterials();
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  return new EmbedBuilder()
    .setTitle('⚙️ CONFIGURAÇÃO DE MATERIAIS ⚙️')
    .setDescription(
      'Abaixo estão listados os materiais atualmente cadastrados no sistema. ' +
      'Eles aparecerão nos menus de seleção para os membros ao adicionar farms e declarar metas.\n\n' +
      'Use os botões abaixo para gerenciar os materiais.'
    )
    .addFields({
      name: '📦 Materiais Cadastrados:',
      value: materiais.map((m, i) => `${i + 1}. **${m}**`).join('\n') || 'Nenhum material cadastrado.'
    })
    .setColor(2326507)
    .setFooter({ text: `LuxBot Configuração de Farm • ${dataAtual} • criado por chegaheitor` })
    .setTimestamp();
}

// Função auxiliar para construir os botões principais
function buildConfigButtons() {
  const btnAdicionar = new ButtonBuilder()
    .setCustomId('configfarm_btn_adicionar')
    .setLabel('Adicionar Material')
    .setStyle(ButtonStyle.Success)
    .setEmoji('➕');

  const btnRemover = new ButtonBuilder()
    .setCustomId('configfarm_btn_remover')
    .setLabel('Remover Material')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('➖');

  const btnResetar = new ButtonBuilder()
    .setCustomId('configfarm_btn_resetar')
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
    console.error('Erro ao executar /configfarm:', error);
    await interaction.reply({ content: 'Erro ao abrir painel de configuração.', ephemeral: true });
  }
}

// Handler para processar as interações iniciadas por configfarm_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. Botão Adicionar Material -> Abre Modal
  if (customId === 'configfarm_btn_adicionar') {
    try {
      const modal = new ModalBuilder()
        .setCustomId('configfarm_modal_adicionar')
        .setTitle('➕ Adicionar Novo Material');

      const materialInput = new TextInputBuilder()
        .setCustomId('material_nome')
        .setLabel('Nome do Material')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Cobre, Platina, Couro')
        .setMinLength(1)
        .setMaxLength(30)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(materialInput));
      await interaction.showModal(modal);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 2. Modal Submetido -> Salva material e atualiza embed
  if (customId === 'configfarm_modal_adicionar') {
    try {
      const novoMaterial = interaction.fields.getTextInputValue('material_nome').trim();
      const materiais = getFarmMaterials();

      if (materiais.map(m => m.toLowerCase()).includes(novoMaterial.toLowerCase())) {
        return await interaction.reply({
          content: `❌ O material **${novoMaterial}** já está cadastrado!`,
          ephemeral: true
        });
      }

      materiais.push(novoMaterial);
      saveFarmMaterials(materiais);

      const embed = buildConfigEmbed();
      const row = buildConfigButtons();

      await interaction.update({ embeds: [embed], components: [row] });

      // Envia Log
      const logEmbed = new EmbedBuilder()
        .setTitle('📦 Material Adicionado')
        .setColor(3066993)
        .setDescription(`O administrador <@${interaction.user.id}> adicionou um novo material à lista.`)
        .addFields({ name: '🆕 Material:', value: novoMaterial })
        .setTimestamp();
      
      await sendLog(interaction.client, guild, 'configfarm', logEmbed);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 3. Botão Remover Material -> Mostra Select Menu no Embed
  if (customId === 'configfarm_btn_remover') {
    try {
      const materiais = getFarmMaterials();
      if (materiais.length === 0) {
        return await interaction.reply({ content: '❌ Não há materiais cadastrados para remover.', ephemeral: true });
      }

      const embedRemover = new EmbedBuilder()
        .setTitle('➖ REMOVER MATERIAL ➖')
        .setDescription('Selecione abaixo o material que deseja excluir da lista de farm e metas.')
        .setColor(15158332)
        .setFooter({ text: `LuxBot Configuração de Farm • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      const options = materiais.map(m => ({
        label: m,
        value: m
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId('configfarm_select_remover')
        .setPlaceholder('Escolha o material para remover...')
        .addOptions(options);

      const btnCancelar = new ButtonBuilder()
        .setCustomId('configfarm_btn_cancelar_remover')
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
  if (customId === 'configfarm_btn_cancelar_remover') {
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
  if (customId === 'configfarm_select_remover') {
    try {
      const materialParaRemover = interaction.values[0];
      let materiais = getFarmMaterials();

      materiais = materiais.filter(m => m !== materialParaRemover);
      saveFarmMaterials(materiais);

      const embed = buildConfigEmbed();
      const row = buildConfigButtons();

      await interaction.update({ embeds: [embed], components: [row] });

      // Envia Log
      const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ Material Removido')
        .setColor(15158332)
        .setDescription(`O administrador <@${interaction.user.id}> removeu um material da lista.`)
        .addFields({ name: '❌ Material Removido:', value: materialParaRemover })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'configfarm', logEmbed);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 6. Botão Resetar -> Volta aos padrões e atualiza
  if (customId === 'configfarm_btn_resetar') {
    try {
      const padrao = ['Ferro', 'Madeira', 'Ouro', 'Dinheiro', 'Outros'];
      saveFarmMaterials(padrao);

      const embed = buildConfigEmbed();
      const row = buildConfigButtons();

      await interaction.update({ embeds: [embed], components: [row] });

      // Envia Log
      const logEmbed = new EmbedBuilder()
        .setTitle('🔄 Materiais Resetados')
        .setColor(3447003)
        .setDescription(`O administrador <@${interaction.user.id}> resetou a lista de materiais para os padrões.`)
        .addFields({ name: '📦 Materiais Atuais:', value: padrao.join(', ') })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'configfarm', logEmbed);
    } catch (e) {
      console.error(e);
    }
    return;
  }
}
