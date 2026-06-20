import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { getRecrutas, saveFarmPanel, getFarmPanel, saveFarmChannel, getFarmChannel, deleteFarmChannel, hasActiveFarmChannel, getActiveFarmChannel, addConfirmedFarm, addPaidMeta, removeConfirmedFarm, removePaidMeta, getFarmMaterials, addMetaDeclarada, getGlobalFarmConfig } from '../database.js';
import { sendLog } from '../logs.js';

function hasAdminPermission(interaction, channelConfig) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  if (channelConfig && channelConfig.cargosAdminIds && Array.isArray(channelConfig.cargosAdminIds)) {
    return channelConfig.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId));
  }
  return false;
}

export const data = new SlashCommandBuilder()
  .setName('criarfarm')
  .setDescription('Cria o painel de solicitação de pasta de farm no canal configurado no /painelconfig.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const success = await criarPainelFarm(interaction.client, interaction.guild);
    if (success) {
      await interaction.reply({
        content: '✅ Painel de solicitação de pasta de farm enviado com sucesso!',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: '❌ Configurações do Farm incompletas! Use o `/painelconfig` primeiro.',
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Erro ao executar o comando /criarfarm:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao criar o painel de farm.',
      ephemeral: true
    }).catch(() => null);
  }
}

export async function criarPainelFarm(client, guild) {
  try {
    const config = getGlobalFarmConfig();
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    if (!config || !config.painelCanalId || !config.categoriaId) {
      return false;
    }

    const canalPainel = guild.channels.cache.get(config.painelCanalId) 
      || await guild.channels.fetch(config.painelCanalId).catch(() => null);
    if (!canalPainel) return false;

    const embed = new EmbedBuilder()
      .setTitle('📋 PASTA DE FARM 📋')
      .setDescription('Solicite aqui a sua pasta de farm.')
      .setColor(2326507)
      .setFooter({ text: `LuxBot Farm • ${dataAtual} • criado por chegaheitor` });

    const button = new ButtonBuilder()
      .setCustomId('farm_abrir_pasta_btn')
      .setLabel('Abrir/Acessar pasta de farm')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📦');

    const row = new ActionRowBuilder().addComponents(button);

    const msg = await canalPainel.send({ embeds: [embed], components: [row] });
    await msg.pin().catch(() => null);
    return true;
  } catch (error) {
    console.error('Erro ao criar painel de farm:', error);
    return false;
  }
}
// M├®todo para tratar intera├º├Áes relativas a este comando
export async function handleInteraction(interaction) {
  const { customId } = interaction;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. Tratar bot├Áes
  if (interaction.isButton()) {

    // Bot├úo de Solicitar Pasta (Membro)
    if (customId === 'farm_abrir_pasta_btn') {
      try {
        const userId = interaction.user.id;
        const config = getGlobalFarmConfig();

        if (!config || !config.categoriaId) {
          return await interaction.reply({
            content: '❌ Configuração do painel de farm não encontrada ou incompleta no banco de dados.',
            ephemeral: true
          });
        }

        // A. Verificar se o membro est├í aprovado no sistema de recrutamento
        const recrutas = getRecrutas();
        let recruta = recrutas.find(r => r.discordId === userId && r.status === 'ACEITO');

        // Permitir que admins/staff criem mesmo sem recrutamento
        if (!recruta) {
          const isStaff = (config.cargosAdminIds && Array.isArray(config.cargosAdminIds) && config.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId)))
            || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

          if (isStaff) {
            recruta = {
              discordId: userId,
              nome: interaction.member.displayName || interaction.user.username,
              gameId: 'Staff',
              status: 'ACEITO'
            };
          }
        }

        if (!recruta) {
          return await interaction.reply({
            content: '❌ Você precisa estar cadastrado e aprovado no sistema de recrutamento antes de abrir uma pasta de farm!',
            ephemeral: true
          });
        }

        // B. Verificar se ele j├í possui uma pasta de farm ativa
        const activeChannel = getActiveFarmChannel(userId);
        if (activeChannel) {
          return await interaction.reply({
            content: `❌ Você já possui uma pasta de farm ativa! Acesse aqui: <#${activeChannel.canalId}>`,
            ephemeral: true
          });
        }

        // C. Verificar se a categoria configurada realmente existe no servidor
        const guild = interaction.guild;
        const category = guild.channels.cache.get(config.categoriaId)
          || await guild.channels.fetch(config.categoriaId).catch(() => null);

        if (!category || category.type !== ChannelType.GuildCategory) {
          return await interaction.reply({
            content: '❌ A categoria de canais de farm configurada não existe no servidor! Peça para um administrador configurar no `/painelconfig`.',
            ephemeral: true
          });
        }

        // D. Criar o canal de texto
        const channelName = `${recruta.nome} | ${recruta.gameId} - farm`;

        const permissionOverwrites = [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: userId, // Dono do farm
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ];

        // Adicionar cargos admin autorizados
        if (config.cargosAdminIds && Array.isArray(config.cargosAdminIds)) {
          config.cargosAdminIds.forEach(roleId => {
            if (roleId) {
              permissionOverwrites.push({
                id: roleId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AddReactions
                ]
              });
            }
          });
        }

        const newChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: config.categoriaId,
          permissionOverwrites: permissionOverwrites
        });

        // E. Registrar canal ativo no banco
        saveFarmChannel({
          canalId: newChannel.id,
          donoId: userId,
          donoNome: recruta.nome,
          categoriaId: config.categoriaId,
          cargosAdminIds: config.cargosAdminIds || []
        });

        // Enviar log de cria├º├úo de canal de farm
        const logEmbed = new EmbedBuilder()
          .setTitle('📂 Pasta de Farm Criada')
          .setColor(3066993)
          .setDescription(`O usuário <@${userId}> (${userId}) abriu uma nova pasta de farm.`)
          .addFields({ name: '📂 Canal Criado:', value: `${newChannel} (${newChannel.id})` })
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

        // F. Enviar embed de boas-vindas no novo canal
        const farmWelcomeEmbed = new EmbedBuilder()
          .setTitle(`📂 FARM: ${recruta.nome.toUpperCase()} 📂`)
          .setDescription('Nesta pasta você irá colocar o farm que fizer.')
          .setColor(2326507)
          .setFooter({ text: `LuxBot Farm • ${dataAtual} • criado por chegaheitor` });

        const btnAdd = new ButtonBuilder()
          .setCustomId('farm_adicionar_btn')
          .setLabel('Adicionar Farm')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🌾');

        const btnMeta = new ButtonBuilder()
          .setCustomId('farm_bati_meta_btn')
          .setLabel('Bati a Meta')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🌟');

        const btnDelete = new ButtonBuilder()
          .setCustomId('farm_apagar_pasta_btn')
          .setLabel('Apagar pasta de meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(btnAdd, btnMeta, btnDelete);

        await newChannel.send({ content: `<@${userId}>`, embeds: [farmWelcomeEmbed], components: [row] });

        // G. Responder privadamente
        await interaction.reply({
          content: `Sua pasta de farm foi criada com sucesso! Acesse aqui: ${newChannel}`,
          ephemeral: true
        });

      } catch (error) {
        console.error('Erro ao abrir canal de farm:', error);
        await interaction.reply({ content: 'Ocorreu um erro ao criar a sua pasta de farm.', ephemeral: true });
      }
    }

    // Bot├úo Adicionar Farm (Membro)
    if (customId === 'farm_adicionar_btn') {
      try {
        const materiais = getFarmMaterials();
        const options = materiais.map(m => ({
          label: m,
          description: `Farm de ${m}`,
          value: m
        }));

        // Envia o select menu de forma ephemeral
        const select = new StringSelectMenuBuilder()
          .setCustomId('farm_adicionar_select')
          .setPlaceholder('Escolha o recurso que farmou...')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({
          content: 'Selecione abaixo o recurso adicionado:',
          components: [row],
          ephemeral: true
        });
      } catch (error) {
        console.error('Erro ao clicar em Adicionar Farm:', error);
        await interaction.reply({ content: 'Erro ao abrir menu de recursos.', ephemeral: true });
      }
    }

    // Bot├úo Confirmar Farm (Admin)
    if (customId.startsWith('farm_confirmar_btn_')) {
      try {
        const parts = customId.replace('farm_confirmar_btn_', '').split('_');
        const userId = parts[0];
        const item = parts[1];
        const quantidade = parts[2];
        const dataStr = parts[3];

        // Verificar permissões
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: 'ÔØî Voc├¬ n├úo tem permiss├úo para confirmar este farm!', ephemeral: true });
        }

        // Salvar farm no banco de dados local do perfil do usu├írio
        addConfirmedFarm(userId, {
          item: item,
          quantidade: quantidade,
          data: dataStr,
          confirmadoPor: interaction.user.id
        });

        // Adicionar rea├º├úo Ô£à na mensagem original
        await interaction.message.react('Ô£à').catch(() => null);

        // Atualizar embed mostrando status confirmado
        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('Ô£à FARM CONFIRMADO Ô£à')
            .setColor(3066993)
            .setDescription(
              `­ƒæñ **Enviado por:** <@${userId}>\n` +
              `­ƒôª **Recurso:** ${item}\n` +
              `­ƒöó **Quantidade:** ${quantidade}\n` +
              `­ƒôà **Data:** ${dataStr}\n\n` +
              `Ô£à **Confirmado por:** <@${interaction.user.id}>`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('Ô£à FARM CONFIRMADO Ô£à')
            .setColor(3066993)
            .setDescription(
              `­ƒæñ **Enviado por:** <@${userId}>\n` +
              `­ƒôª **Recurso:** ${item}\n` +
              `­ƒöó **Quantidade:** ${quantidade}\n` +
              `­ƒôà **Data:** ${dataStr}\n\n` +
              `Ô£à **Confirmado por:** <@${interaction.user.id}>`
            );
        }

        const desconfirmBtn = new ButtonBuilder()
          .setCustomId(`farm_desconfirmar_btn_${userId}_${item}_${quantidade}_${dataStr}`)
          .setLabel('Desconfirmar Farm')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('Ôå®´©Å');

        const row = new ActionRowBuilder().addComponents(desconfirmBtn);

        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

        // Enviar log de confirma├º├úo de farm
        const logEmbed = new EmbedBuilder()
          .setTitle('Ô£à Farm Confirmado')
          .setColor(3066993)
          .setDescription(`O administrador <@${interaction.user.id}> confirmou o farm de <@${userId}>.`)
          .addFields(
            { name: '­ƒôª Recurso:', value: item, inline: true },
            { name: '­ƒöó Quantidade:', value: quantidade, inline: true },
            { name: '­ƒôà Data:', value: dataStr, inline: true }
          )
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao confirmar farm:', error);
        await interaction.reply({ content: 'Erro ao processar a confirma├º├úo do farm.', ephemeral: true });
      }
    }

    // Bot├úo Desconfirmar Farm (Admin)
    if (customId.startsWith('farm_desconfirmar_btn_')) {
      try {
        const parts = customId.replace('farm_desconfirmar_btn_', '').split('_');
        const userId = parts[0];
        const item = parts[1];
        const quantidade = parts[2];
        const dataStr = parts[3];

        // Verificar permissões
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: 'ÔØî Voc├¬ n├úo tem permiss├úo para desconfirmar este farm!', ephemeral: true });
        }

        // Remover do banco
        removeConfirmedFarm(userId, item, quantidade, dataStr);

        // Remover rea├º├úo Ô£à
        const reaction = interaction.message.reactions.cache.get('Ô£à');
        if (reaction) {
          await reaction.users.remove(interaction.client.user.id).catch(() => null);
        }

        // Reverter embed
        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('­ƒî¥ NOVO FARM DECLARADO ­ƒî¥')
            .setColor(2326507)
            .setDescription(
              `­ƒæñ **Enviado por:** <@${userId}>\n` +
              `­ƒôª **Recurso:** ${item}\n` +
              `­ƒöó **Quantidade:** ${quantidade}\n` +
              `­ƒôà **Data:** ${dataStr}\n\n` +
              `Aguardando confirma├º├úo de um administrador.`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('­ƒî¥ NOVO FARM DECLARADO ­ƒî¥')
            .setColor(2326507)
            .setDescription(
              `­ƒæñ **Enviado por:** <@${userId}>\n` +
              `­ƒôª **Recurso:** ${item}\n` +
              `­ƒöó **Quantidade:** ${quantidade}\n` +
              `­ƒôà **Data:** ${dataStr}\n\n` +
              `Aguardando confirma├º├úo de um administrador.`
            );
        }

        // Reverter bot├úo
        const confirmBtn = new ButtonBuilder()
          .setCustomId(`farm_confirmar_btn_${userId}_${item}_${quantidade}_${dataStr}`)
          .setLabel('Confirmar Farm')
          .setStyle(ButtonStyle.Success)
          .setEmoji('Ô£ö´©Å');

        const row = new ActionRowBuilder().addComponents(confirmBtn);

        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

        // Enviar log de desconfirma├º├úo de farm
        const logEmbed = new EmbedBuilder()
          .setTitle('Ôå®´©Å Farm Desconfirmado')
          .setColor(3447003)
          .setDescription(`O administrador <@${interaction.user.id}> desconfirmou o farm de <@${userId}>.`)
          .addFields(
            { name: '­ƒôª Recurso:', value: item, inline: true },
            { name: '­ƒöó Quantidade:', value: quantidade, inline: true },
            { name: '­ƒôà Data:', value: dataStr, inline: true }
          )
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao desconfirmar farm:', error);
        await interaction.reply({ content: 'Erro ao desconfirmar o farm.', ephemeral: true });
      }
    }

    // Bot├úo Apagar Farm (sem necessidade de permiss├úo administrativa)
    if (customId === 'farm_apagar_declaracao_btn') {
      try {
        const originalEmbed = interaction.message.embeds[0];
        let desc = 'Uma declara├º├úo de farm pendente foi exclu├¡da.';
        if (originalEmbed && originalEmbed.description) {
          desc = `Uma declara├º├úo de farm pendente foi exclu├¡da por <@${interaction.user.id}>:\n${originalEmbed.description}`;
        }
        const logEmbed = new EmbedBuilder()
          .setTitle('­ƒùæ´©Å Declara├º├úo de Farm Apagada')
          .setColor(15158332)
          .setDescription(desc)
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

        await interaction.message.delete().catch(() => null);
      } catch (error) {
        console.error('Erro ao apagar declara├º├úo de farm:', error);
      }
      return;
    }

    // Bot├úo Bati a Meta (Membro) - Abre select de material
    if (customId === 'farm_bati_meta_btn') {
      try {
        const channelConfig = getFarmChannel(interaction.channelId);
        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Canal n├úo registrado no sistema.', ephemeral: true });
        }

        const materiais = getFarmMaterials();
        const options = materiais.map(m => ({
          label: m,
          description: `Meta de ${m}`,
          value: m
        }));

        const select = new StringSelectMenuBuilder()
          .setCustomId('farm_bati_meta_select')
          .setPlaceholder('Escolha o recurso da meta batida...')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({
          content: 'Selecione abaixo o recurso da sua meta batida:',
          components: [row],
          ephemeral: true
        });
      } catch (error) {
        console.error('Erro ao clicar em Bati a Meta:', error);
        await interaction.reply({ content: 'Erro ao declarar meta batida.', ephemeral: true });
      }
    }

    // Bot├úo PAGAR META (Admin)
    // Bot├úo PAGAR META (Admin) - Abre Modal
    if (customId.startsWith('farm_pagar_meta_btn_')) {
      try {
        const donoId = customId.replace('farm_pagar_meta_btn_', '');

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: 'ÔØî Voc├¬ n├úo tem permiss├úo para gerenciar esta meta!', ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId(`farm_pagar_meta_modal_${donoId}`)
          .setTitle('­ƒÆ© Confirmar Pagamento ­ƒÆ©');

        const valorInput = new TextInputBuilder()
          .setCustomId('valor_input')
          .setLabel('VALOR PAGO')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite o valor pago (ex: 100k, 50.000)')
          .setRequired(true);

        const now = new Date();
        const dataFormatada = now.toLocaleDateString('pt-BR');

        const dataInput = new TextInputBuilder()
          .setCustomId('data_input')
          .setLabel('DATA DO PAGAMENTO')
          .setStyle(TextInputStyle.Short)
          .setValue(dataFormatada)
          .setPlaceholder('DD/MM/AAAA')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(valorInput),
          new ActionRowBuilder().addComponents(dataInput)
        );

        await interaction.showModal(modal);

      } catch (error) {
        console.error('Erro ao abrir modal de pagamento de meta:', error);
        await interaction.reply({ content: 'Erro ao abrir formul├írio de confirma├º├úo de pagamento.', ephemeral: true });
      }
    }

    // Bot├úo Desconfirmar Meta (Admin)
    if (customId.startsWith('farm_desconfirmar_meta_btn_')) {
      try {
        const donoId = customId.replace('farm_desconfirmar_meta_btn_', '');

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: 'ÔØî Voc├¬ n├úo tem permiss├úo para desconfirmar esta meta!', ephemeral: true });
        }

        // Remover do banco
        removePaidMeta(donoId);

        // Remover rea├º├úo ­ƒÆ© (ou ­ƒÆ▓ caso o usu├írio clique em uma antiga)
        const reaction = interaction.message.reactions.cache.find(r => r.emoji.name === '­ƒÆ©' || r.emoji.name === '­ƒÆ▓');
        if (reaction) {
          await reaction.users.remove(interaction.client.user.id).catch(() => null);
        }

        // Reverter embed
        const originalEmbed = interaction.message.embeds[0];
        let timestamp = '';
        if (originalEmbed && originalEmbed.description) {
          const match = originalEmbed.description.match(/­ƒôà \*\*Data da Meta:\*\* ([^\n]+)/);
          if (match) {
            timestamp = match[1];
          }
        }
        if (!timestamp) {
          const msgDate = interaction.message.createdAt || new Date();
          timestamp = msgDate.toLocaleDateString('pt-BR') + ' ├ás ' + msgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        const revertedEmbed = new EmbedBuilder()
          .setTitle('Ô£¿ META BATIDA Ô£¿')
          .setDescription(
            `­ƒæñ **Membro:** <@${donoId}>\n` +
            `­ƒôà **Data/Hora:** ${timestamp}\n\n` +
            `Aguardando a confirma├º├úo do pagamento pelos administradores.`
          )
          .setColor(3066993)
          .setFooter({ text: `LuxBot Farm ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` });

        const btnPagar = new ButtonBuilder()
          .setCustomId(`farm_pagar_meta_btn_${donoId}`)
          .setLabel('Pagar Meta')
          .setStyle(ButtonStyle.Success)
          .setEmoji('­ƒÆ©');

        const btnIncompleta = new ButtonBuilder()
          .setCustomId(`farm_meta_incompleta_btn_${donoId}`)
          .setLabel('Meta Incompleta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('ÔÜá´©Å');

        const btnExcluir = new ButtonBuilder()
          .setCustomId('farm_excluir_meta_btn')
          .setLabel('Excluir Meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('­ƒùæ´©Å');

        const row = new ActionRowBuilder().addComponents(btnPagar, btnIncompleta, btnExcluir);

        await interaction.update({
          content: null,
          embeds: [revertedEmbed],
          components: [row]
        });

        // Enviar log de desconfirma├º├úo de meta
        const logEmbed = new EmbedBuilder()
          .setTitle('Ôå®´©Å Pagamento de Meta Desconfirmado')
          .setColor(3447003)
          .setDescription(`O administrador <@${interaction.user.id}> desconfirmou o pagamento de meta de <@${donoId}>.`)
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao desconfirmar meta:', error);
        await interaction.reply({ content: 'Erro ao desconfirmar o pagamento da meta.', ephemeral: true });
      }
    }

    // Bot├úo Voltar a Pendente (Admin)
    if (customId.startsWith('farm_voltar_pendente_meta_btn_')) {
      try {
        const donoId = customId.replace('farm_voltar_pendente_meta_btn_', '');

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: 'ÔØî Voc├¬ n├úo tem permiss├úo para redefinir esta meta!', ephemeral: true });
        }

        const originalEmbed = interaction.message.embeds[0];
        let description = '';
        if (originalEmbed && originalEmbed.description) {
          const parts = originalEmbed.description.split('\n\nÔØî');
          description = parts[0] + '\n\nAguardando a confirma├º├úo do pagamento pelos administradores.';
        } else {
          description = 'Aguardando a confirma├º├úo do pagamento pelos administradores.';
        }

        const revertedEmbed = EmbedBuilder.from(originalEmbed)
          .setTitle('Ô£¿ META BATIDA Ô£¿')
          .setColor(3066993)
          .setDescription(description);

        const btnPagar = new ButtonBuilder()
          .setCustomId(`farm_pagar_meta_btn_${donoId}`)
          .setLabel('Pagar Meta')
          .setStyle(ButtonStyle.Success)
          .setEmoji('­ƒÆ©');

        const btnIncompleta = new ButtonBuilder()
          .setCustomId(`farm_meta_incompleta_btn_${donoId}`)
          .setLabel('Meta Incompleta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('ÔÜá´©Å');

        const btnExcluir = new ButtonBuilder()
          .setCustomId('farm_excluir_meta_btn')
          .setLabel('Excluir Meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('­ƒùæ´©Å');

        const row = new ActionRowBuilder().addComponents(btnPagar, btnIncompleta, btnExcluir);

        await interaction.update({
          content: null,
          embeds: [revertedEmbed],
          components: [row]
        });

        // Enviar log de meta restaurada
        const logEmbed = new EmbedBuilder()
          .setTitle('Ôå®´©Å Meta Restaurada para Pendente')
          .setColor(3447003)
          .setDescription(`O administrador <@${interaction.user.id}> restaurou o status da meta de <@${donoId}> para pendente.`)
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao voltar meta para pendente:', error);
        await interaction.reply({ content: 'Erro ao redefinir status da meta.', ephemeral: true });
      }
    }

    // Bot├úo Excluir Meta (Qualquer um com acesso)
    if (customId === 'farm_excluir_meta_btn') {
      try {
        const originalEmbed = interaction.message.embeds[0];
        let desc = 'Uma declara├º├úo de meta batida foi exclu├¡da.';
        if (originalEmbed && originalEmbed.description) {
          desc = `Uma declara├º├úo de meta batida foi exclu├¡da por <@${interaction.user.id}>:\n${originalEmbed.description}`;
        }
        const logEmbed = new EmbedBuilder()
          .setTitle('­ƒùæ´©Å Declara├º├úo de Meta Exclu├¡da')
          .setColor(15158332)
          .setDescription(desc)
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

        await interaction.message.delete().catch(() => null);
      } catch (error) {
        console.error('Erro ao excluir meta:', error);
      }
      return;
    }

    // Bot├úo Meta Incompleta (Admin)
    if (customId.startsWith('farm_meta_incompleta_btn_')) {
      try {
        const donoId = customId.replace('farm_meta_incompleta_btn_', '');

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: 'ÔØî Voc├¬ n├úo tem permiss├úo para gerenciar esta meta!', ephemeral: true });
        }

        // Abre modal para escrever o motivo
        const modal = new ModalBuilder()
          .setCustomId(`farm_meta_incompleta_modal_${donoId}`)
          .setTitle('ÔÜá´©Å Meta Incompleta ÔÜá´©Å');

        const motivoInput = new TextInputBuilder()
          .setCustomId('motivo_input')
          .setLabel('MOTIVO DO ERRO')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explique o que est├í errado com a meta do farm...')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao clicar em Meta Incompleta:', error);
        await interaction.reply({ content: 'Erro ao abrir formul├írio de erro de meta.', ephemeral: true });
      }
    }

    // Bot├úo Apagar Pasta de Farm (Admin)
    if (customId === 'farm_apagar_pasta_btn') {
      try {
        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: 'ÔØî Voc├¬ n├úo tem permiss├úo para apagar esta pasta!', ephemeral: true });
        }

        // Envia mensagem de confirma├º├úo apenas para quem clicou (ephemeral)
        const confirmBtn = new ButtonBuilder()
          .setCustomId('farm_confirmar_apagar_btn')
          .setLabel('Confirmar Exclus├úo da Pasta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('­ƒùæ´©Å');

        const row = new ActionRowBuilder().addComponents(confirmBtn);

        await interaction.reply({
          content: 'ÔÜá´©Å **ATEN├ç├âO:** Voc├¬ tem certeza de que deseja apagar esta pasta de farm? Todos os registros do canal ser├úo exclu├¡dos.',
          components: [row],
          ephemeral: true
        });
      } catch (error) {
        console.error('Erro ao clicar em Apagar Pasta:', error);
        await interaction.reply({ content: 'Erro ao abrir confirma├º├úo de exclus├úo.', ephemeral: true });
      }
    }

    // Bot├úo Confirmar Apagar Canal (Admin)
    if (customId === 'farm_confirmar_apagar_btn') {
      try {
        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: 'ÔØî Voc├¬ n├úo tem permiss├úo para executar esta a├º├úo!', ephemeral: true });
        }

        // Enviar log antes de deletar o canal
        const donoMencao = channelConfig ? `<@${channelConfig.donoId}>` : 'Desconhecido';
        const logEmbed = new EmbedBuilder()
          .setTitle('­ƒùæ´©Å Pasta de Farm Exclu├¡da')
          .setColor(15158332)
          .setDescription(`O administrador <@${interaction.user.id}> excluiu a pasta de farm de ${donoMencao}.`)
          .addFields({ name: '­ƒôü Canal Exclu├¡do:', value: `${interaction.channel.name} (${interaction.channelId})` })
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

        // Remover do banco
        deleteFarmChannel(interaction.channelId);

        // Deletar o canal correspondente
        const channel = interaction.channel;
        await interaction.reply({ content: 'Apagando pasta em 3 segundos...', ephemeral: true });
        setTimeout(async () => {
          await channel.delete().catch(() => null);
        }, 3000);

      } catch (error) {
        console.error('Erro ao deletar canal de farm:', error);
        await interaction.reply({ content: 'Erro ao apagar pasta de farm.', ephemeral: true });
      }
    }
  }

  // 2. Tratar menus de sele├º├úo
  if (interaction.isStringSelectMenu()) {
    if (customId === 'farm_adicionar_select') {
      try {
        const itemSelecionado = interaction.values[0];
        const channelConfig = getFarmChannel(interaction.channelId);

        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Pasta de farm n├úo configurada no banco.', ephemeral: true });
        }

        // Abre modal para quantidade e data
        const modal = new ModalBuilder()
          .setCustomId(`farm_adicionar_modal_${itemSelecionado}`)
          .setTitle(`­ƒî¥ Adicionar Farm: ${itemSelecionado}`);

        const qtdInput = new TextInputBuilder()
          .setCustomId('qtd_input')
          .setLabel('QUANTIDADE')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite a quantidade do recurso (ex: 500, 15k)')
          .setRequired(true);

        const now = new Date();
        const dataFormatada = now.toLocaleDateString('pt-BR');

        const dataInput = new TextInputBuilder()
          .setCustomId('data_input')
          .setLabel('DATA DO FARM')
          .setStyle(TextInputStyle.Short)
          .setValue(dataFormatada)
          .setPlaceholder('DD/MM/AAAA')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(qtdInput),
          new ActionRowBuilder().addComponents(dataInput)
        );

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao processar select de farm:', error);
        await interaction.reply({ content: 'Erro ao abrir formul├írio de quantidade.', ephemeral: true });
      }
    }

    if (customId === 'farm_bati_meta_select') {
      try {
        const itemSelecionado = interaction.values[0];
        const channelConfig = getFarmChannel(interaction.channelId);

        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Pasta de farm n├úo configurada no banco.', ephemeral: true });
        }

        // Abre modal para quantidade e data/hora
        const modal = new ModalBuilder()
          .setCustomId(`farm_bati_meta_modal_${itemSelecionado}`)
          .setTitle(`Ô£¿ Meta: ${itemSelecionado} Ô£¿`);

        const qtdInput = new TextInputBuilder()
          .setCustomId('qtd_input')
          .setLabel('QUANTIDADE DA META')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite a quantidade (ex: 100k, 50.000)')
          .setRequired(true);

        const now = new Date();
        const dataFormatada = now.toLocaleDateString('pt-BR') + ' ├ás ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const dataInput = new TextInputBuilder()
          .setCustomId('data_input')
          .setLabel('DATA E HORA')
          .setStyle(TextInputStyle.Short)
          .setValue(dataFormatada)
          .setPlaceholder('DD/MM/AAAA ├ás HH:MM')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(qtdInput),
          new ActionRowBuilder().addComponents(dataInput)
        );

        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao processar select de meta:', error);
        await interaction.reply({ content: 'Erro ao abrir formul├írio de meta.', ephemeral: true });
      }
    }
  }

  // 3. Tratar submiss├Áes de modais
  if (interaction.isModalSubmit()) {

    // Modal de Adicionar Farm
    if (customId.startsWith('farm_adicionar_modal_')) {
      try {
        const item = customId.replace('farm_adicionar_modal_', '');
        const quantidade = interaction.fields.getTextInputValue('qtd_input');
        const dataStr = interaction.fields.getTextInputValue('data_input');

        const channelConfig = getFarmChannel(interaction.channelId);
        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Canal n├úo cadastrado.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle('­ƒî¥ NOVO FARM DECLARADO ­ƒî¥')
          .setDescription(
            `­ƒæñ **Enviado por:** <@${channelConfig.donoId}>\n` +
            `­ƒôª **Recurso:** ${item}\n` +
            `­ƒöó **Quantidade:** ${quantidade}\n` +
            `­ƒôà **Data:** ${dataStr}\n\n` +
            `Aguardando confirma├º├úo de um administrador.`
          )
          .setColor(2326507)
          .setFooter({ text: `LuxBot Farm ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` });

        const confirmBtn = new ButtonBuilder()
          .setCustomId(`farm_confirmar_btn_${channelConfig.donoId}_${item}_${quantidade}_${dataStr}`)
          .setLabel('Confirmar Farm')
          .setStyle(ButtonStyle.Success)
          .setEmoji('Ô£ö´©Å');

        const deleteBtn = new ButtonBuilder()
          .setCustomId('farm_apagar_declaracao_btn')
          .setLabel('Apagar Farm')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('­ƒùæ´©Å');

        const row = new ActionRowBuilder().addComponents(confirmBtn, deleteBtn);

        await interaction.reply({ embeds: [embed], components: [row] });

        // Enviar log de farm declarado
        const logEmbed = new EmbedBuilder()
          .setTitle('­ƒî¥ Novo Farm Declarado')
          .setColor(3447003)
          .setDescription(`O usu├írio <@${channelConfig.donoId}> declarou um novo farm pendente.`)
          .addFields(
            { name: '­ƒôª Recurso:', value: item, inline: true },
            { name: '­ƒöó Quantidade:', value: quantidade, inline: true },
            { name: '­ƒôà Data:', value: dataStr, inline: true }
          )
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);
      } catch (error) {
        console.error('Erro ao enviar declara├º├úo de farm:', error);
        await interaction.reply({ content: 'Erro ao registrar declara├º├úo de farm.', ephemeral: true });
      }
    }

    // Modal de Declara├º├úo de Meta Batida (Membro)
    if (customId.startsWith('farm_bati_meta_modal_')) {
      try {
        const item = customId.replace('farm_bati_meta_modal_', '');
        const quantidade = interaction.fields.getTextInputValue('qtd_input');
        const dataStr = interaction.fields.getTextInputValue('data_input');

        const channelConfig = getFarmChannel(interaction.channelId);
        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Canal n├úo cadastrado.', ephemeral: true });
        }

        // Salvar meta declarada no banco para estat├¡sticas de perfil
        addMetaDeclarada(channelConfig.donoId, interaction.user.tag, {
          item: item,
          quantidade: quantidade,
          data: dataStr
        });

        const embed = new EmbedBuilder()
          .setTitle('Ô£¿ META BATIDA Ô£¿')
          .setDescription(
            `­ƒæñ **Membro:** <@${channelConfig.donoId}>\n` +
            `­ƒôª **Recurso:** ${item}\n` +
            `­ƒöó **Quantidade:** ${quantidade}\n` +
            `­ƒôà **Data/Hora:** ${dataStr}\n\n` +
            `Aguardando a confirma├º├úo do pagamento pelos administradores.`
          )
          .setColor(3066993)
          .setFooter({ text: `LuxBot Farm ÔÇó ${dataAtual} ÔÇó criado por chegaheitor` });

        const btnPagar = new ButtonBuilder()
          .setCustomId(`farm_pagar_meta_btn_${channelConfig.donoId}`)
          .setLabel('Pagar Meta')
          .setStyle(ButtonStyle.Success)
          .setEmoji('­ƒÆ©');

        const btnIncompleta = new ButtonBuilder()
          .setCustomId(`farm_meta_incompleta_btn_${channelConfig.donoId}`)
          .setLabel('Meta Incompleta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('ÔÜá´©Å');

        const btnExcluir = new ButtonBuilder()
          .setCustomId('farm_excluir_meta_btn')
          .setLabel('Excluir Meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('­ƒùæ´©Å');

        const row = new ActionRowBuilder().addComponents(btnPagar, btnIncompleta, btnExcluir);

        await interaction.reply({ embeds: [embed], components: [row] });

        // Enviar log de meta batida
        const logEmbed = new EmbedBuilder()
          .setTitle('Ô£¿ Meta Batida Declarada')
          .setColor(3447003)
          .setDescription(`O usu├írio <@${channelConfig.donoId}> declarou que bateu a meta.`)
          .addFields(
            { name: '­ƒôª Recurso:', value: item, inline: true },
            { name: '­ƒöó Quantidade:', value: quantidade, inline: true },
            { name: '­ƒôà Data/Hora:', value: dataStr, inline: true }
          )
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);
      } catch (error) {
        console.error('Erro ao enviar declara├º├úo de meta batida:', error);
        await interaction.reply({ content: 'Erro ao registrar declara├º├úo de meta.', ephemeral: true });
      }
    }

    // Modal de Pagamento de Meta (Confirmar Pagamento)
    if (customId.startsWith('farm_pagar_meta_modal_')) {
      try {
        const donoId = customId.replace('farm_pagar_meta_modal_', '');
        const valor = interaction.fields.getTextInputValue('valor_input');
        const dataStr = interaction.fields.getTextInputValue('data_input');

        // Registrar meta paga no banco
        addPaidMeta(donoId, {
          pagoPor: interaction.user.id,
          valor: valor,
          data: dataStr
        });

        // Reagir com ­ƒÆ© (conforme requisitado para trocar ­ƒÆ▓ por ­ƒÆ©)
        await interaction.message.react('­ƒÆ©').catch(() => null);

        // Obter data da mensagem original
        const msgDate = interaction.message.createdAt || new Date();
        const dataMensagem = msgDate.toLocaleDateString('pt-BR') + ' ├ás ' + msgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('­ƒÆ© META PAGA ­ƒÆ©')
            .setColor(3066993)
            .setDescription(
              `­ƒæñ **Membro:** <@${donoId}>\n` +
              `­ƒôà **Data da Meta:** ${dataMensagem}\n` +
              `­ƒÆ░ **Valor Pago:** ${valor}\n` +
              `­ƒÆ© **Pago por:** <@${interaction.user.id}>\n` +
              `­ƒôå **Data do Pagamento:** ${dataStr}`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('­ƒÆ© META PAGA ­ƒÆ©')
            .setColor(3066993)
            .setDescription(
              `­ƒæñ **Membro:** <@${donoId}>\n` +
              `­ƒôà **Data da Meta:** ${dataMensagem}\n` +
              `­ƒÆ░ **Valor Pago:** ${valor}\n` +
              `­ƒÆ© **Pago por:** <@${interaction.user.id}>\n` +
              `­ƒôå **Data do Pagamento:** ${dataStr}`
            );
        }

        const desconfirmMetaBtn = new ButtonBuilder()
          .setCustomId(`farm_desconfirmar_meta_btn_${donoId}`)
          .setLabel('Desconfirmar Meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('Ôå®´©Å');

        const row = new ActionRowBuilder().addComponents(desconfirmMetaBtn);

        // Desativar bot├Áes e atualizar a mensagem
        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

        // Enviar log de pagamento de meta
        const logEmbed = new EmbedBuilder()
          .setTitle('­ƒÆ© Meta Confirmada/Paga')
          .setColor(3066993)
          .setDescription(`O administrador <@${interaction.user.id}> marcou como paga a meta de <@${donoId}>.`)
          .addFields(
            { name: '­ƒÆ░ Valor Pago:', value: valor, inline: true },
            { name: '­ƒôà Data do Pagamento:', value: dataStr, inline: true }
          )
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao processar modal de pagamento de meta:', error);
        await interaction.reply({ content: 'Erro ao processar pagamento da meta.', ephemeral: true });
      }
    }

    // Modal de Justificativa de Meta Incompleta
    if (customId.startsWith('farm_meta_incompleta_modal_')) {
      try {
        const donoId = customId.replace('farm_meta_incompleta_modal_', '');
        const motivo = interaction.fields.getTextInputValue('motivo_input');

        const now = new Date();
        const timestamp = now.toLocaleDateString('pt-BR') + ' ├ás ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('ÔÜá´©Å META INCOMPLETA ÔÜá´©Å')
            .setColor(15158332)
            .setDescription(
              originalEmbed.description +
              `\n\nÔØî **Marcada como Incompleta por:** <@${interaction.user.id}>\n` +
              `­ƒôØ **Motivo:** *${motivo}*\n` +
              `­ƒôà **Data/Hora:** ${timestamp}`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('ÔÜá´©Å META INCOMPLETA ÔÜá´©Å')
            .setColor(15158332)
            .setDescription(
              `­ƒæñ **Membro:** <@${donoId}>\n` +
              `ÔØî **Marcada como Incompleta por:** <@${interaction.user.id}>\n` +
              `­ƒôØ **Motivo:** *${motivo}*\n` +
              `­ƒôà **Data/Hora:** ${timestamp}`
            );
        }

        const voltarBtn = new ButtonBuilder()
          .setCustomId(`farm_voltar_pendente_meta_btn_${donoId}`)
          .setLabel('Voltar a Pendente')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('Ôå®´©Å');

        const row = new ActionRowBuilder().addComponents(voltarBtn);

        // Desativar bot├Áes da mensagem de aprova├º├úo de meta
        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

        // Responder ao admin de forma oculta (ephemeral)
        await interaction.followUp({
          content: `ÔÜá´©Å Meta incompleta! Justificativa enviada.`,
          ephemeral: true
        });

        // Envia notifica├º├úo simples no canal marcando o usu├írio dono da pasta
        await interaction.channel.send({
          content: `ÔÜá´©Å <@${donoId}>, sua meta foi marcada como **incompleta/errada** por <@${interaction.user.id}>! Verifique o motivo no painel acima.`
        });

        // Enviar log de meta incompleta
        const logEmbed = new EmbedBuilder()
          .setTitle('ÔÜá´©Å Meta Marcada como Incompleta')
          .setColor(15158332)
          .setDescription(`O administrador <@${interaction.user.id}> marcou a meta de <@${donoId}> como incompleta.`)
          .addFields({ name: '­ƒôØ Motivo:', value: motivo })
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);
      } catch (error) {
        console.error('Erro ao enviar justificativa de meta errada:', error);
        await interaction.reply({ content: 'Erro ao processar erro de meta.', ephemeral: true });
      }
    }
  }
}
