import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('database.json');

// Inicializa o banco de dados se o arquivo não existir
export function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ paineis: [], recrutas: [], farmPaineis: [], farmCanais: [] }, null, 2));
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      let modified = false;
      if (!data.paineis) { data.paineis = []; modified = true; }
      if (!data.recrutas) { data.recrutas = []; modified = true; }
      if (!data.farmPaineis) { data.farmPaineis = []; modified = true; }
      if (!data.farmCanais) { data.farmCanais = []; modified = true; }
      if (modified) {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ paineis: [], recrutas: [], farmPaineis: [], farmCanais: [] }, null, 2));
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
    return saveDatabase({ ...db, recrutas });
  }

  return false;
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

