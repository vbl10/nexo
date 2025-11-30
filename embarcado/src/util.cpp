#include <Arduino.h>
#include "util.h"

int serialPegarUm(int tempoLimiteMs, bool imprimirContador)
{
    int r = 0;
    if (tempoLimiteMs)
    {
        for (
            int periodoTickMs = 10, ticks = tempoLimiteMs / periodoTickMs;
            !Serial.available() && ticks > 0;
            ticks--)
        {
            if (imprimirContador && ticks * periodoTickMs / 1000 != (ticks + 1) * periodoTickMs / 1000)
                Serial.println(String("Continuando em ") + ticks * periodoTickMs / 1000 + "s...");
            delay(periodoTickMs);
        }
        if (Serial.available())
            r = Serial.read();
    }
    else
    {
        while (!Serial.available())
            delay(10);
        r = Serial.read();
    }
    serialLimparEntrada();
    return r;
}

void serialLimparEntrada()
{
    while (Serial.available())
        Serial.read();
}