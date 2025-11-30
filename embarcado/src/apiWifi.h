#ifndef APIWIFI_H
#define APIWIFI_H
#include "Arduino.h"

namespace ApiWifi
{
    void inicializar();
    bool conectar(bool esperar = false);
};

#endif