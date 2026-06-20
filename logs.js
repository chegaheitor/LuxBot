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

    // 1. Padronização Automática do Rodapé para Logs
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const commandDisplayNames = {
      status: 'Status',
      removeradv: 'Remover ADV',
      registrovenda: 'Vendas',
      registrofarm: 'Farm',
      registroencomenda: 'Encomendas',
      registroembed: 'Recrutamento',
      registrobau: 'Baú',
      registroausencia: 'Ausência',
      perfil: 'Perfil',
      hierarquia: 'Hierarquia',
      configlog: 'Configuração de Logs',
      configitemsbau: 'Configuração de Itens do Baú',
      configfarm: 'Configuração de Farm',
      configadv: 'Configuração de Advertências',
      adv: 'Advertências',
      listarbau: 'Listar Baú'
    };
    const displayName = commandDisplayNames[commandName] || commandName;
    embed.setFooter({ text: `LuxBot ${displayName} • ${dataAtual} • criado por chegaheitor` });

    // 2. Padronização Automática do Título para Caixa Alta e Emojis Simétricos
    if (embed.data.title) {
      let title = embed.data.title.trim();
      const standardEmojis = ['📋', '⚙️', '🛍️', '📦', '🛠️', '✅', '⏳', '🗑️', '🌾', '✨', '⚠️', '⚖️', '↩️', '📢', '🔴', '👥', '👤', '🛒', '🎁', '➕', '➖', '🔄', '✔️', '❌'];
      
      let startsWithEmoji = null;
      let endsWithEmoji = null;

      // Verificar se começa com algum dos emojis padronizados
      for (const emoji of standardEmojis) {
        if (title.startsWith(emoji)) {
          startsWithEmoji = emoji;
          break;
        }
      }

      // Verificar se termina com algum dos emojis padronizados
      for (const emoji of standardEmojis) {
        if (title.endsWith(emoji)) {
          endsWithEmoji = emoji;
          break;
        }
      }

      // Reconstruir o título padronizado
      if (startsWithEmoji && endsWithEmoji) {
        // Exemplo: '⚠️ ADVERTÊNCIA APLICADA ⚠️'
        const rawText = title.slice(startsWithEmoji.length, title.length - endsWithEmoji.length).trim();
        title = `${startsWithEmoji} ${rawText.toUpperCase()} ${endsWithEmoji}`;
      } else if (startsWithEmoji) {
        // Exemplo: '⚙️ Painel de Venda Configurado' -> '⚙️ PAINEL DE VENDA CONFIGURADO ⚙️'
        const rawText = title.slice(startsWithEmoji.length).trim();
        title = `${startsWithEmoji} ${rawText.toUpperCase()} ${startsWithEmoji}`;
      } else {
        // Exemplo: 'Painel de Venda' -> '📢 PAINEL DE VENDA 📢'
        title = `📢 ${title.toUpperCase()} 📢`;
      }

      embed.setTitle(title);
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`Erro ao enviar log para o comando /${commandName}:`, error);
  }
}
