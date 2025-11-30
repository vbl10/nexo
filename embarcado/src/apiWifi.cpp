#include "apiWifi.h"
#include "apiMQTT.h"
#include "config.h"
#include <WiFi.h>
#include <Ticker.h>

using namespace ApiWifi;

bool ApiWifi::conectar(bool esperar)
{
    Serial.printf((String("🔌 Conectando a Wi-Fi %s...\n") + (esperar ? "(C)ancelar\n" : "")).c_str(), Config::wifiSsid.c_str());
    WiFi.begin(Config::wifiSsid.c_str(), Config::wifiPass.c_str());
    if (esperar)
    {
        while (esperar && WiFi.status() != WL_CONNECTED)
        {
            delay(500);
            Serial.print(".");
            while (Serial.available())
            {
                int cmd = Serial.read();
                if (cmd == 'C' || cmd == 'c')
                {
                    esperar = false;
                    ESP.restart();
                    break;
                }
            }
        }
        Serial.println();
    }
    return WiFi.status() == WL_CONNECTED;
}

void aoEventoWifi(WiFiEvent_t event, WiFiEventInfo_t info)
{
    switch (event)
    {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
        Serial.println("✅ Wi-Fi conectado!");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
        Serial.println("⚠️ Wi-Fi desconectado!");
        break;
    default:
        break;
    }
}

void ApiWifi::inicializar()
{
    WiFi.setAutoReconnect(true);
    WiFi.onEvent(aoEventoWifi, WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_GOT_IP);
    WiFi.onEvent(aoEventoWifi, WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
}