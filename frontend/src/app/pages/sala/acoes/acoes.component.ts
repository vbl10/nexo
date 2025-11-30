import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MqttService, Variaveis, VariavelMQTT } from '../../../services/mqtt.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchComponent } from '../../../components/toggle-switch/toggle-switch.component';
import { Sala, Variavel } from '../../../services/api.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-acoes',
  imports: [
    TranslateModule,
    CommonModule,
    FormsModule,
    ToggleSwitchComponent
  ],
  templateUrl: './acoes.component.html',
  styleUrls: ['../painel.scss', './acoes.component.scss']
})
export class AcoesComponent implements OnDestroy {
    
    private subs: Subscription;

    cache: {[key: string]: number} = {};

    constructor(
        public mqttService: MqttService
    ) {
        this.subs = mqttService.variaveisObservable.subscribe(variaveis => {
            for (let codigo in variaveis.atuadores) {
                this.cache[codigo] = variaveis.atuadores[codigo].valor;
            }
        })
    }
    
    ngOnDestroy(): void {
        this.subs.unsubscribe();
    }

    arranjoVariaveis(obj: {[key: string]: VariavelMQTT}) {
        return Object.entries(obj).map(entry => {return {codigo: entry[0], desc: entry[1]}});
    }

    get binarias() {
        return Object.entries(this.mqttService.variaveis.atuadores)
            .filter(val => val[1].tipo == 'binaria')
            .map(val => {return {codigo: val[0], desc: val[1]}})
    }
    get limitadas() {
        return Object.entries(this.mqttService.variaveis.atuadores)
            .filter(val => val[1].tipo == 'limitada')
            .map(val => {return {codigo: val[0], desc: val[1]}})
    }
}
