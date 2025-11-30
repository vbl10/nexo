import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TranslateModule,
    RouterLink
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
    
    form: FormGroup;
    erro = '';

    constructor(
        private authService: AuthService,
        private router: Router
    ) {
        if (authService.estaLogado()) {
            router.navigateByUrl('/inicio');
        }
        this.form = new FormGroup({
            "usuario": new FormControl("", Validators.required),
            "senha": new FormControl("", Validators.required)
        })
    }

    login() {
        this.authService.login(this.form.controls['usuario'].value, this.form.controls['senha'].value)
            .then(res => {
                if (res == true) {
                    this.router.navigateByUrl('/home');
                }
                else {
                    const partes = res.split('/');
                    if (partes[0] == 'requisicao-ruim' && partes[1] == 'falha-autenticacao') {
                        this.erro = partes[2] ?? 'desconhecido';
                    }
                    else {
                        this.erro = 'desconhecido';
                    }
                }
            })
    }
}
