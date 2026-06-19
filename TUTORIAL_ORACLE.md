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

Usaremos o comando Git com o seu token de acesso pessoal (PAT) para clonar o repositório diretamente no terminal da sua máquina virtual Oracle:

1. Na VM, clone o repositório rodando o seguinte comando:
   ```bash
   git clone https://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@github.com/chegaheitor/LuxBot.git
   ```
2. Acesse a pasta do projeto clonado:
   ```bash
   cd LuxBot
   ```
3. Instale as dependências de produção necessárias para rodar o bot:
   ```bash
   npm install --omit=dev
   ```
4. Crie e configure o arquivo `.env` contendo as credenciais do seu bot dentro do servidor da Oracle:
   ```bash
   nano .env
   ```
5. Copie e cole o seguinte conteúdo de configuração no editor nano da VM:
   ```env
DISCORD_TOKEN=MTUxNzM1MzkzNDQwMDc4NjYxNQ.G9eqrX.aoMHSHh7FnFi_va432rKZeIdPcdYCY8HIM3NWo
DISCORD_CLIENT_ID=1517353934400786615
   ```
6. No editor nano, pressione:
   - `CTRL + O` para salvar o arquivo.
   - `ENTER` para confirmar o nome do arquivo.
   - `CTRL + X` para fechar o editor.

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

---

## ⚡ Passo 8: Como Atualizar o Bot com Coisas Novas (Deploy de Atualizações)
Toda vez que você alterar o código do bot no seu computador local e quiser subir as alterações para a VM na Oracle Cloud, siga o procedimento abaixo:

### 1. No seu Computador (Local):
1. Salve todas as alterações no código.
2. Adicione e envie as alterações para o seu repositório GitHub:
   ```bash
   git add .
   git commit -m "Adicionando comando registroembed e modal"
   git push origin main
   ```

### 2. Na VM da Oracle Cloud (via SSH):
1. Acesse o terminal da sua VM.
2. Navegue até a pasta do projeto:
   ```bash
   cd LuxBot
   ```
3. Puxe as atualizações do GitHub:
   ```bash
   git pull
   ```
4. Se você adicionou novas dependências, instale-as:
   ```bash
   npm install --omit=dev
   ```
5. Atualize/Registre os novos comandos slash no Discord (como o `/registroembed`):
   ```bash
   npm run deploy
   ```
6. Reinicie o processo do bot no PM2 para aplicar o novo código:
   ```bash
   pm2 restart luxbot
   ```
7. Pronto! A nova versão do bot está ativa. Acompanhe os logs se quiser usando:
   ```bash
   pm2 logs luxbot
   ```

---

## 🔑 Bônus: Conexão Rápida com o Oracle Cloud (Sem digitar o comando longo)
Na pasta do projeto, criamos o arquivo `conectar.bat` para automatizar a abertura da conexão SSH:

1. Abra o arquivo [conectar.bat](file:///c:/Users/heito/Documents/LuxBot/conectar.bat) no seu editor de código local.
2. Edite os caminhos de acordo com os seus dados reais:
   - Defina em `set CHAVE_PRIVADA=` o caminho absoluto para o arquivo `.key` da sua chave privada (ex: `C:\Users\heito\Downloads\ssh-key-lux.key`).
   - Defina em `set IP_PUBLICO=` o IP público da sua instância Oracle.
3. Salve o arquivo.
4. Agora, sempre que o terminal fechar ou você quiser acessar a máquina, basta dar **dois cliques em `conectar.bat`** pelo Windows Explorer ou executá-lo no terminal para abrir o console da Oracle Cloud instantaneamente!
