import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('ERRO: DISCORD_TOKEN ou DISCORD_CLIENT_ID não configurados no arquivo .env!');
  process.exit(1);
}

// Carregar comandos dinamicamente da pasta ./commands
const commands = [];
const commandsPath = path.resolve('commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('Carregando comandos para deploy...');
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const fileUrl = pathToFileURL(filePath).href;
  
  try {
    const command = await import(fileUrl);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`- Comando carregado: /${command.data.name}`);
    } else {
      console.log(`[AVISO] O comando em ${file} está faltando as propriedades "data" ou "execute".`);
    }
  } catch (error) {
    console.error(`Erro ao carregar o comando ${file} para deploy:`, error);
  }
}

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
