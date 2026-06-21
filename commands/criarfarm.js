import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { getRecrutas, saveFarmPanel, getFarmPanel, saveFarmChannel, getFarmChannel, deleteFarmChannel, hasActiveFarmChannel, getActiveFarmChannel, addConfirmedFarm, addPaidMeta, removeConfirmedFarm, removePaidMeta, getFarmMaterials, addMetaDeclarada, getGlobalFarmConfig } from '../database.js';
import { sendLog } from '../logs.js';

function hasAdminPermission(interaction, channelConfig) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  const globalConfig = getGlobalFarmConfig();
  const cargosAdminIds = channelConfig?.cargosAdminIds || globalConfig?.cargosAdminIds || [];
  if (Array.isArray(cargosAdminIds) && cargosAdminIds.length > 0) {
    return cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId));
  }
  return false;
}

export const data = new SlashCommandBuilder()
  .setName('criarfarm')
  .setDescription('Cria o painel de solicitação de pasta de farm no canal configurado no /painelconfig.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const recrutas = getRecrutas();
    const isAccepted = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      recrutas.some(r => r.discordId === interaction.user.id && r.status === 'ACEITO');

    if (!isAccepted) {
      return await interaction.reply({
        content: '❌ Você precisa ter seu recrutamento aceito para usar este comando!',
        ephemeral: true
      });
    }

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
      .setFooter({ text: `LuxBot Farm • criado por chegaheitor` });

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
// Método para tratar interações relativas a este comando
export async function handleInteraction(interaction) {
  const { customId, guild } = interaction;

  const config = getGlobalFarmConfig();
  const recrutas = getRecrutas();
  const isAccepted = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
    (config && config.cargosAdminIds && Array.isArray(config.cargosAdminIds) && config.cargosAdminIds.some(roleId => interaction.member.roles.cache.has(roleId))) ||
    recrutas.some(r => r.discordId === interaction.user.id && r.status === 'ACEITO');

  if (!isAccepted) {
    return await interaction.reply({
      content: '❌ Você precisa ter seu recrutamento aceito para interagir com o bot!',
      ephemeral: true
    });
  }

  // 1. Tratar botões
  if (interaction.isButton()) {

    // Botão de Solicitar Pasta (Membro)
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

        // A. Verificar se o membro está aprovado no sistema de recrutamento
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

        // B. Verificar se ele já possui uma pasta de farm ativa
        const activeChannel = getActiveFarmChannel(userId);
        if (activeChannel) {
          return await interaction.reply({
            content: `❌ Você já possui uma pasta de farm ativa! Acesse aqui: <#${activeChannel.canalId}>`,
            ephemeral: true
          });
        }

        // C. Verificar se a categoria configurada realmente existe no servidor
        const category = guild.channels.cache.get(config.categoriaId)
          || await guild.channels.fetch(config.categoriaId).catch(() => null);

        if (!category || category.type !== ChannelType.GuildCategory) {
          return await interaction.reply({
            content: '❌ A categoria de canais de farm configurada não existe no servidor! Peça para um administrador configurar no `/painelconfig`.',
            ephemeral: true
          });
        }

        // D. Criar o canal de texto
        const channelName = `${recruta.nome} ${recruta.gameId}`;

        const permissionOverwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: userId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ];

        // Adicionar cargos de staff de farm configurados
        if (config.cargosAdminIds && Array.isArray(config.cargosAdminIds)) {
          for (const roleId of config.cargosAdminIds) {
            permissionOverwrites.push({
              id: roleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ReadMessageHistory
              ]
            });
          }
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

        // Enviar log de criação de canal de farm
        const logEmbed = new EmbedBuilder()
          .setTitle('📂 PASTA DE FARM CRIADA 📂')
          .setColor(3066993)
          .setDescription(`O usuário <@${userId}> (${userId}) abriu uma nova pasta de farm.`)
          .addFields({ name: '📂 Canal Criado:', value: `${newChannel} (${newChannel.id})` })
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

        // F. Enviar embed de boas-vindas no novo canal
        const farmWelcomeEmbed = generateIndividualFarmEmbed(userId, recruta.nome);

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
          .setLabel('Apagar pasta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(btnAdd, btnMeta, btnDelete);

        const welcomeMsg = await newChannel.send({ content: `<@${userId}>`, embeds: [farmWelcomeEmbed], components: [row] });
        await welcomeMsg.pin().catch(() => null);

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

    // Botão Adicionar Farm (Membro)
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

    // Botão Confirmar Farm (Admin)
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
          return await interaction.reply({ content: '❌ Você não tem permissão para confirmar este farm!', ephemeral: true });
        }

        // Salvar farm no banco de dados local do perfil do usuário
        addConfirmedFarm(userId, {
          item: item,
          quantidade: quantidade,
          data: dataStr,
          confirmadoPor: interaction.user.id
        });

        // Atualizar o embed principal do canal
        await updateFarmChannelEmbed(interaction.client, interaction.channelId);

        // Adicionar reação ✅ na mensagem original
        await interaction.message.react('✅').catch(() => null);

        // Atualizar embed mostrando status confirmado
        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('✅ FARM CONFIRMADO ✅')
            .setColor(3066993)
            .setDescription(
              `👤 **Enviado por:** <@${userId}>\n` +
              `📦 **Recurso:** ${item}\n` +
              `🔢 **Quantidade:** ${quantidade}\n` +
              `📅 **Data:** ${dataStr}\n\n` +
              `✅ **Confirmado por:** <@${interaction.user.id}>`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('✅ FARM CONFIRMADO ✅')
            .setColor(3066993)
            .setDescription(
              `👤 **Enviado por:** <@${userId}>\n` +
              `📦 **Recurso:** ${item}\n` +
              `🔢 **Quantidade:** ${quantidade}\n` +
              `📅 **Data:** ${dataStr}\n\n` +
              `✅ **Confirmado por:** <@${interaction.user.id}>`
            );
        }

        const desconfirmBtn = new ButtonBuilder()
          .setCustomId(`farm_desconfirmar_btn_${userId}_${item}_${quantidade}_${dataStr}`)
          .setLabel('Desconfirmar Farm')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('↩️');

        const row = new ActionRowBuilder().addComponents(desconfirmBtn);

        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

        // Enviar log de confirmação de farm
        const logEmbed = new EmbedBuilder()
          .setTitle('✅ FARM CONFIRMADO ✅')
          .setColor(3066993)
          .setDescription(`O administrador <@${interaction.user.id}> confirmou o farm de <@${userId}>.`)
          .addFields(
            { name: '📦 Recurso:', value: item, inline: true },
            { name: '🔢 Quantidade:', value: quantidade, inline: true },
            { name: '📅 Data:', value: dataStr, inline: true }
          )
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao confirmar farm:', error);
        await interaction.reply({ content: 'Erro ao processar a confirmação do farm.', ephemeral: true });
      }
    }

    // Botão Desconfirmar Farm (Admin)
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
          return await interaction.reply({ content: '❌ Você não tem permissão para desconfirmar este farm!', ephemeral: true });
        }

        // Remover do banco
        removeConfirmedFarm(userId, item, quantidade, dataStr);

        // Atualizar o embed principal do canal
        await updateFarmChannelEmbed(interaction.client, interaction.channelId);

        // Remover reação ✅
        const reaction = interaction.message.reactions.cache.get('✅');
        if (reaction) {
          await reaction.users.remove(interaction.client.user.id).catch(() => null);
        }

        // Reverter embed
        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('🌾 NOVO FARM DECLARADO 🌾')
            .setColor(2326507)
            .setDescription(
              `👤 **Enviado por:** <@${userId}>\n` +
              `📦 **Recurso:** ${item}\n` +
              `🔢 **Quantidade:** ${quantidade}\n` +
              `📅 **Data:** ${dataStr}\n\n` +
              `Aguardando confirmação de um administrador.`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('🌾 NOVO FARM DECLARADO 🌾')
            .setColor(2326507)
            .setDescription(
              `👤 **Enviado por:** <@${userId}>\n` +
              `📦 **Recurso:** ${item}\n` +
              `🔢 **Quantidade:** ${quantidade}\n` +
              `📅 **Data:** ${dataStr}\n\n` +
              `Aguardando confirmação de um administrador.`
            );
        }

        // Reverter botão
        const confirmBtn = new ButtonBuilder()
          .setCustomId(`farm_confirmar_btn_${userId}_${item}_${quantidade}_${dataStr}`)
          .setLabel('Confirmar Farm')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✔️');

        const row = new ActionRowBuilder().addComponents(confirmBtn);

        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

        // Enviar log de desconfirmação de farm
        const logEmbed = new EmbedBuilder()
          .setTitle('↩️ FARM DESCONFIRMADO ↩️')
          .setColor(3447003)
          .setDescription(`O administrador <@${interaction.user.id}> desconfirmou o farm de <@${userId}>.`)
          .addFields(
            { name: '📦 Recurso:', value: item, inline: true },
            { name: '🔢 Quantidade:', value: quantidade, inline: true },
            { name: '📅 Data:', value: dataStr, inline: true }
          )
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao desconfirmar farm:', error);
        await interaction.reply({ content: 'Erro ao desconfirmar o farm.', ephemeral: true });
      }
    }

    // Botão Apagar Farm (Membro com permissão)
    if (customId === 'farm_apagar_declaracao_btn') {
      try {
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para apagar esta declaração!', ephemeral: true });
        }

        const originalEmbed = interaction.message.embeds[0];
        let desc = 'Uma declaração de farm pendente foi excluída.';
        if (originalEmbed && originalEmbed.description) {
          desc = `Uma declaração de farm pendente foi excluída por <@${interaction.user.id}>:\n${originalEmbed.description}`;
        }
        const logEmbed = new EmbedBuilder()
          .setTitle('🗑️ DECLARAÇÃO DE FARM APAGADA 🗑️')
          .setColor(15158332)
          .setDescription(desc)
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

        await interaction.deferUpdate();
        await interaction.message.delete().catch(() => null);
      } catch (error) {
        console.error('Erro ao apagar declaração de farm:', error);
      }
      return;
    }

    // Botão Bati a Meta (Membro) - Abre select de material
    if (customId === 'farm_bati_meta_btn') {
      try {
        const channelConfig = getFarmChannel(interaction.channelId);
        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Canal não registrado no sistema.', ephemeral: true });
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

    // Botão PAGAR META (Admin) - Abre Modal
    if (customId.startsWith('farm_pagar_meta_btn_')) {
      try {
        const parts = customId.replace('farm_pagar_meta_btn_', '').split('_');
        const donoId = parts[0];
        let item = parts[1];
        const targetMeta = parts[2] || '0';

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para gerenciar esta meta!', ephemeral: true });
        }

        // Tenta extrair o item do embed se não estiver no customId
        if (!item && interaction.message.embeds[0]) {
          const embed = interaction.message.embeds[0];
          if (embed.description) {
            const matchItem = embed.description.match(/📦 \*\*Recurso:\*\* ([^\n]+)/);
            if (matchItem) item = matchItem[1].trim();
          } else if (embed.fields && embed.fields.length > 0) {
            const fieldItem = embed.fields.find(f => f.name && f.name.includes('Recurso'));
            if (fieldItem) item = fieldItem.value.trim();
          }
        }

        const modal = new ModalBuilder()
          .setCustomId(`farm_pagar_meta_modal_${donoId}_${item || 'Outros'}_${targetMeta}`)
          .setTitle('💸 CONFIRMAR PAGAMENTO 💸');

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
        console.error('Erro ao abrir modal de pagamento:', error);
        await interaction.reply({ content: '❌ Erro ao processar o pagamento.', ephemeral: true });
      }
    }

    // Botão Desconfirmar Meta (Admin)
    if (customId.startsWith('farm_desconfirmar_meta_btn_')) {
      try {
        const parts = customId.replace('farm_desconfirmar_meta_btn_', '').split('_');
        const donoId = parts[0];
        let item = parts[1];

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para desconfirmar esta meta!', ephemeral: true });
        }

        const originalEmbed = interaction.message.embeds[0];
        let quantidade = '';
        let quantidadePaga = 0;
        let sobraAcumulada = 0;

        if (originalEmbed) {
          if (originalEmbed.fields && originalEmbed.fields.length > 0) {
            const fieldPaid = originalEmbed.fields.find(f => f.name && f.name.includes('Quantidade Paga'));
            if (fieldPaid) {
              quantidadePaga = parseInt(fieldPaid.value.replace(/`|un|\s/g, ''), 10) || 0;
            }
            const fieldSobra = originalEmbed.fields.find(f => f.name && f.name.includes('Sobra Acumulada'));
            if (fieldSobra) {
              sobraAcumulada = parseInt(fieldSobra.value.replace(/`|un|\s/g, ''), 10) || 0;
            }

            if (quantidadePaga > 0) {
              quantidade = String(quantidadePaga + sobraAcumulada);
            } else {
              const fieldProg = originalEmbed.fields.find(f => f.name && (f.name.includes('Progresso Total') || f.name.includes('Progresso Entregue')));
              if (fieldProg) quantidade = fieldProg.value.replace(/`|un|\s/g, '').trim();
            }

            if (!item) {
              const fieldItem = originalEmbed.fields.find(f => f.name && f.name.includes('Recurso'));
              if (fieldItem) item = fieldItem.value.replace(/\*\*|\*/g, '').trim();
            }
          } else if (originalEmbed.description) {
            const matchItem = originalEmbed.description.match(/📦 \*\*Recurso:\*\* ([^\n]+)/);
            if (matchItem && !item) item = matchItem[1].trim();
            const matchQtd = originalEmbed.description.match(/🔢 \*\*Quantidade:\*\* ([^\n]+)/) || originalEmbed.description.match(/🔢 \*\*Quantidade da Meta:\*\* ([^\n]+)/);
            if (matchQtd) quantidade = matchQtd[1].trim();
          }
        }

        // Remover do banco
        removePaidMeta(donoId);

        // Atualizar o embed principal do canal para restaurar o progresso
        await updateFarmChannelEmbed(interaction.client, interaction.channelId);

        // Remover reação 💸
        const reaction = interaction.message.reactions.cache.find(r => r.emoji.name === '💸');
        if (reaction) {
          await reaction.users.remove(interaction.client.user.id).catch(() => null);
        }

        // Reverter embed
        let timestamp = '';
        if (originalEmbed) {
          if (originalEmbed.description) {
            const match = originalEmbed.description.match(/📅 \*\*Data da Meta:\*\* ([^\n]+)/) || originalEmbed.description.match(/📅 \*\*Data\/Hora:\*\* ([^\n]+)/);
            if (match) timestamp = match[1];
          }
          if (!timestamp && originalEmbed.fields && originalEmbed.fields.length > 0) {
            const fieldTime = originalEmbed.fields.find(f => f.name && f.name.includes('Data'));
            if (fieldTime) timestamp = fieldTime.value.replace(/`/g, '').trim();
          }
        }
        if (!timestamp) {
          const msgDate = interaction.message.createdAt || new Date();
          timestamp = msgDate.toLocaleDateString('pt-BR') + ' às ' + msgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        const farmConfig = getGlobalFarmConfig() || { metas: {} };
        const metas = farmConfig.metas || {};
        const targetMeta = item ? (metas[item] || 0) : 0;

        const totalQtdVal = parseInt(quantidade || 0, 10);
        const revertedEmbed = new EmbedBuilder()
          .setTitle('✨ META BATIDA ✨')
          .setColor(3066993)
          .addFields(
            { name: '👤 Membro', value: `<@${donoId}>`, inline: true },
            { name: '📦 Recurso', value: item || 'Outros', inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '🔢 Quantidade da Meta', value: targetMeta > 0 ? `\`${targetMeta}\` un` : `\`${totalQtdVal}\` un`, inline: true },
            { name: '📊 Progresso Total', value: `\`${totalQtdVal}\` un`, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '📅 Data/Hora', value: timestamp, inline: true }
          )
          .setFooter({ text: `LuxBot Farm • criado por chegaheitor` });

        const extra = totalQtdVal > targetMeta && targetMeta > 0 ? (totalQtdVal - targetMeta) : 0;
        if (extra > 0) {
          revertedEmbed.addFields({ name: '🚀 Acúmulo Extra', value: `\`+${extra}\` un de **${item}** serão mantidos para a próxima meta!`, inline: false });
        }

        revertedEmbed.addFields({ name: '📝 Status', value: '⏳ Aguardando a confirmação do pagamento pelos administradores.', inline: false });

        const btnPagar = new ButtonBuilder()
          .setCustomId(`farm_pagar_meta_btn_${donoId}_${item || ''}_${targetMeta}`)
          .setLabel('Pagar Meta')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💸');

        const btnIncompleta = new ButtonBuilder()
          .setCustomId(`farm_meta_incompleta_btn_${donoId}_${item || ''}`)
          .setLabel('Meta Incompleta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚠️');

        const btnExcluir = new ButtonBuilder()
          .setCustomId('farm_excluir_meta_btn')
          .setLabel('Excluir Meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(btnPagar, btnIncompleta, btnExcluir);

        await interaction.update({
          content: null,
          embeds: [revertedEmbed],
          components: [row]
        });

        // Enviar log de desconfirmação de meta
        const logEmbed = new EmbedBuilder()
          .setTitle('↩️ PAGAMENTO DE META DESCONFIRMADO ↩️')
          .setColor(3447003)
          .setDescription(`O administrador <@${interaction.user.id}> desconfirmou o pagamento de meta de <@${donoId}>.`)
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao desconfirmar meta:', error);
        await interaction.reply({ content: 'Erro ao desconfirmar o pagamento da meta.', ephemeral: true });
      }
    }

    // Botão Voltar a Pendente (Admin)
    if (customId.startsWith('farm_voltar_pendente_meta_btn_')) {
      try {
        const parts = customId.replace('farm_voltar_pendente_meta_btn_', '').split('_');
        const donoId = parts[0];
        const item = parts[1];

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para redefinir esta meta!', ephemeral: true });
        }

        const originalEmbed = interaction.message.embeds[0];
        let revertedEmbed;

        const farmConfig = getGlobalFarmConfig() || { metas: {} };
        const metas = farmConfig.metas || {};
        const targetMeta = item ? (metas[item] || 0) : 0;

        if (originalEmbed) {
          const cleanFields = originalEmbed.fields.filter(f => 
            !f.name.includes('Status') && 
            !f.name.includes('Motivo') && 
            !f.name.includes('Por') && 
            !f.name.includes('Horário') &&
            !f.name.includes('⚠️')
          );
          
          revertedEmbed = new EmbedBuilder()
            .setTitle('✨ META BATIDA ✨')
            .setColor(3066993)
            .addFields(cleanFields)
            .addFields({ name: '📝 Status', value: '⏳ Aguardando a confirmação do pagamento pelos administradores.', inline: false })
            .setFooter({ text: `LuxBot Farm • criado por chegaheitor` });
        } else {
          revertedEmbed = new EmbedBuilder()
            .setTitle('✨ META BATIDA ✨')
            .setColor(3066993)
            .addFields(
              { name: '👤 Membro', value: `<@${donoId}>`, inline: true },
              { name: '📦 Recurso', value: item || 'Outros', inline: true },
              { name: '📝 Status', value: '⏳ Aguardando a confirmação do pagamento pelos administradores.', inline: false }
            )
            .setFooter({ text: `LuxBot Farm • criado por chegaheitor` });
        }

        const btnPagar = new ButtonBuilder()
          .setCustomId(`farm_pagar_meta_btn_${donoId}_${item || ''}_${targetMeta}`)
          .setLabel('Pagar Meta')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💸');

        const btnIncompleta = new ButtonBuilder()
          .setCustomId(`farm_meta_incompleta_btn_${donoId}_${item || ''}`)
          .setLabel('Meta Incompleta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚠️');

        const btnExcluir = new ButtonBuilder()
          .setCustomId('farm_excluir_meta_btn')
          .setLabel('Excluir Meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(btnPagar, btnIncompleta, btnExcluir);

        await interaction.update({
          content: null,
          embeds: [revertedEmbed],
          components: [row]
        });

        // Enviar log de meta restaurada
        const logEmbed = new EmbedBuilder()
          .setTitle('↩️ META RESTAURADA PARA PENDENTE ↩️')
          .setColor(3447003)
          .setDescription(`O administrador <@${interaction.user.id}> restaurou o status da meta de <@${donoId}> para pendente.`)
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao voltar meta para pendente:', error);
        await interaction.reply({ content: 'Erro ao redefinir status da meta.', ephemeral: true });
      }
    }

    // Botão Excluir Meta (Membro com permissão)
    if (customId === 'farm_excluir_meta_btn') {
      try {
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para excluir esta meta!', ephemeral: true });
        }

        const originalEmbed = interaction.message.embeds[0];
        let desc = 'Uma declaração de meta batida foi excluída.';
        if (originalEmbed && originalEmbed.description) {
          desc = `Uma declaração de meta batida foi excluída por <@${interaction.user.id}>:\n${originalEmbed.description}`;
        }
        const logEmbed = new EmbedBuilder()
          .setTitle('🗑️ DECLARAÇÃO DE META EXCLUÍDA 🗑️')
          .setColor(15158332)
          .setDescription(desc)
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);

        await interaction.deferUpdate();
        await interaction.message.delete().catch(() => null);
      } catch (error) {
        console.error('Erro ao excluir meta:', error);
      }
      return;
    }

    // Botão Meta Incompleta (Admin)
    if (customId.startsWith('farm_meta_incompleta_btn_')) {
      try {
        const parts = customId.replace('farm_meta_incompleta_btn_', '').split('_');
        const donoId = parts[0];
        const item = parts[1];

        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para gerenciar esta meta!', ephemeral: true });
        }

        // Abre modal para escrever o motivo
        const modal = new ModalBuilder()
          .setCustomId(`farm_meta_incompleta_modal_${donoId}_${item || ''}`)
          .setTitle('⚠️ Meta Incompleta ⚠️');

        const motivoInput = new TextInputBuilder()
          .setCustomId('motivo_input')
          .setLabel('MOTIVO DO ERRO')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explique o que está errado com a meta do farm...')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
        await interaction.showModal(modal);
      } catch (error) {
        console.error('Erro ao clicar em Meta Incompleta:', error);
        await interaction.reply({ content: 'Erro ao abrir formulário de erro de meta.', ephemeral: true });
      }
    }

    // Botão Apagar Pasta de Farm (Admin)
    if (customId === 'farm_apagar_pasta_btn') {
      try {
        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para apagar esta pasta!', ephemeral: true });
        }

        // Envia mensagem de confirmação apenas para quem clicou (ephemeral)
        const confirmBtn = new ButtonBuilder()
          .setCustomId('farm_confirmar_apagar_btn')
          .setLabel('Confirmar Exclusão da Pasta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(confirmBtn);

        await interaction.reply({
          content: '⚠️ **ATENÇÃO:** Você tem certeza de que deseja apagar esta pasta de farm? Todos os registros do canal serão excluídos.',
          components: [row],
          ephemeral: true
        });
      } catch (error) {
        console.error('Erro ao clicar em Apagar Pasta:', error);
        await interaction.reply({ content: 'Erro ao abrir confirmação de exclusão.', ephemeral: true });
      }
    }

    // Botão Confirmar Apagar Canal (Admin)
    if (customId === 'farm_confirmar_apagar_btn') {
      try {
        // Verificar permissão
        const channelConfig = getFarmChannel(interaction.channelId);
        const hasPermission = hasAdminPermission(interaction, channelConfig);

        if (!hasPermission) {
          return await interaction.reply({ content: '❌ Você não tem permissão para executar esta ação!', ephemeral: true });
        }

        // Enviar log antes de deletar o canal
        const donoMencao = channelConfig ? `<@${channelConfig.donoId}>` : 'Desconhecido';
        const logEmbed = new EmbedBuilder()
          .setTitle('🗑️ PASTA DE FARM EXCLUÍDA 🗑️')
          .setColor(15158332)
          .setDescription(`O administrador <@${interaction.user.id}> excluiu a pasta de farm de ${donoMencao}.`)
          .addFields({ name: '📁 Canal Excluído:', value: `${interaction.channel.name} (${interaction.channelId})` })
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

  // 2. Tratar menus de seleção
  if (interaction.isStringSelectMenu()) {
    if (customId === 'farm_adicionar_select') {
      try {
        const itemSelecionado = interaction.values[0];
        const channelConfig = getFarmChannel(interaction.channelId);

        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Pasta de farm não configurada no banco.', ephemeral: true });
        }

        // Abre modal para quantidade e data
        const modal = new ModalBuilder()
          .setCustomId(`farm_adicionar_modal_${itemSelecionado}`)
          .setTitle(`🌾 Adicionar Farm: ${itemSelecionado}`);

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
        await interaction.reply({ content: 'Erro ao abrir formulário de quantidade.', ephemeral: true });
      }
    }

    if (customId === 'farm_bati_meta_select') {
      try {
        const itemSelecionado = interaction.values[0];
        const channelConfig = getFarmChannel(interaction.channelId);

        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Pasta de farm não configurada no banco.', ephemeral: true });
        }

        // 1. Obter progresso acumulado (confirmado e não pago) deste recurso
        const recrutas = getRecrutas();
        const recruta = recrutas.find(r => r.discordId === channelConfig.donoId);
        const farms = recruta?.farms || [];
        const current = farms
          .filter(f => f.item.toLowerCase() === itemSelecionado.toLowerCase() && !f.pago)
          .reduce((sum, f) => sum + parseInt(f.quantidade || 0, 10), 0);

        if (current === 0) {
          return await interaction.reply({
            content: `❌ Você não possui nenhum farm confirmado e não pago de **${itemSelecionado}** para declarar meta batida!`,
            ephemeral: true
          });
        }

        // 2. Obter valor da meta global configurada
        const farmConfig = getGlobalFarmConfig() || { metas: {} };
        const metas = farmConfig.metas || {};
        const targetMeta = metas[itemSelecionado] || 0;

        // Salvar meta declarada no banco para estatísticas de perfil
        const now = new Date();
        const dataStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        addMetaDeclarada(channelConfig.donoId, interaction.user.tag, {
          item: itemSelecionado,
          quantidade: String(current),
          data: dataStr
        });

        // 3. Montar o embed público de meta batida
        const extra = current > targetMeta && targetMeta > 0 ? (current - targetMeta) : 0;

        const embed = new EmbedBuilder()
          .setTitle('✨ META BATIDA ✨')
          .setColor(3066993)
          .addFields(
            { name: '👤 Membro', value: `<@${channelConfig.donoId}>`, inline: true },
            { name: '📦 Recurso', value: itemSelecionado, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '🔢 Quantidade da Meta', value: targetMeta > 0 ? `\`${targetMeta}\` un` : `\`${current}\` un`, inline: true },
            { name: '📊 Progresso Total', value: `\`${current}\` un`, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '📅 Data/Hora', value: dataStr, inline: true }
          )
          .setFooter({ text: `LuxBot Farm • criado por chegaheitor` });

        if (extra > 0) {
          embed.addFields({ name: '🚀 Acúmulo Extra', value: `\`+${extra}\` un de **${itemSelecionado}** serão mantidos para a próxima meta!`, inline: false });
        }

        embed.addFields({ name: '📝 Status', value: '⏳ Aguardando a confirmação do pagamento pelos administradores.', inline: false });

        // Botão pagar meta carrega o targetMeta no final do customId para o addPaidMeta saber quanto descontar
        const btnPagar = new ButtonBuilder()
          .setCustomId(`farm_pagar_meta_btn_${channelConfig.donoId}_${itemSelecionado}_${targetMeta}`)
          .setLabel('Pagar Meta')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💸');

        const btnIncompleta = new ButtonBuilder()
          .setCustomId(`farm_meta_incompleta_btn_${channelConfig.donoId}_${itemSelecionado}`)
          .setLabel('Meta Incompleta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚠️');

        const btnExcluir = new ButtonBuilder()
          .setCustomId('farm_excluir_meta_btn')
          .setLabel('Excluir Meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(btnPagar, btnIncompleta, btnExcluir);

        // Envia mensagem pública no canal
        await interaction.channel.send({ embeds: [embed], components: [row] });

        // Responde de forma ephemeral à interação do menu
        await interaction.reply({
          content: `✅ Sua meta batida de **${itemSelecionado}** foi declarada publicamente no canal!`,
          ephemeral: true
        });

        // Enviar log de meta batida
        const logEmbed = new EmbedBuilder()
          .setTitle('✨ META BATIDA DECLARADA ✨')
          .setColor(3447003)
          .setDescription(`O usuário <@${channelConfig.donoId}> declarou que bateu a meta.`)
          .addFields(
            { name: '📦 Recurso:', value: itemSelecionado, inline: true },
            { name: '🔢 Quantidade:', value: String(current), inline: true },
            { name: '📅 Data/Hora:', value: dataStr, inline: true }
          )
          .setTimestamp();
        await sendLog(interaction.client, interaction.guild, 'registrofarm', logEmbed);

      } catch (error) {
        console.error('Erro ao processar select de meta:', error);
        await interaction.reply({ content: 'Erro ao declarar meta batida.', ephemeral: true }).catch(() => null);
      }
    }
  }

  // 3. Tratar submissão de modais
  if (interaction.isModalSubmit()) {

    // Modal de Adicionar Farm
    if (customId.startsWith('farm_adicionar_modal_')) {
      try {
        const item = customId.replace('farm_adicionar_modal_', '');
        const quantidade = interaction.fields.getTextInputValue('qtd_input').trim();
        const dataStr = interaction.fields.getTextInputValue('data_input');

        if (!/^\d+$/.test(quantidade)) {
          return await interaction.reply({
            content: '❌ A quantidade de farm deve ser um número inteiro válido (apenas dígitos).',
            ephemeral: true
          });
        }

        const channelConfig = getFarmChannel(interaction.channelId);
        if (!channelConfig) {
          return await interaction.reply({ content: 'Erro: Canal não cadastrado.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle('🌾 NOVO FARM DECLARADO 🌾')
          .setDescription(
            `👤 **Enviado por:** <@${channelConfig.donoId}>\n` +
            `📦 **Recurso:** ${item}\n` +
            `🔢 **Quantidade:** ${quantidade}\n` +
            `📅 **Data:** ${dataStr}\n\n` +
            `Aguardando confirmação de um administrador.`
          )
          .setColor(2326507)
          .setFooter({ text: `LuxBot Farm • criado por chegaheitor` });

        const confirmBtn = new ButtonBuilder()
          .setCustomId(`farm_confirmar_btn_${channelConfig.donoId}_${item}_${quantidade}_${dataStr}`)
          .setLabel('Confirmar Farm')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✔️');

        const deleteBtn = new ButtonBuilder()
          .setCustomId('farm_apagar_declaracao_btn')
          .setLabel('Apagar Farm')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(confirmBtn, deleteBtn);

        await interaction.reply({ embeds: [embed], components: [row] });

        // Enviar log de farm declarado
        const logEmbed = new EmbedBuilder()
          .setTitle('🌾 NOVO FARM DECLARADO 🌾')
          .setColor(3447003)
          .setDescription(`O usuário <@${channelConfig.donoId}> declarou um novo farm pendente.`)
          .addFields(
            { name: '📦 Recurso:', value: item, inline: true },
            { name: '🔢 Quantidade:', value: quantidade, inline: true },
            { name: '📅 Data:', value: dataStr, inline: true }
          )
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);
      } catch (error) {
        console.error('Erro ao enviar declaração de farm:', error);
        await interaction.reply({ content: 'Erro ao registrar declaração de farm.', ephemeral: true });
      }
    }

    // Modal de Pagamento de Meta (Confirmar Pagamento)
    if (customId.startsWith('farm_pagar_meta_modal_')) {
      try {
        const parts = customId.replace('farm_pagar_meta_modal_', '').split('_');
        const donoId = parts[0];
        const item = parts[1];
        const targetMeta = parts[2] || '0';
        const valor = interaction.fields.getTextInputValue('valor_input');
        const dataStr = interaction.fields.getTextInputValue('data_input');

        // Registrar meta paga no banco
        addPaidMeta(donoId, {
          pagoPor: interaction.user.id,
          valor: valor,
          data: dataStr,
          item: item,
          targetMeta: parseInt(targetMeta, 10)
        });

        // Atualizar o embed principal do canal
        await updateFarmChannelEmbed(interaction.client, interaction.channelId);

        // Reagir com 💸
        await interaction.message.react('💸').catch(() => null);

        // Obter data da mensagem original
        const msgDate = interaction.message.createdAt || new Date();
        const dataMensagem = msgDate.toLocaleDateString('pt-BR') + ' às ' + msgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const originalEmbed = interaction.message.embeds[0];
        let quantidade = '0';
        if (originalEmbed) {
          if (originalEmbed.fields && originalEmbed.fields.length > 0) {
            const fieldProg = originalEmbed.fields.find(f => f.name && (f.name.includes('Progresso Total') || f.name.includes('Progresso Entregue')));
            if (fieldProg) {
              quantidade = fieldProg.value.replace(/`|un|\s/g, '').trim();
            }
          } else if (originalEmbed.description) {
            const matchQtd = originalEmbed.description.match(/🔢 \*\*Quantidade:\*\* ([^\n]+)/) || originalEmbed.description.match(/🔢 \*\*Quantidade da Meta:\*\* ([^\n]+)/);
            if (matchQtd) quantidade = matchQtd[1].trim();
          }
        }

        const totalDelivered = parseInt(quantidade || 0, 10);
        const metaTargetVal = parseInt(targetMeta || 0, 10);
        
        let valorPagoMeta = totalDelivered;
        let sobraCarryOver = 0;
        
        if (metaTargetVal > 0 && totalDelivered > metaTargetVal) {
          valorPagoMeta = metaTargetVal;
          sobraCarryOver = totalDelivered - metaTargetVal;
        }

        const updatedEmbed = new EmbedBuilder()
          .setTitle('💸 META CONFIRMADA E PAGA 💸')
          .setColor(3066993)
          .addFields(
            { name: '👤 Membro', value: `<@${donoId}>`, inline: true },
            { name: '📦 Recurso', value: item || 'Outros', inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '🔢 Quantidade Paga', value: `\`${valorPagoMeta}\` un`, inline: true },
            { name: '💰 Valor do Pagamento', value: `\`${valor}\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '📊 Sobra Acumulada', value: sobraCarryOver > 0 ? `\`${sobraCarryOver}\` un (mantidos no inventário)` : '`0` un', inline: true },
            { name: '📅 Data da Meta', value: dataMensagem, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '💸 Pago Por', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📅 Data do Pagamento', value: dataStr, inline: true }
          )
          .setFooter({ text: `LuxBot Farm • criado por chegaheitor` });

        const desconfirmMetaBtn = new ButtonBuilder()
          .setCustomId(`farm_desconfirmar_meta_btn_${donoId}_${item || ''}`)
          .setLabel('Desconfirmar Meta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('↩️');

        const row = new ActionRowBuilder().addComponents(desconfirmMetaBtn);

        // Desativar botões e atualizar a mensagem
        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

        // Enviar log de pagamento de meta
        const logEmbed = new EmbedBuilder()
          .setTitle('💸 META CONFIRMADA E PAGA 💸')
          .setColor(3066993)
          .setDescription(`O administrador <@${interaction.user.id}> confirmou o pagamento da meta de <@${donoId}>.`)
          .addFields(
            { name: '📦 Recurso', value: item || 'Outros', inline: true },
            { name: '🔢 Qtd Paga', value: `\`${valorPagoMeta}\` un`, inline: true },
            { name: '💰 Valor do Pagamento', value: `\`${valor}\``, inline: true },
            { name: '📊 Sobra', value: sobraCarryOver > 0 ? `\`${sobraCarryOver}\` un` : '`0` un', inline: true },
            { name: '📅 Data do Pagamento', value: dataStr, inline: true }
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
        const parts = customId.replace('farm_meta_incompleta_modal_', '').split('_');
        const donoId = parts[0];
        const item = parts[1];
        const motivo = interaction.fields.getTextInputValue('motivo_input');

        const now = new Date();
        const timestamp = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const originalEmbed = interaction.message.embeds[0];
        let updatedEmbed;
        if (originalEmbed) {
          updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('⚠️ META INCOMPLETA ⚠️')
            .setColor(15158332)
            .setDescription(
              originalEmbed.description +
              `\n\n❌ **Marcada como Incompleta por:** <@${interaction.user.id}>\n` +
              `📝 **Motivo:** *${motivo}*\n` +
              `📅 **Data/Hora:** ${timestamp}`
            );
        } else {
          updatedEmbed = new EmbedBuilder()
            .setTitle('⚠️ META INCOMPLETA ⚠️')
            .setColor(15158332)
            .setDescription(
              `👤 **Membro:** <@${donoId}>\n` +
              `❌ **Marcada como Incompleta por:** <@${interaction.user.id}>\n` +
              `📝 **Motivo:** *${motivo}*\n` +
              `📅 **Data/Hora:** ${timestamp}`
            );
        }

        const voltarBtn = new ButtonBuilder()
          .setCustomId(`farm_voltar_pendente_meta_btn_${donoId}_${item || ''}`)
          .setLabel('Voltar a Pendente')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('↩️');

        const row = new ActionRowBuilder().addComponents(voltarBtn);

        // Desativar botões da mensagem de aprovação de meta
        await interaction.update({
          content: null,
          embeds: [updatedEmbed],
          components: [row]
        });

        // Responder ao admin de forma oculta (ephemeral)
        await interaction.followUp({
          content: `⚠️ Meta incompleta! Justificativa enviada.`,
          ephemeral: true
        });

        // Envia notificação simples no canal marcando o usuário dono da pasta
        await interaction.channel.send({
          content: `⚠️ <@${donoId}>, sua meta foi marcada como **incompleta/errada** por <@${interaction.user.id}>! Verifique o motivo no painel acima.`
        });

        // Enviar log de meta incompleta
        const logEmbed = new EmbedBuilder()
          .setTitle('⚠️ META MARCADA COMO INCOMPLETA ⚠️')
          .setColor(15158332)
          .setDescription(`O administrador <@${interaction.user.id}> marcou a meta de <@${donoId}> como incompleta.`)
          .addFields({ name: '📝 Motivo:', value: motivo })
          .setTimestamp();
        await sendLog(interaction.client, guild, 'registrofarm', logEmbed);
      } catch (error) {
        console.error('Erro ao enviar justificativa de meta errada:', error);
        await interaction.reply({ content: 'Erro ao processar erro de meta.', ephemeral: true });
      }
    }
  }
}

// Helpers para progresso visual de metas de farm
export function generateProgressBar(current, target) {
  if (target <= 0) return '';
  const pct = Math.min(100, Math.floor((current / target) * 100));
  const filled = Math.min(10, Math.max(0, Math.floor((current / target) * 10)));
  const empty = 10 - filled;
  return `\`${'▰'.repeat(filled) + '▱'.repeat(empty)}\` **${pct}%** (\`${current}/${target}\`)`;
}

export function generateIndividualFarmEmbed(donoId, donoNome) {
  const farmConfig = getGlobalFarmConfig() || { metas: {} };
  const metas = farmConfig.metas || {};
  const materials = getFarmMaterials();
  const recrutas = getRecrutas();
  const recruta = recrutas.find(r => r.discordId === donoId) || { farms: [] };
  const farms = recruta.farms || [];

  const lines = [];
  for (const mat of materials) {
    const target = metas[mat] || 0;
    const current = farms
      .filter(f => f.item.toLowerCase() === mat.toLowerCase() && !f.pago)
      .reduce((sum, f) => sum + parseInt(f.quantidade || 0, 10), 0);

    if (target > 0) {
      const bar = generateProgressBar(current, target);
      lines.push(`• **${mat}**: ${bar}`);
    } else {
      lines.push(`• **${mat}**: \`${current}\` un *(Sem Meta / Farm Livre)*`);
    }
  }

  return new EmbedBuilder()
    .setTitle(`📂 FARM: ${donoNome.toUpperCase()} 📂`)
    .setDescription(
      'Nesta pasta você irá colocar o farm que fizer.\n\n' +
      '**📊 Progresso de Farm Atual (Não Pago):**\n' +
      lines.join('\n')
    )
    .setColor(2326507)
    .setFooter({ text: `LuxBot Farm • criado por chegaheitor` });
}

export async function updateFarmChannelEmbed(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const channelConfig = getFarmChannel(channelId);
    if (!channelConfig) return;

    const donoId = channelConfig.donoId;
    const donoNome = channelConfig.donoNome;

    // Buscar nos pins primeiro
    const pins = await channel.messages.fetchPinned().catch(() => []);
    let welcomeMsg = pins.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.startsWith('📂 FARM:'));

    // Se não achar nos pins, buscar nas últimas mensagens
    if (!welcomeMsg) {
      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => []);
      welcomeMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.startsWith('📂 FARM:'));
      if (welcomeMsg) {
        // Pin it for future calls
        await welcomeMsg.pin().catch(() => null);
      }
    }

    if (!welcomeMsg) {
      console.warn(`Mensagem de boas-vindas não localizada no canal ${channelId}`);
      return;
    }

    const updatedEmbed = generateIndividualFarmEmbed(donoId, donoNome);
    await welcomeMsg.edit({ embeds: [updatedEmbed] }).catch(err => console.error('Erro ao editar mensagem de farm:', err));
  } catch (e) {
    console.error('Erro em updateFarmChannelEmbed:', e);
  }
}
