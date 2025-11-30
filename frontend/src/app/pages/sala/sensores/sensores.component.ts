import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MqttService } from '../../../services/mqtt.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-sensores',
    imports: [TranslateModule, CommonModule],
    templateUrl: './sensores.component.html',
    styleUrls: ['../painel.scss', './sensores.component.scss'],
})
export class SensoresComponent {
    constructor(public mqttService: MqttService) {}

    get sensores() {
        return Object.entries(this.mqttService.variaveis.sensores).map(
            (val) => val[1]
        );
    }
}
