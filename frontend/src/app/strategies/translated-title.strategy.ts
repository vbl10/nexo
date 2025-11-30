import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root',
})
export class TranslatedTitleStrategy extends TitleStrategy {
    constructor(
        private title: Title,
        private translateService: TranslateService
    ) {
        super();
    }

    override updateTitle(snapshot: RouterStateSnapshot): void {
        const key = this.buildTitle(snapshot);
        if (key) {
            const subs = this.translateService.get(key).subscribe((val) => {
                if (typeof val == 'string') {
                    this.title.setTitle(val);
                } else
                    throw new Error(
                        'Chave de tradução não corresponde a uma string.'
                    );
            });
        }
    }
}
