import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} from 'discord.js';
import { getRecrutas, getGlobalRecrutamentoConfig } from '../database.js';

export const data = new SlashCommandBuilder()
  .setName('listamembros')
  .setDescription('Painel de auditoria de membros da equipe (cadastrados vs não cadastrados).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const config = getGlobalRecrutamentoConfig();
    
    // Verificar permissão (Administrador ou Staff de Recrutamento)
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      (config && config.cargosStaffIds && Array.isArray(config.cargosStaffIds) && config.cargosStaffIds.some(roleId => interaction.member.roles.cache.has(roleId)));

    if (!isStaff) {
      return await interaction.reply({
        content: '❌ Você não tem permissão de Staff de Recrutamento para usar este comando!',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('👥 AUDITORIA E LISTA DE MEMBROS 👥')
      .setDescription(
        'Use os botões abaixo para consultar o status de cadastro dos membros da equipe:\n\n' +
        '🟢 **Membros da Equipe:** Exibe os membros aceitos e registrados no banco de dados.\n' +
        '🔴 **Não Cadastrados:** Lista os membros no servidor que ainda não realizaram o processo de recrutamento.'
      )
      .setColor(3447003)
      .setTimestamp();

    const btnEquipe = new ButtonBuilder()
      .setCustomId('listamembros_equipe')
      .setLabel('Membros da Equipe')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🟢');

    const btnSemCadastro = new ButtonBuilder()
      .setCustomId('listamembros_sem_cadastro')
      .setLabel('Não Cadastrados')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔴');

    const row = new ActionRowBuilder().addComponents(btnEquipe, btnSemCadastro);

    await interaction.reply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Erro ao executar /listamembros:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao abrir a auditoria de membros.',
      ephemeral: true
    }).catch(() => null);
  }
}

// Tratar as interações de botões (Membros Cadastrados vs Sem Cadastro)
export async function handleInteraction(interaction) {
  const { customId, guild } = interaction;

  if (!interaction.isButton()) return;

  const config = getGlobalRecrutamentoConfig();
  const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
    (config && config.cargosStaffIds && Array.isArray(config.cargosStaffIds) && config.cargosStaffIds.some(roleId => interaction.member.roles.cache.has(roleId)));

  if (!isStaff) {
    return await interaction.reply({
      content: '❌ Você não tem cargo autorizado para ver esta listagem!',
      ephemeral: true
    });
  }

  try {
    if (customId === 'listamembros_equipe') {
      const recrutas = getRecrutas().filter(r => r.status === 'ACEITO');

      if (recrutas.length === 0) {
        return await interaction.reply({
          content: '❌ Nenhum membro cadastrado e aprovado no banco de dados atualmente.',
          ephemeral: true
        });
      }

      const lines = recrutas.map((r, i) => `${i + 1}. **${r.nome}** | ID: \`${r.gameId}\` (<@${r.discordId}>)`);
      const maxCount = 80;
      const displayed = lines.slice(0, maxCount).join('\n');
      const suffix = lines.length > maxCount ? `\n\n*... e mais ${lines.length - maxCount} membros.*` : '';

      const embed = new EmbedBuilder()
        .setTitle('🟢 MEMBROS DA EQUIPE (CADASTRADOS)')
        .setDescription(`Lista de recrutas ativos e aprovados no banco de dados:\n\n${displayed}${suffix}`)
        .addFields({ name: '📊 Total de Cadastrados:', value: `\`${recrutas.length}\` membros` })
        .setColor(3066993)
        .setTimestamp();

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'listamembros_sem_cadastro') {
      await interaction.deferReply({ ephemeral: true });

      const allMembers = await guild.members.fetch();
      const dbRecrutasIds = new Set(getRecrutas().filter(r => r.status === 'ACEITO').map(r => r.discordId));
      const cargoRetirarId = config?.cargoRetirarId;

      let unregistered = allMembers.filter(m => !m.user.bot);

      if (cargoRetirarId) {
        unregistered = unregistered.filter(m => m.roles.cache.has(cargoRetirarId));
      }

      unregistered = unregistered.filter(m => !dbRecrutasIds.has(m.id));

      if (unregistered.size === 0) {
        return await interaction.editReply({
          content: '✅ Todos os membros aptos já realizaram o recrutamento e estão cadastrados!'
        });
      }

      const lines = Array.from(unregistered.values()).map((m, i) => `${i + 1}. <@${m.id}> - \`${m.user.tag}\` (Nome: *${m.displayName}*)`);
      const maxCount = 80;
      const displayed = lines.slice(0, maxCount).join('\n');
      const suffix = lines.length > maxCount ? `\n\n*... e mais ${lines.length - maxCount} membros.*` : '';

      const description = cargoRetirarId 
        ? `Membros com o cargo <@&${cargoRetirarId}> que **não possuem** recrutamento no banco:\n\n${displayed}${suffix}`
        : `Membros do servidor que **não possuem** recrutamento no banco:\n\n${displayed}${suffix}`;

      const embed = new EmbedBuilder()
        .setTitle('🔴 MEMBROS NÃO CADASTRADOS')
        .setDescription(description)
        .addFields({ name: '📊 Total Pendente:', value: `\`${unregistered.size}\` membros` })
        .setColor(15158332)
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Erro ao processar listagem de membros:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: '❌ Ocorreu um erro ao gerar a listagem.' }).catch(() => null);
    } else {
      await interaction.reply({ content: '❌ Ocorreu um erro ao gerar a listagem.', ephemeral: true }).catch(() => null);
    }
  }
}
