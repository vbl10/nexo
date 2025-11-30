import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { LangService } from '../../services/lang.service';

@Component({
  selector: 'app-navbar',
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
    
    @ViewChild('menu')
    menu!: ElementRef<HTMLElement>;
    
    lang: string;

    constructor(
        public translateService: TranslateService, 
        public authService: AuthService,
        public router: Router,
        public langService: LangService
    ) {
        this.lang = translateService.currentLang;
    }

    logout() {
        this.authService.logout();
        this.router.navigateByUrl("/login");
        this.menu.nativeElement.hidePopover();
    }
}
