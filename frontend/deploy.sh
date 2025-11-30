#!/bin/bash
set -euo pipefail

# === CARREGA VARIÁVEIS DO ARQUIVO .env ===
if [ -f ".env" ]; then
  echo "🔐 Carregando variáveis do .env..."
  export $(grep -v '^#' .env | xargs)
else
  echo "⚠️  Arquivo .env não encontrado!"
  exit 1
fi

# === CONFIGURAÇÕES ===
HOST="${FTP_HOST:-}"
USER="${FTP_USER:-}"
PASS="${FTP_PASS:-}"
REMOTE_DIR="${FTP_REMOTE_DIR:-htdocs}"
LOCAL_BUILD_DIR="${LOCAL_BUILD_DIR:-dist/nexo/browser}"

if [ -z "$HOST" ] || [ -z "$USER" ] || [ -z "$PASS" ]; then
  echo "❌ Erro: FTP_HOST, FTP_USER e FTP_PASS precisam estar definidos no .env"
  exit 1
fi

# === BUILD LOCAL ===
echo "🏗️  Executando build do projeto..."
npm run build

if [ ! -d "$LOCAL_BUILD_DIR" ]; then
  echo "❌ Erro: diretório '$LOCAL_BUILD_DIR' não encontrado."
  exit 1
fi

# === OBTÉM LISTA DE ARQUIVOS REMOTOS ===
echo "🔎 Listando arquivos remotos em $REMOTE_DIR ..."
mapfile -t REMOTE_FILES < <(
  lftp -u "$USER","$PASS" "$HOST" -e "
    set ftp:ssl-allow no
    set net:timeout 20
    set net:max-retries 2
    cd $REMOTE_DIR
    cls -1
    bye
  "
)

# Filtra apenas .js e .css
FILES_TO_DELETE=()
for fname in "${REMOTE_FILES[@]}"; do
  if [[ "$fname" == *.js || "$fname" == *.css ]]; then
    FILES_TO_DELETE+=("$fname")
  fi
done

if [ ${#FILES_TO_DELETE[@]} -eq 0 ]; then
  echo "ℹ️  Nenhum arquivo .js ou .css encontrado para apagar."
else
  echo "🧹 Apagando ${#FILES_TO_DELETE[@]} arquivos .js/.css no servidor..."

  # Monta a string de nomes escapados corretamente para o comando rm
  DELETE_CMD="rm"
  for f in "${FILES_TO_DELETE[@]}"; do
    # Escapa aspas duplas dentro dos nomes de arquivos
    safe_name="${f//\"/\\\"}"
    DELETE_CMD+=" $safe_name"
  done

  # Executa o rm em uma única chamada lftp
  lftp -u "$USER","$PASS" "$HOST" -e "
    set ftp:ssl-allow no
    set cmd:fail-exit yes
    set net:timeout 20
    set net:max-retries 2
    cd $REMOTE_DIR
    echo "Executando: $DELETE_CMD"
    $DELETE_CMD
    bye
  "

  echo "🗑️  Remoção concluída."
fi

# === DEPLOY VIA LFTP (MIRROR) ===
echo "⬆️ Iniciando upload (mirror -R) de '$LOCAL_BUILD_DIR' para '$REMOTE_DIR'..."
lftp -u "$USER","$PASS" "$HOST" -e "
  set ftp:ssl-allow no
  set cmd:fail-exit yes
  set net:timeout 20
  set net:max-retries 2
  cd $REMOTE_DIR
  mirror -R "$LOCAL_BUILD_DIR" .
  bye
"

echo "✅ Deploy concluído com sucesso!"
