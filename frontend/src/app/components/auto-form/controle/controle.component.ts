import { CommonModule } from '@angular/common';
import { Component, Input, } from '@angular/core';
import { AbstractControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Arranjo, Controle, Grupo, Seletor, Texto } from '../auto-form.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-controle',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TranslateModule
    ],
    templateUrl: './controle.component.html',
    styleUrl: './controle.component.scss',
})
export class ControleComponent {
    @Input() nome!: any;
    @Input() indice?: number;
    @Input() controle!: Controle;
    @Input() desabilitado = false;
    @Input() id = '';
    @Input() aoClicarInfoParente!: (info: {caminho: string, args: {[key: string]: any}}) => void;

    indiceRemover?: number;

    aoClicarRemover() {
        if (this.indiceRemover !== undefined) {
            (this.controle as Arranjo).remover(this.indiceRemover);
            this.indiceRemover = undefined;
        }
    }

    aoClicarInfo() {
        this.aoClicarInfoParente({
            caminho: this.controle.nome + '._info', 
            args: (typeof this.controle.info == 'object' ? this.controle.info : {})
        });
    }

    getEntries(arg: any) {
        return Object.entries(arg) as [string, any][];
    }

    paraFormGroup(controle: AbstractControl) {
        return controle as FormGroup;
    }

    ehTexto(controle: Controle): controle is Texto {
        return controle instanceof Texto;
    }
    ehSeletor(controle: Controle): controle is Seletor {
        return controle instanceof Seletor;
    }
    ehGrupo(controle: Controle): controle is Grupo {
        return controle instanceof Grupo;
    }
    ehArranjo(controle: Controle): controle is Arranjo {
        return controle instanceof Arranjo;
    }
}
