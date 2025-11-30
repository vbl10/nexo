import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup',
  imports: [
    CommonModule,
    TranslateModule,
    RouterLink,
    ReactiveFormsModule
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {
    form: FormGroup;
    erro = '';

    nome!: AbstractControl;
    usuario!: AbstractControl;
    senha!: AbstractControl;
    confirmaSenha!: AbstractControl;

    constructor(
        private authService: AuthService,
        private router: Router,
        fb: FormBuilder
    ) {
        this.form = fb.group({
            nome: ['', [Validators.required]],
            usuario: ['', [Validators.required, Validators.minLength(8)]],
            senha: ['', [Validators.required, Validators.minLength(12), this.senhaForte]],
            confirmaSenha: ['', [Validators.required]]
        }, {
            validators: [this.senhasIguais]
        });

        this.nome = this.form.get('nome') as any;
        this.usuario = this.form.get('usuario') as any;
        this.senha = this.form.get('senha') as any;
        this.confirmaSenha = this.form.get('confirmaSenha') as any;

        if (authService.estaLogado()) {
            router.navigateByUrl('/salas');
        }
    }

    senhasIguais(formGroup: FormGroup): { [key: string]: boolean } | null {
        return formGroup.get('senha')?.value != formGroup.get('confirmaSenha')?.value ? { senhasDiferentes: true } : null;
    }

    senhaForte(control: AbstractControl): { [key: string]: string[] } | null {
        const res = { senhaFraca: [] as string[] }
        const senha = control.value;
        if (!/[A-Z]/.test(senha)) res.senhaFraca.push('maiuscula');
        if (!/[a-z]/.test(senha)) res.senhaFraca.push('minuscula');
        if (!/\d/.test(senha)) res.senhaFraca.push('digito');
        if (!/\W/.test(senha)) res.senhaFraca.push('especial');

        return res.senhaFraca.length > 0 ? res : null;
    }

    signup() {
        this.authService.singup(
            this.form.value['nome'], 
            this.form.value['usuario'], 
            this.form.value['senha']
        )
            .then(res => {
                if (res == true) {
                    this.router.navigateByUrl('/painel');
                }
                else {
                    const [codigo, msg] = res.split(':')
                    const partes = codigo.split('/');
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
