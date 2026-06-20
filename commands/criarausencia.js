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
import { getGlobalAusenciaConfig, addAusencia } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('criarausencia')
  .setDescription('Cria o painel de registro de ausências no canal configurado no /painelconfig.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const success = await criarPainelAusencia(interaction.client, interaction.guild);
    if (success) {
      await interaction.reply({
        content: '✅ Painel de ausências criado com sucesso no canal configurado!',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: '❌ Configurações de Ausência incompletas! Configure o canal no `/painelconfig` primeiro.',
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Erro ao executar o comando /criarausencia:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao criar o painel de ausências.',
      ephemeral: true
    }).catch(() => null);
  }
}

export async function criarPainelAusencia(client, guild) {
  try {
    const config = getGlobalAusenciaConfig();
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    if (!config || !config.canalId) return false;

    const canal = guild.channels.cache.get(config.canalId)
      || await guild.channels.fetch(config.canalId).catch(() => null);
    if (!canal || canal.type !== ChannelType.GuildText) return false;

    const welcomeEmbed = new EmbedBuilder()
      .setTitle('🔴 REGISTRO DE AUSÊNCIAS 🔴')
      .setDescription(
        'Use este painel para registrar a sua ausência do servidor.\n\n' +
        'Clique no botão **Registrar Ausência** abaixo para abrir o formulário.'
      )
      .setColor(15158332) // Vermelho
      .setFooter({ text: `LuxBot Ausência • ${dataAtual} • criado por chegaheitor` })
      .setTimestamp();

    const btnNovaAusencia = new ButtonBuilder()
      .setCustomId('ausencia_nova_btn')
      .setLabel('Registrar Ausência')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔴');

    const row = new ActionRowBuilder().addComponents(btnNovaAusencia);

    const msg = await canal.send({
      embeds: [welcomeEmbed],
      components: [row]
    });

    await msg.pin().catch(() => null);
    return true;
  } catch (error) {
    console.error('Erro ao criar painel de ausência:', error);
    return false;
  }
}

export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // 1. Botão Registrar Ausência clicado
  if (customId === 'ausencia_nova_btn') {
    try {
      const config = getGlobalAusenciaConfig();
      if (!config) {
        return await interaction.reply({
          content: '❌ Erro: Configuração de ausências não localizada no banco de dados.',
          ephemeral: true
        });
      }

      // Verificar permissão de cargos
      const hasPermission = (config.cargosPermitidosIds && config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId)))
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

      // Salvar ausência no banco de dados para estatísticas de perfil
      addAusencia(interaction.user.id, interaction.user.tag, {
        data: dataRetorno,
        motivo: motivo
      });

      const absenceEmbed = new EmbedBuilder()
        .setTitle('🔴 AUSÊNCIA REGISTRADA 🔴')
        .setDescription('Um membro registrou ausência temporária.')
        .addFields(
          { name: '👥 Membro:', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📅 Ausente até:', value: dataRetorno, inline: true },
          { name: '📝 Motivo:', value: motivo, inline: false },
          { name: 'ℹ️ Informações Extras:', value: extra, inline: false },
          { name: 'ℹ️ Status:', value: '🔴 Ausente', inline: true }
        )
        .setColor(15158332) // Vermelho
        .setFooter({ text: `LuxBot Ausência • ${dataAtual} • criado por chegaheitor` })
        .setTimestamp();

      const btnVoltou = new ButtonBuilder()
        .setCustomId(`ausencia_voltou_btn_${interaction.user.id}`)
        .setLabel('Voltei da Ausência')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🏢');

      const rowButtons = new ActionRowBuilder().addComponents(btnVoltou);

      // Envia o embed na sala em que o botão foi clicado
      await interaction.reply({
        embeds: [absenceEmbed],
        components: [rowButtons]
      });

      // Enviar log de nova ausência
      const logEmbed = new EmbedBuilder()
        .setTitle('🔴 Ausência Registrada')
        .setColor(15158332)
        .setDescription(`O membro <@${interaction.user.id}> registrou ausência.`)
        .addFields(
          { name: '👥 Membro:', value: `<@${interaction.user.id}>`, inline: true },
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
      const config = getGlobalAusenciaConfig();

      const hasPermission = interaction.user.id === ausenteUserId
        || (config && config.cargosPermitidosIds && config.cargosPermitidosIds.some(roleId => interaction.member.roles.cache.has(roleId)))
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
          return { name: 'ℹ️ Status:', value: '🏢 Ativo / De Volta', inline: true };
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
        .setTitle('🏢 RETORNO DE AUSÊNCIA 🏢')
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
        .setTitle('🏢 Retorno de Ausência')
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
