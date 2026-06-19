import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { initDatabase } from './database.js';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('ERRO: A variável DISCORD_TOKEN não está definida no arquivo .env!');
  process.exit(1);
}

// Inicializar o banco de dados local
initDatabase();

// Inicializar o bot
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Registrar coleção de comandos
client.commands = new Collection();

// Carregar comandos dinamicamente da pasta ./commands
const commandsPath = path.resolve('commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('Carregando comandos...');
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const fileUrl = pathToFileURL(filePath).href;
  
  try {
    const command = await import(fileUrl);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`- Comando carregado: /${command.data.name}`);
    } else {
      console.log(`[AVISO] O comando em ${file} está faltando as propriedades "data" ou "execute".`);
    }
  } catch (error) {
    console.error(`Erro ao carregar o comando ${file}:`, error);
  }
}

// Evento quando o bot fica online
client.once(Events.ClientReady, c => {
  console.log(`\n==========================================`);
  console.log(`Bot conectado com sucesso como: ${c.user.tag}`);
  console.log(`Pressione CTRL+C para encerrar o bot.`);
  console.log(`==========================================\n`);
});

// Tratar todas as interações
client.on(Events.InteractionCreate, async interaction => {
  // 1. Tratar comandos slash
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Erro ao executar o comando /${interaction.commandName}:`, error);
      const replyPayload = { content: 'Ocorreu um erro ao executar este comando!', ephemeral: true };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyPayload).catch(() => null);
      } else {
        await interaction.reply(replyPayload).catch(() => null);
      }
    }
    return;
  }

  // 2. Tratar outras interações (botões, modais, select menus, etc.) baseando-se no prefixo do customId
  const customId = interaction.customId;
  if (!customId) return;

  // Roteamento de interações baseado em prefixos
  if (customId.startsWith('embed_')) {
    const command = client.commands.get('registroembed');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do registroembed:', error);
      }
    }
  } else if (customId.startsWith('farm_')) {
    const command = client.commands.get('registrofarm');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do registrofarm:', error);
      }
    }
  } else if (customId.startsWith('configfarm_')) {
    const command = client.commands.get('configfarm');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do configfarm:', error);
      }
    }
  } else if (customId.startsWith('log_')) {
    const command = client.commands.get('configlog');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do configlog:', error);
      }
    }
  } else if (customId.startsWith('venda_')) {
    const command = client.commands.get('registrovenda');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do registrovenda:', error);
      }
    }
  } else if (customId.startsWith('encomenda_')) {
    const command = client.commands.get('registroencomenda');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do registroencomenda:', error);
      }
    }
  } else if (customId.startsWith('ausencia_')) {
    const command = client.commands.get('registroausencia');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do registroausencia:', error);
      }
    }
  }
});

// Login do bot
client.login(token);
