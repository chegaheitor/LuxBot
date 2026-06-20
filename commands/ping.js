import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Exibe as latências e status de conexão do bot.');

export async function execute(interaction) {
  try {
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    // Responder com cálculo em andamento
    const sent = await interaction.reply({ 
      content: 'Calculando latência... 🔄', 
      fetchReply: true,
      ephemeral: true
    });
    
    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    // Determinar cor do embed com base na latência
    let embedColor = 3066993; // Verde (boa latência)
    if (apiLatency > 200) {
      embedColor = 15158332; // Vermelho (alta latência)
    } else if (apiLatency > 120) {
      embedColor = 15844367; // Amarelo (latência média)
    }

    const pingEmbed = new EmbedBuilder()
      .setTitle('🏓 STATUS DE LATÊNCIA 🏓')
      .setDescription('Confira o tempo de resposta do bot e a conexão com a API do Discord.')
      .addFields(
        { name: '🤖 Latência do Bot', value: `\`${botLatency}ms\``, inline: true },
        { name: '⚡ Latência da API', value: `\`${apiLatency}ms\``, inline: true }
      )
      .setColor(embedColor)
      .setFooter({ text: `LuxBot Ping • ${dataAtual} • criado por chegaheitor` })
      .setTimestamp();

    await interaction.editReply({
      content: null,
      embeds: [pingEmbed]
    });
  } catch (error) {
    console.error('Erro ao responder o comando /ping:', error);
  }
}
