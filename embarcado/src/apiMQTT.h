#ifndef APIMQTT_H
#define APIMQTT_H
#include "Arduino.h"
#include <Ticker.h>
#include <vector>

namespace ApiMQTT
{
    void conectar();
    void inicializar();
    void laco();
    bool conectado();
    bool enviarAmostras(unsigned int id, const std::vector<std::vector<float>>& amostras);
    bool fimExperimento(unsigned int idExperimento);
};

#endif