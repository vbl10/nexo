import { Component, OnDestroy, ViewChild } from '@angular/core';
import { ModalDialogComponent } from '../../../../components/modal-dialog/modal-dialog.component';
import { MqttService } from '../../../../services/mqtt.service';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { converterTempo, unidadesTempo, UnidadeTempo } from '../../../../uteis/uteis';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-novo-exp',
    imports: [ModalDialogComponent, ReactiveFormsModule, CommonModule, TranslateModule],
    templateUrl: './novo-exp.component.html'
})
export class NovoExpComponent implements OnDestroy {

    unidadesTempo = unidadesTempo;

    @ViewChild('dialog')
    dialog!: ModalDialogComponent;
    erro: string = '';
    iniciando = false;

    form: FormGroup;

    private subs: Subscription[] = [];

    private promiseInicioExperimento?: {
        resolve: (result: boolean) => void
    };

    constructor(
        private mqttService: MqttService,
        public translateService: TranslateService
    ) {
        this.form = new FormGroup({
            nome: new FormControl('', {validators: Validators.required}),
            unidade: new FormControl('milisegundo'),
            periodo: new FormControl(1000, {validators: [Validators.required]})
        }, this.periodoValido);
        this.subs.push(
            translateService.get('sala.plotter.opcoes.experimento')
            .subscribe(val => {
                const hoje = new Date();
                this.form.controls['nome'].setValue(`${val} ${hoje.toLocaleDateString()}`);
            })
        )
    }

    ngOnDestroy(): void {
        this.subs.forEach(sub => sub.unsubscribe());
    }

    abrir(nome?: string, periodo?: number) {
        if (nome) this.form.controls['nome'].setValue(nome);
        if (periodo != undefined) this.form.controls['periodo'].setValue(periodo);
        const promise = new Promise<boolean>((resolve) => {this.promiseInicioExperimento = {resolve}});
        this.dialog.abrir();
        return promise;
    }

    aoFechar() {
        this.promiseInicioExperimento?.resolve(false);
        this.erro = '';
    }

    criarExperimento() {
        this.iniciando = true;
        this.erro = '';
        this.mqttService
            .iniciarExperimento(
                this.form.controls['nome'].value, 
                converterTempo(this.form.controls['periodo'].value, this.form.controls['unidade'].value, 'milisegundo')
            )
            .then(() => {
                const resolve = this.promiseInicioExperimento?.resolve;
                this.promiseInicioExperimento = undefined;
                resolve?.(true);
                this.dialog.fechar();
            })
            .catch((e) => {
                const resolve = this.promiseInicioExperimento?.resolve;
                this.promiseInicioExperimento = undefined;
                resolve?.(true);
                this.erro = 
                    e == "timeout"
                    ? "timeout"
                    : "outro"
                ;
            })
            .finally(() => {
                this.iniciando = false;
                this.promiseInicioExperimento = undefined;
            });
    }


    periodoValido = (control: AbstractControl): { [key: string]: any } | null => {
        const grupo = control as FormGroup;
        type Tempo = {val: number, unidade: UnidadeTempo};
        const min: Tempo = {val: 500, unidade: 'milisegundo'};
        const max: Tempo = {val: 40, unidade: 'dia'};
        const periodo = grupo.controls['periodo'].value;
        const unidade = grupo.controls['unidade'].value;
        if (converterTempo(periodo, unidade, min.unidade) < min.val || converterTempo(periodo, unidade, max.unidade) > max.val) {
            return {
                ['periodo-invalido']: {
                    min: `${min.val} ${this.translateService.instant(`comum.unidades-tempo-extenso-plural.${min.unidade}`)}`,
                    max: `${max.val} ${this.translateService.instant(`comum.unidades-tempo-extenso-plural.${max.unidade}`)}`
                }
            }
        }
        return null;
    }
}

