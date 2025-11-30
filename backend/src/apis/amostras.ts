import express from "express";
import { ParametroInvalido, parseInteiro, tratarExcecao, UsuarioNaoLogado, validarRequisicao } from "../include/excecoes";
import { decodificarToken } from "../include/jwt";
import { pegarPoolMysql } from "../include/db";

const router = express.Router();

router.get("", async (req, res) => {
    try {
        const query = req.query as any as {
            auth: string,
            id_sala: string,
            id_experimento: string,
            primeira?: string,
            ultima?: string
        };
        
        validarRequisicao(query, {
            auth: 'string',
            id_sala: 'string'
        })

        let primeira;
        if (query.primeira != undefined) 
            primeira = parseInteiro('primeira', query.primeira);

        let ultima;
        if (query.ultima != undefined) 
            ultima = parseInteiro('ultima', query.ultima);

        const idExperimento = parseInteiro('id_experimento', query.id_experimento);

        if (!decodificarToken(query.auth)) throw new UsuarioNaoLogado();

        const pool = await pegarPoolMysql();

        const resBody = {status: 'ok'} as any;

        resBody.blocos = await pool.execute(
            `SELECT id, bloco 
                FROM amostras 
                WHERE id_sala = ? AND id_experimento = ?
                ${primeira ?  ` AND id >= (SELECT MAX(id) FROM amostras WHERE id <= ?)` : ""}
                ${ultima ?  ` AND id <= (SELECT MIN(id) FROM amostras WHERE id >= ?)` : ""}
            `, [query.id_sala, idExperimento, ...(primeira ? [primeira] : []), ...(ultima ? [ultima] : [])]
        ).then(([rows]) => {
            return (rows as {id: number, bloco: Buffer}[])
            .map(row => {
                return {
                    id: row.id,
                    bloco: Array.from(new Float32Array((new Uint8Array(row.bloco)).buffer))
                }
            })
        })

        res.json(resBody);
    }
    catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

router.post("", async (req, res) => {
    try {
        const body = req.body as any as {
            auth: string,
            id_sala: string,
            id_experimento: number,
            amostras?: number[][],
            finalizar?: boolean
        };
        validarRequisicao(body, {
            auth: 'string',
            id_sala: 'string',
            id_experimento: 'number',
        })

        if (!decodificarToken(body.auth)) throw new UsuarioNaoLogado();

        const pool = await pegarPoolMysql();
        const resBody = {status: 'ok'} as any;

        if (body.amostras) {
            if (!Array.isArray(body.amostras) || !body.amostras.every(amostra => Array.isArray(amostra)))
                throw new ParametroInvalido('amostras', body.amostras, 'number[][]');

            const amostras = body.amostras;

            if (amostras.length > 0) {
                const {idUltimoBloco, tamBlocoBytes} = await pool.execute(
                    `SELECT id, LENGTH(bloco) tam_bloco FROM amostras 
                    WHERE id_sala = ? AND id_experimento = ?
                    ORDER BY id DESC
                    LIMIT 1
                    `,
                    [body.id_sala, body.id_experimento]
                ).then(([rows]) => { return { idUltimoBloco: (rows as any[]).at(0)?.id as number, tamBlocoBytes: (rows as any[]).at(0)?.tam_bloco as number}});
                const idBloco = idUltimoBloco && tamBlocoBytes 
                    ? idUltimoBloco + tamBlocoBytes / 4 / amostras[0].length
                    : 1;
                await pool.execute(
                    "INSERT INTO amostras (id_sala, id_experimento, id, bloco) VALUES (?, ?, ?, ?)",
                    [body.id_sala, body.id_experimento, idBloco, Buffer.from(Float32Array.from(body.amostras.flat()).buffer)]
                );
            }
        }

        if (body.finalizar) {
            await pool.execute("UPDATE salas SET id_experimento = NULL WHERE salas.id = ?", [body.id_sala]);
        }

        res.json(resBody);
    }
    catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

export default router;