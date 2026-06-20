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
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const config = getAdvConfig();

    if (!config) {
      return await interaction.reply({
        content: '❌ O sistema de advertências não está configurado! Peça para um administrador configurar no `/painelconfig`.',
        ephemeral: true
      });
    }

    const hasPermission = (config.cargosStaffIds && Array.isArray(config.cargosStaffIds) && config.cargosStaffIds.some(roleId => interaction.member.roles.cache.has(roleId)))
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
    const getRolesForLevel = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return [val];
    };

    const rolesLevel1 = getRolesForLevel(config.cargo1Id);
    const rolesLevel2 = getRolesForLevel(config.cargo2Id);
    const rolesLevel3 = getRolesForLevel(config.cargo3Id);

    let rolesToAdd = [];
    let rolesToRemove = [];

    if (activeCount === 0) {
      rolesToRemove = [...rolesLevel1, ...rolesLevel2, ...rolesLevel3];
    } else if (activeCount === 1) {
      rolesToAdd = rolesLevel1;
      rolesToRemove = [...rolesLevel2, ...rolesLevel3];
    } else if (activeCount === 2) {
      rolesToAdd = rolesLevel2;
      rolesToRemove = [...rolesLevel1, ...rolesLevel3];
    }

    // Aplicar alterações de cargos
    for (const rId of rolesToAdd) {
      if (rId && !member.roles.cache.has(rId)) {
        await member.roles.add(rId).catch(err => console.error('Erro ao adicionar cargo de advertência:', err));
      }
    }
    for (const rId of rolesToRemove) {
      if (rId && member.roles.cache.has(rId)) {
        await member.roles.remove(rId).catch(err => console.error('Erro ao remover cargo de advertência:', err));
      }
    }

    // Anúncio público no canal de advertências
    const channel = await interaction.guild.channels.fetch(config.canalId).catch(() => null);
    let roleName = 'Nenhum / Removido';
    if (rolesToAdd.length > 0) {
      roleName = rolesToAdd.map(rId => {
        const r = interaction.guild.roles.cache.get(rId);
        return r ? `${r}` : 'Cargo Advertência';
      }).join(', ');
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
      .setFooter({ text: `LuxBot Remover ADV • ${dataAtual} • criado por chegaheitor` })
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
      .setTitle('✅ ADVERTÊNCIA REMOVIDA ✅')
      .setColor(3066993)
      .setDescription(`<@${interaction.user.id}> removeu uma advertência de ${targetUser}.`)
      .addFields(
        { name: '👤 Advertido:', value: `${targetUser}`, inline: true },
        { name: '🔢 Advertências Ativas:', value: `**${activeCount} / 3**`, inline: true },
        { name: '📝 Motivo da Remoção:', value: motivo, inline: false }
      )
      .setFooter({ text: `LuxBot Remover ADV • ${dataAtual} • criado por chegaheitor` })
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
