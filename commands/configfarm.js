import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { saveFarmMaterials, getFarmMaterials } from '../database.js';

export const data = new SlashCommandBuilder()
  .setName('configfarm')
  .setDescription('Configura a lista de materiais disponíveis para farm e metas.')
  .addStringOption(option =>
    option.setName('materiais')
      .setDescription('Lista de materiais separados por vírgula (ex: Ferro, Madeira, Ouro, Dinheiro)')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const materiaisInput = interaction.options.getString('materiais');
    
    // Separar por vírgula, remover espaços extras e filtrar vazios
    const materiais = materiaisInput
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    if (materiais.length === 0) {
      return await interaction.reply({
        content: '❌ Por favor, digite pelo menos um material válido separado por vírgula.',
        ephemeral: true
      });
    }

    // Salvar no banco
    saveFarmMaterials(materiais);

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuração de Materiais Salva')
      .setDescription('A lista de materiais para farms e metas foi atualizada com sucesso!')
      .addFields({
        name: '📦 Novos Materiais Configurados:',
        value: materiais.map(m => `• ${m}`).join('\n')
      })
      .setColor(2326507)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Erro ao executar o comando /configfarm:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao salvar as configurações de materiais.',
      ephemeral: true
    });
  }
}
