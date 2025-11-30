#include <SPIFFS.h>
#include "apiNexo.h"
#include "apiWifi.h"
#include "config.h"
#include "apiMQTT.h"
#include "sala.h"

void setup()
{
    Serial.begin(115200);
    SPIFFS.begin(true);
    ApiWifi::inicializar();
    ApiMQTT::inicializar();
    Config::inicializar();
    ApiNexo::inicializar();
    sala.inicializar();
    ApiMQTT::conectar();
}

void loop()
{
    ApiMQTT::laco();
    ApiNexo::laco();
}
