import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits 
} from 'discord.js';
import { getAdvConfig, removeWarning, getOrCreateRecruta } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('removeradv')
  .setDescription('Remove uma advertência ativa de um membro.')
  .addUserOption(option =>
    option.setName('membro')
      .setDescription('O membro de quem a advertência será removida')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('motivo')
      .setDescription('O motivo da remoção da advertência')
      .setRequired(true)
  );

export async function execute(interaction) {
  try {
    const config = getAdvConfig();

    if (!config) {
      return await interaction.reply({
        content: '❌ O sistema de advertências não está configurado! Peça para um administrador configurar usando o comando `/configadv`.',
        ephemeral: true
      });
    }

    const hasPermission = config.cargosStaffIds.some(roleId => interaction.member.roles.cache.has(roleId))
      || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasPermission) {
      return await interaction.reply({
        content: '❌ Você não tem cargo de Staff autorizado para remover advertências!',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('membro');
    const motivo = interaction.options.getString('motivo').trim();

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return await interaction.reply({
        content: '❌ Membro não encontrado no servidor!',
        ephemeral: true
      });
    }

    // Verificar se o usuário possui alguma advertência ativa
    const recruta = getOrCreateRecruta(targetUser.id, targetUser.tag);
    const activeWarnings = recruta.warnings ? recruta.warnings.filter(w => w.active) : [];

    if (activeWarnings.length === 0) {
      return await interaction.reply({
        content: `❌ O membro ${targetUser} não possui nenhuma advertência ativa para ser removida!`,
        ephemeral: true
      });
    }

    // Remove a advertência ativa no banco
    const activeCount = removeWarning(targetUser.id, interaction.user.id, motivo);

    // Gerenciamento de cargos
    const rolesToRemove = [];
    let roleToAddId = null;

    if (activeCount === 0) {
      rolesToRemove.push(config.cargo1Id, config.cargo2Id, config.cargo3Id);
    } else if (activeCount === 1) {
      roleToAddId = config.cargo1Id;
      rolesToRemove.push(config.cargo2Id, config.cargo3Id);
    } else if (activeCount === 2) {
      roleToAddId = config.cargo2Id;
      rolesToRemove.push(config.cargo1Id, config.cargo3Id);
    }

    // Aplicar alterações de cargos
    if (roleToAddId) {
      await member.roles.add(roleToAddId).catch(err => console.error('Erro ao adicionar cargo de advertência:', err));
    }
    for (const rId of rolesToRemove) {
      if (member.roles.cache.has(rId)) {
        await member.roles.remove(rId).catch(err => console.error('Erro ao remover cargo de advertência:', err));
      }
    }

    // Anúncio público no canal de advertências
    const channel = await interaction.guild.channels.fetch(config.canalId).catch(() => null);
    let roleName = 'Nenhum / Removido';
    if (roleToAddId) {
      const r = interaction.guild.roles.cache.get(roleToAddId);
      roleName = r ? `${r}` : 'Cargo Advertência';
    }

    const pubEmbed = new EmbedBuilder()
      .setTitle('✅ ADVERTÊNCIA REMOVIDA ✅')
      .setDescription(`Uma advertência de ${targetUser} foi removida pelo Staff.`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setColor(3066993) // Verde
      .addFields(
        { name: '👤 Membro Beneficiado:', value: `${targetUser} (${targetUser.id})`, inline: true },
        { name: '✍️ Removido por:', value: `<@${interaction.user.id}>`, inline: true },
        { name: '⚠️ Nível de Advertência Restante:', value: `**${activeCount} / 3**`, inline: true },
        { name: '📝 Motivo da Remoção:', value: motivo, inline: false },
        { name: '💼 Novo Cargo de Adv:', value: roleName, inline: true }
      )
      .setFooter({ text: 'Lux Advertências' })
      .setTimestamp();

    if (channel) {
      await channel.send({ embeds: [pubEmbed] }).catch(() => null);
    }

    // Responder de forma privada para o executor
    await interaction.reply({
      content: `✅ Advertência removida com sucesso de ${targetUser}! Nível atual: **${activeCount} / 3**.`,
      ephemeral: true
    });

    // Enviar log de remoção de advertência
    const logEmbed = new EmbedBuilder()
      .setTitle('✅ Advertência Removida')
      .setColor(3066993)
      .setDescription(`<@${interaction.user.id}> removeu uma advertência de ${targetUser}.`)
      .addFields(
        { name: '👤 Advertido:', value: `${targetUser}`, inline: true },
        { name: '🔢 Advertências Ativas:', value: `**${activeCount} / 3**`, inline: true },
        { name: '📝 Motivo da Remoção:', value: motivo, inline: false }
      )
      .setTimestamp();

    await sendLog(interaction.client, interaction.guild, 'removeradv', logEmbed);

  } catch (error) {
    console.error('Erro ao remover advertência:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao remover a advertência.',
      ephemeral: true
    }).catch(() => null);
  }
}
