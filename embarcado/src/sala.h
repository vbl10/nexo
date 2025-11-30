#ifndef SALA_H
#define SALA_H
#include <map>
#include <memory>
#include <ArduinoJson.h>
#include <Arduino.h>
#include <DHT.h>

class Dispositivo
{
public:
    struct Variavel {
        String codigo, nome, unidade, f;
    };
protected:
    Dispositivo(const JsonObject& config);
public:
    virtual float pegarValor(const String &variavel) = 0;
    virtual void definirValor(const String &variavel, float novoValor) {}
    const std::vector<Variavel>& pegarVariaveis();
    std::map<std::string, float> pegarVariaveisAlteradas();

private:
    std::vector<Variavel> variaveis;
    std::map<std::string, float> variaveisSalvas;
};

class Sala
{
public:
    void inicializar();
    float pegarValor(const String &codigo);
    String pegarValores();
    String pegarValoresAlterados();
    std::vector<float> pegarAmostra();
    void definirValor(const String &codigo, float novoValor);
    const std::map<std::string, std::unique_ptr<Dispositivo>>& pegarDispositivos() const;
    const int pegarQtdVariaveis() const;
private:
    int qtdVariaveis = 0;
    std::map<std::string, std::unique_ptr<Dispositivo>> dispositivos;
};

extern Sala sala;

class SensorDigital : public Dispositivo
{
public:
    SensorDigital(const JsonObject &config);
    float pegarValor(const String &variavel) override;

private:
    uint8_t porta;

};

class SensorAnalogico : public Dispositivo
{
public:
    SensorAnalogico(const JsonObject &config);
    float pegarValor(const String &variavel) override;

private:
    uint8_t porta;
};

class SensorDht11 : public Dispositivo
{
public:
    SensorDht11(const JsonObject &config);
    float pegarValor(const String &variavel) override;

private:
    DHT dht;
};

/*
class SensorCarga : public Dispositivo {
public:
    SensorCarga(const JsonObject& config);
    float pegarValor(const String& variavel);
private:
    uint8_t porta;
};

class SensorDistancia : public Dispositivo {
public:
    SensorDht11(const JsonObject& config);
    float pegarValor(const String& variavel);
private:
    uint8_t porta;
};
*/

class AtuadorDigital : public Dispositivo
{
public:
    AtuadorDigital(const JsonObject &config);
    float pegarValor(const String &variavel) override;
    void definirValor(const String &variavel, float novoValor) override;

private:
    uint8_t porta;
    uint8_t valor = LOW;
};

class AtuadorAnalogico : public Dispositivo
{
public:
    AtuadorAnalogico(const JsonObject &config);
    float pegarValor(const String &variavel) override;
    void definirValor(const String &variavel, float novoValor) override;

private:
    uint8_t porta;
    float valor = 0.0f;
};

/*
class AtuadorMotorDc : public Dispositivo {
public:
    AtuadorMotorDc(const JsonObject& config);
    float pegarValor(const String& variavel) = 0;
    void definirValor(const String& variavel, float novoValor) {}
private:
    uint8_t porta;
};
*/

#endif