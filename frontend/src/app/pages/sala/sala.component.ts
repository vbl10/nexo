import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AcoesComponent } from './acoes/acoes.component';
import { SensoresComponent } from './sensores/sensores.component';
import { PlayerComponent } from './player/player.component';
import { ApiService, Sala } from '../../services/api.service';
import { MqttService } from '../../services/mqtt.service';
import { PlotterComponent } from './plotter/plotter.component';
import { Title } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sala',
  imports: [
    TranslateModule,
    AcoesComponent,
    SensoresComponent,
    PlayerComponent,
    PlotterComponent,
    RouterLink,
    CommonModule
],
  templateUrl: './sala.component.html',
  styleUrl: './sala.component.scss'
})
export class SalaComponent implements OnDestroy {
    sala?: Sala;
    salaPronta: Promise<Sala>;

    constructor(
        public mqttService: MqttService,
        route: ActivatedRoute,
        apiService: ApiService,
        title: Title
    ) {
        this.salaPronta = new Promise<Sala>(resolve => {
            const subs = route.paramMap.subscribe(async params => {
                const codigo = params.get("codigo");
                if (codigo) {
                    this.sala = await apiService.pegarSala(codigo);
                    resolve(this.sala);
                    title.setTitle(this.sala.modelo.nome);
                    mqttService.conectar(this.sala.id, this.sala.modelo, this.sala.mqtt_broker);
                }
                setTimeout(() => subs.unsubscribe(), 1);
            });
        })
    }

    ngOnDestroy(): void {
        this.mqttService.desconectar();
    }
}
