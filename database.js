import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('database.json');

// Inicializa o banco de dados se o arquivo não existir
export function initDatabase() {
  const defaultBauItems = ['Ferro', 'Madeira', 'Armas', 'Munição', 'Kits', 'Dinheiro', 'Outros'];
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ paineis: [], recrutas: [], farmPaineis: [], farmCanais: [], logChannels: {}, vendaPaineis: [], encomendaPaineis: [], ausenciaPaineis: [], baus: [], bauItems: defaultBauItems }, null, 2));
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      let modified = false;
      if (!data.paineis) { data.paineis = []; modified = true; }
      if (!data.recrutas) { data.recrutas = []; modified = true; }
      if (!data.farmPaineis) { data.farmPaineis = []; modified = true; }
      if (!data.farmCanais) { data.farmCanais = []; modified = true; }
      if (!data.logChannels) { data.logChannels = {}; modified = true; }
      if (!data.vendaPaineis) { data.vendaPaineis = []; modified = true; }
      if (!data.encomendaPaineis) { data.encomendaPaineis = []; modified = true; }
      if (!data.ausenciaPaineis) { data.ausenciaPaineis = []; modified = true; }
      if (!data.baus) { data.baus = []; modified = true; }
      if (!data.bauItems) { data.bauItems = defaultBauItems; modified = true; }
      if (modified) {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ paineis: [], recrutas: [], farmPaineis: [], farmCanais: [], logChannels: {}, vendaPaineis: [], encomendaPaineis: [], ausenciaPaineis: [], baus: [], bauItems: defaultBauItems }, null, 2));
    }
  }
}

// Retorna o objeto JSON completo do banco de dados
function getDatabase() {
  initDatabase();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler banco de dados JSON:', error);
    return { paineis: [], recrutas: [], farmPaineis: [], farmCanais: [] };
  }
}

// Salva o objeto JSON completo no banco de dados
function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao gravar no banco de dados JSON:', error);
    return false;
  }
}

// ==========================================
// MÓDULO: RECRUTAS E PAINÉIS DE EMBED
// ==========================================

export function getRecrutas() {
  return getDatabase().recrutas || [];
}

export function savePanelConfig(config) {
  const db = getDatabase();
  const paineis = db.paineis || [];
  const index = paineis.findIndex(p => p.canalPedidosId === config.canalPedidosId);

  if (index !== -1) {
    paineis[index] = { ...paineis[index], ...config, updatedAt: new Date().toISOString() };
  } else {
    paineis.push({ ...config, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  return saveDatabase({ ...db, paineis });
}

export function getPanelConfig(canalPedidosId) {
  const paineis = getDatabase().paineis || [];
  return paineis.find(p => p.canalPedidosId === canalPedidosId) || null;
}

export function savePendingRecruta(recrutaData) {
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === recrutaData.discordId);
  
  const record = {
    ...recrutaData,
    status: 'PENDENTE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (index !== -1) {
    recrutas[index] = { ...recrutas[index], ...record, createdAt: recrutas[index].createdAt || record.createdAt };
  } else {
    recrutas.push(record);
  }

  return saveDatabase({ ...db, recrutas });
}

export function updateRecrutaStatus(discordId, status, extraData = {}) {
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === discordId);

  if (index === -1) {
    console.warn(`Tentativa de atualizar status de recruta não localizado no banco: ${discordId}`);
    return false;
  }

  recrutas[index] = {
    ...recrutas[index],
    status: status,
    ...extraData,
    updatedAt: new Date().toISOString()
  };

  return saveDatabase({ ...db, recrutas });
}

// ==========================================
// MÓDULO: FARMS
// ==========================================

export function saveFarmPanel(config) {
  const db = getDatabase();
  const farmPaineis = db.farmPaineis || [];
  const index = farmPaineis.findIndex(p => p.painelCanalId === config.painelCanalId);

  if (index !== -1) {
    farmPaineis[index] = { ...farmPaineis[index], ...config, updatedAt: new Date().toISOString() };
  } else {
    farmPaineis.push({ ...config, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  return saveDatabase({ ...db, farmPaineis });
}

export function getFarmPanel(painelCanalId) {
  const farmPaineis = getDatabase().farmPaineis || [];
  return farmPaineis.find(p => p.painelCanalId === painelCanalId) || null;
}

export function saveFarmChannel(channelData) {
  const db = getDatabase();
  const farmCanais = db.farmCanais || [];
  const index = farmCanais.findIndex(c => c.canalId === channelData.canalId);

  if (index !== -1) {
    farmCanais[index] = { ...farmCanais[index], ...channelData, updatedAt: new Date().toISOString() };
  } else {
    farmCanais.push({ ...channelData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  return saveDatabase({ ...db, farmCanais });
}

export function getFarmChannel(canalId) {
  const farmCanais = getDatabase().farmCanais || [];
  return farmCanais.find(c => c.canalId === canalId) || null;
}

export function deleteFarmChannel(canalId) {
  const db = getDatabase();
  const farmCanais = db.farmCanais || [];
  const filtered = farmCanais.filter(c => c.canalId !== canalId);
  return saveDatabase({ ...db, farmCanais: filtered });
}

export function hasActiveFarmChannel(donoId) {
  const farmCanais = getDatabase().farmCanais || [];
  return farmCanais.some(c => c.donoId === donoId);
}

// Salva um farm confirmado na lista de históricos de um recruta
export function addConfirmedFarm(discordId, farmData) {
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === discordId);

  if (index === -1) {
    console.warn(`Tentativa de adicionar farm a recruta não cadastrado: ${discordId}`);
    return false;
  }

  if (!recrutas[index].farms) {
    recrutas[index].farms = [];
  }

  recrutas[index].farms.push({
    ...farmData,
    confirmedAt: new Date().toISOString()
  });

  return saveDatabase({ ...db, recrutas });
}

// Registra uma meta paga no perfil de um recruta
export function addPaidMeta(discordId, metaData) {
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === discordId);

  if (index === -1) {
    console.warn(`Tentativa de registrar meta paga a recruta não cadastrado: ${discordId}`);
    return false;
  }

  if (!recrutas[index].metasPagas) {
    recrutas[index].metasPagas = [];
  }

  recrutas[index].metasPagas.push({
    ...metaData,
    paidAt: new Date().toISOString()
  });

  // Também marcar no array geral de metas para histórico do /perfil
  if (recrutas[index].metas && recrutas[index].metas.length > 0) {
    const lastMeta = recrutas[index].metas[recrutas[index].metas.length - 1];
    lastMeta.paga = true;
    lastMeta.pagoPor = metaData.pagoPor;
    lastMeta.valorPago = metaData.valor;
    lastMeta.pagaAt = new Date().toISOString();
  }

  return saveDatabase({ ...db, recrutas });
}

// Retorna o canal de farm ativo do usuário
export function getActiveFarmChannel(donoId) {
  const farmCanais = getDatabase().farmCanais || [];
  return farmCanais.find(c => c.donoId === donoId) || null;
}

// Remove um farm confirmado do recruta
export function removeConfirmedFarm(discordId, item, quantidade, dataStr) {
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === discordId);

  if (index === -1 || !recrutas[index].farms) {
    return false;
  }

  const farmIndex = recrutas[index].farms.findIndex(f => 
    f.item === item && 
    f.quantidade === quantidade && 
    f.data === dataStr
  );

  if (farmIndex !== -1) {
    recrutas[index].farms.splice(farmIndex, 1);
    return saveDatabase({ ...db, recrutas });
  }

  return false;
}

// Remove o último registro de meta paga do recruta
export function removePaidMeta(discordId) {
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === discordId);

  if (index === -1 || !recrutas[index].metasPagas) {
    return false;
  }

  if (recrutas[index].metasPagas.length > 0) {
    recrutas[index].metasPagas.pop();
  }

  // Também reverter no array geral de metas para histórico do /perfil
  if (recrutas[index].metas && recrutas[index].metas.length > 0) {
    const lastMeta = recrutas[index].metas[recrutas[index].metas.length - 1];
    lastMeta.paga = false;
    delete lastMeta.pagoPor;
    delete lastMeta.valorPago;
    delete lastMeta.pagaAt;
  }

  return saveDatabase({ ...db, recrutas });
}

// Salva a lista de materiais customizados de farm
export function saveFarmMaterials(materials) {
  const db = getDatabase();
  db.farmMaterials = materials;
  return saveDatabase(db);
}

// Retorna a lista de materiais customizados ou o padrão
export function getFarmMaterials() {
  const db = getDatabase();
  return db.farmMaterials || ['Ferro', 'Madeira', 'Ouro', 'Dinheiro', 'Outros'];
}

// Salva o canal de log associado ao comando
export function saveLogChannel(commandName, channelId) {
  const db = getDatabase();
  if (!db.logChannels) db.logChannels = {};
  db.logChannels[commandName] = channelId;
  return saveDatabase(db);
}

// Retorna o canal de log associado ao comando
export function getLogChannel(commandName) {
  const db = getDatabase();
  if (!db.logChannels) return null;
  return db.logChannels[commandName] || null;
}

// Salva a configuração de painel de vendas no banco
export function saveVendaPanel(config) {
  const db = getDatabase();
  const vendaPaineis = db.vendaPaineis || [];
  const index = vendaPaineis.findIndex(p => p.forumCanalId === config.forumCanalId);

  if (index !== -1) {
    vendaPaineis[index] = { ...vendaPaineis[index], ...config, updatedAt: new Date().toISOString() };
  } else {
    vendaPaineis.push({ ...config, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  return saveDatabase({ ...db, vendaPaineis });
}

// Obtém a configuração de painel de vendas pelo canal de fórum
export function getVendaPanel(forumCanalId) {
  const vendaPaineis = getDatabase().vendaPaineis || [];
  return vendaPaineis.find(p => p.forumCanalId === forumCanalId) || null;
}

// Salva a configuração de painel de encomendas no banco
export function saveEncomendaPanel(config) {
  const db = getDatabase();
  const encomendaPaineis = db.encomendaPaineis || [];
  const index = encomendaPaineis.findIndex(p => p.forumCanalId === config.forumCanalId);

  if (index !== -1) {
    encomendaPaineis[index] = { ...encomendaPaineis[index], ...config, updatedAt: new Date().toISOString() };
  } else {
    encomendaPaineis.push({ ...config, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  return saveDatabase({ ...db, encomendaPaineis });
}

// Obtém a configuração de painel de encomendas pelo canal de fórum
export function getEncomendaPanel(forumCanalId) {
  const encomendaPaineis = getDatabase().encomendaPaineis || [];
  return encomendaPaineis.find(p => p.forumCanalId === forumCanalId) || null;
}

// Salva a configuração de painel de ausência no banco
export function saveAusenciaPanel(config) {
  const db = getDatabase();
  const ausenciaPaineis = db.ausenciaPaineis || [];
  const index = ausenciaPaineis.findIndex(p => p.canalId === config.canalId);

  if (index !== -1) {
    ausenciaPaineis[index] = { ...ausenciaPaineis[index], ...config, updatedAt: new Date().toISOString() };
  } else {
    ausenciaPaineis.push({ ...config, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  return saveDatabase({ ...db, ausenciaPaineis });
}

// Obtém a configuração de painel de ausência pelo canal
export function getAusenciaPanel(canalId) {
  const ausenciaPaineis = getDatabase().ausenciaPaineis || [];
  return ausenciaPaineis.find(p => p.canalId === canalId) || null;
}

// Obtém ou inicializa a ficha do membro no banco
export function getOrCreateRecruta(userId, tag = 'Desconhecido') {
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  let recruta = recrutas.find(r => r.discordId === userId);

  if (!recruta) {
    recruta = {
      discordId: userId,
      tag: tag,
      nome: 'Não registrado',
      gameId: 'Nenhum',
      status: 'NÃO_REGISTRADO',
      cargo: 'Nenhum',
      ausencias: [],
      vendas: [],
      encomendas: [],
      metas: []
    };
    recrutas.push(recruta);
    saveDatabase({ ...db, recrutas });
  } else {
    let updated = false;
    if (!recruta.ausencias) { recruta.ausencias = []; updated = true; }
    if (!recruta.vendas) { recruta.vendas = []; updated = true; }
    if (!recruta.encomendas) { recruta.encomendas = []; updated = true; }
    if (!recruta.metas) { recruta.metas = []; updated = true; }
    if (updated) {
      saveDatabase({ ...db, recrutas });
    }
  }
  return recruta;
}

export function addAusencia(userId, tag, data) {
  getOrCreateRecruta(userId, tag);
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === userId);
  if (index !== -1) {
    if (!recrutas[index].ausencias) recrutas[index].ausencias = [];
    recrutas[index].ausencias.push({
      ...data,
      timestamp: new Date().toISOString()
    });
    saveDatabase({ ...db, recrutas });
  }
}

export function addVenda(userId, tag, data) {
  getOrCreateRecruta(userId, tag);
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === userId);
  if (index !== -1) {
    if (!recrutas[index].vendas) recrutas[index].vendas = [];
    recrutas[index].vendas.push({
      ...data,
      timestamp: new Date().toISOString()
    });
    saveDatabase({ ...db, recrutas });
  }
}

export function addEncomenda(userId, tag, data) {
  getOrCreateRecruta(userId, tag);
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === userId);
  if (index !== -1) {
    if (!recrutas[index].encomendas) recrutas[index].encomendas = [];
    recrutas[index].encomendas.push({
      ...data,
      timestamp: new Date().toISOString()
    });
    saveDatabase({ ...db, recrutas });
  }
}

export function addMetaDeclarada(userId, tag, data) {
  getOrCreateRecruta(userId, tag);
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  const index = recrutas.findIndex(r => r.discordId === userId);
  if (index !== -1) {
    if (!recrutas[index].metas) recrutas[index].metas = [];
    recrutas[index].metas.push({
      ...data,
      paga: false,
      timestamp: new Date().toISOString()
    });
    saveDatabase({ ...db, recrutas });
  }
}

// Salva a configuração de baú no banco
export function saveBau(config) {
  const db = getDatabase();
  const baus = db.baus || [];
  const index = baus.findIndex(b => b.messageId === config.messageId);

  if (index !== -1) {
    baus[index] = { ...baus[index], ...config, updatedAt: new Date().toISOString() };
  } else {
    baus.push({ ...config, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  return saveDatabase({ ...db, baus });
}

// Obtém a configuração de baú pelo ID da mensagem
export function getBau(messageId) {
  const baus = getDatabase().baus || [];
  return baus.find(b => b.messageId === messageId) || null;
}

// Salva a lista de itens customizados de baú
export function saveBauItems(items) {
  const db = getDatabase();
  db.bauItems = items;
  return saveDatabase(db);
}

// Retorna a lista de itens do baú
export function getBauItems() {
  const db = getDatabase();
  return db.bauItems || ['Ferro', 'Madeira', 'Armas', 'Munição', 'Kits', 'Dinheiro', 'Outros'];
}



