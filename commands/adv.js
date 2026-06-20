import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits 
} from 'discord.js';
import { getAdvConfig, addWarning } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('adv')
  .setDescription('Aplica uma advertência oficial a um membro.')
  .addUserOption(option =>
    option.setName('membro')
      .setDescription('O membro que receberá a advertência')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('motivo')
      .setDescription('O motivo da advertência')
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
        content: '❌ Você não tem cargo de Staff autorizado para aplicar advertências!',
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

    // Adiciona advertência no banco de dados e calcula nova contagem ativa
    const activeCount = addWarning(targetUser.id, targetUser.tag, {
      reason: motivo,
      authorId: interaction.user.id
    });

    // Gerenciamento de cargos
    const rolesToRemove = [];
    let roleToAddId = null;

    if (activeCount === 1) {
      roleToAddId = config.cargo1Id;
      rolesToRemove.push(config.cargo2Id, config.cargo3Id);
    } else if (activeCount === 2) {
      roleToAddId = config.cargo2Id;
      rolesToRemove.push(config.cargo1Id, config.cargo3Id);
    } else if (activeCount >= 3) {
      roleToAddId = config.cargo3Id;
      rolesToRemove.push(config.cargo1Id, config.cargo2Id);
    }

    // Aplicar alterações de cargos
    if (roleToAddId) {
      await member.roles.add(roleToAddId).catch(err => console.error('Erro ao adicionar cargo de advertência:', err));
    }
    for (const rId of rolesToRemove) {
      if (member.roles.cache.has(rId)) {
        await member.roles.remove(rId).catch(err => console.error('Erro ao remover cargo de advertência anterior:', err));
      }
    }

    // Anúncio público no canal de advertências
    const channel = await interaction.guild.channels.fetch(config.canalId).catch(() => null);
    let roleName = 'Nenhum';
    if (roleToAddId) {
      const r = interaction.guild.roles.cache.get(roleToAddId);
      roleName = r ? `${r}` : 'Cargo Advertência';
    }

    const pubEmbed = new EmbedBuilder()
      .setTitle('⚠️ ADVERTÊNCIA APLICADA ⚠️')
      .setDescription(`O membro ${targetUser} recebeu uma advertência oficial no servidor.`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setColor(15158332) // Vermelho
      .addFields(
        { name: '👤 Membro Advertido:', value: `${targetUser} (${targetUser.id})`, inline: true },
        { name: '✍️ Aplicado por:', value: `<@${interaction.user.id}>`, inline: true },
        { name: '⚠️ Nível de Advertência:', value: `**${activeCount} / 3**`, inline: true },
        { name: '📝 Motivo:', value: motivo, inline: false },
        { name: '💼 Cargo Recebido:', value: roleName, inline: true }
      )
      .setFooter({ text: 'Lux Advertências' })
      .setTimestamp();

    if (channel) {
      await channel.send({ embeds: [pubEmbed] }).catch(() => null);
    }

    // Responder de forma privada para o executor
    await interaction.reply({
      content: `✅ Advertência aplicada com sucesso para ${targetUser}! Nível atual: **${activeCount} / 3**.`,
      ephemeral: true
    });

    // Enviar log de advertência
    const logEmbed = new EmbedBuilder()
      .setTitle('⚠️ Advertência Aplicada')
      .setColor(15158332)
      .setDescription(`<@${interaction.user.id}> aplicou uma advertência em ${targetUser}.`)
      .addFields(
        { name: '👤 Advertido:', value: `${targetUser}`, inline: true },
        { name: '🔢 Advertências Ativas:', value: `**${activeCount} / 3**`, inline: true },
        { name: '📝 Motivo:', value: motivo, inline: false }
      )
      .setTimestamp();

    await sendLog(interaction.client, interaction.guild, 'adv', logEmbed);

  } catch (error) {
    console.error('Erro ao aplicar advertência:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao aplicar a advertência.',
      ephemeral: true
    }).catch(() => null);
  }
}
