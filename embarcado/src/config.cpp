#include <SPIFFS.h>
#include <ArduinoJson.h>
#include "config.h"
#include "apiWifi.h"
#include "apiNexo.h"
#include "util.h"

String Config::wifiSsid, Config::wifiPass;
String Config::authToken;
ApiNexo::Sala Config::sala;

using namespace Config;

void salvar()
{
    File file = SPIFFS.open("/config.json", FILE_WRITE);
    if (!file)
    {
        Serial.println("❌ Falha ao abrir arquivo para escrita!");
        return;
    }

    DynamicJsonDocument doc(1024);
    doc["ssid"] = wifiSsid;
    doc["pass"] = wifiPass;
    doc["token"] = authToken;
    doc["sala"]["id"] = sala.id;
    doc["sala"]["nome"] = sala.nome;
    doc["sala"]["modelo"] = sala.modelo;
    doc["sala"]["brokerMqtt"]["host"] = sala.brokerMqtt.host;
    doc["sala"]["brokerMqtt"]["usuario"] = sala.brokerMqtt.usuario;
    doc["sala"]["brokerMqtt"]["senha"] = sala.brokerMqtt.senha;
    doc["sala"]["brokerMqtt"]["porta"] = sala.brokerMqtt.porta;

    serializeJson(doc, file);
    file.close();
}

bool carregar()
{
    if (!SPIFFS.exists("/config.json"))
        return false;
    File file = SPIFFS.open("/config.json", FILE_READ);
    if (!file)
        return false;

    DynamicJsonDocument doc(1024);
    if (deserializeJson(doc, file))
        return false;

    wifiSsid = doc["ssid"].as<String>();
    wifiPass = doc["pass"].as<String>();
    authToken = doc["token"].as<String>();
    sala.id = doc["sala"]["id"].as<String>();
    sala.nome = doc["sala"]["nome"].as<String>();
    sala.modelo = doc["sala"]["modelo"].as<String>();
    sala.brokerMqtt.host = doc["sala"]["brokerMqtt"]["host"].as<String>();
    sala.brokerMqtt.usuario = doc["sala"]["brokerMqtt"]["usuario"].as<String>();
    sala.brokerMqtt.senha = doc["sala"]["brokerMqtt"]["senha"].as<String>();
    sala.brokerMqtt.porta = doc["sala"]["brokerMqtt"]["porta"].as<uint16_t>();

    file.close();
    return true;
}

void configWifi(bool testarConfigAtual)
{
    if (testarConfigAtual)
    {
        if (ApiWifi::conectar(true))
            return;
        else
            Serial.println("Credenciais Wi-Fi desatualizadas. Configure-as novamente:");
    }

    while (true)
    {
        Serial.print("SSID WiFi: ");
        while (Serial.available() == 0)
            delay(1);

        wifiSsid = Serial.readStringUntil('\n');
        wifiSsid.trim();
        Serial.println(wifiSsid);

        Serial.print("Senha WiFi: ");
        while (Serial.available() == 0)
            delay(1);
        wifiPass = Serial.readStringUntil('\n');
        wifiPass.trim();
        for (int i = 0; i < wifiPass.length(); i++)
            Serial.print("*");
        Serial.println();

        if (ApiWifi::conectar(true))
            break;
        else
            Serial.println("Falha ao conectar ao Wi-Fi. Tente novamente:");
    }
}

void configNexo(bool testarConfigAtual)
{
    if (testarConfigAtual)
    {
        if (ApiNexo::validarToken(authToken))
            return;
        else
            Serial.println("Sessão Nexo expirada. Faça login novamente:");
    }

    while (true)
    {
        Serial.print("Usuário Nexo: ");
        while (Serial.available() == 0)
            ;
        String usuario = Serial.readStringUntil('\n');
        usuario.trim();
        Serial.println(usuario);

        Serial.print("Senha Nexo: ");
        while (Serial.available() == 0)
            ;
        String senha = Serial.readStringUntil('\n');
        senha.trim();
        for (int i = 0; i < senha.length(); i++)
            Serial.print("*");
        Serial.println();

        authToken = ApiNexo::login(usuario, senha);
        if (!authToken.isEmpty())
        {
            Serial.println(String() + "Conectado como \"" + usuario + "\"!");
            break;
        }
        else
            Serial.println("Usuário ou senha incorretos. Tente novamente:");
    }
}

void configSala(bool testarConfigAtual)
{
    if (testarConfigAtual)
    {
        if (ApiNexo::conectarSala())
            return;
        else
            Serial.println("ID da sala não é mais válido. Configure novamente:");
    }

    while (true)
    {
        Serial.print("ID da sala: ");
        while (Serial.available() == 0);
        sala.id = Serial.readStringUntil('\n');
        sala.id.trim();
        Serial.println(sala.id);

        if (ApiNexo::conectarSala())
        {
            Serial.println(String() + "Conectado à sala \"" + sala.nome + "\"!");
            break;
        }
        else
            Serial.println("ID da sala incorreto ou usuário não é proprietário. Tente novamente:");
    }
}

void Config::inicializar()
{
    bool manter = false;
    if (carregar())
    {
        Serial.print("✅ Configurações carregadas da memória. Deseja mantê-las [S/n]?");
        int escolha = serialPegarUm(5000, true);
        manter = escolha != 'n' && escolha != 'N';
    }
    else
    {
        Serial.println("🛠 Nenhuma configuração encontrada. Vamos configurar o dispositivo:");
    }
    configWifi(manter);
    configNexo(manter);
    configSala(manter);
    salvar();
}