import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import os from 'os';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Exibe informações de desempenho do bot (CPU, RAM e Rede).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function getCPUUsage() {
  const cpus = os.cpus();
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  const total = user + nice + sys + idle + irq;
  return { idle, total };
}

import fs from 'fs';

function getNetworkStats() {
  if (process.platform !== 'linux') return null;
  try {
    const data = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = data.split('\n');
    let rxBytes = 0;
    let txBytes = 0;
    for (const line of lines) {
      if (line.includes(':')) {
        const parts = line.split(':')[1].trim().split(/\s+/);
        rxBytes += parseInt(parts[0], 10) || 0; // Received
        txBytes += parseInt(parts[8], 10) || 0; // Transmitted
      }
    }
    return { rxBytes, txBytes };
  } catch {
    return null;
  }
}

export async function execute(interaction) {
  try {
    // Responder com "Calculando..." para que a interação não expire
    await interaction.deferReply({ ephemeral: true });

    // Medir início de CPU e Rede
    const startCPU = getCPUUsage();
    const startNet = getNetworkStats();

    // Aguardar 500ms para medir a variação de uso
    await sleep(500);

    // Medir fim de CPU e Rede
    const endCPU = getCPUUsage();
    const endNet = getNetworkStats();

    // 1. Calcular Uso de CPU
    const idleDiff = endCPU.idle - startCPU.idle;
    const totalDiff = endCPU.total - startCPU.total;
    const cpuPercentage = totalDiff > 0 ? (100 - (100 * idleDiff / totalDiff)).toFixed(2) : '0.00';

    // 2. Coletar Memória do Processo
    const processMemory = process.memoryUsage();
    const heapUsedMB = (processMemory.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMB = (processMemory.heapTotal / 1024 / 1024).toFixed(1);
    const rssMB = (processMemory.rss / 1024 / 1024).toFixed(1);

    // 3. Coletar Memória do Sistema
    const totalMemGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const freeMemGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
    const usedMemGB = (os.totalmem() - os.freemem());
    const usedMemGBStr = (usedMemGB / 1024 / 1024 / 1024).toFixed(1);

    // 4. Medir Latência de Rede (HTTP check)
    const startPing = Date.now();
    const hasNet = await fetch('https://www.google.com', { method: 'HEAD' })
      .then(() => true)
      .catch(() => false);
    const internetPing = hasNet ? `${Date.now() - startPing}ms` : 'Desconectado';

    const wsPing = `${interaction.client.ws.ping}ms`;

    // 5. Calcular Velocidade da Rede (apenas Linux)
    let downloadSpeed = 'N/A';
    let uploadSpeed = 'N/A';
    let netTotalInfo = '';

    if (startNet && endNet) {
      const rxDiff = endNet.rxBytes - startNet.rxBytes;
      const txDiff = endNet.txBytes - startNet.txBytes;

      // Converter bytes/500ms para MB/s ou KB/s
      // rxDiff / 0.5 segundos = bytes por segundo
      const rxSpeedBps = rxDiff / 0.5;
      const txSpeedBps = txDiff / 0.5;

      if (rxSpeedBps > 1024 * 1024) {
        downloadSpeed = `${(rxSpeedBps / 1024 / 1024).toFixed(2)} MB/s`;
      } else {
        downloadSpeed = `${(rxSpeedBps / 1024).toFixed(2)} KB/s`;
      }

      if (txSpeedBps > 1024 * 1024) {
        uploadSpeed = `${(txSpeedBps / 1024 / 1024).toFixed(2)} MB/s`;
      } else {
        uploadSpeed = `${(txSpeedBps / 1024).toFixed(2)} KB/s`;
      }

      const totalRxGB = (endNet.rxBytes / 1024 / 1024 / 1024).toFixed(2);
      const totalTxGB = (endNet.txBytes / 1024 / 1024 / 1024).toFixed(2);
      netTotalInfo = `\n📥 **Total Baixado:** ${totalRxGB} GB\n📤 **Total Enviado:** ${totalTxGB} GB`;
    }

    // Criar Embed de Status do Sistema
    const embed = new EmbedBuilder()
      .setTitle('📊 Painel de Status do Sistema')
      .setColor(2326507)
      .addFields(
        {
          name: '💻 Processamento (CPU)',
          value: `• **Uso de CPU:** ${cpuPercentage}%\n• **Cores:** ${os.cpus().length}\n• **Modelo:** ${os.cpus()[0].model.trim()}`,
          inline: false
        },
        {
          name: '🧠 Memória (RAM)',
          value: `• **Bot (heap):** ${heapUsedMB} MB / ${heapTotalMB} MB\n• **Bot (RSS):** ${rssMB} MB\n• **Sistema:** ${usedMemGBStr} GB / ${totalMemGB} GB free: ${freeMemGB} GB`,
          inline: false
        },
        {
          name: '🌐 Rede / Conectividade',
          value: `• **API Ping (Discord):** ${wsPing}\n• **Web Ping (Google):** ${internetPing}\n• **Velocidade Download:** ${downloadSpeed}\n• **Velocidade Upload:** ${uploadSpeed}${netTotalInfo}`,
          inline: false
        },
        {
          name: 'ℹ️ Informações Adicionais',
          value: `• **Uptime do Bot:** ${(process.uptime() / 60 / 60).toFixed(1)} horas\n• **Uptime do Sistema:** ${(os.uptime() / 60 / 60 / 24).toFixed(1)} dias\n• **S.O.:** ${os.type()} (${os.arch()})`,
          inline: false
        }
      )
      .setFooter({ text: 'Lux Bot Status • Criado por chegaheitor' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Erro ao executar o comando /status:', error);
    await interaction.editReply({ content: '❌ Ocorreu um erro ao obter os status do sistema.' }).catch(() => null);
  }
}
