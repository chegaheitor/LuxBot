import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ChannelType 
} from 'discord.js';
import { saveAdvConfig } from '../database.js';
import { sendLog } from '../logs.js';

export const data = new SlashCommandBuilder()
  .setName('configadv')
  .setDescription('Configura o canal de avisos, os cargos de advertência e cargos de Staff autorizados.')
  .addChannelOption(option =>
    option.setName('canal')
      .setDescription('O canal de texto onde os avisos de advertência serão enviados')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addRoleOption(option =>
    option.setName('cargo_adv_1')
      .setDescription('Cargo de advertência 1 (Adv 1)')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_adv_2')
      .setDescription('Cargo de advertência 2 (Adv 2)')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_adv_3')
      .setDescription('Cargo de advertência 3 (Adv 3)')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_staff_1')
      .setDescription('Primeiro cargo de Staff autorizado a aplicar/remover advertências')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option.setName('cargo_staff_2')
      .setDescription('Segundo cargo de Staff autorizado (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_staff_3')
      .setDescription('Terceiro cargo de Staff autorizado (opcional)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option.setName('cargo_staff_4')
      .setDescription('Quarto cargo de Staff autorizado (opcional)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const canal = interaction.options.getChannel('canal');
    const cargoAdv1 = interaction.options.getRole('cargo_adv_1');
    const cargoAdv2 = interaction.options.getRole('cargo_adv_2');
    const cargoAdv3 = interaction.options.getRole('cargo_adv_3');
    
    const staff1 = interaction.options.getRole('cargo_staff_1');
    const staff2 = interaction.options.getRole('cargo_staff_2');
    const staff3 = interaction.options.getRole('cargo_staff_3');
    const staff4 = interaction.options.getRole('cargo_staff_4');

    if (canal.type !== ChannelType.GuildText) {
      return await interaction.reply({
        content: '❌ O canal selecionado precisa ser do tipo Texto!',
        ephemeral: true
      });
    }

    const cargosStaffIds = [staff1.id];
    if (staff2) cargosStaffIds.push(staff2.id);
    if (staff3) cargosStaffIds.push(staff3.id);
    if (staff4) cargosStaffIds.push(staff4.id);

    const config = {
      canalId: canal.id,
      cargo1Id: cargoAdv1.id,
      cargo2Id: cargoAdv2.id,
      cargo3Id: cargoAdv3.id,
      cargosStaffIds: cargosStaffIds
    };

    saveAdvConfig(config);

    const embed = new EmbedBuilder()
      .setTitle('⚙️ SISTEMA DE ADVERTÊNCIAS CONFIGURADO ⚙️')
      .setDescription('As configurações do sistema de advertências foram salvas com sucesso!')
      .setColor(3066993) // Verde
      .addFields(
        { name: '📢 Canal de Alertas:', value: `${canal} (${canal.id})`, inline: false },
        { name: '⚠️ Cargo Adv 1:', value: `${cargoAdv1}`, inline: true },
        { name: '⚠️ Cargo Adv 2:', value: `${cargoAdv2}`, inline: true },
        { name: '⚠️ Cargo Adv 3:', value: `${cargoAdv3}`, inline: true },
        { name: '💼 Staffs Autorizados:', value: cargosStaffIds.map(id => `<@&${id}>`).join(', '), inline: false }
      )
      .setFooter({ text: 'Lux Advertências' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Enviar log de configuração do bot
    const logEmbed = new EmbedBuilder()
      .setTitle('⚙️ Advertências Configurado')
      .setColor(3066993)
      .setDescription(`O administrador <@${interaction.user.id}> configurou as advertências no canal ${canal}.`)
      .addFields(
        { name: '⚠️ Cargo 1:', value: `${cargoAdv1}`, inline: true },
        { name: '⚠️ Cargo 2:', value: `${cargoAdv2}`, inline: true },
        { name: '⚠️ Cargo 3:', value: `${cargoAdv3}`, inline: true },
        { name: '💼 Staffs Autorizados:', value: cargosStaffIds.map(id => `<@&${id}>`).join(', '), inline: false }
      )
      .setTimestamp();

    await sendLog(interaction.client, interaction.guild, 'configadv', logEmbed);

  } catch (error) {
    console.error('Erro ao executar o comando /configadv:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao salvar as configurações de advertência.',
      ephemeral: true
    });
  }
}
