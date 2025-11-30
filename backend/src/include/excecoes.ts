import { Request, Response } from "express";
import { ambiente } from "./ambiente";

export function tratarExcecao(erro: Error, req: Request, res: Response) {
    const data = ['GET', 'DELETE'].includes(req.method) ? req.query : req.body;
    if (erro instanceof RequisicaoRuim) {
        res.status(400).json({
            status: "erro",
            erro: erro.message,
            req: data,
        });
    } else {
        if (ambiente.responseError === "true") {
            res.status(500).json({ status: "erro", erro: erro.message, req: data });
        } else {
            res.status(500).json({ status: "erro", req: data });
        }
    }
}

type Requeridos = {
    [chave: string]: 
        | string 
        | readonly string[] 
        | ((valor: any, prefixo: string) => void)
        | Requeridos
};
export function validarRequisicao(dados: any, requeridos: Requeridos, prefixo: string = '') {
    if (typeof dados !== 'object')
        throw new RequisicaoRuim('mal-formatado');

    for (let [chave, tipo] of Object.entries(requeridos)) {
        if (typeof tipo === 'object')
            validarRequisicao(dados[chave], tipo as Requeridos, prefixo + chave + '.');
        else if (typeof dados[chave] === 'undefined')
            throw new ParametroFaltante(prefixo + chave);
        else if (typeof tipo == 'function') 
            tipo(dados[chave], prefixo);
        else if (!(typeof tipo === 'string' ? [tipo] : tipo).includes(typeof dados[chave]))
            throw new ParametroInvalido(prefixo + chave, dados[chave], tipo);
    }
}

export function parseInteiro(nome: string, valor: any): number {
    const num = Number.parseInt(valor);
    if (Number.isNaN(num))
        throw new ParametroInvalido(nome, valor, 'int');
    return num;
}

export function parseNumero(nome: string, valor: any): number {
    const num = Number.parseFloat(valor);
    if (Number.isNaN(num))
        throw new ParametroInvalido(nome, valor, 'number');
    return num;
}

export class RequisicaoRuim extends Error {
    constructor(codigo: string) {
        super(`requisicao-ruim/${codigo}`);
        this.name = this.constructor.name;
    }
}

export class RequisicaoRuimGenerica extends RequisicaoRuim {
    constructor(msg: string) {
        super(`erro-generico: ${msg}`);
    }
}

export class MetodoHTTPInvalido extends RequisicaoRuim {
    constructor(method?: string) {
        super(`metodo-http-invalido: ${method ?? "UNKNOWN"}`);
    }
}

export class ParametroInvalido extends RequisicaoRuim {
    constructor(nomeVariavel: string, valorPassado: any, valorAceito: string | readonly string[]) {
        super(`parametro-invalido: ${nomeVariavel} de tipo ${typeof valorPassado} e igual a ${valorPassado} deve ser ${typeof valorAceito == 'string' ? valorAceito : valorAceito.join(' ou ')}`);
    }
}

export class ParametroFaltante extends RequisicaoRuim {
    constructor(param: string) {
        super(`parametro-faltante: ${param}`);
    }
}

export class FalhaDeAutenticacao extends RequisicaoRuim {
    constructor(codigo: string) {
        super(`falha-autenticacao/${codigo}`);
    }
}

export class UsuarioNaoLogado extends FalhaDeAutenticacao {
    constructor() {
        super("usuario-nao-logado");
    }
}

export class AcessoNegado extends RequisicaoRuim {
    constructor() {
        super("acesso-negado");
    }
}

export class NaoExiste extends RequisicaoRuim {
    constructor() {
        super("nao-existe");
    }
}