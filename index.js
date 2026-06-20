import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { initDatabase } from './database.js';
import { handleInteraction as handleListarbauInteraction } from './commands/listarbau.js';

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
  // 1. Tratar autocomplete de comandos slash
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      if (typeof command.autocomplete === 'function') {
        await command.autocomplete(interaction);
      }
    } catch (error) {
      console.error(`Erro ao processar autocomplete do comando /${interaction.commandName}:`, error);
    }
    return;
  }

  // 2. Tratar comandos slash
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
  if (customId.startsWith('embed_') || customId.startsWith('recrutamento_')) {
    const command = client.commands.get('criarrecrutamento');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do criarrecrutamento:', error);
      }
    }
  } else if (customId.startsWith('farm_')) {
    const command = client.commands.get('criarfarm');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do criarfarm:', error);
      }
    }
  } else if (customId.startsWith('venda_')) {
    const command = client.commands.get('criarvenda');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do criarvenda:', error);
      }
    }
  } else if (customId.startsWith('encomenda_')) {
    const command = client.commands.get('criarencomenda');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do criarencomenda:', error);
      }
    }
  } else if (customId.startsWith('ausencia_')) {
    const command = client.commands.get('criarausencia');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do criarausencia:', error);
      }
    }
  } else if (customId.startsWith('perfil_')) {
    const command = client.commands.get('perfil');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do perfil:', error);
      }
    }
  } else if (customId.startsWith('bau_') || customId.startsWith('listarbau_')) {
    try {
      await handleListarbauInteraction(interaction);
    } catch (error) {
      console.error('Erro ao processar interação do listarbau:', error);
    }
  } else if (customId.startsWith('adv_')) {
    const command = client.commands.get('adv');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do adv:', error);
      }
    }
  } else if (customId.startsWith('painelconfig_')) {
    const command = client.commands.get('painelconfig');
    if (command && typeof command.handleInteraction === 'function') {
      try {
        await command.handleInteraction(interaction);
      } catch (error) {
        console.error('Erro ao processar interação do painelconfig:', error);
      }
    }
  }
});

// Login do bot
client.login(token);
