import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  PermissionFlagsBits 
} from 'discord.js';
import { getOrCreateRecruta, getActiveFarmChannel } from '../database.js';

export const data = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('Visualiza o perfil e estatísticas completas de um membro.')
  .addUserOption(option =>
    option.setName('membro')
      .setDescription('O membro que você deseja consultar')
      .setRequired(true)
  );

// Cria o menu de seleção que serve como abas
function createStatsMenu(targetUserId, executorId, selectedValue = 'principal') {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`perfil_stats_select_${targetUserId}_${executorId}`)
    .setPlaceholder('Selecione uma aba para visualizar...')
    .addOptions([
      { 
        label: 'Perfil Principal', 
        value: 'principal', 
        emoji: '👤', 
        description: 'Dados cadastrais do membro',
        default: selectedValue === 'principal'
      },
      { 
        label: 'Histórico de Ausências', 
        value: 'ausencias', 
        emoji: '🔴', 
        description: 'Ausências e datas de retorno',
        default: selectedValue === 'ausencias'
      },
      { 
        label: 'Histórico de Vendas', 
        value: 'vendas', 
        emoji: '🛍️', 
        description: 'Lista de vendas registradas',
        default: selectedValue === 'vendas'
      },
      { 
        label: 'Histórico de Encomendas', 
        value: 'encomendas', 
        emoji: '📦', 
        description: 'Lista de encomendas do membro',
        default: selectedValue === 'encomendas'
      },
      { 
        label: 'Metas de Farm', 
        value: 'metas', 
        emoji: '🛠️', 
        description: 'Metas declaradas e status de pagamento',
        default: selectedValue === 'metas'
      }
    ]);

  return new ActionRowBuilder().addComponents(selectMenu);
}

// Gera o Embed específico para cada aba selecionada
export function generatePerfilEmbed(targetUser, recruta, tab = 'principal') {
  const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 256 });
  const embed = new EmbedBuilder()
    .setAuthor({ name: `Perfil de ${targetUser.username}`, iconURL: avatarUrl })
    .setThumbnail(avatarUrl)
    .setTimestamp();

  if (tab === 'principal') {
    const farmChannel = getActiveFarmChannel(targetUser.id);
    const farmFolderStr = farmChannel ? `<#${farmChannel.canalId}>` : '❌ Nenhuma pasta ativa';

    embed
      .setTitle('👤 DADOS CADASTRAIS 👤')
      .setDescription('Informações de registro de membro no banco de dados da Lux.')
      .setColor(3447003) // Azul
      .addFields(
        { name: '🔠 Nome Personagem:', value: recruta.nome || 'Não registrado', inline: true },
        { name: '💳 ID no Jogo:', value: recruta.gameId || 'Nenhum', inline: true },
        { name: '💼 Cargo na Guilda:', value: recruta.cargo || 'Nenhum', inline: true },
        { name: '✨ Status do Set:', value: recruta.status || 'NÃO_REGISTRADO', inline: true },
        { name: '📞 Telefone:', value: recruta.telefone || 'Não informado', inline: true },
        { name: '📋 Recrutador (ID):', value: recruta.recrutadorId || 'Não informado', inline: true },
        { name: '📁 Pasta de Farm:', value: farmFolderStr, inline: false }
      )
      .setFooter({ text: 'Lux Perfil • Principal' });
  }

  else if (tab === 'ausencias') {
    const count = recruta.ausencias ? recruta.ausencias.length : 0;
    embed
      .setTitle('🔴 HISTÓRICO DE AUSÊNCIAS 🔴')
      .setDescription(`Registro de ausências temporárias solicitadas pelo membro.\n\n**📊 Total de Ausências:** \`${count}\``)
      .setColor(15158332) // Vermelho
      .setFooter({ text: 'Lux Perfil • Ausências' });

    if (count > 0) {
      const list = recruta.ausencias.slice(-5).reverse().map((a, i) => {
        return `**${i + 1}. Ausente até:** ${a.data}\n   **Motivo:** ${a.motivo}`;
      }).join('\n\n');
      embed.addFields({ name: '📅 Últimos Registros:', value: list });
    } else {
      embed.addFields({ name: '📅 Últimos Registros:', value: 'Nenhuma ausência registrada.' });
    }
  }

  else if (tab === 'vendas') {
    const count = recruta.vendas ? recruta.vendas.length : 0;
    embed
      .setTitle('🛍️ HISTÓRICO DE VENDAS 🛍️')
      .setDescription(`Vendas faturadas e cadastradas no fórum de vendas.\n\n**📊 Total de Vendas:** \`${count}\``)
      .setColor(3066993) // Verde
      .setFooter({ text: 'Lux Perfil • Vendas' });

    if (count > 0) {
      const list = recruta.vendas.slice(-5).reverse().map((v, i) => {
        return `**${i + 1}. Data:** ${v.data}\n   **Tópico:** [Acessar Venda](${v.threadUrl})`;
      }).join('\n\n');
      embed.addFields({ name: '🛒 Últimas Vendas:', value: list });
    } else {
      embed.addFields({ name: '🛒 Últimas Vendas:', value: 'Nenhuma venda registrada.' });
    }
  }

  else if (tab === 'encomendas') {
    const count = recruta.encomendas ? recruta.encomendas.length : 0;
    embed
      .setTitle('📦 HISTÓRICO DE ENCOMENDAS 📦')
      .setDescription(`Encomendas faturadas e organizadas no fórum de encomendas.\n\n**📊 Total de Encomendas:** \`${count}\``)
      .setColor(15844367) // Amarelo/Dourado
      .setFooter({ text: 'Lux Perfil • Encomendas' });

    if (count > 0) {
      const list = recruta.encomendas.slice(-5).reverse().map((e, i) => {
        return `**${i + 1}. Data:** ${e.data}\n   **Tópico:** [Acessar Encomenda](${e.threadUrl})`;
      }).join('\n\n');
      embed.addFields({ name: '🎁 Últimas Encomendas:', value: list });
    } else {
      embed.addFields({ name: '🎁 Últimas Encomendas:', value: 'Nenhuma encomenda registrada.' });
    }
  }

  else if (tab === 'metas') {
    const count = recruta.metas ? recruta.metas.length : 0;
    embed
      .setTitle('🛠️ HISTÓRICO DE METAS 🛠️')
      .setDescription(`Registro de metas de farm batidas declaradas e status de pagamento.\n\n**📊 Total de Metas:** \`${count}\``)
      .setColor(10181046) // Roxo
      .setFooter({ text: 'Lux Perfil • Metas' });

    if (count > 0) {
      const list = recruta.metas.slice(-5).reverse().map((m, i) => {
        const payStatus = m.paga 
          ? `✅ Pago em ${m.pagaAt ? new Date(m.pagaAt).toLocaleDateString('pt-BR') : ''} por <@${m.pagoPor}>` 
          : '❌ Pendente de confirmação/pagamento';
        return `**${i + 1}. Recurso:** ${m.item} (${m.quantidade})\n   **Data:** ${m.data}\n   **Status:** ${payStatus}`;
      }).join('\n\n');
      embed.addFields({ name: '📈 Últimas Metas Batidas:', value: list });
    } else {
      embed.addFields({ name: '📈 Últimas Metas Batidas:', value: 'Nenhuma meta batida declarada.' });
    }
  }

  return embed;
}

export async function execute(interaction) {
  try {
    const targetUser = interaction.options.getUser('membro');
    const recruta = getOrCreateRecruta(targetUser.id, targetUser.tag);

    const embed = generatePerfilEmbed(targetUser, recruta, 'principal');
    const row = createStatsMenu(targetUser.id, interaction.user.id, 'principal');

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Erro ao executar /perfil:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao buscar o perfil do membro.',
      ephemeral: true
    });
  }
}

// Trata as interações iniciadas por perfil_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('perfil_stats_select_')) {
    try {
      const parts = customId.replace('perfil_stats_select_', '').split('_');
      const targetUserId = parts[0];
      const executorId = parts[1];

      // Apenas quem iniciou o comando pode interagir com o select menu
      if (interaction.user.id !== executorId) {
        return await interaction.reply({
          content: '❌ Apenas quem executou o comando `/perfil` pode interagir com este menu!',
          ephemeral: true
        });
      }

      const selectedTab = interaction.values[0];
      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);

      if (!targetUser) {
        return await interaction.reply({
          content: '❌ Não foi possível carregar as informações do usuário solicitado.',
          ephemeral: true
        });
      }

      const recruta = getOrCreateRecruta(targetUserId, targetUser.tag);
      const updatedEmbed = generatePerfilEmbed(targetUser, recruta, selectedTab);
      const row = createStatsMenu(targetUserId, executorId, selectedTab);

      await interaction.update({
        embeds: [updatedEmbed],
        components: [row]
      });

    } catch (error) {
      console.error('Erro ao processar alteração de aba do perfil:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao atualizar o perfil.',
        ephemeral: true
      }).catch(() => null);
    }
  }
}
