import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root',
})
export class LangService {
    private readonly chaveIdioma = 'idioma';
    
    constructor(
        private translateService: TranslateService
    ) {
        translateService.setDefaultLang('en-US');
        translateService.addLangs(idiomas as any as string[]);
        let idiomaUsuario = localStorage.getItem(this.chaveIdioma);
        if (!idiomaUsuario) {
            idiomaUsuario = 'en-US';
            localStorage.setItem(this.chaveIdioma, idiomaUsuario);
        }
        translateService.use(idiomaUsuario);
    }

    definirIdioma(novoIdioma: string) {
        if (idiomas.includes(novoIdioma as Idioma)) {
            this.translateService.use(novoIdioma);
            localStorage.setItem(this.chaveIdioma, novoIdioma);
        }
    }
}

export const idiomas = ['pt-BR', 'es-ES', 'en-US'] as const;
export type Idioma = typeof idiomas[number];