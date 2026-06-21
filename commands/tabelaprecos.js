import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getRecrutas, getTabelaPrecos } from '../database.js';

export const data = new SlashCommandBuilder()
  .setName('tabelaprecos')
  .setDescription('Exibe a tabela oficial de preços e parcerias da organização.');

export async function execute(interaction) {
  try {
    const recrutas = getRecrutas();
    const isAccepted = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      recrutas.some(r => r.discordId === interaction.user.id && r.status === 'ACEITO');

    if (!isAccepted) {
      return await interaction.reply({
        content: '❌ Você precisa ter seu recrutamento aceito para usar este comando!',
        ephemeral: true
      });
    }

    const tabela = getTabelaPrecos();
    const embed = new EmbedBuilder()
      .setTitle('🏷️ TABELA DE PREÇOS OFICIAL 🏷️')
      .setDescription('Confira abaixo a lista de itens, valores normais e valores para parcerias da organização.')
      .setColor(16753920) // Laranja / Dourado
      .setFooter({ text: 'LuxBot Tabela de Preços • criado por chegaheitor' })
      .setTimestamp();

    if (tabela.length === 0) {
      embed.addFields({ name: 'Aviso', value: '*Nenhum item cadastrado na tabela de preços no momento.*' });
    } else {
      tabela.forEach(item => {
        embed.addFields({
          name: `🏷️ ${item.nome.toUpperCase()}`,
          value: `• Preço Normal: **${item.precoNormal}**\n• Preço Parceria: **${item.precoParceria}**`,
          inline: false
        });
      });
    }

    return await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Erro ao executar o comando /tabelaprecos:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao buscar a tabela de preços.',
      ephemeral: true
    }).catch(() => null);
  }
}
