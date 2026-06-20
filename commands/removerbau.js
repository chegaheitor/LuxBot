import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder 
} from 'discord.js';
import { getBaus, getBau, deleteBau } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('removerbau')
  .setDescription('Apaga um baú criado, deleta sua mensagem e remove tudo do banco de dados.')
  .addStringOption(option =>
    option.setName('bau')
      .setDescription('Selecione o baú a ser removido')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function autocomplete(interaction) {
  try {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const baus = getBaus();

    const filtered = baus.filter(b => b.nome.toLowerCase().includes(focusedValue));

    const options = filtered.slice(0, 25).map(b => {
      const channel = interaction.guild.channels.cache.get(b.canalId);
      const channelName = channel ? `#${channel.name}` : `Canal ID: ${b.canalId}`;
      return {
        name: `${b.nome} (${channelName})`,
        value: b.messageId
      };
    });

    await interaction.respond(options);
  } catch (error) {
    console.error('Erro no autocomplete de removerbau:', error);
    await interaction.respond([]).catch(() => null);
  }
}

export async function execute(interaction) {
  try {
    // Somente administradores podem usar
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ Somente membros com a permissão de Administrador podem utilizar este comando!',
        ephemeral: true
      });
    }

    const messageId = interaction.options.getString('bau');
    const chest = getBau(messageId);

    if (!chest) {
      return await interaction.reply({
        content: '❌ O baú selecionado não foi localizado no banco de dados!',
        ephemeral: true
      });
    }

    // Deletar a mensagem do baú no Discord se ela existir
    const channel = await interaction.guild.channels.fetch(chest.canalId).catch(() => null);
    let msgDeletada = false;
    if (channel) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) {
        await msg.delete().catch(err => console.error('Erro ao deletar mensagem do baú:', err));
        msgDeletada = true;
      }
    }

    // Remover do banco de dados
    deleteBau(messageId);

    // Enviar log de exclusão
    const logEmbed = new EmbedBuilder()
      .setTitle('🗑️ Baú Removido')
      .setColor(15158332) // Vermelho
      .setDescription(`O administrador <@${interaction.user.id}> removeu completamente o baú **${chest.nome}**.`)
      .addFields(
        { name: '📦 Nome do Baú:', value: chest.nome, inline: true },
        { name: '📢 Canal de Origem:', value: `<#${chest.canalId}>`, inline: true },
        { name: '✉️ Mensagem Deletada:', value: msgDeletada ? 'Sim' : 'Não (Mensagem não localizada/deletada manualmente)', inline: true }
      )
      .setTimestamp();

    await sendLog(interaction.client, interaction.guild, 'registrobau', logEmbed);

    await interaction.reply({
      content: `✅ O baú **${chest.nome}** foi removido com sucesso e seus dados foram excluídos do banco de dados!`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Erro ao executar o comando /removerbau:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao remover o baú.',
      ephemeral: true
    }).catch(() => null);
  }
}
