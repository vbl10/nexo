import { Injectable } from '@angular/core';
import { ambiente } from '../../ambientes/ambiente';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    token?: string;
    dados?: {
        nome: string,
        usuario: string,
        iat: number
    };

    constructor() {
        this.atualizarToken(localStorage.getItem('token'));
    }

    private atualizarToken(novoToken: string | null) {
        this.token = novoToken ?? undefined;
        if (this.token) {
            localStorage.setItem("token", this.token);
            const result = /^(.+)\.(.+)\.(.+)$/.exec(this.token);
            if (result) {
                const [, header, payload] = result;
                this.dados = JSON.parse(atob(decodeURIComponent(payload))) as {id: number, nome: string, usuario: string, iat: number};
            }
        }
        else {
            localStorage.removeItem("token");
            this.dados = undefined;
        }
    }

    estaLogado(): boolean {
        return this.token != undefined;
    }

    login(usuario: string, senha: string) {
        type Resposta = {
            status: 'ok' | 'erro';
            erro?: string;
            token?: string;
        };

        return fetch(`${ambiente.apiUrlBase}/usuarios/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ usuario, senha }),
        })
            .then((resp) => resp.json() as Promise<Resposta>)
            .then((res) => {
                if (res.status == 'ok' && res.token) {
                    this.atualizarToken(res.token);
                    return true;
                }
                return res.erro ?? 'desconhecido';
            });
    }

    logout() {
        this.atualizarToken(null);
    }

    singup(nome: string, usuario: string, senha: string) {
        type Resposta = {
           status: "ok" | "erro",
           erro?: string,
           token?: string
       };

        return fetch(`${ambiente.apiUrlBase}/usuarios/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({nome, usuario, senha})
        })
            .then(res => res.json() as Promise<Resposta>)
            .then(res => {
                if (res.status == 'ok' && res.token) {
                    this.atualizarToken(res.token);
                    return true;
                }
                return res.erro ?? 'desconhecido';
            })
    }
}
