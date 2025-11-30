import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import {
    AbstractControl,
    AsyncValidatorFn,
    FormArray,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
} from '@angular/forms';
import { ControleComponent } from './controle/controle.component';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { stringAleatoria } from '../../uteis/uteis';
import { ModalDialogComponent } from '../modal-dialog/modal-dialog.component';

@Component({
    selector: 'app-auto-form',
    imports: [
        ReactiveFormsModule,
        CommonModule,
        ControleComponent,
        TranslateModule,
        ModalDialogComponent
    ],
    templateUrl: './auto-form.component.html',
    styleUrl: './auto-form.component.scss',
})
export class AutoFormComponent {
    
    @Input() controle!: Grupo;
    @ViewChild('dialogInfo') dialogInfo!: ModalDialogComponent;

    info?: {caminho: string, args: {[key: string]: any}};
    id = stringAleatoria();

    constructor(
        private viewContainerRef: ViewContainerRef
    ) {
    }

    // aplicar css deste componente a elementos html gerados dinâmicamente
    private fixEmulatedEncapsulation():void {
        // Make sure the component element exists
        if (!this.viewContainerRef.element?.nativeElement) {
        return;
        }

        const elementRef: HTMLElement = this.viewContainerRef.element.nativeElement;
        // get the compile-time, dynamically generated, unique host identifier from the component root element
        const ngHostAttribute = elementRef
        .getAttributeNames()
        .find((attr) => attr.startsWith('_nghost-'));

        // In case there is no nghost (no encapsulation / shadow DOM)
        if (!ngHostAttribute) {
        return;
        }

        const ngContentAttribute = ngHostAttribute.replace(
        '_nghost-',
        '_ngcontent-'
        );

        // Find all elements inside the component that didn't exist on compile time - and add the _ngcontent-ng-XXX attribute to apply scoped CSS
        elementRef
        .querySelectorAll(`:not([${ngContentAttribute}])`)
        .forEach((elem) => elem.setAttribute(ngContentAttribute, ''));
    }

    aoClicarInfo = (info: {caminho: string, args: {[key: string]: any}}) => {
        this.info = info;
        this.dialogInfo.abrir();
        setTimeout(() => {
            this.fixEmulatedEncapsulation();
        }, 10);
    }
}


export abstract class Controle {
    protected readonly nomeEstatico: boolean = false;
    protected _controle!: AbstractControl;
    dinamico = false;
    prontoParaExibir = true;
    info: boolean | {[key: string]: any} = false;
    nome = '';
    visivel = true;

    constructor(
        opcoes?: {
            info?: boolean | {[key: string]: any},
            nome?: string,
            visivel?: boolean
        }
    ) {
        this.info = opcoes?.info ?? this.info;
        this.nome = opcoes?.nome ?? this.nome;
        this.visivel = opcoes?.visivel ?? this.visivel;

        if (this.nome.length > 0)
            this.nomeEstatico = true;
    }

    public get controle() {
        return this._controle;
    }

    public aoCriar() {}

    public aoDestruir() {}

    public definirNome(nome: string) {
        this.nome = this.nomeEstatico ? this.nome : nome;
    }

    public definirValor(valor: any) {
        this._controle.setValue(valor, {emitEvent: false});
    }
}

type EstiloEntrada = {
    rotulo?: {estilo?: string, classe?: string},
    entrada?: {estilo?: string, classe?: string}
}
export class Texto extends Controle {
    checagemOrtografica?: boolean;
    constructor(
        opcoes?: {
            nome?: string,
            info?: boolean | {[key: string]: any},
            visivel?: boolean,
            valorInicial?: string,
            validators?: ValidatorFn[],
            asyncValidators?: AsyncValidatorFn[],
            checagemOrtografica?: boolean,
        },
        public estilo?: EstiloEntrada
    ) {
        super(opcoes);
        this.checagemOrtografica = opcoes?.checagemOrtografica;
        this._controle = new FormControl(
            opcoes?.valorInicial ?? '', {
                validators: opcoes?.validators, 
                asyncValidators: opcoes?.asyncValidators
            }
        );
    }
}

export abstract class Seletor extends Controle {
    public caminhoTraducoesOpcoes?: string;
    constructor(
        opcoes?: {
            nome?: string,
            info?: boolean | {[key: string]: any},
            caminhoTraducoesOpcoes?: string,
        },
        public estilo?: EstiloEntrada
    ) {
        super(opcoes);
        this.caminhoTraducoesOpcoes = opcoes?.caminhoTraducoesOpcoes;
        this.prontoParaExibir = false;
        setTimeout(() => this.prontoParaExibir = true, 10);
    }
    abstract get opcoes(): readonly (string | number)[];
}

export class SeletorEstatico extends Seletor {
    constructor(
        private _opcoesSeletor: readonly string[],
        opcoes?: {
            validators?: ValidatorFn[],
            info?: boolean | {[key: string]: any},
            nome?: string
            caminhoTraducoesOpcoes?: string,
        },
        estilo?: EstiloEntrada
    ) {
        super(opcoes, estilo);
        this._controle = new FormControl(_opcoesSeletor[0], opcoes?.validators);
    }

    override get opcoes() {
        return this._opcoesSeletor;
    }
}

export class SeletorCompartilhado extends Seletor {
    private valor: number = -1;
    private filtro?: (livres: number) => boolean;
    private subs: Subscription;

    constructor(
        private todasOpcoes: (string | number)[],
        private todasLivres: number[],
        opcoes?: {
            validators?: ValidatorFn[],
            info?: boolean | {[key: string]: any},
            nome?: string
            caminhoTraducoesOpcoes?: string,
            filtro?: (livres: number) => boolean
        },
        estilo?: EstiloEntrada
    ) {
        super(opcoes, estilo);
        this.filtro = opcoes?.filtro;

        this._controle = new FormControl('_nenhum',
            (opcoes?.validators ?? []).concat(
                (ctrl: AbstractControl): ValidationErrors | null => {
                    return ctrl.value == '_nenhum' ? { 'seletor-compartilhado-nenhum': true } : null;
                }
            )
        );

        this.subs = this._controle.valueChanges.subscribe(this.aoSelecionar);
    }

    private get livresFiltrado() {
        return (this.filtro ? this.todasLivres.filter(this.filtro) : this.todasLivres);
    }

    override get opcoes() {
        return this.livresFiltrado
            .concat(this.valor != -1 ? this.valor : [])
            .sort((a, b) => a - b)
            .map(livre => this.todasOpcoes[livre])
            .concat('_nenhum');
    }

    private aoSelecionar = (opcao: string | number): void => {
        if (typeof this.todasOpcoes.at(0) == 'number' && typeof opcao == 'string') {
            opcao = Number.parseInt(opcao);
        }
        const novoValor = this.todasOpcoes.indexOf(opcao);
        this.todasLivres.push(...(this.valor != -1 ? [this.valor] : []));
        this.valor = novoValor;
        if (novoValor != -1)
            this.todasLivres.splice(this.todasLivres.indexOf(novoValor), 1);
        this.todasLivres.sort((a, b) => a - b);
    }

    public override aoCriar(): void {
        if (this.livresFiltrado.at(0) !== undefined)
            this.definirValor(this.todasOpcoes[this.livresFiltrado[0]]);
    }

    public override aoDestruir(): void {
        this.subs.unsubscribe();
        if (this.valor != -1 ) this.todasLivres.push(this.valor);
        this.todasLivres.sort((a, b) => a - b);
    }

    public override definirValor(valor: string | number): void {
        if (typeof this.todasOpcoes.at(0) == 'number' && typeof valor == 'string') {
            valor = Number.parseInt(valor);
        }
        this.aoSelecionar(valor);
        super.definirValor(valor);
    }
}

type EstiloGrupo = {
    container?: boolean
    retraido?: boolean,
    titulo?: string,
    estilo?: string
}
export class Grupo extends Controle {
    constructor(
        public campos: {[key: string]: Controle} = {},
        public estilo: EstiloGrupo = {},
        opcoes?: {
            validators?: ValidatorFn[],
            info?: boolean | {[key: string]: any},
            nome?: string
        }
    ) {
        super(opcoes);
        this._controle = new FormGroup(
            Object.fromEntries(
                Object.entries(campos)
                .map(campo => [campo[0], campo[1].controle])
            ),
            opcoes?.validators
        );
        Object.entries(this.campos).forEach(val => val[1].aoCriar());
    }

    public override aoDestruir(): void {
        Object.entries(this.campos).forEach(val => val[1].aoDestruir());
    }

    public override definirNome(nome: string) {
        if (!this.nomeEstatico)
            this.nome = nome;
        Object.entries(this.campos).forEach(val => val[1].definirNome(`${this.nome.length > 0 ? this.nome + '.' : ''}${val[0]}`));
    }

    public override definirValor(valor: any): void {
        Object.entries(this.campos)
        .sort(([_, a], [__, b]) => a.dinamico ? (b.dinamico ? 0 : 1) : (b.dinamico ? -1 : 0))
        .forEach(([nome, filho]) => { if(valor[nome]) filho.definirValor(valor[nome]) });
    }
}

export class GrupoDinamico extends Grupo {
    private valorAntigo: any = {};
    private id = '';
    private subs?: Subscription;
    private validators: ValidatorFn[] = [];

    constructor(
        private gerarCampos: (valor: any, valorAntigo: any) => { id: string, campos: { [key: string]: Controle }} | null,
        private gerarValidadores?: (valor: any, valorAntigo: any) => ValidatorFn[] | null,
        estilo: EstiloGrupo = {},
        opcoes?: {
            validators?: ValidatorFn[],
            info?: boolean | {[key: string]: any},
            nome?: string
        }
    ) {
        super({}, estilo, opcoes);
        this.dinamico = true;
    }
    
    public override aoCriar(): void {
        this.aoAtualizar(this._controle.parent?.value);
        this.subs = this._controle.parent?.valueChanges.subscribe(this.aoAtualizar);
    }

    public override aoDestruir(): void {
        Object.entries(this.campos).forEach(val => val[1].aoDestruir());
        this.subs?.unsubscribe();
    }

    public override definirNome(nome: string): void {
        if (!this.nomeEstatico)
            this.nome = nome;
        Object.entries(this.campos).forEach(([nome, controle]) => controle.definirNome(`${this.nome.length > 0 ? `${this.nome}.${this.id}.` : ''}${nome}`));
    }

    public override definirValor(valor: any): void {
        this.aoAtualizar(this.controle.parent?.value ?? undefined);
        super.definirValor(valor);
    }

    private aoAtualizar = (valor: any) => {
        const novosCampos = this.gerarCampos(valor, this.valorAntigo);
        const novosValidadores = this.gerarValidadores?.(valor, this.valorAntigo);
        this.valorAntigo = valor;
        if (novosCampos || novosValidadores) {
            if (novosCampos) {
                for (let [nome, controle] of Object.entries(this.campos)) {
                    (this._controle as FormGroup).removeControl(nome, {emitEvent: false});
                    controle.aoDestruir();
                }
                this.campos = novosCampos.campos;
                for (let [nome, controle] of Object.entries(this.campos)) {
                    (this._controle as FormGroup).addControl(nome, controle.controle, {emitEvent: false});
                    controle.aoCriar();
                }
                this.id = novosCampos.id;
                this.definirNome(this.nome);
            }
            if (novosValidadores) {
                this._controle.removeValidators(this.validators);
                this.validators = novosValidadores;
                this._controle.setValidators(novosValidadores);
            }
        }
    }
}

export class Arranjo extends Controle {
    public readonly itens: Controle[] = [];
    public opcoes: {
        qtd: number,
        adicionar?: boolean,
        remover?: boolean,
        numerar?: boolean
    };

    constructor(
        private fabrica: (i: number) => Controle,
        opcoesArranjo: {
            qtd: number,
            adicionar?: boolean,
            remover?: boolean,
            numerar?: boolean
        } = {
            qtd: 1
        },
        opcoes?: {
            validators?: ValidatorFn[],
            info?: boolean | {[key: string]: any},
            nome?: string
        },
        public estilo: EstiloGrupo = {},
    ) {
        super(opcoes);
        this.opcoes = opcoesArranjo;
        this._controle = new FormArray([], opcoes?.validators);
        for (let i = 0; i < this.opcoes.qtd; i++) {
            const item = fabrica(i);
            (this._controle as FormArray).push(item.controle);
            this.itens.push(item);
        }
    }

    public override definirNome(nome: string) {
        if (!this.nomeEstatico)
            this.nome = nome;
        this.itens.forEach((val, i) => val.definirNome(this.nome + (this.opcoes?.numerar ? `._${i}` : '')));
    }

    public adicionar() {
        this.opcoes.qtd++;
        const item = this.fabrica(this.opcoes.qtd);
        item.definirNome(this.nome);
        (this._controle as FormArray).push(item.controle);
        item.aoCriar();
        this.itens.push(item);
    }

    public remover(i: number) {
        this.opcoes.qtd--;
        (this._controle as FormArray).removeAt(i);
        this.itens.splice(i, 1)[0].aoDestruir();
    }

    public override aoDestruir(): void {
        this.itens.forEach(val => val.aoDestruir());
    }

    public override definirValor(valor: any): void {
        if (!Array.isArray(valor))
            throw new Error('Valor deve ser arranjo');
        
        this.itens.forEach((item, i) => {
            item.aoDestruir();
            (this._controle as FormArray).removeAt(i);
        });
        valor.forEach(item => {
            this.adicionar();
            this.itens.at(-1)?.definirValor(item);
        })
    }
}