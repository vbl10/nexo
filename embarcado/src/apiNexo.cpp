#include <vector>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include "apiMQTT.h"
#include "apiNexo.h"
#include "config.h"
#include "sala.h"
#include <mutex>

const char *urlBase = "https://zb00jfnlm6.execute-api.sa-east-1.amazonaws.com";
constexpr unsigned int periodoSalvarAmostrasNoBancoMs = 5 * 60 * 1000;
constexpr unsigned int tamMaxAmostras = 1000;
constexpr unsigned int tamMaxEnvioBanco = 30;
constexpr int maxTentativasPararExperimento = 10;
constexpr int periodoTentarPararExperimentoNovamenteMs = 10 * 1000;

unsigned int idExperimento;
int qtdNovasAmostras = 0;
bool emExperimento = false;
bool enviandoMensagemMqttFimExperimento = false;
int tentativasPararExperimento = 0;
uint32_t periodoAmostragemMs;
unsigned int idAmostra = 0;
std::vector<std::vector<float>> amostras;
std::mutex mtx;

bool tratarRespostaApi(const String& nomeRequisicao, JsonDocument& doc, const String& resposta)
{
    auto erro = deserializeJson(doc, resposta);
    if (erro)
    {
        Serial.println('[' + nomeRequisicao + "]: Erro desserializando JSON: " + erro.c_str());
        Serial.println(resposta);
        return false;
    }
    if (doc["status"].as<String>() != "ok")
    {
        Serial.println(
            '[' + nomeRequisicao + "]: Erro apiNexo: " + (
                doc.containsKey("erro") 
                ? doc["erro"].as<String>().c_str() 
                : "impressão de erros suprimida pelas configurações do servidor"
            )
        );
        return false;
    }
    return true;
}

String ApiNexo::login(String usuario, String senha)
{
    HTTPClient http;
    http.begin(String() + urlBase + "/usuarios/login");
    http.addHeader("Content-Type", "application/json");
    http.POST(String() + "{\"usuario\":\"" + usuario + "\",\"senha\":\"" + senha + "\"}");
    JsonDocument doc;
    bool ok = tratarRespostaApi("login", doc, http.getString());
    http.end();
    return ok ? doc["token"].as<String>() : "";
}

bool ApiNexo::validarToken(String token)
{
    // TODO: chamar api de validação de token
    return !token.isEmpty();
}

bool ApiNexo::conectarSala()
{
    ApiNexo::Sala& sala = Config::sala;

    HTTPClient http;
    http.begin(
        String() + urlBase + "/salas?"
        "id=" + sala.id + "&"
        "auth=" + Config::authToken
    );
    http.GET();
    JsonDocument doc;
    bool ok = tratarRespostaApi("conectarSala", doc, http.getString());
    http.end();

    if (!ok)
        return false;

    JsonObject objSala = doc["sala"];

    if (!objSala["proprietario"].as<bool>())
    {
        Serial.println("Usuário não é proprietário da sala.");
        return false;
    }

    idExperimento = objSala["id_experimento"].as<unsigned int>();
    sala.id = objSala["id"].as<String>();
    sala.nome = objSala["nome"].as<String>();
    serializeJson(objSala["modelo"], sala.modelo);
    sala.brokerMqtt.host = objSala["mqtt_broker"]["host"].as<String>();
    sala.brokerMqtt.porta = objSala["mqtt_broker"]["porta"].as<uint16_t>();
    sala.brokerMqtt.usuario = objSala["mqtt_broker"]["username"].as<String>();
    sala.brokerMqtt.senha = objSala["mqtt_broker"]["password"].as<String>();

    return true;
}

void salvarAmostrasNoBanco()
{
    mtx.lock();
    const int qtdTotalAmostrasParaSalvar = amostras.size() - qtdNovasAmostras; // Não salvar/apagar amostras que ainda não foram enviadas pelo MQTT
    mtx.unlock();

    if ((emExperimento && qtdTotalAmostrasParaSalvar == 0) || idExperimento == 0 || enviandoMensagemMqttFimExperimento) 
        return;

    HTTPClient http;
    http.begin(String() + urlBase + "/amostras");
    http.addHeader("Content-Type", "application/json");
    JsonDocument docCorpo;
    docCorpo["auth"] = Config::authToken;
    docCorpo["id_sala"] = Config::sala.id;
    docCorpo["id_experimento"] = idExperimento;
    
    if (!emExperimento) 
        docCorpo["finalizar"] = true;

    JsonArray jaAmostras = docCorpo["amostras"].to<JsonArray>();
    int qtdAmostrasSalvas = 0;
    if (sala.pegarQtdVariaveis() > 0)
    {
        // Enviar no máximo tamMaxEnvioBanco valores de cada vez para evitar problemas com memória e timeout
        const int tamMaxAmostrasParaSalvar = sala.pegarQtdVariaveis() > 0 ? tamMaxEnvioBanco / sala.pegarQtdVariaveis() : 0;
        
        qtdAmostrasSalvas = min(tamMaxAmostrasParaSalvar, qtdTotalAmostrasParaSalvar);
        for (int i = 0; i < qtdAmostrasSalvas; i++) 
        {
            JsonArray jaAmostra = jaAmostras.add<JsonArray>();
            for (int j = 0; j < amostras[i].size(); j++)
                jaAmostra.add(amostras[i][j]);
        }
    }
    
    String strCorpo;
    serializeJson(docCorpo, strCorpo);
    http.POST(strCorpo);
    bool ok = tratarRespostaApi("salvarAmostrasNoBanco", docCorpo, http.getString());
    http.end();
    
    if (ok)
    {
        Serial.printf("%i/%i amostras salvas no banco\n", qtdAmostrasSalvas, (int)amostras.size());
        mtx.lock();
        amostras.erase(amostras.begin(), amostras.begin() + qtdAmostrasSalvas);
        mtx.unlock();
        if (!emExperimento)
        {
            tentativasPararExperimento = 0;
            if (amostras.empty())
            {
                Serial.println("Experimento finalizado");
                Serial.println("Enviando mensagem MQTT de fim de experimento...");
                idAmostra = 0;
                enviandoMensagemMqttFimExperimento = true;
            }
            else salvarAmostrasNoBanco();
        }
    }
    else if (!emExperimento)
    {
        tentativasPararExperimento++;
        Serial.printf("Falha ao salvar amostras no banco (tentativa %i de %i)\n", tentativasPararExperimento, maxTentativasPararExperimento);
        if (tentativasPararExperimento >= maxTentativasPararExperimento) 
        {
            Serial.println("Parada forçada do experimento");
            amostras.clear();
            ApiMQTT::fimExperimento(idExperimento);
            idExperimento = 0;
            idAmostra = 0;
            tentativasPararExperimento = 0;
        }
    }   
}

int ApiNexo::iniciarExperimento(const String& nome, unsigned int _periodoAmostragemMs)
{
    if (idExperimento != 0) 
    {
        Serial.println("Experimento anterior não finalizado ainda!");
        return 0;
    }

    HTTPClient http;
    http.begin(String() + urlBase + "/experimentos");
    http.addHeader("Content-Type", "application/json");
    JsonDocument postDoc;
    postDoc["auth"] = Config::authToken;
    postDoc["id_sala"] = Config::sala.id;
    postDoc["nome"] = nome;
    postDoc["periodo"] = _periodoAmostragemMs;
    JsonArray cabecalho = postDoc["cabecalho"].to<JsonArray>();
    for (const auto& [codigo, dispositivo] : sala.pegarDispositivos())
    {
        for (const auto& variavel : dispositivo->pegarVariaveis())
        {
            JsonObject col = cabecalho.add<JsonObject>();
            col["codigo"] = String() + codigo.c_str() + '-' + variavel.codigo;
            col["nome"] = variavel.nome;
            col["unidade"] = variavel.unidade;
            col["f"] = variavel.f;
        }
    }

    String postCorpo;
    serializeJson(postDoc, postCorpo);
    http.POST(postCorpo);
    
    JsonDocument resp;
    bool ok = tratarRespostaApi("iniciarExperimento", resp, http.getString());
    http.end();
    
    if (ok)
    {
        periodoAmostragemMs = _periodoAmostragemMs;
        idExperimento = resp["id"];
        idAmostra = 0;
        emExperimento = true;
        return idExperimento;
    }
    else Serial.println("Erro ao tentar iniciar experimento!");
    return 0;
}

void ApiNexo::sincronizarExperimento() {
    ApiMQTT::enviarAmostras(idAmostra - amostras.size() + 1, amostras);
}

void ApiNexo::pararExperimento()
{
    emExperimento = false;
    salvarAmostrasNoBanco();
}

void ApiNexo::laco()
{
    static uint32_t tp0 = 0;
    uint32_t tp1 = millis();
    if (tp1 > tp0 + 10)
    {
        tp0 = tp1;
        if (ApiMQTT::conectado())
        {
            if (qtdNovasAmostras > 0 && qtdNovasAmostras <= amostras.size())
            {
                mtx.lock();
                auto novasAmostras = std::vector<std::vector<float>>(amostras.end() - qtdNovasAmostras, amostras.end());
                int qtdNovasAmostrasCopia = qtdNovasAmostras;
                int idAmostraCopia = idAmostra;
                mtx.unlock();
                if (ApiMQTT::enviarAmostras(idAmostraCopia - qtdNovasAmostrasCopia + 1, novasAmostras))
                {
                    mtx.lock();
                    qtdNovasAmostras -= qtdNovasAmostrasCopia;
                    mtx.unlock();
                    Serial.printf("[ApiMQTT::enviarAmostras()] %i amostras enviadas\n", qtdNovasAmostrasCopia);
                }
                else
                {
                    Serial.printf("[ApiMQTT::enviarAmostras()] %i amostras não enviadas\n", qtdNovasAmostrasCopia);
                }
            }
            if (enviandoMensagemMqttFimExperimento)
            {
                if (ApiMQTT::fimExperimento(idExperimento))
                {
                    Serial.println("Mensagem mqtt de fim de experimento enviada!");
                    idExperimento = 0;
                    enviandoMensagemMqttFimExperimento = false;
                }
            }
        }
        if (WiFi.isConnected())
        {
            static uint32_t tp2 = 0;
            if (
                (tp1 > tp2 + (emExperimento ? periodoSalvarAmostrasNoBancoMs : periodoTentarPararExperimentoNovamenteMs))
                || (amostras.size() > 0 && amostras.size() * sala.pegarQtdVariaveis() >= tamMaxEnvioBanco)
            ) {
                tp2 = tp1;
                salvarAmostrasNoBanco();
            }
        }
    }
}

void coletorAmostra(void* params)
{
    while (true)
    {
        static uint32_t tp0 = 0;
        if (emExperimento)
        {
            mtx.lock();
            if (amostras.size() < tamMaxAmostras) 
            {
                idAmostra++;
                auto amostra = sala.pegarAmostra();
                Serial.printf("[Amostra coletada #%i @ %ums]: ", idAmostra, tp0);
                for (auto valor : amostra)
                    Serial.printf("%f, ", valor);
                Serial.println();
                amostras.push_back(amostra);
                qtdNovasAmostras++;
            }
            else 
            {
                emExperimento = false;
            }
            mtx.unlock();
            
            uint32_t tp1 = millis();
            uint32_t diff = tp1 > tp0 ? tp1 - tp0 : ((uint32_t)-1) - tp0 + tp1 + 1;
            delay(periodoAmostragemMs - std::min(periodoAmostragemMs, diff));
            tp0 = millis();
            
            if (diff > periodoAmostragemMs) 
                Serial.printf("[coletorAmostra]: coleta atrasada em %ums\n", diff - periodoAmostragemMs);
        }
        else
        {
            delay(100);
            tp0 = millis();
        }
    }
}

void ApiNexo::inicializar()
{
    xTaskCreate(coletorAmostra, "coletor-amostra", 4096, nullptr, 2, nullptr);
}