import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { 
  getDatabase,
  saveDatabase,
  getAdvConfig, 
  saveAdvConfig,
  getBaus,
  saveBau,
  deleteBau,
  getBauItems,
  saveBauItems,
  getLogChannel,
  saveLogChannel,
  getGlobalVendaConfig,
  saveGlobalVendaConfig,
  getGlobalEncomendaConfig,
  saveGlobalEncomendaConfig,
  getGlobalAusenciaConfig,
  saveGlobalAusenciaConfig,
  getGlobalFarmConfig,
  saveGlobalFarmConfig,
  getGlobalRecrutamentoConfig,
  saveGlobalRecrutamentoConfig
} from '../database.js';
import { sendLog } from '../logs.js';

// Importações dos criadores de painéis (serão renomeados)
import { criarPainelFarm } from './criarfarm.js';
import { criarPainelVenda } from './criarvenda.js';
import { criarPainelEncomenda } from './criarencomenda.js';
import { criarPainelAusencia } from './criarausencia.js';
import { criarPainelRecrutamento } from './criarrecrutamento.js';

export const data = new SlashCommandBuilder()
  .setName('painelconfig')
  .setDescription('Painel central de configurações do LuxBot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Armazena as seleções pendentes de confirmação antes de salvar no banco.
// Chave: `${guildId}_${userId}`
const pendingConfigs = new Map();

// Helper para gerar o Embed Principal do Painel
export function generateMainEmbed() {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  
  // Obter configurações atuais
  const adv = getAdvConfig();
  const farm = getGlobalFarmConfig();
  const bausCount = getBaus().length;
  const venda = getGlobalVendaConfig();
  const encomenda = getGlobalEncomendaConfig();
  const ausencia = getGlobalAusenciaConfig();
  const recrutamento = getGlobalRecrutamentoConfig();

  const advAlertStr = adv?.canalId ? `<#${adv.canalId}>` : '❌ *Não Configurado*';
  const advRevStr = adv?.canalRevogacaoId ? `<#${adv.canalRevogacaoId}>` : '❌ *Não Configurado*';
  const farmPanelStr = farm?.painelCanalId ? `<#${farm.painelCanalId}>` : '❌ *Não Configurado*';
  const vendaPanelStr = venda?.forumCanalId ? `<#${venda.forumCanalId}>` : '❌ *Não Configurado*';
  const encomendaPanelStr = encomenda?.forumCanalId ? `<#${encomenda.forumCanalId}>` : '❌ *Não Configurado*';
  const ausenciaPanelStr = ausencia?.canalId ? `<#${ausencia.canalId}>` : '❌ *Não Configurado*';
  const recPanelStr = recrutamento?.canalPainelId ? `<#${recrutamento.canalPainelId}>` : '❌ *Não Configurado*';

  return new EmbedBuilder()
    .setTitle('⚙️ PAINEL DE CONFIGURAÇÕES GERAIS ⚙️')
    .setDescription(
      'Bem-vindo ao centro de administração do **LuxBot**!\n' +
      'Selecione um módulo abaixo no menu de seleção para ajustar canais, cargos e gerenciar o bot.\n\n' +
      '**📋 Resumo de Configurações Ativas:**\n' +
      `• **⚖️ Advertências**: Alertas em ${advAlertStr} | Revogações em ${advRevStr}\n` +
      `• **🌾 Farm**: Painel em ${farmPanelStr}\n` +
      `• **📦 Baús**: \`${bausCount}\` baú(s) ativo(s) no banco de dados\n` +
      `• **🛍️ Vendas**: Painel em ${vendaPanelStr}\n` +
      `• **📦 Encomendas**: Painel em ${encomendaPanelStr}\n` +
      `• **🔴 Ausências**: Painel em ${ausenciaPanelStr}\n` +
      `• **👥 Recrutamento**: Painel em ${recPanelStr}\n`
    )
    .setColor(2326507)
    .setFooter({ text: `LuxBot Configurações • ${dataAtual} • criado por chegaheitor` })
    .setTimestamp();
}

// Helper para gerar o Select Menu Principal
export function generateMainRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('painelconfig_select_module')
    .setPlaceholder('Escolha um módulo para configurar...')
    .addOptions([
      { label: '⚖️ Advertências', description: 'Canais de avisos, revogações e cargos', value: 'painelconfig_mod_adv' },
      { label: '🌾 Farm', description: 'Painel, categoria de canais e materiais', value: 'painelconfig_mod_farm' },
      { label: '📦 Baús', description: 'Gerenciar baús ativos e lista de itens', value: 'painelconfig_mod_bau' },
      { label: '🛍️ Vendas', description: 'Fórum de vendas e cargos autorizados', value: 'painelconfig_mod_venda' },
      { label: '📦 Encomendas', description: 'Fórum de encomendas e cargos autorizados', value: 'painelconfig_mod_encomenda' },
      { label: '🔴 Ausências', description: 'Canal de ausências e cargos autorizados', value: 'painelconfig_mod_ausencia' },
      { label: '👥 Recrutamento', description: 'Canais de inscrição, aprovação e logs', value: 'painelconfig_mod_recrutamento' },
      { label: '📋 Logs', description: 'Configurar canais de logs por comando', value: 'painelconfig_mod_logs' }
    ]);

  return new ActionRowBuilder().addComponents(select);
}

export async function execute(interaction) {
  try {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ Apenas administradores podem utilizar o painel de configurações!',
        ephemeral: true
      });
    }

    const embed = generateMainEmbed();
    const row = generateMainRow();

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Erro ao executar o comando /painelconfig:', error);
    await interaction.reply({
      content: '❌ Ocorreu um erro ao abrir o painel de configurações.',
      ephemeral: true
    }).catch(() => null);
  }
}

// Trata as interações do painel de configuração
export async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const key = `${interaction.guildId}_${interaction.user.id}`;

  // Restrição estrita de Administrador
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({
      content: '❌ Apenas administradores podem utilizar o painel de configurações!',
      ephemeral: true
    });
  }

  // ========================================================
  // 1. SELEÇÃO DO MÓDULO PRINCIPAL
  // ========================================================
  if (interaction.isStringSelectMenu() && customId === 'painelconfig_select_module') {
    const selected = interaction.values[0];

    // MÓDULO LOGS
    if (selected === 'painelconfig_mod_logs') {
      return await showLogsMenu(interaction);
    }

    // MÓDULO ADVERTÊNCIAS
    if (selected === 'painelconfig_mod_adv') {
      return await showAdvMenu(interaction);
    }

    // MÓDULO FARM
    if (selected === 'painelconfig_mod_farm') {
      return await showFarmMenu(interaction);
    }

    // MÓDULO BAÚ
    if (selected === 'painelconfig_mod_bau') {
      return await showBauMenu(interaction);
    }

    // MÓDULOS DE FLUXO SIMPLES (Vendas, Encomendas, Ausências, Recrutamento)
    if (['painelconfig_mod_venda', 'painelconfig_mod_encomenda', 'painelconfig_mod_ausencia', 'painelconfig_mod_recrutamento'].includes(selected)) {
      const moduleName = selected.replace('painelconfig_mod_', '');
      return await showSimpleModuleMenu(interaction, moduleName);
    }
  }

  // ========================================================
  // 2. RETORNO AO MENU PRINCIPAL (BOTÃO VOLTAR)
  // ========================================================
  if (interaction.isButton() && customId === 'painelconfig_btn_back') {
    pendingConfigs.delete(key);
    try {
      const embed = generateMainEmbed();
      const row = generateMainRow();
      return await interaction.update({ embeds: [embed], components: [row] });
    } catch (e) {
      console.error(e);
    }
  }

  // ========================================================
  // MÓDULO LOGS: CONFIGURAÇÕES E INTERAÇÕES
  // ========================================================
  if (interaction.isStringSelectMenu() && customId === 'painelconfig_logs_sel_cmd') {
    const commandName = interaction.values[0];
    return await showLogsChannelSelect(interaction, commandName);
  }

  if (interaction.isChannelSelectMenu() && customId.startsWith('painelconfig_logs_channel_')) {
    const commandName = customId.replace('painelconfig_logs_channel_', '');
    const channelId = interaction.values[0];
    pendingConfigs.set(key, { type: 'logs', commandName, channelId });

    await interaction.deferUpdate();
    return await showLogsChannelSelect(interaction, commandName);
  }

  if (interaction.isButton() && customId.startsWith('painelconfig_btn_confirm_logs_')) {
    const commandName = customId.replace('painelconfig_btn_confirm_logs_', '');
    const pending = pendingConfigs.get(key);
    
    if (pending && pending.type === 'logs' && pending.commandName === commandName) {
      saveLogChannel(commandName, pending.channelId);
      pendingConfigs.delete(key);
      await interaction.reply({
        content: `✅ Logs do comando **/${commandName}** configurados com sucesso no canal <#${pending.channelId}>!`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: `⚠️ Nenhuma alteração pendente encontrada.`,
        ephemeral: true
      });
    }
    return await showLogsMenu(interaction);
  }

  if (interaction.isButton() && customId.startsWith('painelconfig_logs_disable_')) {
    const commandName = customId.replace('painelconfig_logs_disable_', '');
    pendingConfigs.delete(key);
    saveLogChannel(commandName, null);

    await interaction.reply({
      content: `📢 Logs do comando **/${commandName}** desativados com sucesso!`,
      ephemeral: true
    });
    return await showLogsMenu(interaction);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_back_logs') {
    pendingConfigs.delete(key);
    return await showLogsMenu(interaction);
  }

  // ========================================================
  // MÓDULO ADVERTÊNCIAS: CONFIGURAÇÕES E INTERAÇÕES
  // ========================================================
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_adv_')) {
    const action = customId.replace('painelconfig_btn_adv_', '');

    if (action === 'ch_alertas') {
      return await showAdvAlertsChannelSelect(interaction);
    }

    if (action === 'ch_revocacoes') {
      return await showAdvRevsChannelSelect(interaction);
    }

    if (action === 'staff') {
      return await showAdvStaffSelect(interaction);
    }

    if (action === 'cargos_adv') {
      const btn1 = new ButtonBuilder().setCustomId('painelconfig_btn_adv_set_c1').setLabel('Definir Cargo Adv 1').setStyle(ButtonStyle.Primary);
      const btn2 = new ButtonBuilder().setCustomId('painelconfig_btn_adv_set_c2').setLabel('Definir Cargo Adv 2').setStyle(ButtonStyle.Primary);
      const btn3 = new ButtonBuilder().setCustomId('painelconfig_btn_adv_set_c3').setLabel('Definir Cargo Adv 3').setStyle(ButtonStyle.Primary);
      const btnBackAdv = new ButtonBuilder().setCustomId('painelconfig_btn_back_adv').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');
      
      const row = new ActionRowBuilder().addComponents(btn1, btn2, btn3, btnBackAdv);
      return await interaction.update({
        content: 'Selecione qual cargo de advertência você quer configurar:',
        embeds: [],
        components: [row]
      });
    }
  }

  if (interaction.isButton() && customId.startsWith('painelconfig_btn_adv_set_c')) {
    const level = customId.replace('painelconfig_btn_adv_set_c', '');
    return await showAdvLevelSelect(interaction, level);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_back_adv') {
    pendingConfigs.delete(key);
    return await showAdvMenu(interaction);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_adv_cargos_adv') {
    pendingConfigs.delete(key);
    const btn1 = new ButtonBuilder().setCustomId('painelconfig_btn_adv_set_c1').setLabel('Definir Cargo Adv 1').setStyle(ButtonStyle.Primary);
    const btn2 = new ButtonBuilder().setCustomId('painelconfig_btn_adv_set_c2').setLabel('Definir Cargo Adv 2').setStyle(ButtonStyle.Primary);
    const btn3 = new ButtonBuilder().setCustomId('painelconfig_btn_adv_set_c3').setLabel('Definir Cargo Adv 3').setStyle(ButtonStyle.Primary);
    const btnBackAdv = new ButtonBuilder().setCustomId('painelconfig_btn_back_adv').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');
    
    const row = new ActionRowBuilder().addComponents(btn1, btn2, btn3, btnBackAdv);
    return await updatePanel(interaction, {
      content: 'Selecione qual cargo de advertência você quer configurar:',
      embeds: [],
      components: [row]
    });
  }

  // Tratar salvamentos de canais e cargos das advertências
  if (interaction.isChannelSelectMenu() && customId === 'painelconfig_selectchan_adv_alertas') {
    pendingConfigs.set(key, { type: 'adv_alertas', channelId: interaction.values[0] });
    await interaction.deferUpdate();
    return await showAdvAlertsChannelSelect(interaction);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_confirm_adv_alertas') {
    const pending = pendingConfigs.get(key);
    if (pending && pending.type === 'adv_alertas') {
      const config = getAdvConfig() || { canalId: '', canalRevogacaoId: '', cargo1Ids: [], cargo2Ids: [], cargo3Ids: [], cargosStaffIds: [] };
      config.canalId = pending.channelId;
      saveAdvConfig(config);
      pendingConfigs.delete(key);
      await interaction.reply({ content: '✅ Canal de alertas de advertências salvo com sucesso!', ephemeral: true });
    } else {
      await interaction.reply({ content: '⚠️ Nenhuma alteração pendente encontrada.', ephemeral: true });
    }
    return await showAdvMenu(interaction);
  }

  if (interaction.isChannelSelectMenu() && customId === 'painelconfig_selectchan_adv_revocacoes') {
    pendingConfigs.set(key, { type: 'adv_revocacoes', channelId: interaction.values[0] });
    await interaction.deferUpdate();
    return await showAdvRevsChannelSelect(interaction);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_confirm_adv_revocacoes') {
    const pending = pendingConfigs.get(key);
    if (pending && pending.type === 'adv_revocacoes') {
      const config = getAdvConfig() || { canalId: '', canalRevogacaoId: '', cargo1Ids: [], cargo2Ids: [], cargo3Ids: [], cargosStaffIds: [] };
      config.canalRevogacaoId = pending.channelId;
      saveAdvConfig(config);
      pendingConfigs.delete(key);
      await interaction.reply({ content: '✅ Canal de solicitações de revogação salvo com sucesso!', ephemeral: true });
    } else {
      await interaction.reply({ content: '⚠️ Nenhuma alteração pendente encontrada.', ephemeral: true });
    }
    return await showAdvMenu(interaction);
  }

  if (interaction.isRoleSelectMenu() && customId === 'painelconfig_selectroles_adv_staff') {
    pendingConfigs.set(key, { type: 'adv_staff', roles: interaction.values });
    await interaction.deferUpdate();
    return await showAdvStaffSelect(interaction);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_confirm_adv_staff') {
    const pending = pendingConfigs.get(key);
    if (pending && pending.type === 'adv_staff') {
      const config = getAdvConfig() || { canalId: '', canalRevogacaoId: '', cargo1Ids: [], cargo2Ids: [], cargo3Ids: [], cargosStaffIds: [] };
      config.cargosStaffIds = pending.roles;
      saveAdvConfig(config);
      pendingConfigs.delete(key);
      await interaction.reply({ content: '✅ Cargos de Staff autorizados salvos com sucesso!', ephemeral: true });
    } else {
      await interaction.reply({ content: '⚠️ Nenhuma alteração pendente encontrada.', ephemeral: true });
    }
    return await showAdvMenu(interaction);
  }

  if (interaction.isRoleSelectMenu() && customId.startsWith('painelconfig_selectrole_adv_cargo')) {
    const level = customId.replace('painelconfig_selectrole_adv_cargo', '');
    pendingConfigs.set(key, { type: `adv_cargo_${level}`, level, roles: interaction.values });
    await interaction.deferUpdate();
    return await showAdvLevelSelect(interaction, level);
  }

  if (interaction.isButton() && customId.startsWith('painelconfig_btn_confirm_adv_cargo_')) {
    const level = customId.replace('painelconfig_btn_confirm_adv_cargo_', '');
    const pending = pendingConfigs.get(key);
    
    if (pending && pending.type === `adv_cargo_${level}`) {
      const config = getAdvConfig() || { canalId: '', canalRevogacaoId: '', cargo1Ids: [], cargo2Ids: [], cargo3Ids: [], cargosStaffIds: [] };
      config[`cargo${level}Ids`] = pending.roles;
      delete config[`cargo${level}Id`];
      saveAdvConfig(config);
      pendingConfigs.delete(key);
      await interaction.reply({ content: `✅ Cargos do nível Adv ${level} salvos com sucesso!`, ephemeral: true });
    } else {
      await interaction.reply({ content: '⚠️ Nenhuma alteração pendente encontrada.', ephemeral: true });
    }
    
    const btn1 = new ButtonBuilder().setCustomId('painelconfig_btn_adv_set_c1').setLabel('Definir Cargo Adv 1').setStyle(ButtonStyle.Primary);
    const btn2 = new ButtonBuilder().setCustomId('painelconfig_btn_adv_set_c2').setLabel('Definir Cargo Adv 2').setStyle(ButtonStyle.Primary);
    const btn3 = new ButtonBuilder().setCustomId('painelconfig_btn_adv_set_c3').setLabel('Definir Cargo Adv 3').setStyle(ButtonStyle.Primary);
    const btnBackAdv = new ButtonBuilder().setCustomId('painelconfig_btn_back_adv').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');
    
    const row = new ActionRowBuilder().addComponents(btn1, btn2, btn3, btnBackAdv);
    return await updatePanel(interaction, {
      content: 'Selecione qual cargo de advertência você quer configurar:',
      embeds: [],
      components: [row]
    });
  }

  // ========================================================
  // MÓDULO FARM: CONFIGURAÇÕES E INTERAÇÕES
  // ========================================================
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_farm_')) {
    const action = customId.replace('painelconfig_btn_farm_', '');

    if (action === 'channels') {
      return await showFarmChannelsSelect(interaction);
    }

    if (action === 'roles') {
      return await showFarmRolesSelect(interaction);
    }

    if (action === 'materials') {
      const btnAdd = new ButtonBuilder().setCustomId('painelconfig_btn_farm_materials_add').setLabel('➕ Adicionar Material').setStyle(ButtonStyle.Success);
      const btnRemove = new ButtonBuilder().setCustomId('painelconfig_btn_farm_materials_remove').setLabel('➖ Remover Material').setStyle(ButtonStyle.Danger);
      const btnBack = new ButtonBuilder().setCustomId('painelconfig_btn_back_farm').setLabel('Voltar').setStyle(ButtonStyle.Secondary);
      
      const row = new ActionRowBuilder().addComponents(btnAdd, btnRemove, btnBack);
      return await interaction.update({
        content: 'Escolha se deseja adicionar ou remover materiais da lista de farm/metas:',
        embeds: [],
        components: [row]
      });
    }

    if (action === 'criar') {
      try {
        const farmConfig = getGlobalFarmConfig();
        if (!farmConfig || !farmConfig.painelCanalId || !farmConfig.categoriaId) {
          return await interaction.reply({
            content: '❌ Configure o Canal do Painel e a Categoria de Farm antes de criar o painel!',
            ephemeral: true
          });
        }
        await interaction.deferReply({ ephemeral: true });
        
        // Acionar criação do painel farm
        const success = await criarPainelFarm(interaction.client, guild);
        if (success) {
          await interaction.editReply({ content: '✅ Painel de Farm criado e configurado com sucesso no canal correspondente!' });
        } else {
          await interaction.editReply({ content: '❌ Ocorreu um erro ao criar o Painel de Farm. Verifique as configurações.' });
        }
        return await showFarmMenu(interaction);
      } catch (e) {
        console.error(e);
        await interaction.reply({ content: 'Erro ao criar painel.', ephemeral: true }).catch(() => null);
      }
    }
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_back_farm') {
    pendingConfigs.delete(key);
    return await showFarmMenu(interaction);
  }

  if (interaction.isRoleSelectMenu() && customId === 'painelconfig_selectroles_farm') {
    pendingConfigs.set(key, { type: 'farm_roles', roles: interaction.values });
    await interaction.deferUpdate();
    return await showFarmRolesSelect(interaction);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_confirm_farm_roles') {
    const pending = pendingConfigs.get(key);
    if (pending && pending.type === 'farm_roles') {
      const config = getGlobalFarmConfig() || { painelCanalId: '', categoriaId: '', cargosAdminIds: [] };
      config.cargosAdminIds = pending.roles;
      saveGlobalFarmConfig(config);
      pendingConfigs.delete(key);
      await interaction.reply({ content: '✅ Cargos de gerenciamento de Farm salvos com sucesso!', ephemeral: true });
    } else {
      await interaction.reply({ content: '⚠️ Nenhuma alteração pendente encontrada.', ephemeral: true });
    }
    return await showFarmMenu(interaction);
  }

  // Adicionar e Remover materiais de Farm
  if (interaction.isButton() && customId === 'painelconfig_btn_farm_materials_add') {
    const modal = new ModalBuilder()
      .setCustomId('painelconfig_modal_farm_mat_add')
      .setTitle('Adicionar Material de Farm');
    
    const input = new TextInputBuilder()
      .setCustomId('material_name_input')
      .setLabel('NOME DO MATERIAL')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(30);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && customId === 'painelconfig_modal_farm_mat_add') {
    const name = interaction.fields.getTextInputValue('material_name_input').trim();
    const materials = getFarmMaterials();
    
    if (materials.map(m => m.toLowerCase()).includes(name.toLowerCase())) {
      return await interaction.reply({ content: '❌ Este material já está cadastrado!', ephemeral: true });
    }
    
    materials.push(name);
    saveFarmMaterials(materials);

    await interaction.reply({ content: `✅ Material **${name}** adicionado com sucesso!`, ephemeral: true });
    return await showFarmMenu(interaction);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_farm_materials_remove') {
    const materials = getFarmMaterials();
    if (materials.length === 0) {
      return await interaction.reply({ content: '❌ Nenhum material cadastrado para remover.', ephemeral: true });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('painelconfig_select_farm_mat_remove')
      .setPlaceholder('Escolha o material para remover...')
      .addOptions(materials.map(m => ({ label: m, value: m })));

    const btnBack = new ButtonBuilder()
      .setCustomId('painelconfig_btn_farm_materials')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');

    const row = new ActionRowBuilder().addComponents(select);
    const rowBack = new ActionRowBuilder().addComponents(btnBack);

    return await interaction.update({
      content: 'Selecione abaixo o material que deseja excluir permanentemente:',
      components: [row, rowBack]
    });
  }

  if (interaction.isStringSelectMenu() && customId === 'painelconfig_select_farm_mat_remove') {
    const target = interaction.values[0];
    let materials = getFarmMaterials();
    materials = materials.filter(m => m !== target);
    saveFarmMaterials(materials);

    await interaction.reply({ content: `✅ Material **${target}** removido com sucesso!`, ephemeral: true });
    return await showFarmMenu(interaction);
  }

  // Canais de Farm selecionados
  if (interaction.isChannelSelectMenu() && customId === 'painelconfig_selectchan_farm_panel') {
    const pending = pendingConfigs.get(key) || { type: 'farm_channels' };
    pending.painelCanalId = interaction.values[0];
    pendingConfigs.set(key, pending);

    await interaction.deferUpdate();
    return await showFarmChannelsSelect(interaction);
  }

  if (interaction.isChannelSelectMenu() && customId === 'painelconfig_selectchan_farm_category') {
    const pending = pendingConfigs.get(key) || { type: 'farm_channels' };
    pending.categoriaId = interaction.values[0];
    pendingConfigs.set(key, pending);

    await interaction.deferUpdate();
    return await showFarmChannelsSelect(interaction);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_confirm_farm_channels') {
    const pending = pendingConfigs.get(key);
    if (pending && pending.type === 'farm_channels') {
      const config = getGlobalFarmConfig() || { painelCanalId: '', categoriaId: '', cargosAdminIds: [] };
      if (pending.painelCanalId) config.painelCanalId = pending.painelCanalId;
      if (pending.categoriaId) config.categoriaId = pending.categoriaId;
      saveGlobalFarmConfig(config);
      pendingConfigs.delete(key);
      await interaction.reply({ content: '✅ Canais de Farm salvos com sucesso!', ephemeral: true });
    } else {
      await interaction.reply({ content: '⚠️ Nenhuma alteração pendente encontrada.', ephemeral: true });
    }
    return await showFarmMenu(interaction);
  }

  // ========================================================
  // MÓDULO BAÚS: CONFIGURAÇÕES E INTERAÇÕES
  // ========================================================
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_bau_')) {
    const action = customId.replace('painelconfig_btn_bau_', '');

    if (action === 'criar_bau') {
      const modal = new ModalBuilder()
        .setCustomId('painelconfig_modal_bau_create')
        .setTitle('Criar Novo Baú');
      
      const nomeInput = new TextInputBuilder()
        .setCustomId('bau_nome_input')
        .setLabel('NOME DO BAÚ')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Baú Geral, Almoxarifado')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(nomeInput));
      return await interaction.showModal(modal);
    }

    if (action === 'items') {
      const btnAdd = new ButtonBuilder().setCustomId('painelconfig_btn_bau_items_add').setLabel('➕ Adicionar Item').setStyle(ButtonStyle.Success);
      const btnRemove = new ButtonBuilder().setCustomId('painelconfig_btn_bau_items_remove').setLabel('➖ Remover Item').setStyle(ButtonStyle.Danger);
      const btnBack = new ButtonBuilder().setCustomId('painelconfig_btn_back_bau').setLabel('Voltar').setStyle(ButtonStyle.Secondary);
      
      const row = new ActionRowBuilder().addComponents(btnAdd, btnRemove, btnBack);
      return await interaction.update({
        content: 'Escolha se deseja adicionar ou remover itens disponíveis nos baús:',
        embeds: [],
        components: [row]
      });
    }
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_back_bau') {
    pendingConfigs.delete(key);
    return await showBauMenu(interaction);
  }

  // Criação de Baú: Modal Submit -> Canal -> Cargos -> Envio
  if (interaction.isModalSubmit() && customId === 'painelconfig_modal_bau_create') {
    const name = interaction.fields.getTextInputValue('bau_nome_input').trim();
    
    // Armazenar temporariamente na memória/interação o nome do baú abrindo canais
    const selectChan = new ChannelSelectMenuBuilder()
      .setCustomId(`painelconfig_selectchan_bau_create_${name}`)
      .setPlaceholder('Escolha o canal onde enviar o baú...')
      .addChannelTypes(ChannelType.GuildText);

    const btnBack = new ButtonBuilder()
      .setCustomId('painelconfig_btn_back_bau')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');

    const row = new ActionRowBuilder().addComponents(selectChan);
    const rowBack = new ActionRowBuilder().addComponents(btnBack);
    return await interaction.update({
      content: `Selecione o canal onde deseja enviar o baú **${name}**:`,
      components: [row, rowBack]
    });
  }

  if (interaction.isChannelSelectMenu() && customId.startsWith('painelconfig_selectchan_bau_create_')) {
    const name = customId.replace('painelconfig_selectchan_bau_create_', '');
    const channelId = interaction.values[0];

    const selectRoles = new RoleSelectMenuBuilder()
      .setCustomId(`painelconfig_selectroles_bau_create_${name}_${channelId}`)
      .setPlaceholder('Selecione os cargos autorizados...')
      .setMinValues(1)
      .setMaxValues(5);

    const btnBack = new ButtonBuilder()
      .setCustomId('painelconfig_btn_back_bau')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');

    const row = new ActionRowBuilder().addComponents(selectRoles);
    const rowBack = new ActionRowBuilder().addComponents(btnBack);
    return await interaction.update({
      content: `Selecione até 5 cargos permitidos a adicionar/remover itens no baú **${name}** (<#${channelId}>):`,
      components: [row, rowBack]
    });
  }

  if (interaction.isRoleSelectMenu() && customId.startsWith('painelconfig_selectroles_bau_create_')) {
    const parts = customId.replace('painelconfig_selectroles_bau_create_', '').split('_');
    const name = parts[0];
    const channelId = parts[1];
    
    pendingConfigs.set(key, { type: 'bau_create', name, channelId, roles: interaction.values });
    await interaction.deferUpdate();
    return await showBauCreateRolesSelect(interaction, name, channelId);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_confirm_bau_create') {
    const pending = pendingConfigs.get(key);
    if (pending && pending.type === 'bau_create') {
      try {
        const { name, channelId, roles } = pending;

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          return await interaction.reply({ content: '❌ Canal do baú não localizado!', ephemeral: true });
        }

        // Criar a mensagem do Baú no canal
        const welcomeEmbed = new EmbedBuilder()
          .setTitle(`📦 BAÚ: ${name.toUpperCase()} 📦`)
          .setDescription('**Conteúdo do Baú:**\n*Nenhum item armazenado no momento.*')
          .setColor(12096338) // Madeira
          .setFooter({ text: `LuxBot Baú • ${dataAtual} • criado por chegaheitor` })
          .setTimestamp();

        const btnAdd = new ButtonBuilder().setCustomId('bau_adicionar_btn').setLabel('Adicionar').setStyle(ButtonStyle.Primary).setEmoji('📥');
        const btnRemove = new ButtonBuilder().setCustomId('bau_retirar_btn').setLabel('Retirar').setStyle(ButtonStyle.Secondary).setEmoji('📤');
        const row = new ActionRowBuilder().addComponents(btnAdd, btnRemove);

        const msg = await channel.send({ embeds: [welcomeEmbed], components: [row] });
        await msg.pin().catch(() => null);

        // Salvar baú no banco
        saveBau({
          messageId: msg.id,
          canalId: channelId,
          nome: name,
          cargosPermitidosIds: roles,
          itens: {}
        });

        pendingConfigs.delete(key);

        await interaction.update({
          content: `✅ O baú **${name}** foi criado com sucesso no canal <#${channelId}>!`,
          components: []
        });

        // Log de Baú Criado
        const logEmbed = new EmbedBuilder()
          .setTitle('⚙️ Baú Criado')
          .setColor(3066993)
          .setDescription(`O administrador <@${interaction.user.id}> criou o baú **${name}** em <#${channelId}>.`)
          .addFields({ name: '💼 Cargos Autorizados:', value: roles.map(id => `<@&${id}>`).join(', ') })
          .setTimestamp();

        await sendLog(interaction.client, guild, 'listarbau', logEmbed);

      } catch (e) {
        console.error(e);
        await interaction.reply({ content: '❌ Erro ao instanciar o baú no canal.', ephemeral: true }).catch(() => null);
      }
    } else {
      await interaction.reply({ content: '⚠️ Nenhuma alteração pendente encontrada.', ephemeral: true });
    }
    return;
  }

  // Itens Globais do Baú (Adicionar/Remover)
  if (interaction.isButton() && customId === 'painelconfig_btn_bau_items_add') {
    const modal = new ModalBuilder()
      .setCustomId('painelconfig_modal_bau_item_add')
      .setTitle('Adicionar Item no Baú');
    
    const input = new TextInputBuilder()
      .setCustomId('item_name_input')
      .setLabel('NOME DO ITEM')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(30);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && customId === 'painelconfig_modal_bau_item_add') {
    const name = interaction.fields.getTextInputValue('item_name_input').trim();
    const items = getBauItems();
    
    if (items.map(i => i.toLowerCase()).includes(name.toLowerCase())) {
      return await interaction.reply({ content: '❌ Este item já está cadastrado nos baús!', ephemeral: true });
    }
    
    items.push(name);
    saveBauItems(items);

    await interaction.reply({ content: `✅ Item **${name}** cadastrado com sucesso para os baús!`, ephemeral: true });
    return await showBauMenu(interaction);
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_bau_items_remove') {
    const items = getBauItems();
    if (items.length === 0) {
      return await interaction.reply({ content: '❌ Nenhum item cadastrado para remover.', ephemeral: true });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('painelconfig_select_bau_item_remove')
      .setPlaceholder('Escolha o item para remover...')
      .addOptions(items.map(i => ({ label: i, value: i })));

    const btnBack = new ButtonBuilder()
      .setCustomId('painelconfig_btn_bau_items')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');

    const row = new ActionRowBuilder().addComponents(select);
    const rowBack = new ActionRowBuilder().addComponents(btnBack);

    return await interaction.update({
      content: 'Selecione abaixo o item que deseja excluir da lista global de baús:',
      components: [row, rowBack]
    });
  }

  if (interaction.isStringSelectMenu() && customId === 'painelconfig_select_bau_item_remove') {
    const target = interaction.values[0];
    let items = getBauItems();
    items = items.filter(i => i !== target);
    saveBauItems(items);

    await interaction.reply({ content: `✅ Item **${target}** removido com sucesso dos baús!`, ephemeral: true });
    return await showBauMenu(interaction);
  }

  // ========================================================
  // MÓDULOS DE FLUXO SIMPLES: EDITAR CANAIS, CARGOS E CRIAR PAINEL
  // ========================================================
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_simple_')) {
    const parts = customId.replace('painelconfig_btn_simple_', '').split('_');
    const action = parts[0];
    const moduleName = parts[1];

    if (action === 'channels') {
      return await showSimpleModuleChannelsSelect(interaction, moduleName);
    }

    if (action === 'roles') {
      return await showSimpleModuleRolesSelect(interaction, moduleName);
    }

    // Criar Painel
    if (action === 'criar') {
      try {
        await interaction.deferReply({ ephemeral: true });
        let success = false;

        if (moduleName === 'venda') success = await criarPainelVenda(interaction.client, guild);
        if (moduleName === 'encomenda') success = await criarPainelEncomenda(interaction.client, guild);
        if (moduleName === 'ausencia') success = await criarPainelAusencia(interaction.client, guild);
        if (moduleName === 'recrutamento') success = await criarPainelRecrutamento(interaction.client, guild);

        if (success) {
          await interaction.editReply({ content: `✅ Painel do módulo **${moduleName}** enviado com sucesso para o canal configurado!` });
        } else {
          await interaction.editReply({ content: `❌ Erro ao criar o painel de **${moduleName}**. Verifique se os canais estão configurados.` });
        }
        return await showSimpleModuleMenu(interaction, moduleName);
      } catch (e) {
        console.error(e);
        await interaction.reply({ content: 'Erro ao processar criação do painel.', ephemeral: true }).catch(() => null);
      }
    }
  }

  // Retorno de módulos simples
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_back_simple_')) {
    const moduleName = customId.replace('painelconfig_btn_back_simple_', '');
    pendingConfigs.delete(key);
    return await showSimpleModuleMenu(interaction, moduleName);
  }

  // Tratar seleções de canal para módulos simples
  if (interaction.isChannelSelectMenu() && customId.startsWith('painelconfig_selectchan_simple_')) {
    const detail = customId.replace('painelconfig_selectchan_simple_', '');

    if (detail.startsWith('recrutamento_')) {
      const channelType = detail.replace('recrutamento_', '');
      const pending = pendingConfigs.get(key) || { type: 'simple_channels_recrutamento' };
      
      if (channelType === 'welcome') pending.welcome = interaction.values[0];
      if (channelType === 'pedidos') pending.pedidos = interaction.values[0];
      if (channelType === 'logs') pending.logs = interaction.values[0];

      pendingConfigs.set(key, pending);
      await interaction.deferUpdate();
      return await showSimpleModuleChannelsSelect(interaction, 'recrutamento');
    } else {
      const moduleName = detail;
      const channelId = interaction.values[0];
      pendingConfigs.set(key, { type: `simple_channels_${moduleName}`, moduleName, channelId });

      await interaction.deferUpdate();
      return await showSimpleModuleChannelsSelect(interaction, moduleName);
    }
  }

  if (interaction.isButton() && customId.startsWith('painelconfig_btn_confirm_simple_channels_')) {
    const moduleName = customId.replace('painelconfig_btn_confirm_simple_channels_', '');
    const pending = pendingConfigs.get(key);
    
    if (pending && pending.type === `simple_channels_${moduleName}`) {
      if (moduleName === 'recrutamento') {
        const config = getGlobalRecrutamentoConfig() || { canalPainelId: '', canalPedidosId: '', canalLogsNegadoId: '', cargosStaffIds: [] };
        if (pending.welcome) config.canalPainelId = pending.welcome;
        if (pending.pedidos) config.canalPedidosId = pending.pedidos;
        if (pending.logs) config.canalLogsNegadoId = pending.logs;
        saveGlobalRecrutamentoConfig(config);
      } else {
        const channelId = pending.channelId;
        if (moduleName === 'venda') {
          const config = getGlobalVendaConfig() || { forumCanalId: '', cargosPermitidosIds: [] };
          config.forumCanalId = channelId;
          saveGlobalVendaConfig(config);
        } else if (moduleName === 'encomenda') {
          const config = getGlobalEncomendaConfig() || { forumCanalId: '', cargosPermitidosIds: [] };
          config.forumCanalId = channelId;
          saveGlobalEncomendaConfig(config);
        } else if (moduleName === 'ausencia') {
          const config = getGlobalAusenciaConfig() || { canalId: '', cargosPermitidosIds: [] };
          config.canalId = channelId;
          saveGlobalAusenciaConfig(config);
        }
      }
      pendingConfigs.delete(key);
      await interaction.reply({ content: `✅ Canais do módulo **${moduleName}** salvos com sucesso!`, ephemeral: true });
    } else {
      await interaction.reply({ content: '⚠️ Nenhuma alteração pendente encontrada.', ephemeral: true });
    }
    return await showSimpleModuleMenu(interaction, moduleName);
  }

  // Tratar seleções de cargos para módulos simples
  if (interaction.isRoleSelectMenu() && customId.startsWith('painelconfig_selectroles_simple_')) {
    const moduleName = customId.replace('painelconfig_selectroles_simple_', '');
    pendingConfigs.set(key, { type: `simple_roles_${moduleName}`, moduleName, roles: interaction.values });

    await interaction.deferUpdate();
    return await showSimpleModuleRolesSelect(interaction, moduleName);
  }

  if (interaction.isButton() && customId.startsWith('painelconfig_btn_confirm_simple_roles_')) {
    const moduleName = customId.replace('painelconfig_btn_confirm_simple_roles_', '');
    const pending = pendingConfigs.get(key);
    
    if (pending && pending.type === `simple_roles_${moduleName}`) {
      if (moduleName === 'venda') {
        const config = getGlobalVendaConfig() || { forumCanalId: '', cargosPermitidosIds: [] };
        config.cargosPermitidosIds = pending.roles;
        saveGlobalVendaConfig(config);
      } else if (moduleName === 'encomenda') {
        const config = getGlobalEncomendaConfig() || { forumCanalId: '', cargosPermitidosIds: [] };
        config.cargosPermitidosIds = pending.roles;
        saveGlobalEncomendaConfig(config);
      } else if (moduleName === 'ausencia') {
        const config = getGlobalAusenciaConfig() || { canalId: '', cargosPermitidosIds: [] };
        config.cargosPermitidosIds = pending.roles;
        saveGlobalAusenciaConfig(config);
      } else if (moduleName === 'recrutamento') {
        const config = getGlobalRecrutamentoConfig() || { canalPainelId: '', canalPedidosId: '', canalLogsNegadoId: '', cargosStaffIds: [] };
        config.cargosStaffIds = pending.roles;
        saveGlobalRecrutamentoConfig(config);
      }
      pendingConfigs.delete(key);
      await interaction.reply({ content: `✅ Cargos autorizados do módulo **${moduleName}** salvos com sucesso!`, ephemeral: true });
    } else {
      await interaction.reply({ content: '⚠️ Nenhuma alteração pendente encontrada.', ephemeral: true });
    }
    return await showSimpleModuleMenu(interaction, moduleName);
  }
}

// ========================================================
// FUNÇÕES AUXILIARES DE RENDERIZAÇÃO DE MENUS
// ========================================================

// Helper para atualizar a mensagem do painel de forma flexível (com ou sem ephemeral)
async function updatePanel(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.message.edit(options);
    } else {
      return await interaction.update(options);
    }
  } catch (error) {
    console.error('Erro ao atualizar painel:', error);
  }
}

// Helper para renderizar seleção de cargos de staff de Adv
async function showAdvStaffSelect(interaction) {
  const adv = getAdvConfig();
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);

  let roles = adv?.cargosStaffIds || [];
  let isPending = false;
  if (pending && pending.type === 'adv_staff') {
    roles = pending.roles;
    isPending = true;
  }

  const staffsText = roles.length > 0
    ? roles.map(id => `<@&${id}>`).join(', ') + (isPending ? ' ⚠️ *(Pendente de Confirmação)*' : '')
    : '❌ *Não Configurado*';

  const select = new RoleSelectMenuBuilder()
    .setCustomId('painelconfig_selectroles_adv_staff')
    .setPlaceholder('Escolha os cargos autorizados a aplicar/remover Adv...')
    .setMinValues(1)
    .setMaxValues(4);
  
  const btnConfirm = new ButtonBuilder().setCustomId('painelconfig_btn_confirm_adv_staff').setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back_adv').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(select);
  const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnVoltar);

  return await updatePanel(interaction, {
    content: `Selecione abaixo até 4 cargos de Staff permitidos a aplicar/revogar advertências:\n\n• **Cargos Selecionados:** ${staffsText}`,
    components: [row, rowBtns]
  });
}

// Helper para renderizar seleção de cargos de nível de Adv (1, 2, 3)
async function showAdvLevelSelect(interaction, level) {
  const adv = getAdvConfig();
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);

  let cIds = adv?.[`cargo${level}Ids`] || (adv?.[`cargo${level}Id`] ? [adv[`cargo${level}Id`]] : []);
  let isPending = false;
  if (pending && pending.type === `adv_cargo_${level}`) {
    cIds = pending.roles;
    isPending = true;
  }

  const currentText = cIds.length > 0 
    ? cIds.map(id => `<@&${id}>`).join(', ') + (isPending ? ' ⚠️ *(Pendente de Confirmação)*' : '') 
    : '❌ *Nenhum cargo configurado*';

  const select = new RoleSelectMenuBuilder()
    .setCustomId(`painelconfig_selectrole_adv_cargo${level}`)
    .setPlaceholder(`Selecione os cargos para Adv ${level}...`)
    .setMinValues(1)
    .setMaxValues(5);
  
  const btnConfirm = new ButtonBuilder().setCustomId(`painelconfig_btn_confirm_adv_cargo_${level}`).setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_adv_cargos_adv').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(select);
  const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnVoltar);

  return await updatePanel(interaction, {
    content: `Selecione os cargos correspondentes ao acúmulo de **${level} advertência(s)** no servidor:\n\n• **Cargos Selecionados:** ${currentText}`,
    components: [row, rowBtns]
  });
}

// Helper para renderizar seleção de canais de alertas de Adv
async function showAdvAlertsChannelSelect(interaction) {
  const adv = getAdvConfig();
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);

  const currentChannelId = adv?.canalId;
  const currentText = currentChannelId ? `<#${currentChannelId}>` : '❌ *Não Configurado*';
  
  let newText = '';
  if (pending && pending.type === 'adv_alertas') {
    newText = `\n\n👉 **Nova seleção (Pendente de Confirmação):** <#${pending.channelId}> ⚠️`;
  }
  
  const select = new ChannelSelectMenuBuilder()
    .setCustomId('painelconfig_selectchan_adv_alertas')
    .setPlaceholder('Escolha o canal de alertas de Adv...')
    .addChannelTypes(ChannelType.GuildText);
  
  const btnConfirm = new ButtonBuilder().setCustomId('painelconfig_btn_confirm_adv_alertas').setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back_adv').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(select);
  const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnVoltar);

  return await updatePanel(interaction, {
    content: `Selecione abaixo o canal onde serão publicados os avisos das advertências aplicadas:\n\n• **Canal Atual:** ${currentText}${newText}`,
    components: [row, rowBtns]
  });
}

// Helper para renderizar seleção de canais de revogações de Adv
async function showAdvRevsChannelSelect(interaction) {
  const adv = getAdvConfig();
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);

  const currentChannelId = adv?.canalRevogacaoId;
  const currentText = currentChannelId ? `<#${currentChannelId}>` : '❌ *Não Configurado*';
  
  let newText = '';
  if (pending && pending.type === 'adv_revocacoes') {
    newText = `\n\n👉 **Nova seleção (Pendente de Confirmação):** <#${pending.channelId}> ⚠️`;
  }
  
  const select = new ChannelSelectMenuBuilder()
    .setCustomId('painelconfig_selectchan_adv_revocacoes')
    .setPlaceholder('Escolha o canal de solicitações de revogação...')
    .addChannelTypes(ChannelType.GuildText);
  
  const btnConfirm = new ButtonBuilder().setCustomId('painelconfig_btn_confirm_adv_revocacoes').setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back_adv').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(select);
  const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnVoltar);

  return await updatePanel(interaction, {
    content: `Selecione abaixo o canal onde a Staff receberá os pedidos de revogação das advertências:\n\n• **Canal Atual:** ${currentText}${newText}`,
    components: [row, rowBtns]
  });
}

// Helper para renderizar seleção de cargos de Farm
async function showFarmRolesSelect(interaction) {
  const farm = getGlobalFarmConfig();
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);

  let roles = farm?.cargosAdminIds || [];
  let isPending = false;
  if (pending && pending.type === 'farm_roles') {
    roles = pending.roles;
    isPending = true;
  }

  const staffsText = roles.length > 0
    ? roles.map(id => `<@&${id}>`).join(', ') + (isPending ? ' ⚠️ *(Pendente de Confirmação)*' : '')
    : '❌ *Não Configurado*';

  const select = new RoleSelectMenuBuilder()
    .setCustomId('painelconfig_selectroles_farm')
    .setPlaceholder('Escolha os cargos autorizados a gerenciar metas e farms...')
    .setMinValues(1)
    .setMaxValues(3);
  
  const btnConfirm = new ButtonBuilder().setCustomId('painelconfig_btn_confirm_farm_roles').setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back_farm').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(select);
  const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnVoltar);

  return await updatePanel(interaction, {
    content: `Selecione abaixo até 3 cargos autorizados a gerenciar as metas e canais de farm:\n\n• **Cargos Selecionados:** ${staffsText}`,
    components: [row, rowBtns]
  });
}

// Helper para renderizar seleção de canais de Farm
async function showFarmChannelsSelect(interaction) {
  const farm = getGlobalFarmConfig();
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);

  let panelId = farm?.painelCanalId;
  let catId = farm?.categoriaId;
  let panelPending = false;
  let catPending = false;

  if (pending && pending.type === 'farm_channels') {
    if (pending.painelCanalId) {
      panelId = pending.painelCanalId;
      panelPending = true;
    }
    if (pending.categoriaId) {
      catId = pending.categoriaId;
      catPending = true;
    }
  }

  const panelText = panelId ? `<#${panelId}>` + (panelPending ? ' ⚠️ *(Pendente)*' : '') : '❌ *Não Configurado*';
  const catText = catId ? `<#${catId}>` + (catPending ? ' ⚠️ *(Pendente)*' : '') : '❌ *Não Configurado*';

  const selectPanel = new ChannelSelectMenuBuilder()
    .setCustomId('painelconfig_selectchan_farm_panel')
    .setPlaceholder('Escolha o canal onde ficará o Painel de Farm...')
    .addChannelTypes(ChannelType.GuildText);

  const selectCat = new ChannelSelectMenuBuilder()
    .setCustomId('painelconfig_selectchan_farm_category')
    .setPlaceholder('Escolha a categoria dos canais de farm dos membros...')
    .addChannelTypes(ChannelType.GuildCategory);

  const btnConfirm = new ButtonBuilder().setCustomId('painelconfig_btn_confirm_farm_channels').setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back_farm').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const rowP = new ActionRowBuilder().addComponents(selectPanel);
  const rowC = new ActionRowBuilder().addComponents(selectCat);
  const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnVoltar);

  return await updatePanel(interaction, {
    content: 
      `Configure abaixo o canal do painel e a categoria correspondente de farm:\n\n` +
      `• **Canal do Painel:** ${panelText}\n` +
      `• **Categoria de Farm:** ${catText}`,
    components: [rowP, rowC, rowBtns]
  });
}

// Helper para renderizar seleção de cargos para módulos simples
async function showSimpleModuleRolesSelect(interaction, moduleName) {
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);

  let roles = [];
  let isPending = false;

  if (pending && pending.type === `simple_roles_${moduleName}`) {
    roles = pending.roles;
    isPending = true;
  } else {
    if (moduleName === 'venda') {
      const config = getGlobalVendaConfig();
      roles = config?.cargosPermitidosIds || [];
    } else if (moduleName === 'encomenda') {
      const config = getGlobalEncomendaConfig();
      roles = config?.cargosPermitidosIds || [];
    } else if (moduleName === 'ausencia') {
      const config = getGlobalAusenciaConfig();
      roles = config?.cargosPermitidosIds || [];
    } else if (moduleName === 'recrutamento') {
      const config = getGlobalRecrutamentoConfig();
      roles = config?.cargosStaffIds || [];
    }
  }

  const staffsText = roles.length > 0 
    ? roles.map(id => `<@&${id}>`).join(', ') + (isPending ? ' ⚠️ *(Pendente de Confirmação)*' : '') 
    : '❌ *Não Configurado*';

  const select = new RoleSelectMenuBuilder()
    .setCustomId(`painelconfig_selectroles_simple_${moduleName}`)
    .setPlaceholder(`Selecione os cargos para ${moduleName}...`)
    .setMinValues(1)
    .setMaxValues(5);
  
  const btnConfirm = new ButtonBuilder().setCustomId(`painelconfig_btn_confirm_simple_roles_${moduleName}`).setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
  const btnVoltar = new ButtonBuilder().setCustomId(`painelconfig_btn_back_simple_${moduleName}`).setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(select);
  const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnVoltar);

  return await updatePanel(interaction, {
    content: `Selecione abaixo até 5 cargos permitidos para o módulo **${moduleName}**:\n\n• **Cargos Selecionados:** ${staffsText}`,
    components: [row, rowBtns]
  });
}

// Helper para renderizar seleção de canais para módulos simples
async function showSimpleModuleChannelsSelect(interaction, moduleName) {
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);

  if (moduleName === 'recrutamento') {
    const config = getGlobalRecrutamentoConfig();
    
    let welcomeId = config?.canalPainelId;
    let pedidosId = config?.canalPedidosId;
    let logsId = config?.canalLogsNegadoId;
    let welcomePending = false;
    let pedidosPending = false;
    let logsPending = false;

    if (pending && pending.type === 'simple_channels_recrutamento') {
      if (pending.welcome) {
        welcomeId = pending.welcome;
        welcomePending = true;
      }
      if (pending.pedidos) {
        pedidosId = pending.pedidos;
        pedidosPending = true;
      }
      if (pending.logs) {
        logsId = pending.logs;
        logsPending = true;
      }
    }

    const welcomeText = welcomeId ? `<#${welcomeId}>` + (welcomePending ? ' ⚠️ *(Pendente)*' : '') : '❌ *Não Configurado*';
    const pedidosText = pedidosId ? `<#${pedidosId}>` + (pedidosPending ? ' ⚠️ *(Pendente)*' : '') : '❌ *Não Configurado*';
    const logsText = logsId ? `<#${logsId}>` + (logsPending ? ' ⚠️ *(Pendente)*' : '') : '❌ *Não Configurado*';

    const selectWelcome = new ChannelSelectMenuBuilder()
      .setCustomId('painelconfig_selectchan_simple_recrutamento_welcome')
      .setPlaceholder('Canal do Painel (Bem-vindo)...')
      .addChannelTypes(ChannelType.GuildText);

    const selectPedidos = new ChannelSelectMenuBuilder()
      .setCustomId('painelconfig_selectchan_simple_recrutamento_pedidos')
      .setPlaceholder('Canal de Pedidos (Inscrições Staff)...')
      .addChannelTypes(ChannelType.GuildText);

    const selectLogs = new ChannelSelectMenuBuilder()
      .setCustomId('painelconfig_selectchan_simple_recrutamento_logs')
      .setPlaceholder('Canal de Logs Negados...')
      .addChannelTypes(ChannelType.GuildText);

    const btnConfirm = new ButtonBuilder().setCustomId('painelconfig_btn_confirm_simple_channels_recrutamento').setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
    const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back_simple_recrutamento').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

    const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnVoltar);

    return await updatePanel(interaction, {
      content: 
        `Selecione abaixo os 3 canais de texto para o recrutamento:\n\n` +
        `• **Painel (Bem-vindo):** ${welcomeText}\n` +
        `• **Pedidos (Aprovação):** ${pedidosText}\n` +
        `• **Logs Negados:** ${logsText}`,
      components: [
        new ActionRowBuilder().addComponents(selectWelcome),
        new ActionRowBuilder().addComponents(selectPedidos),
        new ActionRowBuilder().addComponents(selectLogs),
        rowBtns
      ]
    });
  } else {
    const isForum = ['venda', 'encomenda'].includes(moduleName);
    const channelTypes = isForum ? [ChannelType.GuildForum] : [ChannelType.GuildText];
    
    let currentId = null;
    let isPending = false;

    if (pending && pending.type === `simple_channels_${moduleName}`) {
      currentId = pending.channelId;
      isPending = true;
    } else {
      if (moduleName === 'venda') {
        const config = getGlobalVendaConfig();
        currentId = config?.forumCanalId;
      } else if (moduleName === 'encomenda') {
        const config = getGlobalEncomendaConfig();
        currentId = config?.forumCanalId;
      } else if (moduleName === 'ausencia') {
        const config = getGlobalAusenciaConfig();
        currentId = config?.canalId;
      }
    }

    const currentText = currentId ? `<#${currentId}>` + (isPending ? ' ⚠️ *(Pendente de Confirmação)*' : '') : '❌ *Não Configurado*';

    const select = new ChannelSelectMenuBuilder()
      .setCustomId(`painelconfig_selectchan_simple_${moduleName}`)
      .setPlaceholder(`Selecione o canal para ${moduleName}...`)
      .addChannelTypes(channelTypes);

    const btnConfirm = new ButtonBuilder().setCustomId(`painelconfig_btn_confirm_simple_channels_${moduleName}`).setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
    const btnVoltar = new ButtonBuilder().setCustomId(`painelconfig_btn_back_simple_${moduleName}`).setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

    const row = new ActionRowBuilder().addComponents(select);
    const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnVoltar);

    return await updatePanel(interaction, {
      content: `Selecione abaixo o canal/fórum correspondente ao módulo **${moduleName}**:\n\n• **Canal Configurado:** ${currentText}`,
      components: [row, rowBtns]
    });
  }
}

// Renderiza a tela de seleção de canais de logs
async function showLogsChannelSelect(interaction, commandName) {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);
  
  const channelId = getLogChannel(commandName);
  const currentText = channelId ? `<#${channelId}>` : '❌ *Nenhum canal configurado*';
  
  let newChannelText = '';
  if (pending && pending.type === 'logs' && pending.commandName === commandName) {
    newChannelText = `\n\n👉 **Nova seleção (Pendente de Confirmação):** <#${pending.channelId}> ⚠️`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📋 CONFIGURAR LOG: /${commandName.toUpperCase()} 📋`)
    .setDescription(
      `Selecione abaixo o canal de texto para os logs do comando **/${commandName}**.\n\n` +
      `• **Canal Atual:** ${currentText}${newChannelText}\n\n` +
      `Clique no botão **Confirmar** para salvar e voltar.`
    )
    .setColor(3447003)
    .setFooter({ text: `LuxBot Logs • ${dataAtual} • criado por chegaheitor` });

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`painelconfig_logs_channel_${commandName}`)
    .setPlaceholder('Escolha o canal de logs...')
    .addChannelTypes(ChannelType.GuildText);

  const btnConfirm = new ButtonBuilder().setCustomId(`painelconfig_btn_confirm_logs_${commandName}`).setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
  const btnDisable = new ButtonBuilder().setCustomId(`painelconfig_logs_disable_${commandName}`).setLabel('Desativar Log').setStyle(ButtonStyle.Danger).setEmoji('❌');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back_logs').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const rowChan = new ActionRowBuilder().addComponents(channelSelect);
  const rowBtns = new ActionRowBuilder().addComponents(btnConfirm, btnDisable, btnVoltar);

  return await updatePanel(interaction, { content: null, embeds: [embed], components: [rowChan, rowBtns] });
}

// Renderiza a tela de seleção de cargos para criação do Baú
async function showBauCreateRolesSelect(interaction, name, channelId) {
  const key = `${interaction.guildId}_${interaction.user.id}`;
  const pending = pendingConfigs.get(key);
  
  let roles = [];
  let isPending = false;
  if (pending && pending.type === 'bau_create') {
    roles = pending.roles;
    isPending = true;
  }
  
  const currentText = roles.length > 0
    ? roles.map(id => `<@&${id}>`).join(', ') + (isPending ? ' ⚠️ *(Pendente de Confirmação)*' : '')
    : '❌ *Nenhum cargo selecionado*';

  const selectRoles = new RoleSelectMenuBuilder()
    .setCustomId(`painelconfig_selectroles_bau_create_${name}_${channelId}`)
    .setPlaceholder('Selecione os cargos autorizados...')
    .setMinValues(1)
    .setMaxValues(5);

  const btnConfirm = new ButtonBuilder().setCustomId('painelconfig_btn_confirm_bau_create').setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
  const btnBack = new ButtonBuilder().setCustomId('painelconfig_btn_back_bau').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(selectRoles);
  const rowBack = new ActionRowBuilder().addComponents(btnConfirm, btnBack);

  return await updatePanel(interaction, {
    content: `Selecione até 5 cargos permitidos a adicionar/remover itens no baú **${name}** (<#${channelId}>):\n\n• **Cargos Selecionados:** ${currentText}`,
    components: [row, rowBack]
  });
}

// Painel de Logs
async function showLogsMenu(interaction) {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const commands = ['adv', 'status', 'listarbau', 'perfil', 'criarfarm', 'criarvenda', 'criarencomenda', 'criarausencia', 'criarrecrutamento'];
  
  const statusLines = commands.map(cmd => {
    const channelId = getLogChannel(cmd);
    const channelText = channelId ? `<#${channelId}>` : '❌ *Desativado*';
    return `• **/${cmd}**: ${channelText}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('📋 CONFIGURAÇÃO DE LOGS 📋')
    .setDescription(
      'Selecione no menu abaixo o comando que você deseja vincular ou desvincular a um canal de logs.\n\n' +
      '**Vínculos de logs atuais:**\n' +
      statusLines.join('\n')
    )
    .setColor(3447003)
    .setFooter({ text: `LuxBot Logs • ${dataAtual} • criado por chegaheitor` });

  const select = new StringSelectMenuBuilder()
    .setCustomId('painelconfig_logs_sel_cmd')
    .setPlaceholder('Selecione o comando para configurar...')
    .addOptions(commands.map(cmd => ({ label: `/${cmd}`, value: cmd })));

  const btnVoltar = new ButtonBuilder()
    .setCustomId('painelconfig_btn_back')
    .setLabel('Voltar ao Menu')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('↩️');

  const rowSel = new ActionRowBuilder().addComponents(select);
  const rowBtn = new ActionRowBuilder().addComponents(btnVoltar);

  return await updatePanel(interaction, { embeds: [embed], components: [rowSel, rowBtn] });
}

// Painel de Advertências
async function showAdvMenu(interaction) {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const adv = getAdvConfig();

  const alertsText = adv?.canalId ? `<#${adv.canalId}>` : '❌ *Não Configurado*';
  const revsText = adv?.canalRevogacaoId ? `<#${adv.canalRevogacaoId}>` : '❌ *Não Configurado*';
  const staffsText = adv?.cargosStaffIds && adv.cargosStaffIds.length > 0
    ? adv.cargosStaffIds.map(id => `<@&${id}>`).join(', ')
    : '❌ *Não Configurado*';
  
  const c1Ids = adv?.cargo1Ids || (adv?.cargo1Id ? [adv.cargo1Id] : []);
  const c2Ids = adv?.cargo2Ids || (adv?.cargo2Id ? [adv.cargo2Id] : []);
  const c3Ids = adv?.cargo3Ids || (adv?.cargo3Id ? [adv.cargo3Id] : []);

  const c1Text = c1Ids.length > 0 ? c1Ids.map(id => `<@&${id}>`).join(', ') : '❌';
  const c2Text = c2Ids.length > 0 ? c2Ids.map(id => `<@&${id}>`).join(', ') : '❌';
  const c3Text = c3Ids.length > 0 ? c3Ids.map(id => `<@&${id}>`).join(', ') : '❌';

  const embed = new EmbedBuilder()
    .setTitle('⚖️ CONFIGURAÇÃO DE ADVERTÊNCIAS ⚖️')
    .setDescription(
      'Configure os canais e regras do sistema de advertências oficiais e revogações:\n\n' +
      `• **📢 Canal de Alertas:** ${alertsText}\n` +
      `• **⚖️ Canal de Revogações:** ${revsText}\n` +
      `• **💼 Staffs Autorizados:** ${staffsText}\n` +
      `• **⚠️ Nível 1:** ${c1Text}\n` +
      `• **⚠️ Nível 2:** ${c2Text}\n` +
      `• **⚠️ Nível 3:** ${c3Text}`
    )
    .setColor(15158332)
    .setFooter({ text: `LuxBot Advertências • ${dataAtual} • criado por chegaheitor` });

  const btnChAlerts = new ButtonBuilder().setCustomId('painelconfig_btn_adv_ch_alertas').setLabel('Canal Alertas').setStyle(ButtonStyle.Primary).setEmoji('📢');
  const btnChRevs = new ButtonBuilder().setCustomId('painelconfig_btn_adv_ch_revocacoes').setLabel('Canal Revogações').setStyle(ButtonStyle.Primary).setEmoji('⚖️');
  const btnStaff = new ButtonBuilder().setCustomId('painelconfig_btn_adv_staff').setLabel('Alterar Staff').setStyle(ButtonStyle.Primary).setEmoji('💼');
  const btnCargos = new ButtonBuilder().setCustomId('painelconfig_btn_adv_cargos_adv').setLabel('Cargos Adv 1/2/3').setStyle(ButtonStyle.Primary).setEmoji('⚠️');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row1 = new ActionRowBuilder().addComponents(btnChAlerts, btnChRevs, btnStaff, btnCargos);
  const row2 = new ActionRowBuilder().addComponents(btnVoltar);

  return await updatePanel(interaction, { embeds: [embed], components: [row1, row2] });
}

// Painel de Farm
async function showFarmMenu(interaction) {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const farm = getGlobalFarmConfig();
  const materials = getFarmMaterials();

  const panelText = farm?.painelCanalId ? `<#${farm.painelCanalId}>` : '❌ *Não Configurado*';
  const catText = farm?.categoriaId ? `<#${farm.categoriaId}>` : '❌ *Não Configurado*';
  const staffsText = farm?.cargosAdminIds && farm.cargosAdminIds.length > 0
    ? farm.cargosAdminIds.map(id => `<@&${id}>`).join(', ')
    : '❌ *Não Configurado*';

  const embed = new EmbedBuilder()
    .setTitle('🌾 CONFIGURAÇÃO DE FARM 🌾')
    .setDescription(
      'Gerencie as pastas de farm automático, cargos autorizados e materiais cadastrados:\n\n' +
      `• **📢 Canal do Painel:** ${panelText}\n` +
      `• **📁 Categoria de Canais:** ${catText}\n` +
      `• **💼 Staffs de Farm:** ${staffsText}\n\n` +
      `• **🌾 Materiais de Farm Ativos:**\n${materials.map((m, i) => `  ${i+1}. **${m}**`).join('\n') || '  *Nenhum material cadastrado.*'}`
    )
    .setColor(3066993)
    .setFooter({ text: `LuxBot Farm • ${dataAtual} • criado por chegaheitor` });

  const btnChannels = new ButtonBuilder().setCustomId('painelconfig_btn_farm_channels').setLabel('Canais/Categoria').setStyle(ButtonStyle.Primary).setEmoji('📢');
  const btnRoles = new ButtonBuilder().setCustomId('painelconfig_btn_farm_roles').setLabel('Alterar Cargos').setStyle(ButtonStyle.Primary).setEmoji('👥');
  const btnMaterials = new ButtonBuilder().setCustomId('painelconfig_btn_farm_materials').setLabel('Editar Materiais').setStyle(ButtonStyle.Primary).setEmoji('🌾');
  const btnCriar = new ButtonBuilder().setCustomId('painelconfig_btn_farm_criar').setLabel('Criar Painel').setStyle(ButtonStyle.Success).setEmoji('➕');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row1 = new ActionRowBuilder().addComponents(btnChannels, btnRoles, btnMaterials, btnCriar);
  const row2 = new ActionRowBuilder().addComponents(btnVoltar);

  return await updatePanel(interaction, { embeds: [embed], components: [row1, row2] });
}

// Painel de Baús
async function showBauMenu(interaction) {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const baus = getBaus();
  const items = getBauItems();

  const activeChestsStr = baus.map((b, i) => `  ${i+1}. **${b.nome}** em <#${b.canalId}>`).join('\n') || '  *Nenhum baú cadastrado.*';

  const embed = new EmbedBuilder()
    .setTitle('📦 CONFIGURAÇÃO DE BAÚS 📦')
    .setDescription(
      'Configure os baús interativos do servidor e itens permitidos:\n\n' +
      `**📦 Baús Criados:**\n${activeChestsStr}\n\n` +
      `**📦 Itens de Inventário Ativos:**\n${items.map((it, i) => `  ${i+1}. **${it}**`).join('\n') || '  *Nenhum item cadastrado.*'}`
    )
    .setColor(12096338)
    .setFooter({ text: `LuxBot Baús • ${dataAtual} • criado por chegaheitor` });

  const btnCriar = new ButtonBuilder().setCustomId('painelconfig_btn_bau_criar_bau').setLabel('Criar Novo Baú').setStyle(ButtonStyle.Success).setEmoji('📦');
  const btnItems = new ButtonBuilder().setCustomId('painelconfig_btn_bau_items').setLabel('Editar Itens').setStyle(ButtonStyle.Primary).setEmoji('⚙️');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(btnCriar, btnItems, btnVoltar);

  return await updatePanel(interaction, { embeds: [embed], components: [row] });
}

// Renderizador Genérico para Vendas, Encomendas, Ausências e Recrutamento
async function showSimpleModuleMenu(interaction, moduleName) {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  
  let title = '';
  let color = 0;
  let statusLines = '';

  if (moduleName === 'venda') {
    title = '🛍️ CONFIGURAÇÃO DE VENDAS 🛍️';
    color = 2326507;
    const config = getGlobalVendaConfig();
    const forumText = config?.forumCanalId ? `<#${config.forumCanalId}>` : '❌ *Não Configurado*';
    const rolesText = config?.cargosPermitidosIds && config.cargosPermitidosIds.length > 0
      ? config.cargosPermitidosIds.map(id => `<@&${id}>`).join(', ')
      : '❌ *Não Configurado*';
    statusLines = `• **Fórum de Vendas:** ${forumText}\n• **Cargos Permitidos:** ${rolesText}`;
  } 
  
  else if (moduleName === 'encomenda') {
    title = '📦 CONFIGURAÇÃO DE ENCOMENDAS 📦';
    color = 15844367;
    const config = getGlobalEncomendaConfig();
    const forumText = config?.forumCanalId ? `<#${config.forumCanalId}>` : '❌ *Não Configurado*';
    const rolesText = config?.cargosPermitidosIds && config.cargosPermitidosIds.length > 0
      ? config.cargosPermitidosIds.map(id => `<@&${id}>`).join(', ')
      : '❌ *Não Configurado*';
    statusLines = `• **Fórum de Encomendas:** ${forumText}\n• **Cargos Permitidos:** ${rolesText}`;
  } 
  
  else if (moduleName === 'ausencia') {
    title = '🔴 CONFIGURAÇÃO DE AUSÊNCIAS 🔴';
    color = 15158332;
    const config = getGlobalAusenciaConfig();
    const chanText = config?.canalId ? `<#${config.canalId}>` : '❌ *Não Configurado*';
    const rolesText = config?.cargosPermitidosIds && config.cargosPermitidosIds.length > 0
      ? config.cargosPermitidosIds.map(id => `<@&${id}>`).join(', ')
      : '❌ *Não Configurado*';
    statusLines = `• **Canal do Painel:** ${chanText}\n• **Cargos Permitidos:** ${rolesText}`;
  } 
  
  else if (moduleName === 'recrutamento') {
    title = '👥 CONFIGURAÇÃO DE RECRUTAMENTO 👥';
    color = 3447003;
    const config = getGlobalRecrutamentoConfig();
    const welcomeText = config?.canalPainelId ? `<#${config.canalPainelId}>` : '❌ *Não Configurado*';
    const pedidosText = config?.canalPedidosId ? `<#${config.canalPedidosId}>` : '❌ *Não Configurado*';
    const logsText = config?.canalLogsNegadoId ? `<#${config.canalLogsNegadoId}>` : '❌ *Não Configurado*';
    const staffText = config?.cargosStaffIds && config.cargosStaffIds.length > 0
      ? config.cargosStaffIds.map(id => `<@&${id}>`).join(', ')
      : '❌ *Não Configurado*';
    
    statusLines = 
      `• **Canal do Painel (Bem-vindo):** ${welcomeText}\n` +
      `• **Canal de Pedidos (Aprovação):** ${pedidosText}\n` +
      `• **Canal de Logs Negados:** ${logsText}\n` +
      `• **Staffs Recrutadores:** ${staffText}`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `Gerencie as configurações básicas do módulo de **${moduleName}**:\n\n` +
      statusLines
    )
    .setColor(color)
    .setFooter({ text: `LuxBot ${moduleName.toUpperCase()} • ${dataAtual} • criado por chegaheitor` });

  const btnChannels = new ButtonBuilder().setCustomId(`painelconfig_btn_simple_channels_${moduleName}`).setLabel(moduleName === 'recrutamento' ? 'Canais' : 'Canal/Fórum').setStyle(ButtonStyle.Primary).setEmoji('📢');
  const btnRoles = new ButtonBuilder().setCustomId(`painelconfig_btn_simple_roles_${moduleName}`).setLabel('Cargos').setStyle(ButtonStyle.Primary).setEmoji('👥');
  const btnCriar = new ButtonBuilder().setCustomId(`painelconfig_btn_simple_criar_${moduleName}`).setLabel('Criar Painel').setStyle(ButtonStyle.Success).setEmoji('➕');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(btnChannels, btnRoles, btnCriar, btnVoltar);

  return await updatePanel(interaction, { embeds: [embed], components: [row] });
}
