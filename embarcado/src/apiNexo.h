#ifndef APINEXO_H
#define APINEXO_H
#include "Arduino.h"

namespace ApiNexo
{
    struct Sala
    {
        String id;
        String nome;
        String modelo;
        struct BrokerMqtt
        {
            String host, usuario, senha;
            uint16_t porta;
        } brokerMqtt;
    };

    String login(String usuario, String senha);
    bool validarToken(String token);
    bool conectarSala();
    int iniciarExperimento(const String& nome, unsigned int periodoAmostragemMs);
    void sincronizarExperimento();
    void pararExperimento();
    void laco();
    void inicializar();
};

#endif