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
  getFarmMaterials,
  saveFarmMaterials,
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
  saveGlobalRecrutamentoConfig,
  getGlobalPerfilConfig,
  saveGlobalPerfilConfig
} from '../database.js';
import { sendLog } from '../logs.js';

// Cache temporário para seleções de cargos no painel
const tempSelections = new Map();

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
  const perfil = getGlobalPerfilConfig();

  const advAlertStr = adv?.canalId ? `<#${adv.canalId}>` : '❌ *Não Configurado*';
  const advRevStr = adv?.canalRevogacaoId ? `<#${adv.canalRevogacaoId}>` : '❌ *Não Configurado*';
  const farmPanelStr = farm?.painelCanalId ? `<#${farm.painelCanalId}>` : '❌ *Não Configurado*';
  const vendaPanelStr = venda?.forumCanalId ? `<#${venda.forumCanalId}>` : '❌ *Não Configurado*';
  const encomendaPanelStr = encomenda?.forumCanalId ? `<#${encomenda.forumCanalId}>` : '❌ *Não Configurado*';
  const ausenciaPanelStr = ausencia?.canalId ? `<#${ausencia.canalId}>` : '❌ *Não Configurado*';
  const recPanelStr = recrutamento?.canalPainelId ? `<#${recrutamento.canalPainelId}>` : '❌ *Não Configurado*';
  const perfilPessoalCount = perfil?.cargosPessoalIds?.length || 0;
  const perfilAdminCount = perfil?.cargosAdminIds?.length || 0;

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
      `• **👥 Recrutamento**: Painel em ${recPanelStr}\n` +
      `• **👤 Perfil**: Pessoal: \`${perfilPessoalCount}\` cargo(s) | Admins: \`${perfilAdminCount}\` cargo(s)\n`
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
      { label: '👤 Perfil', description: 'Cargos autorizados a alterar informações de perfis', value: 'painelconfig_mod_perfil' },
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
    
    const btnDb = new ButtonBuilder()
      .setCustomId('painelconfig_btn_download_db')
      .setLabel('Baixar Banco de Dados')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💾');

    const btnClearAll = new ButtonBuilder()
      .setCustomId('painelconfig_btn_clear_all_db')
      .setLabel('Limpar Banco de Dados')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('💥');

    const rowBtns = new ActionRowBuilder().addComponents(btnDb, btnClearAll);

    await interaction.reply({
      embeds: [embed],
      components: [row, rowBtns]
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

    // MÓDULO PERFIL
    if (selected === 'painelconfig_mod_perfil') {
      return await showPerfilMenu(interaction);
    }

    // MÓDULOS DE FLUXO SIMPLES (Vendas, Encomendas, Ausências, Recrutamento)
    if (['painelconfig_mod_venda', 'painelconfig_mod_encomenda', 'painelconfig_mod_ausencia', 'painelconfig_mod_recrutamento'].includes(selected)) {
      const moduleName = selected.replace('painelconfig_mod_', '');
      return await showSimpleModuleMenu(interaction, moduleName);
    }
  }

  // ========================================================
  // 2. RETORNO AO MENU PRINCIPAL (BOTÃO VOLTAR) E AÇÕES DE DB
  // ========================================================
  if (interaction.isButton() && customId === 'painelconfig_btn_back') {
    try {
      const embed = generateMainEmbed();
      const row = generateMainRow();
      const btnDb = new ButtonBuilder()
        .setCustomId('painelconfig_btn_download_db')
        .setLabel('Baixar Banco de Dados')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💾');
      const btnClearAll = new ButtonBuilder()
        .setCustomId('painelconfig_btn_clear_all_db')
        .setLabel('Limpar Banco de Dados')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💥');
      const rowBtns = new ActionRowBuilder().addComponents(btnDb, btnClearAll);
      return await interaction.update({ embeds: [embed], components: [row, rowBtns] });
    } catch (e) {
      console.error(e);
    }
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_download_db') {
    try {
      return await interaction.reply({
        content: '📦 Aqui está o arquivo do banco de dados atualizado:',
        files: [{
          attachment: './database.json',
          name: 'database.json'
        }],
        ephemeral: true
      });
    } catch (error) {
      console.error('Erro ao enviar banco de dados:', error);
      return await interaction.reply({
        content: '❌ Ocorreu um erro ao tentar exportar o banco de dados.',
        ephemeral: true
      });
    }
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_clear_all_db') {
    const embedConfirm = new EmbedBuilder()
      .setTitle('💥 PERIGO: APAGAR TODO O BANCO DE DADOS 💥')
      .setDescription(
        'Você está prestes a **APAGAR TOTALMENTE** o banco de dados do bot!\n' +
        'Isso irá resetar todas as configurações de todos os módulos, deletar todas as fichas de membros, históricos de farm, ausências e baús cadastrados.\n\n' +
        '**⚠️ ESTA AÇÃO É ABSOLUTAMENTE IRREVERSÍVEL!**'
      )
      .setColor(15548997)
      .setTimestamp();

    const btnConfirm = new ButtonBuilder()
      .setCustomId('painelconfig_confirm_clear_all_db')
      .setLabel('Sim, Apagar Tudo')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('💣');

    const btnCancel = new ButtonBuilder()
      .setCustomId('painelconfig_btn_back')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌');

    const row = new ActionRowBuilder().addComponents(btnConfirm, btnCancel);
    return await interaction.update({ embeds: [embedConfirm], components: [row] });
  }

  if (interaction.isButton() && customId === 'painelconfig_confirm_clear_all_db') {
    try {
      const defaultBauItems = ['Ferro', 'Madeira', 'Armas', 'Munição', 'Kits', 'Dinheiro', 'Outros'];
      saveDatabase({
        paineis: [],
        recrutas: [],
        farmPaineis: [],
        farmCanais: [],
        logChannels: {},
        vendaPaineis: [],
        encomendaPaineis: [],
        ausenciaPaineis: [],
        baus: [],
        bauItems: defaultBauItems,
        advConfig: null
      });

      const embed = generateMainEmbed();
      const row = generateMainRow();
      const btnDb = new ButtonBuilder()
        .setCustomId('painelconfig_btn_download_db')
        .setLabel('Baixar Banco de Dados')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💾');
      const btnClearAll = new ButtonBuilder()
        .setCustomId('painelconfig_btn_clear_all_db')
        .setLabel('Limpar Banco de Dados')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💥');
      const rowBtns = new ActionRowBuilder().addComponents(btnDb, btnClearAll);

      await interaction.update({ embeds: [embed], components: [row, rowBtns] });
      return await interaction.followUp({
        content: '💥 O banco de dados do LuxBot foi completamente deletado e resetado para os valores de fábrica!',
        ephemeral: true
      });
    } catch (e) {
      console.error('Erro ao limpar todo o banco de dados:', e);
      return await interaction.reply({
        content: '❌ Ocorreu um erro ao limpar o banco de dados.',
        ephemeral: true
      }).catch(() => null);
    }
  }

  // ========================================================
  // 3. LIMPEZA DE CONFIGURAÇÃO (LIMPAR CONFIG)
  // ========================================================
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_clear_')) {
    const moduleName = customId.replace('painelconfig_btn_clear_', '');
    
    const embedConfirm = new EmbedBuilder()
      .setTitle('⚠️ CONFIRMAR EXCLUSÃO DE CONFIGURAÇÃO ⚠️')
      .setDescription(
        `Você tem certeza de que deseja limpar todas as configurações do módulo **${moduleName.toUpperCase()}**?\n` +
        `Esta ação é irreversível e irá apagar todos os canais, cargos e dados vinculados a este módulo no banco de dados local.`
      )
      .setColor(15548997)
      .setTimestamp();

    const btnConfirm = new ButtonBuilder()
      .setCustomId(`painelconfig_confirm_clear_${moduleName}`)
      .setLabel('Confirmar Limpeza')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️');

    const btnCancel = new ButtonBuilder()
      .setCustomId(`painelconfig_cancel_clear_${moduleName}`)
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌');

    const row = new ActionRowBuilder().addComponents(btnConfirm, btnCancel);
    return await interaction.update({ embeds: [embedConfirm], components: [row] });
  }

  if (interaction.isButton() && customId.startsWith('painelconfig_cancel_clear_')) {
    const moduleName = customId.replace('painelconfig_cancel_clear_', '');
    if (moduleName === 'logs') return await showLogsMenu(interaction);
    if (moduleName === 'adv') return await showAdvMenu(interaction);
    if (moduleName === 'farm') return await showFarmMenu(interaction);
    if (moduleName === 'bau') return await showBauMenu(interaction);
    if (moduleName === 'perfil') return await showPerfilMenu(interaction);
    if (moduleName.startsWith('simple_')) {
      const simpleMod = moduleName.replace('simple_', '');
      return await showSimpleModuleMenu(interaction, simpleMod);
    }
  }

  if (interaction.isButton() && customId.startsWith('painelconfig_confirm_clear_')) {
    const moduleName = customId.replace('painelconfig_confirm_clear_', '');
    
    if (moduleName === 'logs') {
      const db = getDatabase();
      db.logChannels = {};
      saveDatabase(db);
      await interaction.reply({ content: '✅ Todas as configurações de Logs foram limpas com sucesso!', ephemeral: true });
      return await showLogsMenu(interaction);
    }
    
    if (moduleName === 'adv') {
      saveAdvConfig(null);
      await interaction.reply({ content: '✅ Todas as configurações de Advertências foram limpas com sucesso!', ephemeral: true });
      return await showAdvMenu(interaction);
    }
    
    if (moduleName === 'farm') {
      const db = getDatabase();
      db.farmPaineis = [];
      db.farmCanais = [];
      delete db.farmMaterials;
      saveDatabase(db);
      await interaction.reply({ content: '✅ Todas as configurações de Farm foram limpas com sucesso!', ephemeral: true });
      return await showFarmMenu(interaction);
    }
    
    if (moduleName === 'bau') {
      const db = getDatabase();
      db.baus = [];
      delete db.bauItems;
      saveDatabase(db);
      await interaction.reply({ content: '✅ Todas as configurações de Baús foram limpas com sucesso!', ephemeral: true });
      return await showBauMenu(interaction);
    }
    
    if (moduleName === 'perfil') {
      saveGlobalPerfilConfig({ cargosPessoalIds: [], cargosAdminIds: [] });
      await interaction.reply({ content: '✅ Todas as configurações de Perfil foram limpas com sucesso!', ephemeral: true });
      return await showPerfilMenu(interaction);
    }
    
    if (moduleName.startsWith('simple_')) {
      const simpleMod = moduleName.replace('simple_', '');
      const db = getDatabase();
      if (simpleMod === 'venda') db.vendaPaineis = [];
      else if (simpleMod === 'encomenda') db.encomendaPaineis = [];
      else if (simpleMod === 'ausencia') db.ausenciaPaineis = [];
      else if (simpleMod === 'recrutamento') db.paineis = [];
      saveDatabase(db);
      await interaction.reply({ content: `✅ Todas as configurações do módulo **${simpleMod}** foram limpas com sucesso!`, ephemeral: true });
      return await showSimpleModuleMenu(interaction, simpleMod);
    }
  }

  // ========================================================
  // MÓDULO LOGS: CONFIGURAÇÕES E INTERAÇÕES
  // ========================================================
  if (interaction.isStringSelectMenu() && customId === 'painelconfig_logs_sel_cmd') {
    const commandName = interaction.values[0];
    
    const embed = new EmbedBuilder()
      .setTitle(`📋 CONFIGURAR LOG: /${commandName.toUpperCase()} 📋`)
      .setDescription(
        `Selecione abaixo o canal de texto para onde os logs do comando **/${commandName}** serão enviados.\n\n` +
        `Para desligar os logs deste comando, clique no botão **Desativar Log** abaixo.`
      )
      .setColor(3447003)
      .setFooter({ text: `LuxBot Logs • ${dataAtual} • criado por chegaheitor` });

    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(`painelconfig_logs_channel_${commandName}`)
      .setPlaceholder('Escolha o canal de logs...')
      .addChannelTypes(ChannelType.GuildText);

    const btnDisable = new ButtonBuilder()
      .setCustomId(`painelconfig_logs_disable_${commandName}`)
      .setLabel('Desativar Log')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌');

    const btnVoltar = new ButtonBuilder()
      .setCustomId('painelconfig_btn_back_logs')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');

    const rowChan = new ActionRowBuilder().addComponents(channelSelect);
    const rowBtns = new ActionRowBuilder().addComponents(btnDisable, btnVoltar);

    return await interaction.update({ embeds: [embed], components: [rowChan, rowBtns] });
  }

  if (interaction.isChannelSelectMenu() && customId.startsWith('painelconfig_logs_channel_')) {
    const commandName = customId.replace('painelconfig_logs_channel_', '');
    const channelId = interaction.values[0];
    
    saveLogChannel(commandName, channelId);

    await showLogsMenu(interaction);
    return await interaction.followUp({
      content: `✅ Logs do comando **/${commandName}** associados com sucesso ao canal <#${channelId}>!`,
      ephemeral: true
    });
  }

  if (interaction.isButton() && customId.startsWith('painelconfig_logs_disable_')) {
    const commandName = customId.replace('painelconfig_logs_disable_', '');
    
    saveLogChannel(commandName, null);

    await showLogsMenu(interaction);
    return await interaction.followUp({
      content: `📢 Logs do comando **/${commandName}** desativados com sucesso!`,
      ephemeral: true
    });
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_back_logs') {
    return await showLogsMenu(interaction);
  }

  // ========================================================
  // MÓDULO ADVERTÊNCIAS: CONFIGURAÇÕES E INTERAÇÕES
  // ========================================================
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_adv_')) {
    const action = customId.replace('painelconfig_btn_adv_', '');

    const btnBack = new ButtonBuilder()
      .setCustomId('painelconfig_btn_back_adv')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');
    const rowBack = new ActionRowBuilder().addComponents(btnBack);

    if (action === 'ch_alertas') {
      const select = new ChannelSelectMenuBuilder()
        .setCustomId('painelconfig_selectchan_adv_alertas')
        .setPlaceholder('Escolha o canal de alertas de Adv...')
        .addChannelTypes(ChannelType.GuildText);
      
      const row = new ActionRowBuilder().addComponents(select);
      return await interaction.update({
        content: 'Selecione abaixo o canal onde serão publicados os avisos das advertências aplicadas:',
        components: [row, rowBack]
      });
    }

    if (action === 'ch_revocacoes') {
      const select = new ChannelSelectMenuBuilder()
        .setCustomId('painelconfig_selectchan_adv_revocacoes')
        .setPlaceholder('Escolha o canal de solicitações de revogação...')
        .addChannelTypes(ChannelType.GuildText);
      
      const row = new ActionRowBuilder().addComponents(select);
      return await interaction.update({
        content: 'Selecione abaixo o canal onde a Staff receberá os pedidos de revogação das advertências:',
        components: [row, rowBack]
      });
    }

    if (action === 'staff') {
      const adv = getAdvConfig();
      const existingRoles = adv?.cargosStaffIds || [];

      const select = new RoleSelectMenuBuilder()
        .setCustomId('painelconfig_tempselect_adv_staff')
        .setPlaceholder('Escolha os cargos autorizados a aplicar/remover Adv...')
        .setMinValues(1)
        .setMaxValues(25);

      const btnSave = new ButtonBuilder()
        .setCustomId('painelconfig_save_adv_staff')
        .setLabel('Salvar Cargos')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💾');
      
      const btnBack = new ButtonBuilder()
        .setCustomId('painelconfig_btn_back_adv')
        .setLabel('Voltar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️');

      const row = new ActionRowBuilder().addComponents(select);
      const rowBtns = new ActionRowBuilder().addComponents(btnSave, btnBack);
      return await interaction.update({
        content: 'Selecione abaixo os cargos de Staff permitidos a aplicar/revogar advertências:',
        components: [row, rowBtns]
      });
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
    const adv = getAdvConfig();
    const getRolesForLevel = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return [val];
    };
    const existingRoles = getRolesForLevel(adv?.[`cargo${level}Id`]);

    const select = new RoleSelectMenuBuilder()
      .setCustomId(`painelconfig_tempselect_adv_cargo${level}`)
      .setPlaceholder(`Selecione os cargos para Adv ${level}...`)
      .setMinValues(1)
      .setMaxValues(25);
    
    const btnSave = new ButtonBuilder()
      .setCustomId(`painelconfig_save_adv_cargo${level}`)
      .setLabel('Salvar Cargos')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💾');

    const btnBack = new ButtonBuilder()
      .setCustomId('painelconfig_btn_adv_cargos_adv')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');
    
    const row = new ActionRowBuilder().addComponents(select);
    const rowBtns = new ActionRowBuilder().addComponents(btnSave, btnBack);

    return await interaction.update({
      content: `Selecione os cargos correspondentes ao acúmulo de **${level} advertência(s)** no servidor:`,
      components: [row, rowBtns]
    });
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_back_adv') {
    return await showAdvMenu(interaction);
  }

  // Tratar salvamentos de canais das advertências
  if (interaction.isChannelSelectMenu() && customId === 'painelconfig_selectchan_adv_alertas') {
    const config = getAdvConfig() || { canalId: '', canalRevogacaoId: '', cargo1Id: '', cargo2Id: '', cargo3Id: '', cargosStaffIds: [] };
    config.canalId = interaction.values[0];
    saveAdvConfig(config);
    await showAdvMenu(interaction);
    return await interaction.followUp({ content: '✅ Canal de alertas de advertência atualizado!', ephemeral: true });
  }

  if (interaction.isChannelSelectMenu() && customId === 'painelconfig_selectchan_adv_revocacoes') {
    const config = getAdvConfig() || { canalId: '', canalRevogacaoId: '', cargo1Id: '', cargo2Id: '', cargo3Id: '', cargosStaffIds: [] };
    config.canalRevogacaoId = interaction.values[0];
    saveAdvConfig(config);
    await showAdvMenu(interaction);
    return await interaction.followUp({ content: '✅ Canal de revogações de advertência atualizado!', ephemeral: true });
  }

  // ========================================================
  // MÓDULO FARM: CONFIGURAÇÕES E INTERAÇÕES
  // ========================================================
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_farm_')) {
    const action = customId.replace('painelconfig_btn_farm_', '');

    const btnBack = new ButtonBuilder()
      .setCustomId('painelconfig_btn_back_farm')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');
    const rowBack = new ActionRowBuilder().addComponents(btnBack);

    if (action === 'channels') {
      const selectPanel = new ChannelSelectMenuBuilder()
        .setCustomId('painelconfig_selectchan_farm_panel')
        .setPlaceholder('Escolha o canal onde ficará o Painel de Farm...')
        .addChannelTypes(ChannelType.GuildText);

      const selectCat = new ChannelSelectMenuBuilder()
        .setCustomId('painelconfig_selectchan_farm_category')
        .setPlaceholder('Escolha a categoria dos canais de farm dos membros...')
        .addChannelTypes(ChannelType.GuildCategory);

      const rowP = new ActionRowBuilder().addComponents(selectPanel);
      const rowC = new ActionRowBuilder().addComponents(selectCat);

      return await interaction.update({
        content: 'Configure abaixo o canal do painel e a categoria correspondente de farm:',
        components: [rowP, rowC, rowBack]
      });
    }

    if (action === 'roles') {
      const farm = getGlobalFarmConfig();
      const existingRoles = farm?.cargosAdminIds || [];

      const select = new RoleSelectMenuBuilder()
        .setCustomId('painelconfig_tempselect_farm')
        .setPlaceholder('Escolha os cargos autorizados a gerenciar metas e farms...')
        .setMinValues(1)
        .setMaxValues(25);

      const btnSave = new ButtonBuilder()
        .setCustomId('painelconfig_save_farm')
        .setLabel('Salvar Cargos')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💾');
      
      const btnBack = new ButtonBuilder()
        .setCustomId('painelconfig_btn_back_farm')
        .setLabel('Voltar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️');
      
      const row = new ActionRowBuilder().addComponents(select);
      const rowBtns = new ActionRowBuilder().addComponents(btnSave, btnBack);
      return await interaction.update({
        content: 'Selecione abaixo os cargos autorizados a gerenciar as metas e canais de farm:',
        components: [row, rowBtns]
      });
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

    await showFarmMenu(interaction);
    return await interaction.followUp({ content: `✅ Material **${name}** adicionado com sucesso!`, ephemeral: true });
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

    await showFarmMenu(interaction);
    return await interaction.followUp({ content: `✅ Material **${target}** removido com sucesso!`, ephemeral: true });
  }

  // Canais de Farm selecionados
  if (interaction.isChannelSelectMenu() && customId === 'painelconfig_selectchan_farm_panel') {
    const config = getGlobalFarmConfig() || { painelCanalId: '', categoriaId: '', cargosAdminIds: [] };
    config.painelCanalId = interaction.values[0];
    saveGlobalFarmConfig(config);
    await showFarmMenu(interaction);
    return await interaction.followUp({ content: '✅ Canal do Painel de Farm atualizado!', ephemeral: true });
  }

  if (interaction.isChannelSelectMenu() && customId === 'painelconfig_selectchan_farm_category') {
    const config = getGlobalFarmConfig() || { painelCanalId: '', categoriaId: '', cargosAdminIds: [] };
    config.categoriaId = interaction.values[0];
    saveGlobalFarmConfig(config);
    await showFarmMenu(interaction);
    return await interaction.followUp({ content: '✅ Categoria de canais de Farm atualizada!', ephemeral: true });
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
      .setCustomId(`painelconfig_tempselect_bau_create_${name}_${channelId}`)
      .setPlaceholder('Selecione os cargos autorizados...')
      .setMinValues(1)
      .setMaxValues(25);

    const btnSave = new ButtonBuilder()
      .setCustomId(`painelconfig_save_bau_create_${name}_${channelId}`)
      .setLabel('Salvar Cargos')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💾');

    const btnBack = new ButtonBuilder()
      .setCustomId('painelconfig_btn_back_bau')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');

    const row = new ActionRowBuilder().addComponents(selectRoles);
    const rowBtns = new ActionRowBuilder().addComponents(btnSave, btnBack);
    return await interaction.update({
      content: `Selecione os cargos permitidos a adicionar/remover itens no baú **${name}** (<#${channelId}>):`,
      components: [row, rowBtns]
    });
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

    await showBauMenu(interaction);
    return await interaction.followUp({ content: `✅ Item **${name}** cadastrado com sucesso para os baús!`, ephemeral: true });
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

    await showBauMenu(interaction);
    return await interaction.followUp({ content: `✅ Item **${target}** removido com sucesso dos baús!`, ephemeral: true });
  }

  // ========================================================
  // MÓDULO PERFIL: CONFIGURAÇÕES E INTERAÇÕES
  // ========================================================
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_perfil_')) {
    const action = customId.replace('painelconfig_btn_perfil_', '');
    
    if (action === 'roles_pessoal') {
      const select = new RoleSelectMenuBuilder()
        .setCustomId('painelconfig_tempselect_perfil_pessoal')
        .setPlaceholder('Escolha os cargos para dados pessoais...')
        .setMinValues(1)
        .setMaxValues(25);

      const btnSave = new ButtonBuilder()
        .setCustomId('painelconfig_save_perfil_pessoal')
        .setLabel('Salvar Cargos')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💾');

      const btnBack = new ButtonBuilder()
        .setCustomId('painelconfig_btn_back_perfil')
        .setLabel('Voltar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️');

      const row = new ActionRowBuilder().addComponents(select);
      const rowBtns = new ActionRowBuilder().addComponents(btnSave, btnBack);
      return await interaction.update({
        content: 'Selecione abaixo os cargos que podem alterar dados pessoais do perfil (Nome, ID, Telefone):',
        components: [row, rowBtns]
      });
    }

    if (action === 'roles_admin') {
      const select = new RoleSelectMenuBuilder()
        .setCustomId('painelconfig_tempselect_perfil_admin')
        .setPlaceholder('Escolha os cargos para dados administrativos...')
        .setMinValues(1)
        .setMaxValues(25);

      const btnSave = new ButtonBuilder()
        .setCustomId('painelconfig_save_perfil_admin')
        .setLabel('Salvar Cargos')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💾');

      const btnBack = new ButtonBuilder()
        .setCustomId('painelconfig_btn_back_perfil')
        .setLabel('Voltar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️');

      const row = new ActionRowBuilder().addComponents(select);
      const rowBtns = new ActionRowBuilder().addComponents(btnSave, btnBack);
      return await interaction.update({
        content: 'Selecione abaixo os cargos que podem alterar dados administrativos (Cargo, Recrutador, Set) e Excluir Perfis:',
        components: [row, rowBtns]
      });
    }
  }

  if (interaction.isButton() && customId === 'painelconfig_btn_back_perfil') {
    return await showPerfilMenu(interaction);
  }

  // ========================================================
  // MÓDULOS DE FLUXO SIMPLES: EDITAR CANAIS, CARGOS E CRIAR PAINEL
  // ========================================================
  if (interaction.isButton() && customId.startsWith('painelconfig_btn_simple_')) {
    const parts = customId.replace('painelconfig_btn_simple_', '').split('_');
    const action = parts[0];
    const moduleName = parts[1];

    const btnBack = new ButtonBuilder()
      .setCustomId(`painelconfig_btn_back_simple_${moduleName}`)
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');
    const rowBack = new ActionRowBuilder().addComponents(btnBack);

    // Alterar canais de fluxo simples
    if (action === 'channels') {
      if (moduleName === 'recrutamento') {
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

        return await interaction.update({
          content: 'Selecione abaixo os 3 canais de texto para o recrutamento:',
          components: [
            new ActionRowBuilder().addComponents(selectWelcome),
            new ActionRowBuilder().addComponents(selectPedidos),
            new ActionRowBuilder().addComponents(selectLogs),
            rowBack
          ]
        });
      } else {
        const isForum = ['venda', 'encomenda'].includes(moduleName);
        const channelTypes = isForum ? [ChannelType.GuildForum] : [ChannelType.GuildText];
        
        const select = new ChannelSelectMenuBuilder()
          .setCustomId(`painelconfig_selectchan_simple_${moduleName}`)
          .setPlaceholder(`Selecione o canal para ${moduleName}...`)
          .addChannelTypes(channelTypes);

        const row = new ActionRowBuilder().addComponents(select);
        return await interaction.update({
          content: `Selecione abaixo o canal/fórum correspondente ao módulo **${moduleName}**:`,
          components: [row, rowBack]
        });
      }
    }

    // Alterar cargos de fluxo simples
    if (action === 'roles') {
      let existingRoles = [];
      if (moduleName === 'venda') {
        existingRoles = getGlobalVendaConfig()?.cargosPermitidosIds || [];
      } else if (moduleName === 'encomenda') {
        existingRoles = getGlobalEncomendaConfig()?.cargosPermitidosIds || [];
      } else if (moduleName === 'ausencia') {
        existingRoles = getGlobalAusenciaConfig()?.cargosPermitidosIds || [];
      } else if (moduleName === 'recrutamento') {
        existingRoles = getGlobalRecrutamentoConfig()?.cargosStaffIds || [];
      }

      const select = new RoleSelectMenuBuilder()
        .setCustomId(`painelconfig_tempselect_simple_roles_${moduleName}`)
        .setPlaceholder(`Selecione os cargos para usar ${moduleName}...`)
        .setMinValues(1)
        .setMaxValues(25);

      const btnSave = new ButtonBuilder()
        .setCustomId(`painelconfig_save_simple_roles_${moduleName}`)
        .setLabel('Salvar Cargos')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💾');

      const btnBack = new ButtonBuilder()
        .setCustomId(`painelconfig_btn_back_simple_${moduleName}`)
        .setLabel('Voltar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️');

      const row = new ActionRowBuilder().addComponents(select);
      const rowBtns = new ActionRowBuilder().addComponents(btnSave, btnBack);
      return await interaction.update({
        content: `Selecione abaixo os cargos com permissão para usar/registrar no módulo **${moduleName}**:`,
        components: [row, rowBtns]
      });
    }

    if (action === 'staff') {
      let existingRoles = [];
      if (moduleName === 'venda') {
        existingRoles = getGlobalVendaConfig()?.cargosStaffIds || [];
      } else if (moduleName === 'encomenda') {
        existingRoles = getGlobalEncomendaConfig()?.cargosStaffIds || [];
      } else if (moduleName === 'ausencia') {
        existingRoles = getGlobalAusenciaConfig()?.cargosStaffIds || [];
      }

      const select = new RoleSelectMenuBuilder()
        .setCustomId(`painelconfig_tempselect_simple_staff_${moduleName}`)
        .setPlaceholder(`Selecione os cargos staff para gerenciar ${moduleName}...`)
        .setMinValues(1)
        .setMaxValues(25);

      const btnSave = new ButtonBuilder()
        .setCustomId(`painelconfig_save_simple_staff_${moduleName}`)
        .setLabel('Salvar Cargos')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💾');

      const btnBack = new ButtonBuilder()
        .setCustomId(`painelconfig_btn_back_simple_${moduleName}`)
        .setLabel('Voltar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️');

      const row = new ActionRowBuilder().addComponents(select);
      const rowBtns = new ActionRowBuilder().addComponents(btnSave, btnBack);
      return await interaction.update({
        content: `Selecione abaixo os cargos staff com permissão para gerenciar/auditar no módulo **${moduleName}**:`,
        components: [row, rowBtns]
      });
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
    return await showSimpleModuleMenu(interaction, moduleName);
  }

  // Tratar seleções de canal para módulos simples
  if (interaction.isChannelSelectMenu() && customId.startsWith('painelconfig_selectchan_simple_')) {
    const detail = customId.replace('painelconfig_selectchan_simple_', '');

    if (detail.startsWith('recrutamento_')) {
      const channelType = detail.replace('recrutamento_', '');
      const config = getGlobalRecrutamentoConfig() || { canalPainelId: '', canalPedidosId: '', canalLogsNegadoId: '', cargosStaffIds: [] };
      
      if (channelType === 'welcome') config.canalPainelId = interaction.values[0];
      if (channelType === 'pedidos') config.canalPedidosId = interaction.values[0];
      if (channelType === 'logs') config.canalLogsNegadoId = interaction.values[0];

      saveGlobalRecrutamentoConfig(config);
      await showSimpleModuleMenu(interaction, 'recrutamento');
      return await interaction.followUp({ content: `✅ Canal de recrutamento (${channelType}) salvo com sucesso!`, ephemeral: true });
    } else {
      const moduleName = detail;
      const channelId = interaction.values[0];

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

      await showSimpleModuleMenu(interaction, moduleName);
      return await interaction.followUp({ content: `✅ Canal do módulo **${moduleName}** atualizado!`, ephemeral: true });
    }
  }

  // ========================================================
  // TRATAMENTO DE SELEÇÃO TEMPORÁRIA E CONFIRMAÇÃO DE CARGOS
  // ========================================================

  // 1. Seleção temporária de cargos (não grava no banco imediatamente)
  if (interaction.isRoleSelectMenu() && customId.startsWith('painelconfig_tempselect_')) {
    const type = customId.replace('painelconfig_tempselect_', '');
    const rolesIds = interaction.values;
    
    // Armazenar no cache temporário
    const msgId = interaction.message.id;
    if (!tempSelections.has(msgId)) {
      tempSelections.set(msgId, {});
    }
    tempSelections.get(msgId)[type] = rolesIds;

    // Mostra a lista de cargos selecionados e o botão de salvar
    const cargosListStr = rolesIds.map(id => `<@&${id}>`).join(', ');
    
    // Criar o mesmo menu select novamente para que o usuário possa re-selecionar se quiser
    const originalSelect = new RoleSelectMenuBuilder()
      .setCustomId(interaction.component.customId || customId)
      .setPlaceholder(interaction.component.placeholder || 'Escolha os cargos...')
      .setMinValues(interaction.component.minValues ?? 1)
      .setMaxValues(interaction.component.maxValues ?? 25);
    
    // Botão salvar (agora o customId é fixo e dinâmico na leitura via cache!)
    const btnSave = new ButtonBuilder()
      .setCustomId(`painelconfig_save_${type}`)
      .setLabel('Salvar Cargos')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💾');
      
    // Botão Voltar (precisa ser dinâmico dependendo de onde viemos)
    let backCustomId = 'painelconfig_btn_back';
    if (type.startsWith('adv_cargo')) {
      backCustomId = 'painelconfig_btn_adv_cargos_adv';
    } else if (type === 'adv_staff') {
      backCustomId = 'painelconfig_btn_back_adv';
    } else if (type === 'farm') {
      backCustomId = 'painelconfig_btn_back_farm';
    } else if (type.startsWith('bau_create_')) {
      backCustomId = 'painelconfig_btn_back_bau';
    } else if (type.startsWith('perfil_')) {
      backCustomId = 'painelconfig_btn_back_perfil';
    } else if (type.startsWith('simple_roles_')) {
      const mod = type.replace('simple_roles_', '');
      backCustomId = `painelconfig_btn_back_simple_${mod}`;
    } else if (type.startsWith('simple_staff_')) {
      const mod = type.replace('simple_staff_', '');
      backCustomId = `painelconfig_btn_back_simple_${mod}`;
    } else if (type.startsWith('simple_')) {
      const mod = type.replace('simple_', '');
      backCustomId = `painelconfig_btn_back_simple_${mod}`;
    }
    
    const btnBack = new ButtonBuilder()
      .setCustomId(backCustomId)
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️');
      
    const rowSelect = new ActionRowBuilder().addComponents(originalSelect);
    const rowBtns = new ActionRowBuilder().addComponents(btnSave, btnBack);
    
    return await interaction.update({
      content: `**⚠️ Cargos selecionados para configurar:**\n${cargosListStr}\n\nClique em **Salvar Cargos** para confirmar a alteração no banco de dados.`,
      components: [rowSelect, rowBtns]
    });
  }

  // 2. Clique no botão de Salvar Cargos (grava no banco de dados)
  if (interaction.isButton() && customId.startsWith('painelconfig_save_')) {
    const payload = customId.replace('painelconfig_save_', '');
    const msgId = interaction.message.id;
    const tempRoles = tempSelections.get(msgId)?.[payload];
    
    if (payload === 'perfil_pessoal') {
      const roleIds = tempRoles || getGlobalPerfilConfig()?.cargosPessoalIds || [];
      const config = getGlobalPerfilConfig();
      config.cargosPessoalIds = roleIds;
      saveGlobalPerfilConfig(config);
      await showPerfilMenu(interaction);
      
      if (tempSelections.has(msgId)) {
        delete tempSelections.get(msgId)[payload];
      }
      return await interaction.followUp({ content: '✅ Cargos permitidos para alterar dados pessoais salvos!', ephemeral: true });
    }

    if (payload === 'perfil_admin') {
      const roleIds = tempRoles || getGlobalPerfilConfig()?.cargosAdminIds || [];
      const config = getGlobalPerfilConfig();
      config.cargosAdminIds = roleIds;
      saveGlobalPerfilConfig(config);
      await showPerfilMenu(interaction);
      
      if (tempSelections.has(msgId)) {
        delete tempSelections.get(msgId)[payload];
      }
      return await interaction.followUp({ content: '✅ Cargos permitidos para gerenciar dados administrativos salvos!', ephemeral: true });
    }
    
    if (payload === 'adv_staff') {
      const roleIds = tempRoles || getAdvConfig()?.cargosStaffIds || [];
      const config = getAdvConfig() || { canalId: '', canalRevogacaoId: '', cargo1Id: [], cargo2Id: [], cargo3Id: [], cargosStaffIds: [] };
      config.cargosStaffIds = roleIds;
      saveAdvConfig(config);
      await showAdvMenu(interaction);
      
      // Limpar cache temporário
      if (tempSelections.has(msgId)) {
        delete tempSelections.get(msgId)[payload];
      }
      return await interaction.followUp({ content: '✅ Cargos de Staff autorizados para Adv salvos!', ephemeral: true });
    }
    
    if (payload.startsWith('adv_cargo')) {
      const level = payload.charAt(9); // 1, 2, 3
      const getRolesForLevel = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        return [val];
      };
      const roleIds = tempRoles || getRolesForLevel(getAdvConfig()?.[`cargo${level}Id`]);
      const config = getAdvConfig() || { canalId: '', canalRevogacaoId: '', cargo1Id: [], cargo2Id: [], cargo3Id: [], cargosStaffIds: [] };
      config[`cargo${level}Id`] = roleIds;
      saveAdvConfig(config);
      await showAdvMenu(interaction);
      
      // Limpar cache temporário
      if (tempSelections.has(msgId)) {
        delete tempSelections.get(msgId)[payload];
      }
      return await interaction.followUp({ content: `✅ Cargos para o nível Adv ${level} configurados!`, ephemeral: true });
    }
    
    if (payload === 'farm') {
      const roleIds = tempRoles || getGlobalFarmConfig()?.cargosAdminIds || [];
      const config = getGlobalFarmConfig() || { painelCanalId: '', categoriaId: '', cargosAdminIds: [] };
      config.cargosAdminIds = roleIds;
      saveGlobalFarmConfig(config);
      await showFarmMenu(interaction);
      
      // Limpar cache temporário
      if (tempSelections.has(msgId)) {
        delete tempSelections.get(msgId)[payload];
      }
      return await interaction.followUp({ content: '✅ Cargos de gerenciamento de Farm salvos!', ephemeral: true });
    }
    
    if (payload.startsWith('bau_create_')) {
      // payload = bau_create_Nome_canalId
      const parts = payload.replace('bau_create_', '').split('_');
      const name = parts[0];
      const channelId = parts[1];
      const rolesIds = tempRoles || [];
      
      if (rolesIds.length === 0) {
        return await interaction.reply({
          content: '❌ Você precisa selecionar pelo menos 1 cargo autorizado antes de salvar!',
          ephemeral: true
        });
      }
      
      try {
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
          cargosPermitidosIds: rolesIds,
          itens: {}
        });

        await interaction.update({
          content: `✅ O baú **${name}** foi criado com sucesso no canal <#${channelId}>!`,
          components: []
        });

        // Log de Baú Criado
        const logEmbed = new EmbedBuilder()
          .setTitle('⚙️ Baú Criado')
          .setColor(3066993)
          .setDescription(`O administrador <@${interaction.user.id}> criou o baú **${name}** em <#${channelId}>.`)
          .addFields({ name: '💼 Cargos Autorizados:', value: rolesIds.map(id => `<@&${id}>`).join(', ') })
          .setTimestamp();

        await sendLog(interaction.client, guild, 'listarbau', logEmbed);
        
        // Limpar cache temporário
        if (tempSelections.has(msgId)) {
          delete tempSelections.get(msgId)[payload];
        }
      } catch (e) {
        console.error(e);
        await interaction.reply({ content: '❌ Erro ao instanciar o baú no canal.', ephemeral: true }).catch(() => null);
      }
      return;
    }
    
    if (payload.startsWith('simple_roles_') || payload.startsWith('simple_staff_') || payload.startsWith('simple_')) {
      const isStaffType = payload.startsWith('simple_staff_');
      const isRolesType = payload.startsWith('simple_roles_');
      
      let moduleName;
      if (isStaffType) moduleName = payload.replace('simple_staff_', '');
      else if (isRolesType) moduleName = payload.replace('simple_roles_', '');
      else moduleName = payload.replace('simple_', '');
      
      let existingRoles = [];
      if (moduleName === 'venda') {
        existingRoles = isStaffType 
          ? (getGlobalVendaConfig()?.cargosStaffIds || []) 
          : (getGlobalVendaConfig()?.cargosPermitidosIds || []);
      } else if (moduleName === 'encomenda') {
        existingRoles = isStaffType 
          ? (getGlobalEncomendaConfig()?.cargosStaffIds || []) 
          : (getGlobalEncomendaConfig()?.cargosPermitidosIds || []);
      } else if (moduleName === 'ausencia') {
        existingRoles = isStaffType 
          ? (getGlobalAusenciaConfig()?.cargosStaffIds || []) 
          : (getGlobalAusenciaConfig()?.cargosPermitidosIds || []);
      } else if (moduleName === 'recrutamento') {
        existingRoles = getGlobalRecrutamentoConfig()?.cargosStaffIds || [];
      }

      const rolesIds = tempRoles || existingRoles;
      
      if (moduleName === 'venda') {
        const config = getGlobalVendaConfig() || { forumCanalId: '', cargosPermitidosIds: [], cargosStaffIds: [] };
        if (isStaffType) config.cargosStaffIds = rolesIds;
        else config.cargosPermitidosIds = rolesIds;
        saveGlobalVendaConfig(config);
      } else if (moduleName === 'encomenda') {
        const config = getGlobalEncomendaConfig() || { forumCanalId: '', cargosPermitidosIds: [], cargosStaffIds: [] };
        if (isStaffType) config.cargosStaffIds = rolesIds;
        else config.cargosPermitidosIds = rolesIds;
        saveGlobalEncomendaConfig(config);
      } else if (moduleName === 'ausencia') {
        const config = getGlobalAusenciaConfig() || { canalId: '', cargosPermitidosIds: [], cargosStaffIds: [] };
        if (isStaffType) config.cargosStaffIds = rolesIds;
        else config.cargosPermitidosIds = rolesIds;
        saveGlobalAusenciaConfig(config);
      } else if (moduleName === 'recrutamento') {
        const config = getGlobalRecrutamentoConfig() || { canalPainelId: '', canalPedidosId: '', canalLogsNegadoId: '', cargosStaffIds: [] };
        config.cargosStaffIds = rolesIds;
        saveGlobalRecrutamentoConfig(config);
      }
      
      await showSimpleModuleMenu(interaction, moduleName);
      
      // Limpar cache temporário
      if (tempSelections.has(msgId)) {
        delete tempSelections.get(msgId)[payload];
      }
      return await interaction.followUp({ content: `✅ Cargos autorizados do módulo **${moduleName}** salvos!`, ephemeral: true });
    }
  }
}

// ========================================================
// FUNÇÕES AUXILIARES DE RENDERIZAÇÃO DE MENUS
// ========================================================

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

  const btnLimpar = new ButtonBuilder()
    .setCustomId('painelconfig_btn_clear_logs')
    .setLabel('Limpar Config')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🗑️');

  const btnVoltar = new ButtonBuilder()
    .setCustomId('painelconfig_btn_back')
    .setLabel('Voltar ao Menu')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('↩️');

  const rowSel = new ActionRowBuilder().addComponents(select);
  const rowBtn = new ActionRowBuilder().addComponents(btnLimpar, btnVoltar);

  return await interaction.update({ embeds: [embed], components: [rowSel, rowBtn] });
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
  const formatRoles = (val) => {
    if (!val) return '❌';
    if (Array.isArray(val)) {
      if (val.length === 0) return '❌';
      return val.map(id => `<@&${id}>`).join(', ');
    }
    return `<@&${val}>`;
  };

  const c1Text = formatRoles(adv?.cargo1Id);
  const c2Text = formatRoles(adv?.cargo2Id);
  const c3Text = formatRoles(adv?.cargo3Id);

  const embed = new EmbedBuilder()
    .setTitle('⚖️ CONFIGURAÇÃO DE ADVERTÊNCIAS ⚖️')
    .setDescription(
      'Configure os canais e regras do sistema de advertências oficiais e revogações:\n\n' +
      `• **📢 Canal de Alertas:** ${alertsText}\n` +
      `• **⚖️ Canal de Revogações:** ${revsText}\n` +
      `• **💼 Staffs Autorizados:** ${staffsText}\n` +
      `• **⚠️ Nível 1:** ${c1Text} | **Nível 2:** ${c2Text} | **Nível 3:** ${c3Text}`
    )
    .setColor(15158332)
    .setFooter({ text: `LuxBot Advertências • ${dataAtual} • criado por chegaheitor` });

  const btnChAlerts = new ButtonBuilder().setCustomId('painelconfig_btn_adv_ch_alertas').setLabel('Canal Alertas').setStyle(ButtonStyle.Primary).setEmoji('📢');
  const btnChRevs = new ButtonBuilder().setCustomId('painelconfig_btn_adv_ch_revocacoes').setLabel('Canal Revogações').setStyle(ButtonStyle.Primary).setEmoji('⚖️');
  const btnStaff = new ButtonBuilder().setCustomId('painelconfig_btn_adv_staff').setLabel('Alterar Staff').setStyle(ButtonStyle.Primary).setEmoji('💼');
  const btnCargos = new ButtonBuilder().setCustomId('painelconfig_btn_adv_cargos_adv').setLabel('Cargos Adv 1/2/3').setStyle(ButtonStyle.Primary).setEmoji('⚠️');
  const btnLimpar = new ButtonBuilder().setCustomId('painelconfig_btn_clear_adv').setLabel('Limpar Config').setStyle(ButtonStyle.Danger).setEmoji('🗑️');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row1 = new ActionRowBuilder().addComponents(btnChAlerts, btnChRevs, btnStaff, btnCargos);
  const row2 = new ActionRowBuilder().addComponents(btnLimpar, btnVoltar);

  return await interaction.update({ embeds: [embed], components: [row1, row2] });
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
  const btnLimpar = new ButtonBuilder().setCustomId('painelconfig_btn_clear_farm').setLabel('Limpar Config').setStyle(ButtonStyle.Danger).setEmoji('🗑️');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row1 = new ActionRowBuilder().addComponents(btnChannels, btnRoles, btnMaterials, btnCriar);
  const row2 = new ActionRowBuilder().addComponents(btnLimpar, btnVoltar);

  return await interaction.update({ embeds: [embed], components: [row1, row2] });
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
  const btnLimpar = new ButtonBuilder().setCustomId('painelconfig_btn_clear_bau').setLabel('Limpar Config').setStyle(ButtonStyle.Danger).setEmoji('🗑️');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(btnCriar, btnItems, btnLimpar, btnVoltar);

  return await interaction.update({ embeds: [embed], components: [row] });
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
    const staffText = config?.cargosStaffIds && config.cargosStaffIds.length > 0
      ? config.cargosStaffIds.map(id => `<@&${id}>`).join(', ')
      : '❌ *Não Configurado*';
    statusLines = `• **Fórum de Vendas:** ${forumText}\n• **Cargos Permitidos (Vender):** ${rolesText}\n• **Cargos Staff (Gerenciar):** ${staffText}`;
  } 
  
  else if (moduleName === 'encomenda') {
    title = '📦 CONFIGURAÇÃO DE ENCOMENDAS 📦';
    color = 15844367;
    const config = getGlobalEncomendaConfig();
    const forumText = config?.forumCanalId ? `<#${config.forumCanalId}>` : '❌ *Não Configurado*';
    const rolesText = config?.cargosPermitidosIds && config.cargosPermitidosIds.length > 0
      ? config.cargosPermitidosIds.map(id => `<@&${id}>`).join(', ')
      : '❌ *Não Configurado*';
    const staffText = config?.cargosStaffIds && config.cargosStaffIds.length > 0
      ? config.cargosStaffIds.map(id => `<@&${id}>`).join(', ')
      : '❌ *Não Configurado*';
    statusLines = `• **Fórum de Encomendas:** ${forumText}\n• **Cargos Permitidos (Pedir):** ${rolesText}\n• **Cargos Staff (Gerenciar):** ${staffText}`;
  } 
  
  else if (moduleName === 'ausencia') {
    title = '🔴 CONFIGURAÇÃO DE AUSÊNCIAS 🔴';
    color = 15158332;
    const config = getGlobalAusenciaConfig();
    const chanText = config?.canalId ? `<#${config.canalId}>` : '❌ *Não Configurado*';
    const rolesText = config?.cargosPermitidosIds && config.cargosPermitidosIds.length > 0
      ? config.cargosPermitidosIds.map(id => `<@&${id}>`).join(', ')
      : '❌ *Não Configurado*';
    const staffText = config?.cargosStaffIds && config.cargosStaffIds.length > 0
      ? config.cargosStaffIds.map(id => `<@&${id}>`).join(', ')
      : '❌ *Não Configurado*';
    statusLines = `• **Canal do Painel:** ${chanText}\n• **Cargos Permitidos (Ausentar):** ${rolesText}\n• **Cargos Staff (Gerenciar):** ${staffText}`;
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
  
  let btnRolesLabel = 'Cargos';
  if (['venda', 'encomenda', 'ausencia'].includes(moduleName)) {
    btnRolesLabel = 'Cargos Registro';
  }
  const btnRoles = new ButtonBuilder().setCustomId(`painelconfig_btn_simple_roles_${moduleName}`).setLabel(btnRolesLabel).setStyle(ButtonStyle.Primary).setEmoji('👥');
  const btnCriar = new ButtonBuilder().setCustomId(`painelconfig_btn_simple_criar_${moduleName}`).setLabel('Criar Painel').setStyle(ButtonStyle.Success).setEmoji('➕');
  const btnLimpar = new ButtonBuilder().setCustomId(`painelconfig_btn_clear_simple_${moduleName}`).setLabel('Limpar Config').setStyle(ButtonStyle.Danger).setEmoji('🗑️');
  const btnVoltar = new ButtonBuilder().setCustomId('painelconfig_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('↩️');

  let components = [];
  if (['venda', 'encomenda', 'ausencia'].includes(moduleName)) {
    const btnStaff = new ButtonBuilder().setCustomId(`painelconfig_btn_simple_staff_${moduleName}`).setLabel('Cargos Staff').setStyle(ButtonStyle.Primary).setEmoji('👮');
    const row1 = new ActionRowBuilder().addComponents(btnChannels, btnRoles, btnStaff);
    const row2 = new ActionRowBuilder().addComponents(btnCriar, btnLimpar, btnVoltar);
    components = [row1, row2];
  } else {
    const row = new ActionRowBuilder().addComponents(btnChannels, btnRoles, btnCriar, btnLimpar, btnVoltar);
    components = [row];
  }

  return await interaction.update({ embeds: [embed], components: components });
}

// Painel de Perfil
async function showPerfilMenu(interaction) {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const perfil = getGlobalPerfilConfig();

  const pessoalText = perfil?.cargosPessoalIds && perfil.cargosPessoalIds.length > 0
    ? perfil.cargosPessoalIds.map(id => `<@&${id}>`).join(', ')
    : '❌ *Não Configurado*';

  const adminText = perfil?.cargosAdminIds && perfil.cargosAdminIds.length > 0
    ? perfil.cargosAdminIds.map(id => `<@&${id}>`).join(', ')
    : '❌ *Não Configurado*';

  const embed = new EmbedBuilder()
    .setTitle('👤 CONFIGURAÇÃO DE PERFIL 👤')
    .setDescription(
      'Configure os cargos autorizados a editar e gerenciar as fichas de perfil do LuxBot:\n\n' +
      `• **👤 Alteração de Dados Pessoais:** ${pessoalText}\n*(Cargos autorizados a alterar Nome, ID e Telefone)*\n\n` +
      `• **👮 Alteração Administrativa & Exclusão:** ${adminText}\n*(Cargos autorizados a alterar Cargo, Recrutador, Set e Excluir Perfil)*`
    )
    .setColor(3447003)
    .setFooter({ text: `LuxBot Perfil • ${dataAtual} • criado por chegaheitor` });

  const btnPessoal = new ButtonBuilder()
    .setCustomId('painelconfig_btn_perfil_roles_pessoal')
    .setLabel('Cargos Pessoais')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('👤');

  const btnAdmin = new ButtonBuilder()
    .setCustomId('painelconfig_btn_perfil_roles_admin')
    .setLabel('Cargos Admins')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('👮');

  const btnLimpar = new ButtonBuilder()
    .setCustomId('painelconfig_btn_clear_perfil')
    .setLabel('Limpar Config')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🗑️');

  const btnVoltar = new ButtonBuilder()
    .setCustomId('painelconfig_btn_back')
    .setLabel('Voltar')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('↩️');

  const row = new ActionRowBuilder().addComponents(btnPessoal, btnAdmin, btnLimpar, btnVoltar);

  return await interaction.update({ embeds: [embed], components: [row] });
}
