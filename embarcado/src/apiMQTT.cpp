#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <MQTT.h> // MQTT by Joel Gaehwiler 2.5.2
#include "apiNexo.h"
#include "apiMQTT.h"
#include "config.h"
#include "sala.h"

constexpr int periodoAtualizacaoMs = 500; // periodo de espera entre envios de atualizações das variáveis dos sensores e atuadores

WiFiClientSecure net;
MQTTClient clienteMqtt;

using namespace ApiMQTT;

void ApiMQTT::conectar()
{
    Serial.println("🌐 Conectando ao broker MQTT...");
    clienteMqtt.setHost(Config::sala.brokerMqtt.host.c_str(), Config::sala.brokerMqtt.porta);
    net.setInsecure();
    clienteMqtt.connect("embarcado", Config::sala.brokerMqtt.usuario.c_str(), Config::sala.brokerMqtt.senha.c_str());
}

bool ApiMQTT::conectado()
{
    return clienteMqtt.connected();
}

bool ApiMQTT::enviarAmostras(unsigned int id, const std::vector<std::vector<float>>& amostras)
{
    JsonDocument doc;
    doc["id"] = id;
    JsonArray jaAmostras = doc["amostras"].to<JsonArray>();
    for (const auto& amostra : amostras) 
    {
        JsonArray jaAmostra = jaAmostras.add<JsonArray>();
        for (auto col: amostra) 
        {
            jaAmostra.add(col);
        }
    }
    String strDoc;
    serializeJson(doc, strDoc);
    return clienteMqtt.publish(String() + Config::sala.id + "/exp", strDoc);
}
bool ApiMQTT::fimExperimento(unsigned int idExperimento) 
{
    return clienteMqtt.publish(String() + Config::sala.id + "/fim-exp", String(idExperimento));
}

void aoConectar()
{
    Serial.println("✅ Conectado ao MQTT!");
    clienteMqtt.subscribe((Config::sala.id + "/get").c_str(), 1);
    clienteMqtt.subscribe((Config::sala.id + "/set").c_str(), 1);
    clienteMqtt.subscribe((Config::sala.id + "/iniciar-exp").c_str(), 1);
    clienteMqtt.subscribe((Config::sala.id + "/sinc-exp").c_str(), 1);
    clienteMqtt.subscribe((Config::sala.id + "/parar-exp").c_str(), 1);
}

void aoReceberMensagem(String &topico, String &payload)
{
    Serial.printf("📩 Mensagem recebida [%s]: %s\n", topico.c_str(), payload.c_str());

    topico = topico.substring(topico.indexOf('/') + 1);
    if (topico == "get")
    {
        if (payload == "status")
        {
            clienteMqtt.publish(Config::sala.id + "/status", sala.pegarValores());
        }
        else
        {
            JsonDocument doc;
            doc[payload] = sala.pegarValor(payload);
            String json;
            serializeJson(doc, json);
            clienteMqtt.publish(Config::sala.id + "/status", json);
        }
    }
    else if (topico == "set")
    {
        JsonDocument docEntrada;
        deserializeJson(docEntrada, payload);
        if (docEntrada.is<JsonObject>())
        {
            JsonDocument docSaida;
            for (const auto &jsonStringCodigo : docEntrada.as<JsonObject>())
            {
                String codigo = jsonStringCodigo.key().c_str();
                sala.definirValor(codigo, docEntrada[codigo].as<float>());
                docSaida[codigo] = sala.pegarValor(codigo);
            }
            String json;
            serializeJson(docSaida, json);
            clienteMqtt.publish(Config::sala.id + "/status", json);
        }
    }
    else if (topico == "iniciar-exp")
    {
        JsonDocument reqDoc;
        deserializeJson(reqDoc, payload);
        String nome = reqDoc["nome"];
        String codigo = reqDoc["codigo"];
        unsigned int periodoAmostragemMs = reqDoc["periodo"];
        unsigned int idExperimento = ApiNexo::iniciarExperimento(nome, periodoAmostragemMs);
        if (idExperimento != 0) {
            JsonDocument respDoc;
            respDoc["idExperimento"] = idExperimento;
            respDoc["codigoRequisicao"] = codigo;
            String resp;
            serializeJson(respDoc, resp);
            clienteMqtt.publish(Config::sala.id + "/novo-exp", resp);
        }
        else {
            //TODO: Tratar erro de criação de experimento
        }
    }
    else if (topico == "sinc-exp") 
    {
        ApiNexo::sincronizarExperimento();
    }
    else if (topico == "parar-exp")
    {
        ApiNexo::pararExperimento();
    }
}

void ApiMQTT::inicializar()
{
    clienteMqtt.begin(net);
    clienteMqtt.onMessage(aoReceberMensagem);
}

void enviarAtualizacoes()
{
    static uint32_t tp0 = 0;
    uint32_t tp1 = millis();
    if (tp1 > tp0 + periodoAtualizacaoMs)
    {
        tp0 = tp1;
        String alterados = sala.pegarValoresAlterados();
        if (!alterados.isEmpty())
            clienteMqtt.publish(Config::sala.id + "/status", alterados);
    }
}

void ApiMQTT::laco()
{
    static bool estavaConectado = false;
    static uint32_t tp0 = 0;
    uint32_t tp1 = millis();
    if (tp1 > tp0 + 10)
    {
        tp0 = tp1;
        if (conectado())
        {
            if (!estavaConectado)
            {
                estavaConectado = true;
                aoConectar();
            }
            clienteMqtt.loop();
            enviarAtualizacoes();
        }
        else
        {
            static uint32_t tp2 = 0;
            estavaConectado = false;
            if (WiFi.isConnected() && tp1 > tp2 + 15 * 1000)
            {
                tp2 = tp1;
                Serial.println("⚠️ MQTT desconectado! Tentando reconectar...");
                conectar();
            }
        }
    }
}