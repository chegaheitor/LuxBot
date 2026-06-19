# Tutorial: Hospedagem do LuxBot na Oracle Cloud Free Tier (24/7)

Este guia ensina o passo a passo para pegar o código do seu bot, configurá-lo corretamente no Discord Developer Portal, criar uma máquina virtual gratuita na Oracle Cloud Infrastructure (OCI) e colocá-lo para rodar de forma contínua e persistente.

---

## 🛠️ Passo 1: Configurar o Bot no Discord Developer Portal

Antes de subir para a nuvem, precisamos garantir que o bot tenha o **Token** e as **Permissões** corretas.

1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications).
2. Clique no seu aplicativo (**LuxBot**).
3. No menu lateral esquerdo, vá em **Bot**.
4. Procure pela seção **Token** e clique em **Reset Token**.
5. Insira seu código de autenticação (se solicitado) e **copie o Token gerado**.
   > [!WARNING]
   > Salve este token em um local seguro. Ele é a senha do seu bot e não deve ser compartilhado nem enviado para repositórios públicos (como o GitHub).
6. Ainda na aba **Bot**, role para baixo até **Privileged Gateway Intents** e ative a opção:
   - **Presence Intent** (Opcional, mas útil no futuro)
   - **Server Members Intent** (Opcional, mas útil no futuro)
   - **Message Content Intent** (Se você for escutar mensagens normais além de comandos slash)
   > *Nota: Para o comando `/ping` atual (comando slash), os intents de gateway padrão são suficientes.*

### 🔗 Como Convidar o Bot para o seu Servidor
1. No menu lateral, vá em **OAuth2** > **URL Generator**.
2. Em **Scopes**, selecione:
   - `bot`
   - `applications.commands` (necessário para comandos slash)
3. Em **Bot Permissions** (que aparece abaixo), selecione:
   - `Send Messages`
   - `Use Slash Commands`
4. Copie a URL gerada no final da página, cole no seu navegador e selecione o servidor de testes para adicionar o bot.

---

## ☁️ Passo 2: Criar a Instância Gratuita na Oracle Cloud (OCI)

A Oracle Cloud oferece instâncias de computação gratuitas permanentemente (Always Free).

1. Acesse o console da [Oracle Cloud](https://cloud.oracle.com/) e faça login.
2. Na página inicial, clique em **Create a VM instance** (ou vá no menu lateral: **Compute** > **Instances** > **Create Instance**).
3. Defina um nome para sua máquina virtual (ex: `luxbot-instance`).
4. **Image and Shape (Imagem e Forma):**
   - **Image:** Clique em *Edit* e escolha **Canonical Ubuntu** (versão 22.04 LTS ou 24.04 LTS). É um sistema leve e excelente para rodar Node.js.
   - **Shape:** Escolha a opção gratuita:
     - `VM.Standard.E2.1.Micro` (AMD de 1 OCPU e 1 GB RAM) - **Suficiente para este bot**.
     - `VM.Standard.A1.Flex` (Ampere ARM - até 4 OCPU e 24 GB RAM gratuitos) - **Melhor desempenho, se disponível na sua região**.
5. **Networking (Rede):**
   - Deixe o padrão (Create a new Virtual Cloud Network).
   - Certifique-se de que a opção **Assign a public IPv4 address** esteja selecionada.
6. **SSH Keys (Chaves de Acesso):**
   - Selecione **Save private key** (e também a public key se desejar).
   - **Importante:** Baixe o arquivo `.key` (chave privada) para o seu computador. Você precisará dele para conectar na máquina.
7. Clique em **Create** no final da página. Aguarde alguns minutos até o status da instância mudar para **Running** (Verde).

---

## 🔑 Passo 3: Conectar na Máquina Virtual via SSH

Com o IP público da sua VM (exibido na página da Instância na OCI) e a chave privada baixada, abra o terminal do seu computador (PowerShell no Windows, Terminal no Linux/macOS ou Git Bash).

1. No Windows, navegue até a pasta onde a chave privada `.key` foi salva.
2. Execute o comando de conexão (substitua pelo nome do seu arquivo de chave e o IP público da máquina):
   ```bash
   ssh -i "caminho/para/sua-chave.key" ubuntu@IP_PUBLICO_DA_MÁQUINA
   ```
   > [!TIP]
   > Se receber um erro de permissão da chave no Windows/Linux, ajuste as permissões para leitura exclusiva. No Linux/macOS: `chmod 400 sua-chave.key`. No Windows PowerShell, certifique-se de que a chave está em uma pasta com privilégios do seu usuário.

---

## 📦 Passo 4: Instalar Node.js e Git na VM

Após conectar na VM via SSH, você verá o prompt do Ubuntu (`ubuntu@luxbot-instance:~$`). Siga as instruções abaixo para instalar as ferramentas:

1. Atualize o sistema:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
2. Instale o Node.js v20 (versão LTS recomendada):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. Verifique se a instalação foi bem-sucedida:
   ```bash
   node -v
   npm -v
   ```
4. Instale o Git (caso já não venha pré-instalado):
   ```bash
   sudo apt install git -y
   ```

---

## 🚀 Passo 5: Subir o Bot para a VM e Configurar

Você pode enviar seu código criando um repositório privado no GitHub (recomendado) ou enviando os arquivos via SCP. Usando a abordagem do **Git/GitHub**:

1. Suba o código do bot do seu computador para o seu repositório no GitHub (lembre-se de que o `.env` e `node_modules` estão no `.gitignore` e não serão enviados).
2. Na VM, clone o repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   ```
3. Acesse a pasta do projeto:
   ```bash
   cd SEU_REPOSITORIO
   ```
4. Instale as dependências de produção:
   ```bash
   npm install --omit=dev
   ```
5. Crie e configure o arquivo `.env` na VM usando o editor nano:
   ```bash
   nano .env
   ```
6. Copie as configurações a seguir para dentro do arquivo (substituindo pelos seus dados reais):
   ```env
   DISCORD_TOKEN=SEU_TOKEN_COPIADO_DO_PORTAL_DEVELOPER
   DISCORD_CLIENT_ID=1517353934400786615
   ```
7. Pressione `CTRL + O` para salvar, `ENTER` para confirmar e `CTRL + X` para sair do editor.

---

## ⚡ Passo 6: Registrar Comandos e Testar Localmente

Na VM, execute primeiro o deploy dos comandos slash:
```bash
node deploy-commands.js
```
*Você deve ver a mensagem: `Sucesso: 1 comando(s) slash registrados globalmente com êxito!`*

Agora, teste o bot rodando de forma direta:
```bash
node index.js
```
*Vá no Discord e digite `/ping` em um canal onde o bot está presente. Ele deve responder imediatamente.*
*Pressione `CTRL + C` no terminal para parar o bot após os testes.*

---

## 🔄 Passo 7: Manter o Bot Online 24/7 usando PM2

Se fecharmos o terminal SSH, o processo do bot é encerrado. Para mantê-lo rodando de forma contínua em segundo plano, utilizaremos o **PM2** (Process Manager).

1. Instale o PM2 globalmente na VM:
   ```bash
   sudo npm install -g pm2
   ```
2. Inicie o bot com o PM2:
   ```bash
   pm2 start index.js --name "luxbot"
   ```
3. Verifique se o bot está rodando corretamente:
   ```bash
   pm2 list
   ```
4. Configurar o PM2 para iniciar automaticamente caso a máquina virtual da Oracle Cloud seja reiniciada:
   ```bash
   pm2 startup
   ```
   *Este comando gerará uma linha de comando com `sudo env PATH=...`. **Copie e cole toda essa linha gerada no terminal** e execute.*
5. Salve o estado atual da lista de processos para persistir:
   ```bash
   pm2 save
   ```

### 💡 Comandos Úteis do PM2:
- **Ver logs em tempo real:** `pm2 logs luxbot`
- **Parar o bot:** `pm2 stop luxbot`
- **Reiniciar o bot:** `pm2 restart luxbot`
- **Ver consumo de CPU/RAM:** `pm2 monit`

Pronto! Seu bot está rodando de forma 100% gratuita, segura e online 24 horas por dia na Oracle Cloud! 🎉
