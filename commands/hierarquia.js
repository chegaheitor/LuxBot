import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('hierarquia')
  .setDescription('Mostra a hierarquia de cargos do servidor e seus respectivos membros.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    // Garantir permissão
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ Apenas administradores podem usar este comando.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const guild = interaction.guild;

    // Buscar todos os membros para garantir que a cache de cargos esteja completa
    console.log('Buscando membros para montar hierarquia...');
    await guild.members.fetch();

    // Pegar e ordenar cargos
    const roles = [...guild.roles.cache.values()]
      .filter(role => role.id !== guild.id && !role.managed) // Ignora @everyone e cargos de integração
      .sort((a, b) => b.position - a.position);

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const embed = new EmbedBuilder()
      .setTitle('👑 HIERARQUIA DE CARGOS - LUX 👑')
      .setDescription('Lista de todos os cargos do servidor por ordem hierárquica e seus membros atuais:')
      .setColor(2326507)
      .setFooter({ text: `LuxBot Hierarquia • ${dataAtual} • criado por chegaheitor` })
      .setTimestamp();

    let totalChars = embed.data.title.length + embed.data.description.length;
    let fieldsCount = 0;

    for (const role of roles) {
      if (fieldsCount >= 25) {
        embed.addFields({
          name: '⚠️ Limite Atingido',
          value: '*Existem mais cargos cadastrados, mas o Discord limita a exibição a 25 campos.*'
        });
        break;
      }

      // Filtrar membros do cargo
      const roleMembers = [...role.members.values()];
      const memberList = roleMembers.map(m => `<@${m.id}>`).join(' ') || '*Nenhum membro*';

      // Verificar tamanho do valor do campo (limite de 1024 caracteres por campo)
      let fieldValue = memberList;
      if (fieldValue.length > 1020) {
        fieldValue = fieldValue.slice(0, 1010) + '... (e outros)';
      }

      const fieldName = `${role.name} (${roleMembers.length})`;
      const fieldChars = fieldName.length + fieldValue.length;

      // Verificar limite total de 6000 caracteres no embed
      if (totalChars + fieldChars > 5800) {
        embed.addFields({
          name: '⚠️ Limite Excedido',
          value: '*Alguns cargos inferiores foram omitidos para respeitar os limites de tamanho do Discord.*'
        });
        break;
      }

      embed.addFields({ name: fieldName, value: fieldValue, inline: false });
      totalChars += fieldChars;
      fieldsCount++;
    }

    await interaction.editReply({ embeds: [embed] });

    // Enviar log do comando
    const logEmbed = new EmbedBuilder()
      .setTitle('👑 Hierarquia Consultada')
      .setColor(3447003)
      .setDescription(`O administrador <@${interaction.user.id}> executou o comando \`/hierarquia\`.`)
      .setTimestamp();

    await sendLog(interaction.client, guild, 'hierarquia', logEmbed);

  } catch (error) {
    console.error('Erro ao executar o comando /hierarquia:', error);
    await interaction.editReply({
      content: '❌ Ocorreu um erro ao gerar o painel de hierarquia.'
    }).catch(() => null);
  }
}
