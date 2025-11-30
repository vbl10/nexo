#ifndef CONFIG_H
#define CONFIG_H
#include "Arduino.h"
#include "apiNexo.h"

namespace Config
{
    extern String wifiSsid, wifiPass;
    extern String authToken;
    extern ApiNexo::Sala sala;

    void inicializar();
};

#endif