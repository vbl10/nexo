# NEXO -- Plataforma de Laboratório Remoto

## 1. Visão Geral

O NEXO é uma plataforma distribuída para monitoramento e controle remoto
de experimentos físicos em laboratórios didáticos.\
A arquitetura é baseada em três camadas principais:

-   Frontend Web (Angular + TypeScript)
-   Backend (Node.js + Express + MySQL)
-   Sistema Embarcado (ESP32 + MQTT)

O sistema implementa controle bidirecional em tempo real via MQTT,
persistência estruturada de dados experimentais e transmissão de vídeo
por streaming.

------------------------------------------------------------------------

## 2. Arquitetura do Sistema

### 2.1 Modelo Arquitetural

A solução segue um modelo distribuído orientado a serviços:

\[ Navegador \] \| HTTPS \| \[ Backend API \] ---- MySQL \| MQTT Broker
\| Wi-Fi \| \[ ESP32 \]

Transmissão de vídeo ocorre paralelamente via Amazon IVS (RTMPS ingest +
Player SDK).

------------------------------------------------------------------------

## 3. Frontend

### 3.1 Stack Tecnológica

-   Angular
-   TypeScript
-   MQTT.js
-   WebWorkers
-   JWT (armazenado via LocalStorage)

### 3.2 Estrutura de Serviços

O frontend é organizado em serviços:

-   AuthService → gerenciamento de sessão e JWT
-   ApiService → abstração das chamadas REST
-   MqttService → abstração da comunicação MQTT

### 3.3 Comunicação MQTT

Canais implementados:

-   status
-   get
-   set
-   exp
-   iniciar-exp
-   parar-exp
-   sinc-exp

Mensagens são estruturadas em JSON.

### 3.4 Plotter

-   Atualização híbrida:
    -   Dados históricos via API (MySQL)
    -   Dados em tempo real via MQTT
-   Exportação em CSV

------------------------------------------------------------------------

## 4. Backend

### 4.1 Stack Tecnológica

-   Node.js
-   Express
-   TypeScript
-   MySQL2
-   JWT
-   CORS

### 4.2 Estrutura Modular

-   signup.ts
-   login.ts
-   salas.ts
-   experimentos.ts

### 4.3 Autenticação

-   JWT assinado no login
-   Token obrigatório nas rotas protegidas
-   Armazenamento no cliente via LocalStorage

### 4.4 Operações REST

Experimentos suportam:

-   GET
-   POST
-   PATCH
-   DELETE

------------------------------------------------------------------------

## 5. Banco de Dados

Modelo relacional com integridade referencial.

Principais tabelas:

-   usuarios
-   salas
-   salas_usuarios
-   mqtt_brokers
-   streams
-   experimentos
-   amostras

Relacionamentos:

-   usuarios ↔ salas (N:N)
-   salas → experimentos (1:N)
-   experimentos → amostras (1:N)
-   mqtt_brokers → salas (1:N)

A tabela amostras armazena dados binários para otimizar armazenamento de
grande volume.

------------------------------------------------------------------------

## 6. Sistema Embarcado

### 6.1 Hardware

-   ESP32
-   Conectividade Wi-Fi integrada
-   Armazenamento SPIFFS

### 6.2 Firmware

Desenvolvido em C++ (Arduino IDE).

Função setup(): - Recebe credenciais via Serial - Conecta à rede -
Autentica no backend - Obtém metadados da sala - Configura GPIO
dinamicamente - Conecta ao broker MQTT

Função loop(): - Leitura periódica de sensores - Publicação MQTT -
Execução de comandos recebidos - Gerenciamento de experimentos

### 6.3 Bibliotecas

-   MQTT.h
-   HTTPClient
-   ArduinoJson

------------------------------------------------------------------------

## 7. Streaming de Vídeo

-   Ingestão via RTMPS
-   Reprodução via IVS Player SDK
-   Canal criado dinamicamente por sala

------------------------------------------------------------------------

## 8. Requisitos de Implantação

### Backend

-   Node 18+
-   MySQL 8+

### Frontend

-   Node 18+
-   Angular CLI

### Embarcado

-   Arduino IDE
-   ESP32 Board Package

------------------------------------------------------------------------

## 9. Segurança

Limitações atuais:

-   Informações de conexão visíveis via DevTools
-   Não há criptografia ponta-a-ponta no MQTT

Melhorias recomendadas:

-   TLS no broker MQTT
-   Rotação de tokens
-   Controle de permissões por perfil
-   Obfuscação de endpoints sensíveis

------------------------------------------------------------------------
