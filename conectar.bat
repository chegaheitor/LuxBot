@echo off
:: ====================================================================
:: ATALHO PARA CONECTAR NA ORACLE CLOUD RAPIDAMENTE
:: ====================================================================
:: Instrução: Altere os dois caminhos/valores abaixo para os seus dados reais.
:: Depois disso, basta dar dois cliques neste arquivo para abrir a conexão!

set CHAVE_PRIVADA=C:\caminho\para\sua-chave.key
set IP_PUBLICO=SEU_IP_PUBLICO_DA_ORACLE

echo ==========================================================
echo Conectando na maquina virtual da Oracle (%IP_PUBLICO%)...
echo ==========================================================

ssh -i "%CHAVE_PRIVADA%" ubuntu@%IP_PUBLICO%

echo.
echo Conexao encerrada.
pause
