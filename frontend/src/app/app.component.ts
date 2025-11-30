import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import mqtt from 'mqtt';
import { NavbarComponent } from './components/navbar/navbar.component';
import { LangService } from './services/lang.service';
/*
 */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NavbarComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
})
export class AppComponent {
    constructor(
        public langService: LangService
    ) {
    }
}
