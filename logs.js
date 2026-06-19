import { EmbedBuilder } from 'discord.js';
import { getLogChannel } from './database.js';

/**
 * Envia um log formatado em formato Embed para o canal configurado para o comando correspondente.
 * @param {Client} client - Instância do cliente do Discord.
 * @param {Guild} guild - Instância da guilda onde a ação ocorreu.
 * @param {string} commandName - Nome do comando associado à ação (ex: 'registroembed', 'registrofarm').
 * @param {EmbedBuilder|object} embedPayload - EmbedBuilder ou payload do embed de log.
 */
export async function sendLog(client, guild, commandName, embedPayload) {
  try {
    if (!guild) return;
    
    const channelId = getLogChannel(commandName);
    if (!channelId) return; // Não configurado, ignora silenciosamente

    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.warn(`[AVISO LOG] Canal de log ${channelId} para o comando /${commandName} não encontrado ou sem acesso.`);
      return;
    }

    const embed = embedPayload.toJSON ? embedPayload : new EmbedBuilder(embedPayload);

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`Erro ao enviar log para o comando /${commandName}:`, error);
  }
}
