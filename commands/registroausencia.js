import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ChannelType 
} from 'discord.js';
import { saveAusenciaPanel, getAusenciaPanel } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('registroausencia')
  .setDescription('Envia o painel de registro de ausências para o canal selecionado.')
  .addChannelOption(option =>
    option.setName('canal')
      .setDescription('O canal de texto onde as ausências serão registradas')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addRoleOption(option =>
    option.setName('cargo_1')
      .setDescription('Cargo autorizado a registrar ausências')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_2')
      .setDescription('Segundo cargo autorizado a registrar ausências (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_3')
      .setDescription('Terceiro cargo autorizado a registrar ausências (opcional)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const canal = interaction.options.getChannel('canal');
    const role1 = interaction.options.getRole('cargo_1');
    const role2 = interaction.options.getRole('cargo_2');
    const role3 = interaction.options.getRole('cargo_3');

    if (canal.type !== ChannelType.GuildText) {
      return await interaction.reply({
        content: '❌ O canal selecionado precisa ser um canal de texto padrão!',
        ephemeral: true
      });
    }

    const cargosPermitidosIds = [role1.id];
    if (role2) cargosPermitidosIds.push(role2.id);
    if (role3) cargosPermitidosIds.push(role3.id);

    // Salvar configuração no banco
    saveAusenciaPanel({
      canalId: canal.id,
      cargosPermitidosIds: cargosPermitidosIds
    });

    const welcomeEmbed = new EmbedBuilder()
      .setTitle('🔴 REGISTRO DE AUSÊNCIAS 🔴')
      .setDescription(
        'Use este painel para registrar suas ausências temporárias na corporação.\n\n' +
        'Clique no botão **Registrar Ausência** abaixo para abrir o formulário.'
      )
      .setColor(15158332) // Vermelho
      .setFooter({ text: 'Lux Ausências • Bot por chegaheitor' })
      .setTimestamp();

    const btnNovaAusencia = new ButtonBuilder()
      .setCustomId('ausencia_registrar_btn')
      .setLabel('Registrar Ausência')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('📝');

    const row = new ActionRowBuilder().addComponents(btnNovaAusencia);

    // Enviar a mensagem do painel no canal configurado
    await canal.send({
      embeds: [welcomeEmbed],
      components: [row]
    });

    await interaction.reply({
      content: `✅ Painel de ausências configurado com sucesso no canal ${canal}!`,
      ephemeral: true
    });

    // Enviar log de configuração de ausência
    const logEmbed = new EmbedBuilder()
      .setTitle('⚙️ Painel de Ausência Configurado')
      .setColor(3066993)
      .setDescription(`O administrador <@${interaction.user.id}> configurou o painel de ausências no canal ${canal}.`)
      .addFields({
        name: '💼 Cargos Autorizados:',
        value: cargosPermitidosIds.map(id => `<@&${id}>`).join(', ')
      })
      .setTimestamp();

    await sendLog(interaction.client, interaction.guild, 'registroausencia', logEmbed);

  } catch (error) {
    console.error('Erro ao executar o comando /registroausencia:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao configurar o painel de ausências.',
      ephemeral: true
    });
  }
}

// Trata as interações iniciadas por ausencia_
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const channelId = interaction.channel.id;

  // 1. Botão Registrar Ausência clicado
  if (customId === 'ausencia_registrar_btn') {
    try {
      const config = getAusenciaPanel(channelId);
      if (!config) {
        return await interaction.reply({
          content: '❌ Erro: Configuração de ausências deste canal não localizada no banco de dados.',
          ephemeral: true
        });
      }

      // Verificar permissão de cargos
      const hasPermission = config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId))
        || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Você não tem um cargo autorizado para registrar ausências!',
          ephemeral: true
        });
      }

      // Abrir modal de ausência
      const modal = new ModalBuilder()
        .setCustomId('ausencia_registrar_modal')
        .setTitle('🔴 Registrar Ausência');

      const motivoInput = new TextInputBuilder()
        .setCustomId('motivo_input')
        .setLabel('MOTIVO DA AUSÊNCIA')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ex: Férias, viagem, problemas de saúde, provas da faculdade...')
        .setRequired(true);

      const dataInput = new TextInputBuilder()
        .setCustomId('data_input')
        .setLabel('ATÉ QUANDO (DATA DE RETORNO)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: DD/MM/AAAA ou 15 dias')
        .setRequired(true);

      const extraInput = new TextInputBuilder()
        .setCustomId('extra_input')
        .setLabel('INFORMAÇÕES EXTRAS (OPCIONAL)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Informações adicionais que os administradores devem saber...')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(motivoInput),
        new ActionRowBuilder().addComponents(dataInput),
        new ActionRowBuilder().addComponents(extraInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Erro ao abrir modal de ausência:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao abrir o formulário de ausência.',
        ephemeral: true
      });
    }
    return;
  }

  // 2. Modal Submetido
  if (customId === 'ausencia_registrar_modal') {
    try {
      const motivo = interaction.fields.getTextInputValue('motivo_input').trim();
      const dataRetorno = interaction.fields.getTextInputValue('data_input').trim();
      const extra = interaction.fields.getTextInputValue('extra_input').trim() || 'Nenhuma';

      const absenceEmbed = new EmbedBuilder()
        .setTitle('🔴 AUSÊNCIA REGISTRADA 🔴')
        .setDescription('Um membro registrou ausência temporária.')
        .addFields(
          { name: '👤 Membro:', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📅 Ausente até:', value: dataRetorno, inline: true },
          { name: '📝 Motivo:', value: motivo, inline: false },
          { name: 'ℹ️ Informações Extras:', value: extra, inline: false },
          { name: 'ℹ️ Status:', value: '🔴 Ausente', inline: true }
        )
        .setColor(15158332) // Vermelho
        .setFooter({ text: 'Lux Ausências' })
        .setTimestamp();

      const btnVoltou = new ButtonBuilder()
        .setCustomId(`ausencia_voltou_btn_${interaction.user.id}`)
        .setLabel('Voltei da Ausência')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🟢');

      const rowButtons = new ActionRowBuilder().addComponents(btnVoltou);

      // Envia o embed na sala em que o botão foi clicado
      const message = await interaction.reply({
        embeds: [absenceEmbed],
        components: [rowButtons],
        fetchReply: true
      });

      // Enviar log de nova ausência
      const logEmbed = new EmbedBuilder()
        .setTitle('🔴 Ausência Registrada')
        .setColor(15158332)
        .setDescription(`O membro <@${interaction.user.id}> registrou ausência.`)
        .addFields(
          { name: '👤 Membro:', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📅 Ausente até:', value: dataRetorno, inline: true },
          { name: '📝 Motivo:', value: motivo, inline: false }
        )
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroausencia', logEmbed);

    } catch (error) {
      console.error('Erro ao processar modal de ausência:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao processar o registro da sua ausência.',
        ephemeral: true
      });
    }
    return;
  }

  // 3. Botão Voltei da Ausência clicado
  if (customId.startsWith('ausencia_voltou_btn_')) {
    try {
      const ausenteUserId = customId.replace('ausencia_voltou_btn_', '');
      const config = getAusenciaPanel(channelId);

      const hasPermission = interaction.user.id === ausenteUserId
        || (config && config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId)))
        || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return await interaction.reply({
          content: '❌ Apenas o próprio membro ausente, cargos autorizados ou administradores podem registrar o retorno!',
          ephemeral: true
        });
      }

      const originalEmbed = interaction.message.embeds[0];
      if (!originalEmbed) {
        return await interaction.reply({
          content: '❌ Erro: Não foi possível obter o embed original.',
          ephemeral: true
        });
      }

      // Reformatar os campos e atualizar o status
      const updatedFields = originalEmbed.fields.map(field => {
        if (field.name.toLowerCase().includes('status')) {
          return { name: 'ℹ️ Status:', value: '🟢 Ativo / De Volta', inline: true };
        }
        return field;
      });

      const now = new Date();
      const retornoStr = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Horário de Brasília)';

      updatedFields.push({
        name: '✅ Retornou em:',
        value: `${retornoStr} por <@${interaction.user.id}>`,
        inline: false
      });

      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setTitle('🟢 RETORNO DE AUSÊNCIA 🟢')
        .setDescription('O membro retornou e está ativo novamente.')
        .setFields(updatedFields)
        .setColor(3066993) // Verde
        .setTimestamp();

      await interaction.update({
        embeds: [updatedEmbed],
        components: [] // Remove o botão voltei da ausência
      });

      // Enviar log de retorno de ausência
      const logEmbed = new EmbedBuilder()
        .setTitle('🟢 Retorno de Ausência')
        .setColor(3066993)
        .setDescription(`O membro <@${ausenteUserId}> retornou da sua ausência.`)
        .addFields({
          name: '✍️ Registrado por:',
          value: `<@${interaction.user.id}>`,
          inline: true
        })
        .setTimestamp();

      await sendLog(interaction.client, guild, 'registroausencia', logEmbed);

    } catch (error) {
      console.error('Erro ao processar retorno de ausência:', error);
      await interaction.reply({
        content: '❌ Ocorreu um erro ao processar seu retorno de ausência.',
        ephemeral: true
      }).catch(() => null);
    }
    return;
  }
}
