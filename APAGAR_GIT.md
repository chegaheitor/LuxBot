# Tutorial: Como Limpar e Apagar Repositórios Git (Local e Servidor)

Este guia prático ensina como limpar clonagens antigas na Oracle Cloud e como reiniciar o histórico do Git do zero (caso tenha enviado chaves secretas ou queira limpar o histórico).

---

## 🗑️ Caso 1: Apagar a pasta clonada na Oracle Cloud (VM)
Se você clonou o bot na VM da Oracle no diretório errado, com chaves erradas, ou quer apenas deletar a pasta para fazer um clone limpo:

1. Acesse o terminal da sua VM no Oracle via SSH.
2. Execute o comando para apagar a pasta `LuxBot` e tudo dentro dela:
   ```bash
   rm -rf LuxBot
   ```
   *Nota: O parâmetro `-r` apaga diretórios recursivamente e o `-f` força a deleção sem pedir confirmação.*
3. Agora você pode clonar novamente usando o comando correto:
   ```bash
   git clone https://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@github.com/chegaheitor/LuxBot.git
   ```

---

## 🧹 Caso 2: Resetar o Git do Zero (Localmente) e Forçar no GitHub
Se você comitou acidentalmente algum arquivo com senhas/tokens (como `.env`) e quer apagar todo o histórico do Git para enviar o repositório totalmente limpo:

### No seu computador (Terminal Windows / PowerShell):
1. **Apague a pasta oculta `.git`** do projeto local para remover todo o histórico antigo:
   ```powershell
   Remove-Item -Recurse -Force .git
   ```
   *(Se estiver usando Git Bash ou Linux, use: `rm -rf .git`)*

2. **Inicie um novo repositório Git do zero**:
   ```bash
   git init
   ```

3. **Verifique se o seu `.gitignore` está configurado** para ignorar o `.env` (ele não deve ser enviado para o GitHub!). O arquivo `.gitignore` deve conter:
   ```text
   node_modules/
   .env
   *.log
   ```

4. **Adicione os arquivos e faça o primeiro commit**:
   ```bash
   git add .
   git commit -m "Initial commit (clean)"
   ```

5. **Defina o branch principal como `main`**:
   ```bash
   git branch -M main
   ```

6. **Associe ao seu repositório do GitHub**:
   ```bash
   git remote add origin https://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@github.com/chegaheitor/LuxBot.git
   ```

7. **Envie para o GitHub forçando a limpeza** do histórico antigo na nuvem:
   ```bash
   git push -u origin main --force
   ```
   > [!IMPORTANT]
   > O parâmetro `--force` substituirá todo o histórico antigo no GitHub pelo histórico novo e limpo.

---

## 🔒 Caso 3: Limpar Credenciais do Git salvas na VM
Se o Git na VM salvou chaves antigas em cache e você quer que ele pare de lembrar delas ou limpe o cache:

1. Limpar cache de credenciais do Git na máquina virtual:
   ```bash
   git config --global --unset credential.helper
   git config --system --unset credential.helper
   ```
