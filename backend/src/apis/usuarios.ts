import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import {
    ParametroFaltante,
    FalhaDeAutenticacao,
    RequisicaoRuim,
    tratarExcecao,
} from "../include/excecoes";
import { pegarPoolMysql } from "../include/db";
import { gerarToken } from "../include/jwt";
import { ambiente } from "../include/ambiente";

const router = express.Router();

function encriptarSenha(senha: string) {
    return bcrypt.hash(senha + ambiente.userPassPepper, 12);
}

function compararSenha(senha: string, hash: string) {
    return bcrypt.compare(senha + ambiente.userPassPepper, hash);
}

router.post("/login", async (req: Request, res: Response) => {
    const resposta: any = { status: "erro" };

    try {
        const { usuario, senha } = req.body ?? {};

        if (!usuario) throw new ParametroFaltante("usuario");
        if (!senha) throw new ParametroFaltante("senha");

        const pool = await pegarPoolMysql();

        const [rows] = await pool.execute(
            "SELECT * FROM usuarios WHERE usuario = ?",
            [usuario]
        );

        const row = (rows as any[])[0];

        if (!row) throw new FalhaDeAutenticacao("usuario-inexistente");
    
        if (!await compararSenha(senha, row.hash_senha))
            throw new FalhaDeAutenticacao("senha-incorreta");

        resposta.status = "ok";
        resposta.token = gerarToken(usuario, row.nome);

        res.status(200).json(resposta);
    } catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

/**
 * POST /auth/signup
 * Corpo:
 * {
 *   nome: string,
 *   usuario: string,
 *   senha: string
 * }
 *
 * Resposta:
 * {
 *   status: "ok" | "erro",
 *   erro?: string,
 *   token?: {
 *     payload: {
 *       id: number,
 *       nome: string,
 *       usuario: string,
 *       iat: number
 *     }
 *   }
 * }
 */

function senhaForte(senha: string): string[] | null {
    const res: string[] = [];

    if (senha.length < 12) res.push("comprimento");
    if (!/[A-Z]/.test(senha)) res.push("maiuscula");
    if (!/[a-z]/.test(senha)) res.push("minuscula");
    if (!/\d/.test(senha)) res.push("digito");
    if (!/\W/.test(senha)) res.push("especial");

    return res.length > 0 ? res : null;
}

router.post("/signup", async (req: Request, res: Response) => {
    try {
        const { nome, usuario, senha } = req.body;

        for (const key of ["nome", "usuario", "senha"]) {
            if (typeof req.body[key] !== "string") {
                throw new ParametroFaltante(key);
            }
        }

        if (nome.length > 30) throw new FalhaDeAutenticacao("nome-longo");
        if (usuario.length > 30) throw new FalhaDeAutenticacao("usuario-longo");
        if (senha.length > 30) throw new FalhaDeAutenticacao("senha-longa");

        const fraca = senhaForte(senha);
        if (fraca) throw new FalhaDeAutenticacao("senha-fraca:" + fraca.join(","));

        const pool = await pegarPoolMysql();

        const [usuarios] = await pool.execute("SELECT usuario FROM usuarios WHERE usuario = ?", [usuario]) as [any[], any];
        if (usuarios.length > 0) 
            throw new Error("usuario-ja-existe");

        await pool.execute(
            "INSERT INTO usuarios (nome, usuario, hash_senha) VALUES (?, ?, ?)", [
                nome, usuario, await encriptarSenha(senha)
            ]
        );

        res.json({status: "ok", token: gerarToken(usuario, nome)});
    } catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

export default router;
