import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Responde com Pong! e exibe as latências do bot.');

export async function execute(interaction) {
  try {
    const sent = await interaction.reply({ 
      content: 'Calculando latência... 🔄', 
      fetchReply: true 
    });
    
    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    await interaction.editReply(
      `Pong! 🏓\n` +
      `• **Latência do Bot:** ${botLatency}ms\n` +
      `• **Latência da API (WebSocket):** ${apiLatency}ms`
    );
  } catch (error) {
    console.error('Erro ao responder o comando /ping:', error);
  }
}
