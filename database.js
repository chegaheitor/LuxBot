import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('database.json');

// Inicializa o banco de dados se o arquivo não existir
export function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ paineis: [], recrutas: [] }, null, 2));
  } else {
    // Garantir que as chaves existam se o arquivo já existir de iterações anteriores
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      let modified = false;
      if (!data.paineis) {
        data.paineis = [];
        modified = true;
      }
      if (!data.recrutas) {
        data.recrutas = [];
        modified = true;
      }
      if (modified) {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      // Se tiver erro de leitura de JSON corrompido, resetar
      fs.writeFileSync(DB_PATH, JSON.stringify({ paineis: [], recrutas: [] }, null, 2));
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
    return { paineis: [], recrutas: [] };
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

// Retorna a lista de todos os recrutas salvos
export function getRecrutas() {
  return getDatabase().recrutas || [];
}

// Salva as configurações de um painel de recrutamento (canais e cargos admin permitidos)
export function savePanelConfig(config) {
  const db = getDatabase();
  const paineis = db.paineis || [];
  const index = paineis.findIndex(p => p.canalPedidosId === config.canalPedidosId);

  if (index !== -1) {
    paineis[index] = {
      ...paineis[index],
      ...config,
      updatedAt: new Date().toISOString()
    };
  } else {
    paineis.push({
      ...config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return saveDatabase({ ...db, paineis });
}

// Retorna a configuração de um painel pelo ID do canal de pedidos
export function getPanelConfig(canalPedidosId) {
  const paineis = getDatabase().paineis || [];
  return paineis.find(p => p.canalPedidosId === canalPedidosId) || null;
}

// Salva as informações iniciais de um pedido de set (status: PENDENTE)
export function savePendingRecruta(recrutaData) {
  const db = getDatabase();
  const recrutas = db.recrutas || [];
  
  // Procura se já existe um registro para o mesmo ID do Discord
  const index = recrutas.findIndex(r => r.discordId === recrutaData.discordId);
  
  const record = {
    ...recrutaData,
    status: 'PENDENTE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (index !== -1) {
    // Se já existe, atualizamos as respostas do formulário
    recrutas[index] = {
      ...recrutas[index],
      ...record,
      createdAt: recrutas[index].createdAt || record.createdAt
    };
  } else {
    recrutas.push(record);
  }

  return saveDatabase({ ...db, recrutas });
}

// Atualiza o status do recruta após a ação do administrador (ACEITO ou NEGADO)
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
