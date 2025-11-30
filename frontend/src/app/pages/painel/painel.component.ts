import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ModalDialogComponent } from '../../components/modal-dialog/modal-dialog.component';
import { ApiService, SalaEmArranjo } from '../../services/api.service';
import { TranslateModule } from '@ngx-translate/core';
import { CliqueCopiaComponent } from '../../components/clique-copia/clique-copia.component';
import { stringAleatoria } from '../../uteis/uteis';

@Component({
    selector: 'app-home',
    imports: [
        CommonModule,
        RouterLink,
        FormsModule,
        ModalDialogComponent,
        TranslateModule,
        CliqueCopiaComponent
    ],
    templateUrl: './painel.component.html',
    styleUrl: './painel.component.scss',
})
export class PainelComponent {
    private timeoutDigitarBuscaSala: any;
    pesquisaSala = '';
    resultadosPesquisaSala: SalaEmArranjo[] = [];
    
    @ViewChild('dialogPesquisarSala')
    dialogPesquisarSala!: ModalDialogComponent;
    @ViewChild('dialogOpcoesSala')
    dialogOpcoesSala!: ModalDialogComponent;

    salaSelecionada?: Sala;

    confirmandoExclusao = false;

    readonly minhasSalas: Sala[] = [];
    readonly salasFavoritadas: Sala[] = [];
    get salas() {
        return this.minhasSalas.concat(this.salasFavoritadas);
    }

    constructor(
        private apiService: ApiService,
        public router: Router,
        authService: AuthService
    ) {
        if (!authService.estaLogado()) {
            router.navigateByUrl("/login");
        }
        else {
            apiService.pegarSalas()
            .then(salas => {
                this.minhasSalas.push(
                    ...salas.filter(sala => (sala?.proprietario ?? false))
                    .map(sala => {return {...sala, favoritada: false}})
                );
                this.salasFavoritadas.push(
                    ...salas.filter(sala => !(sala?.proprietario ?? false))
                    .map(sala => {return {...sala, favoritada: true}})
                );
            })
        }
    }

    aoDigitarBuscaSala(codigoOuNome: string) {
        clearTimeout(this.timeoutDigitarBuscaSala);
        this.timeoutDigitarBuscaSala = setTimeout(() => {
            this.procurarSala(codigoOuNome);
        }, 500);
    }

    async procurarSala(codigoOuNome: string) {
        this.resultadosPesquisaSala.length = 0;
        this.resultadosPesquisaSala = await this.apiService.buscarSalaPorCodigoOuNome(codigoOuNome);
    }

    aoAbrirProcurarSala() {
        //this.resultadosPesquisaSala.length = 0;
        this.pesquisaSala = '';
    }

    aoEscolherResultadoPesquisaSala(idx: number) {
        this.salaSelecionada = {
            ...this.resultadosPesquisaSala[idx],
            favoritada: this.salasFavoritadas.findIndex(favoritada => favoritada.id == this.resultadosPesquisaSala[idx].id) != -1
        };
        this.dialogPesquisarSala.fechar();
        this.dialogOpcoesSala.abrir();
    }

    excluirSala(id?: string) {
        if (!id) return;
        this.apiService.removerSala(id)
        .then(() => {
            this.minhasSalas.splice(this.minhasSalas.findIndex(val => val.id == id), 1);
            this.dialogOpcoesSala.fechar();
        })
    }

    abrirOpcoesSala(sala: Sala) {
        this.salaSelecionada = sala;
        this.dialogOpcoesSala.abrir();
    }

    aoFecharOpcoesSala() {
        this.confirmandoExclusao = false;
    }

    async inverterFavoritoSalaSelecionada() {
        if (this.salaSelecionada) {
            if (this.salaSelecionada.favoritada) {
                await this.apiService.desfavoritarSala(this.salaSelecionada.id)
                this.salasFavoritadas.splice(this.salasFavoritadas.findIndex(sala => this.salaSelecionada?.id == sala.id), 1);
            }
            else {
                await this.apiService.favoritarSala(this.salaSelecionada.id);
                this.salasFavoritadas.push(this.salaSelecionada);
            }
            this.salaSelecionada.favoritada = !this.salaSelecionada.favoritada;
        }
    }
}

interface Sala extends SalaEmArranjo {
    favoritada: boolean
}