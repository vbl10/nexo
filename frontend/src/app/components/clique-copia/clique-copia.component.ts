import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-clique-copia',
    imports: [CommonModule],
    templateUrl: './clique-copia.component.html',
    styleUrl: './clique-copia.component.scss',
})
export class CliqueCopiaComponent {
    @Input('valor')
    valor = 'valor';
    copiado = 0;
    tamMax = 100;
    private timeout: any;

    copiar() {
        navigator.clipboard.writeText(this.valor)
        .then(() => {
            this.copiado = 2;
            clearTimeout(this.timeout);
            setTimeout(() => this.copiado = 1, 500);
            this.timeout = setTimeout(() => this.copiado = 0, 5000);
        })
    }

    redefinir() {
        clearTimeout(this.timeout);
        this.copiado = 0;
    }
}
