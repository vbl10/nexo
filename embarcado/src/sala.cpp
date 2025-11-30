#include "sala.h"
#include "config.h"
#include <ArduinoJson.h>
#include <DHT.h>

#ifdef ARDUINO_ARCH_ESP32
#define ADC_RESOLUTION 12
#else
#define ADC_RESOLUTION 10
#endif

Sala sala;

constexpr float difMinGatilhoValorAterado = 0.005;

const char *tiposSensores[] = {
    "digital",
    "analogico",
    "dht11",
    //"carga",
    //"distancia"
};
const int nTiposSensores = sizeof(tiposSensores) / sizeof(char *);

const char *tiposAtuadores[] = {
    "digital",
    "analogico",
    //"motor-dc"
};
const int nTiposAtuadores = sizeof(tiposAtuadores) / sizeof(char *);

void Sala::inicializar()
{
    JsonDocument doc;
    deserializeJson(doc, Config::sala.modelo);

    JsonArray sensores = doc["sensores"];
    for (auto sensor : sensores)
    {
        String tipo = sensor["tipo"].as<String>();
        String codigo = sensor["codigo"].as<String>();
        JsonObject config = sensor["configuracoes"];

        int tipoId;
        for (tipoId = 0; tipoId < nTiposSensores; tipoId++)
        {
            if (tipo == tiposSensores[tipoId])
            {
                std::unique_ptr<Dispositivo> dispositivo;

                switch (tipoId)
                {
                case 0:
                    dispositivo = std::make_unique<SensorDigital>(config);
                    break;
                case 1:
                    dispositivo = std::make_unique<SensorAnalogico>(config);
                    break;
                case 2:
                    dispositivo = std::make_unique<SensorDht11>(config);
                    break;
                    // case 3:
                    //     dispositivo = std::make_unique<SensorCarga>(config);
                    //     break;
                    // case 4:
                    //     dispositivo = std::make_unique<SensorDistancia>(config);
                    //     break;
                }

                qtdVariaveis += dispositivo->pegarVariaveis().size();
                dispositivos.insert({
                    std::string(codigo.c_str()),
                    std::move(dispositivo)
                });
                break;
            }
        }
        if (tipoId == nTiposSensores)
            Serial.println("Aviso: sensor do tipo \"" + tipo + "\" não implementado!");
    }

    JsonArray atuadores = doc["atuadores"];
    for (auto atuador : atuadores)
    {
        String tipo = atuador["tipo"].as<String>();
        String codigo = atuador["codigo"].as<String>();
        JsonObject config = atuador["configuracoes"];

        int tipoId;
        for (tipoId = 0; tipoId < nTiposAtuadores; tipoId++)
        {
            if (tipo == tiposAtuadores[tipoId])
            {
                std::unique_ptr<Dispositivo> dispositivo;

                switch (tipoId)
                {
                case 0:
                    dispositivo = std::make_unique<AtuadorDigital>(config);
                    break;
                case 1:
                    dispositivo = std::make_unique<AtuadorAnalogico>(config);
                    break;
                // case 2:
                //     dispositivo = std::make_unique<AtuadorMotorDc>(config);
                //     break;
                }

                qtdVariaveis += dispositivo->pegarVariaveis().size();
                dispositivos.insert({
                    std::string(codigo.c_str()),
                    std::move(dispositivo)
                });
                break;
            }
        }
        if (tipoId == nTiposSensores)
            Serial.println("Aviso: atuador do tipo \"" + tipo + "\" não implementado!");
    }
}
float Sala::pegarValor(const String &codigo)
{
    int indiceSeparador = codigo.indexOf('-');
    std::string codigoDispositivo(codigo.substring(0, indiceSeparador).c_str());
    if (dispositivos.count(codigoDispositivo))
    {
        String codigoVariavel = indiceSeparador > 0 ? codigo.substring(indiceSeparador + 1).c_str() : "";
        return dispositivos.at(codigoDispositivo)->pegarValor(codigoVariavel);
    }
    return 0.0f;
}
String Sala::pegarValores()
{
    JsonDocument doc;

    for (const auto &[codigoDispositivo, dispositivo] : dispositivos)
        for (const auto &variavel : dispositivo->pegarVariaveis())
            doc[(codigoDispositivo + '-' + variavel.codigo.c_str()).c_str()] = dispositivo->pegarValor(variavel.codigo);
    
    if (doc.isNull()) return "";

    String json;
    serializeJson(doc, json);
    return json;
}

String Sala::pegarValoresAlterados()
{
    JsonDocument doc;
    
    for (const auto& [codigoDispositivo, dispositivo] : dispositivos)
        for (const auto& [codigoVariavel, valor] : dispositivo->pegarVariaveisAlteradas())
            doc[(codigoDispositivo + '-' + codigoVariavel).c_str()] = valor;

    if (doc.isNull()) return "";

    String json;
    serializeJson(doc, json);
    return json;
}
std::vector<float> Sala::pegarAmostra()
{
    std::vector<float> amostra;
    for (const auto& [codigo, dispositivo] : dispositivos)
        for (const auto& variavel : dispositivo->pegarVariaveis())
            amostra.push_back(dispositivo->pegarValor(variavel.codigo));

    return amostra;
}
void Sala::definirValor(const String &codigo, float novoValor)
{
    int indiceSeparador = codigo.indexOf('-');
    std::string codigoDispositivo(codigo.substring(0, indiceSeparador).c_str());
    if (dispositivos.count(codigoDispositivo))
    {
        String codigoVariavel = indiceSeparador > 0 ? codigo.substring(indiceSeparador + 1).c_str() : "";
        dispositivos.at(codigoDispositivo)->definirValor(codigoVariavel, novoValor);
    }
}
const std::map<std::string, std::unique_ptr<Dispositivo>>& Sala::pegarDispositivos() const
{
    return dispositivos;
}
const int Sala::pegarQtdVariaveis() const 
{
    return qtdVariaveis;
}

Dispositivo::Dispositivo(const JsonObject& config)
{
    JsonObject objVariaveis = config["variaveis"];
    for (auto kv : objVariaveis) {
        JsonObject val = kv.value().as<JsonObject>();
        variaveis.push_back(Variavel{
            .codigo = kv.key().c_str(),
            .nome = val["nome"].as<String>(),
            .unidade = val["unidade"].as<String>(),
            .f = val["f"].as<String>()
        });
    }
    for (const auto& variavel : variaveis)
        variaveisSalvas[variavel.codigo.c_str()] = 0.0f;
}
const std::vector<Dispositivo::Variavel>& Dispositivo::pegarVariaveis()
{
    return variaveis;
}
std::map<std::string, float> Dispositivo::pegarVariaveisAlteradas()
{
    std::map<std::string, float> alteradas;
    for (const auto& [codigo, valorSalvo] : variaveisSalvas)
    {
        float novoValor = pegarValor(codigo.c_str());
        if (abs(valorSalvo - novoValor) > difMinGatilhoValorAterado)
            variaveisSalvas[codigo] = alteradas[codigo] = novoValor;
    }
    return alteradas;
}

SensorDigital::SensorDigital(const JsonObject &config)
    : Dispositivo(config)
{
    porta = config["porta"];
    pinMode(porta, INPUT);
}
float SensorDigital::pegarValor(const String &variavel)
{
    return (float)digitalRead(porta);
}

SensorAnalogico::SensorAnalogico(const JsonObject &config)
    : Dispositivo(config)
{
    porta = config["porta"];
    pinMode(porta, INPUT);
}
float SensorAnalogico::pegarValor(const String &variavel)
{
    return (float)analogRead(porta) / (float)(1 << ADC_RESOLUTION);
}

SensorDht11::SensorDht11(const JsonObject &config)
    : Dispositivo(config), dht(config["porta"].as<uint8_t>(), DHT11)
{
    dht.begin();
}
float SensorDht11::pegarValor(const String &variavel)
{
    if (variavel == "temperatura")
    {
        float temp = dht.readTemperature();
        return temp == temp ? temp : 0.0f;
    }
    else if (variavel == "umidade")
    {
        float umidade = dht.readHumidity();
        return umidade == umidade ? umidade : 0.0f;
    }
    else
        Serial.println("Aviso: variavel \"" + variavel + "\" não existe!");

    return 0.0f;
}

AtuadorDigital::AtuadorDigital(const JsonObject &config)
    : Dispositivo(config)
{
    porta = config["porta"];
    pinMode(porta, OUTPUT);
}
float AtuadorDigital::pegarValor(const String &variavel)
{
    return (float)valor;
}
void AtuadorDigital::definirValor(const String &variavel, float novoValor)
{
    valor = (uint8_t)novoValor;
    digitalWrite(porta, valor);
}

AtuadorAnalogico::AtuadorAnalogico(const JsonObject &config)
    : Dispositivo(config)
{
    porta = config["porta"];
    pinMode(porta, OUTPUT);
}
float AtuadorAnalogico::pegarValor(const String &variavel)
{
    return valor;
}
void AtuadorAnalogico::definirValor(const String &variavel, float novoValor)
{
    valor = novoValor;
    analogWrite(porta, (int)(valor * (float)(1 << ADC_RESOLUTION)));
}
