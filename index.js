import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('ERRO: A variável DISCORD_TOKEN não está definida no arquivo .env!');
  process.exit(1);
}

// Inicializar o bot.
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

// Tratar todas as interações (comandos slash, botões e modais)
client.on('interactionCreate', async interaction => {
  
  // 1. Tratar comandos slash de chat
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'ping') {
      try {
        const sent = await interaction.reply({ 
          content: 'Calculando latência... 🔄', 
          fetchReply: true 
        });
        
        const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        await interaction.editReply(
          `Pong! 🏓\n` +
          `• **Latência do Bot:** ${botLatency}ms\n` +
          `• **Latência da API (WebSocket):** ${apiLatency}ms`
        );
      } catch (error) {
        console.error('Erro ao responder o comando /ping:', error);
      }
    }

    if (commandName === 'registroembed') {
      try {
        const canalPainel = interaction.options.getChannel('canal_painel');
        const canalPedidos = interaction.options.getChannel('canal_pedidos');

        // Criação do embed inicial do painel de recrutamento
        const embed = new EmbedBuilder()
          .setTitle('✨ PEÇA SEU SET ✨')
          .setDescription(
            'Para ser recrutado, preencha o formulário abaixo\n\n' +
            '🔠 NOME\n' +
            '💳 ID\n' +
            '📞 TELEFONE\n' +
            '📋 ID DE QUEM RECRUTOU\n\n' +
            'Seja muito bem vindo a Lux!'
          )
          .setColor(2326507)
          .setFooter({ text: 'Bot criado por chegaheitor © 2026' });

        // Guardamos o ID do canal de pedidos no customId do botão
        const button = new ButtonBuilder()
          .setCustomId(`pedir_set_btn_${canalPedidos.id}`)
          .setLabel('Pedir set')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✅');

        const row = new ActionRowBuilder().addComponents(button);

        // Envia o painel de recrutamento no canal especificado
        await canalPainel.send({ embeds: [embed], components: [row] });

        // Responde de forma privada para o administrador que executou o comando
        await interaction.reply({ 
          content: `Painel de recrutamento enviado no canal ${canalPainel}! As respostas dos usuários serão enviadas em ${canalPedidos}.`, 
          ephemeral: true 
        });
      } catch (error) {
        console.error('Erro ao executar o comando /registroembed:', error);
        await interaction.reply({ 
          content: 'Ocorreu um erro ao enviar o painel de recrutamento. Verifique se o bot tem permissão de escrita no canal selecionado.', 
          ephemeral: true 
        });
      }
    }
  }

  // 2. Tratar interações com botões
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('pedir_set_btn_')) {
      try {
        // Extrai o ID do canal de destino (pedidos) codificado no customId do botão
        const canalPedidosId = interaction.customId.replace('pedir_set_btn_', '');

        // Criação do modal (formulário) de inscrição
        const modal = new ModalBuilder()
          .setCustomId(`pedir_set_modal_${canalPedidosId}`)
          .setTitle('✨ Pedido de Set - Lux ✨');

        // Inputs do formulário
        const nomeInput = new TextInputBuilder()
          .setCustomId('nome_input')
          .setLabel('🔠 NOME')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite seu nome completo')
          .setRequired(true);

        const idInput = new TextInputBuilder()
          .setCustomId('id_input')
          .setLabel('💳 ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite seu ID no jogo')
          .setRequired(true);

        const telefoneInput = new TextInputBuilder()
          .setCustomId('telefone_input')
          .setLabel('📞 TELEFONE')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite seu telefone (ex: 11 99999-9999)')
          .setRequired(true);

        const recrutadorInput = new TextInputBuilder()
          .setCustomId('recrutador_input')
          .setLabel('📋 ID DE QUEM RECRUTOU')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite o ID de quem recrutou você')
          .setRequired(true);

        // Adiciona cada campo de texto em uma linha de ação (ActionRow) distinta
        modal.addComponents(
          new ActionRowBuilder().addComponents(nomeInput),
          new ActionRowBuilder().addComponents(idInput),
          new ActionRowBuilder().addComponents(telefoneInput),
          new ActionRowBuilder().addComponents(recrutadorInput)
        );

        // Exibe o modal na tela do usuário
        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao abrir o modal de recrutamento:', error);
        await interaction.reply({ 
          content: 'Ocorreu um erro ao abrir o formulário.', 
          ephemeral: true 
        });
      }
    }
  }

  // 3. Tratar submissões de modais
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('pedir_set_modal_')) {
      try {
        // Extrai o ID do canal de destino (pedidos)
        const canalPedidosId = interaction.customId.replace('pedir_set_modal_', '');

        // Obtém as respostas digitadas pelo usuário
        const nome = interaction.fields.getTextInputValue('nome_input');
        const id = interaction.fields.getTextInputValue('id_input');
        const telefone = interaction.fields.getTextInputValue('telefone_input');
        const recrutador = interaction.fields.getTextInputValue('recrutador_input');

        const user = interaction.user;

        // Criação do embed formatado com os dados coletados
        const responseEmbed = new EmbedBuilder()
          .setTitle('✨ NOVO PEDIDO DE SET ✨')
          .setDescription(
            `👤 Discord user:\n<@${user.id}> (${user.id})\n\n` +
            `🔠 NOME\n${nome}\n\n` +
            `💳 ID\n${id}\n\n` +
            `📞 TELEFONE\n${telefone}\n\n` +
            `📋 ID DE QUEM RECRUTOU\n${recrutador}\n\n`
          )
          .setColor(2326507)
          .setFooter({ text: 'Bot criado por chegaheitor © 2026' });

        // Tenta buscar o canal de pedidos no servidor
        const canalPedidos = await interaction.guild.channels.fetch(canalPedidosId);

        if (canalPedidos) {
          // Envia a mensagem embed de resposta no canal de pedidos correto
          await canalPedidos.send({ embeds: [responseEmbed] });
          
          // Confirmação privada para o usuário que enviou
          await interaction.reply({ 
            content: 'Seu pedido de set foi enviado com sucesso! ✅', 
            ephemeral: true 
          });
        } else {
          await interaction.reply({ 
            content: 'Erro: O canal configurado para receber os pedidos não foi encontrado.', 
            ephemeral: true 
          });
        }
      } catch (error) {
        console.error('Erro ao processar a resposta do modal:', error);
        await interaction.reply({ 
          content: 'Ocorreu um erro ao enviar o seu pedido de set. Por favor, tente novamente.', 
          ephemeral: true 
        });
      }
    }
  }
});

// Login do bot
client.login(token);

