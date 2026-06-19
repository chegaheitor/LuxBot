import { REST, Routes, SlashCommandBuilder, ChannelType } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('ERRO: DISCORD_TOKEN ou DISCORD_CLIENT_ID não configurados no arquivo .env!');
  process.exit(1);
}

// Definição dos comandos slash
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Responde com Pong! e exibe as latências do bot.'),
  new SlashCommandBuilder()
    .setName('registroembed')
    .setDescription('Envia o painel de recrutamento para o canal selecionado.')
    .addChannelOption(option =>
      option.setName('canal_painel')
        .setDescription('O canal onde a mensagem com o botão de recrutamento será enviada')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addChannelOption(option =>
      option.setName('canal_pedidos')
        .setDescription('O canal para onde as respostas do formulário serão enviadas')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
].map(command => command.toJSON());

// Preparar o cliente REST da API do Discord
const rest = new REST({ version: '10' }).setToken(token);

// Deploy dos comandos
(async () => {
  try {
    console.log(`Iniciando a atualização de ${commands.length} comando(s) slash da aplicação (global)...`);

    // Registrar globalmente
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log(`Sucesso: ${data.length} comando(s) slash registrados globalmente com êxito!`);
  } catch (error) {
    console.error('Ocorreu um erro ao registrar os comandos:', error);
  }
})();
