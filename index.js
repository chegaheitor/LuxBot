import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder } from 'discord.js';
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
client.once('clientReady', () => {
  console.log(`\n==========================================`);
  console.log(`Bot conectado com sucesso como: ${client.user.tag}`);
  console.log(`Pressione CTRL+C para encerrar o bot.`);
  console.log(`==========================================\n`);
});

// Tratar todas as interações (comandos slash, botões, select menus e modais)
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
        const canalLogsNegado = interaction.options.getChannel('canal_logs_negado');

        // Criação do embed inicial do painel de recrutamento
        const embed = new EmbedBuilder()
          .setTitle('✨ PEÇA SEU SET ✨')
          .setDescription(
            'Para ser recrutado, preencha o formulário abaixo\n\n' +
            '🔠 NOME\n' +
            '💳 ID\n' +
            '📞 TELEFONE\n' +
            '📋 ID DE QUEM RECRUTOU\n' +
            '💼 CARGO DESEJADO\n\n' +
            'Seja muito bem vindo a Lux!'
          )
          .setColor(2326507)
          .setFooter({ text: 'Bot criado por chegaheitor © 2026' });

        // Guardamos os IDs do canal de pedidos e logs_negado no customId do botão
        const button = new ButtonBuilder()
          .setCustomId(`pedir_set_btn_${canalPedidos.id}_${canalLogsNegado.id}`)
          .setLabel('Pedir set')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✅');

        const row = new ActionRowBuilder().addComponents(button);

        // Envia o painel de recrutamento no canal especificado
        await canalPainel.send({ embeds: [embed], components: [row] });

        // Responde de forma privada para o administrador que executou o comando
        await interaction.reply({ 
          content: `Painel de recrutamento enviado no canal ${canalPainel}! As respostas serão enviadas em ${canalPedidos}.`, 
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
    
    // Tratando botão principal de solicitar recrutamento
    if (interaction.customId.startsWith('pedir_set_btn_')) {
      try {
        // Extrai as variáveis codificadas no customId
        const parts = interaction.customId.replace('pedir_set_btn_', '').split('_');
        const canalPedidosId = parts[0];
        const canalLogsNegadoId = parts[1];

        // Criação do modal (formulário) de inscrição com 5 campos de texto
        const modal = new ModalBuilder()
          .setCustomId(`pedir_set_modal_${canalPedidosId}_${canalLogsNegadoId}`)
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

        const cargoInput = new TextInputBuilder()
          .setCustomId('cargo_input')
          .setLabel('💼 CARGO DESEJADO')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite o cargo que deseja (ex: Recruta, Soldado)')
          .setRequired(true);

        // Adiciona cada campo de texto em uma linha de ação (ActionRow) distinta
        modal.addComponents(
          new ActionRowBuilder().addComponents(nomeInput),
          new ActionRowBuilder().addComponents(idInput),
          new ActionRowBuilder().addComponents(telefoneInput),
          new ActionRowBuilder().addComponents(recrutadorInput),
          new ActionRowBuilder().addComponents(cargoInput)
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

    // Tratando botão "Negar"
    if (interaction.customId.startsWith('negar_btn_')) {
      try {
        const parts = interaction.customId.replace('negar_btn_', '').split('_');
        const userId = parts[0];
        const canalLogsNegadoId = parts[1];

        // Modificar o embed original para indicar que foi recusado
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setTitle('❌ PEDIDO DE SET NEGADO ❌')
          .setColor(15158332); // Cor vermelha (Danger)

        // Responde editando a mensagem (remove os botões e atualiza texto/embed)
        await interaction.update({
          content: `❌ Pedido recusado por <@${interaction.user.id}>.`,
          embeds: [updatedEmbed],
          components: [] // Remove a lista de seleção e o botão
        });

        // Tenta buscar o canal de logs de negação e enviar a mensagem bonita
        const logsChannel = await interaction.guild.channels.fetch(canalLogsNegadoId).catch(() => null);

        if (logsChannel) {
          const denialEmbed = new EmbedBuilder()
            .setTitle('📢 Lux Recrutamento - Status')
            .setDescription(
              `Olá <@${userId}>,\n\n` +
              `Agradecemos muito pelo seu interesse em fazer parte da **Lux**, porém o seu pedido de recrutamento foi **negado** no momento. 😔\n\n` +
              `Não desanime! Fique de olho em novas oportunidades.`
            )
            .setColor(15158332)
            .setFooter({ text: 'Lux Recrutamento' })
            .setTimestamp();

          await logsChannel.send({ content: `<@${userId}>`, embeds: [denialEmbed] });
        }
      } catch (error) {
        console.error('Erro ao recusar pedido de recrutamento:', error);
        await interaction.reply({ 
          content: 'Ocorreu um erro ao processar a negação do recrutamento.', 
          ephemeral: true 
        });
      }
    }
  }

  // 3. Tratar interações com menus de seleção de cargo (Role Select Menu)
  if (interaction.isRoleSelectMenu()) {
    if (interaction.customId.startsWith('aprovar_select_')) {
      try {
        const userId = interaction.customId.replace('aprovar_select_', '');
        const cargoId = interaction.values[0]; // O ID da role selecionada

        // Obter o membro da guilda
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) {
          return await interaction.reply({ 
            content: 'Erro: Não foi possível encontrar esse usuário no servidor. Talvez ele tenha saído.', 
            ephemeral: true 
          });
        }

        // Tentar adicionar o cargo ao usuário
        await member.roles.add(cargoId);

        // Modificar o embed original para indicar que foi aceito
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setTitle('✨ PEDIDO DE SET ACEITO ✨')
          .setColor(3066993); // Cor verde (Success)

        // Responde editando a mensagem (remove o select menu, botão negar e atualiza texto/embed)
        await interaction.update({
          content: `✅ Pedido aceito por <@${interaction.user.id}>! O cargo <@&${cargoId}> foi adicionado para <@${userId}>.`,
          embeds: [updatedEmbed],
          components: [] // Limpa todos os componentes (Select Menu e Botão Negar)
        });
      } catch (error) {
        console.error('Erro ao aceitar recrutamento via select menu:', error);
        await interaction.reply({ 
          content: 'Ocorreu um erro ao adicionar o cargo. Verifique se o cargo do bot está posicionado acima do cargo selecionado nas configurações de Cargos do Servidor.', 
          ephemeral: true 
        });
      }
    }
  }

  // 4. Tratar submissões de modais
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('pedir_set_modal_')) {
      try {
        // Extrai as variáveis codificadas no customId
        const parts = interaction.customId.replace('pedir_set_modal_', '').split('_');
        const canalPedidosId = parts[0];
        const canalLogsNegadoId = parts[1];

        // Obtém as respostas digitadas pelo usuário no modal (incluindo o 5º campo)
        const nome = interaction.fields.getTextInputValue('nome_input');
        const id = interaction.fields.getTextInputValue('id_input');
        const telefone = interaction.fields.getTextInputValue('telefone_input');
        const recrutador = interaction.fields.getTextInputValue('recrutador_input');
        const cargoDesejado = interaction.fields.getTextInputValue('cargo_input');

        const user = interaction.user;

        // Criação do embed formatado com os dados e cargo selecionado
        const responseEmbed = new EmbedBuilder()
          .setTitle('✨ NOVO PEDIDO DE SET ✨')
          .setDescription(
            `👤 Discord user:\n<@${user.id}> (${user.id})\n\n` +
            `🔠 NOME\n${nome}\n\n` +
            `💳 ID\n${id}\n\n` +
            `📞 TELEFONE\n${telefone}\n\n` +
            `📋 ID DE QUEM RECRUTOU\n${recrutador}\n\n` +
            `💼 CARGO DESEJADO\n${cargoDesejado}\n\n`
          )
          .setColor(2326507)
          .setFooter({ text: 'Bot criado por chegaheitor © 2026' });

        // Criação do Role Select Menu para selecionar o cargo
        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId(`aprovar_select_${user.id}`)
          .setPlaceholder('Selecione o cargo para ACEITAR...')
          .setMinValues(1)
          .setMaxValues(1);

        // Criação do botão de recusa
        const denyButton = new ButtonBuilder()
          .setCustomId(`negar_btn_${user.id}_${canalLogsNegadoId}`)
          .setLabel('Negar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✖️');

        // Como o RoleSelectMenuBuilder deve ocupar uma linha inteira, criamos dois ActionRows
        const rowSelect = new ActionRowBuilder().addComponents(roleSelect);
        const rowButton = new ActionRowBuilder().addComponents(denyButton);

        // Tenta buscar o canal de pedidos no servidor
        const canalPedidos = await interaction.guild.channels.fetch(canalPedidosId);

        if (canalPedidos) {
          // Envia o embed com o select menu e botão negar no canal de pedidos
          await canalPedidos.send({ embeds: [responseEmbed], components: [rowSelect, rowButton] });
          
          // Confirmação privada para o usuário que enviou
          await interaction.reply({ 
            content: 'Seu pedido de set foi enviado com sucesso! Aguarde a revisão dos administradores. ✅', 
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
