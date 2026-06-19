import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('ERRO: A variável DISCORD_TOKEN não está definida no arquivo .env!');
  process.exit(1);
}

// Inicializar o bot. Como o bot utilizará apenas comandos slash,
// o intent Guilds é suficiente para escutar as interações nos servidores.
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Evento quando o bot fica online
client.once('ready', () => {
  console.log(`\n==========================================`);
  console.log(`Bot conectado com sucesso como: ${client.user.tag}`);
  console.log(`Pressione CTRL+C para encerrar o bot.`);
  console.log(`==========================================\n`);
});

// Tratar interações (comandos slash)
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    try {
      // Registra a mensagem inicial e busca o objeto da resposta
      const sent = await interaction.reply({ 
        content: 'Calculando latência... 🔄', 
        fetchReply: true 
      });
      
      // Calcula a diferença de tempo
      const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
      const apiLatency = Math.round(client.ws.ping);

      // Atualiza a resposta com os dados reais
      await interaction.editReply(
        `Pong! 🏓\n` +
        `• **Latência do Bot:** ${botLatency}ms\n` +
        `• **Latência da API (WebSocket):** ${apiLatency}ms`
      );
    } catch (error) {
      console.error('Erro ao responder o comando /ping:', error);
    }
  }
});

// Login do bot
client.login(token);
