import experss from "express"
import { NaoExiste, ParametroFaltante, ParametroInvalido, parseInteiro, RequisicaoRuim, tratarExcecao, UsuarioNaoLogado, validarRequisicao } from "../include/excecoes";
import { decodificarToken } from "../include/jwt";
import { pegarPoolMysql } from "../include/db";

const router = experss.Router();

router.get("", async (req, res) => {
    try {
        const query = req.query as {
            auth?: string, 
            id_sala?: string, 
            id_experimento?: string,
            em_andamento?: string,
            limite?: string
        };
        if (!query.auth) throw new ParametroFaltante("auth");
        if (!decodificarToken(query.auth)) throw new UsuarioNaoLogado();

        if (!query.id_sala) throw new ParametroFaltante('id_sala');
        if (typeof query.id_sala != 'string') throw new ParametroInvalido('id_string', query.id_sala, 'string');

        const pool = await pegarPoolMysql();        

        const resBody = {
            status: 'ok'
        } as any;

        if (query.em_andamento !== undefined) {
            resBody.experimento = await pool.execute(
                `
                    SELECT 
                        experimentos.id, 
                        experimentos.nome, 
                        experimentos.inicio, 
                        experimentos.cabecalho, 
                        experimentos.periodo, 
                        (experimentos.id = COALESCE(salas.id_experimento, 0)) AS em_andamento,
                        COUNT(amostras.id) AS qtd_amostras
                    FROM experimentos 
                    JOIN salas ON salas.id = experimentos.id_sala 
                    LEFT JOIN amostras ON amostras.id_sala = experimentos.id_sala AND amostras.id_experimento = experimentos.id
                    WHERE experimentos.id_sala = ? AND salas.id_experimento = experimentos.id
                    GROUP BY experimentos.id, experimentos.nome, experimentos.inicio, experimentos.cabecalho, experimentos.periodo, em_andamento
                `, 
                [query.id_sala]
            ).then(([rows]) => (rows as any[])[0]);
            if (resBody.experimento) {
                resBody.experimento.inicio = (resBody.experimento.inicio as Date).getTime();
                resBody.experimento.cabecalho = JSON.parse(resBody.experimento.cabecalho);
                resBody.experimento.em_andamento = resBody.em_andamento == 1;
            }
            else resBody.experimento = null;
        }
        else if (query.id_experimento !== undefined) {
            const idExperimento = parseInteiro('id_experimento', query.id_experimento);
            resBody.experimento = await pool.execute(
                `
                    SELECT 
                        experimentos.id, 
                        experimentos.nome, 
                        experimentos.inicio, 
                        experimentos.cabecalho, 
                        experimentos.periodo, 
                        (experimentos.id = COALESCE(salas.id_experimento, 0)) AS em_andamento,
                        COUNT(amostras.id) AS qtd_amostras
                    FROM experimentos 
                    JOIN salas ON salas.id = experimentos.id_sala 
                    LEFT JOIN amostras ON amostras.id_sala = experimentos.id_sala AND amostras.id_experimento = experimentos.id
                    WHERE experimentos.id_sala = ? AND experimentos.id = ?
                    GROUP BY experimentos.id, experimentos.nome, experimentos.inicio, experimentos.cabecalho, experimentos.periodo, em_andamento
                    ORDER BY experimentos.inicio DESC
                `, 
                [query.id_sala, idExperimento]
            ).then(([rows]) => (rows as any[])[0])
            if (resBody.experimento) {
                resBody.experimento.inicio = (resBody.experimento.inicio as Date).getTime();
                resBody.experimento.cabecalho = JSON.parse(resBody.experimento.cabecalho);
                resBody.em_andamento = resBody.em_andamento == 1;
            }
            else {
                throw new NaoExiste();
            }
        }
        else {
            let limite;
            if (query.limite) {
                limite = parseInteiro('limite', query.limite);
            }

            resBody.experimentos = await pool.execute(
                `
                    SELECT 
                        experimentos.id, 
                        experimentos.nome, 
                        experimentos.inicio, 
                        experimentos.cabecalho, 
                        experimentos.periodo, 
                        (experimentos.id = COALESCE(salas.id_experimento, 0)) AS em_andamento,
                        COUNT(amostras.id) AS qtd_amostras
                    FROM experimentos 
                    JOIN salas ON salas.id = experimentos.id_sala 
                    LEFT JOIN amostras ON amostras.id_sala = experimentos.id_sala AND amostras.id_experimento = experimentos.id
                    WHERE experimentos.id_sala = ? 
                    GROUP BY experimentos.id, experimentos.nome, experimentos.inicio, experimentos.cabecalho, experimentos.periodo, em_andamento
                    ORDER BY experimentos.inicio DESC
                    ${limite ? `LIMIT ${limite}` : ''}
                `, [query.id_sala]
            ).then(([experimentos]) => (experimentos as any[]).map(experimento => {
                return {
                    id: experimento.id, 
                    nome: experimento.nome, 
                    inicio: (experimento.inicio as Date).getTime(), 
                    cabecalho: JSON.parse(experimento.cabecalho), 
                    periodo: experimento.periodo, 
                    em_andamento: experimento.em_andamento == 1,
                    qtd_amostras: experimento.qtd_amostras
                }
            }));
        }

        res.json(resBody);
    }
    catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

router.delete("", async (req, res) => {
    try {
        const query = req.query as any as {
            auth: string,
            id_sala: string,
            id_experimento: string
        };
        validarRequisicao(query, {
            auth: 'string',
            id_sala: 'string',
            id_experimento: 'string'
        });

        const idExperimento = parseInteiro('id_experimento', query.id_experimento);

        const auth = decodificarToken(query.auth);
        if (!auth) throw new UsuarioNaoLogado();

        const resBody = {status: 'ok'} as any;

        const pool = await pegarPoolMysql();
        await pool.execute(
            "DELETE FROM experimentos WHERE id_sala = ? AND id = ?", 
            [query.id_sala, idExperimento]
        );

        res.json(resBody);
    }
    catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

router.patch("", async (req, res) => {
    try {
        const body = req.body as {
            auth: string,
            id_sala: string,
            id_experimento: number,
            nome?: string
        };
        validarRequisicao(body, {
            auth: 'string',
            id_sala: 'string',
            id_experimento: 'number'
        });

        const auth = decodificarToken(body.auth);
        if (!auth) throw new UsuarioNaoLogado();

        const resBody = {status: 'ok'} as any;

        if (typeof body.nome == 'string') {
            const pool = await pegarPoolMysql();
            await pool.execute(
                "UPDATE experimentos SET nome = ? WHERE id_sala = ? AND id = ?",
                [body.nome, body.id_sala, body.id_experimento]
            )
        }

        res.json(resBody);
    }
    catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

router.post("", async (req, res) => {
    try {
        const body = req.body as {
            auth: string, 
            id_sala: string, 
            nome: string,
            cabecalho: {
                codigo: string,
                nome: string,
                unidade: string,
                f: string
            }[],
            periodo: number
        };

        validarRequisicao(body, {
            auth: 'string',
            id_sala: 'string',
            nome: 'string',
            cabecalho: (val, prefixo) => {
                if (Array.isArray(val)) val.forEach((elmt, idx) => 
                    validarRequisicao(elmt, {
                        codigo: 'string',
                        nome: 'string',
                        unidade: 'string',
                        f: 'string'
                    }, prefixo + idx + '.')
                )},
            periodo: 'number'
        })

        const auth = decodificarToken(body.auth);
        if (!auth) throw new UsuarioNaoLogado();

        const pool = await pegarPoolMysql();

        const id = await pool.execute(
            "SELECT COALESCE(MAX(id), 0) + 1 AS id FROM experimentos WHERE id_sala = ?",
            [body.id_sala]
        ).then(([rows]) => (rows as any[])[0].id as number);

        await pool.execute(
            `INSERT INTO experimentos (inicio, id_sala, id, nome, cabecalho, periodo)
            VALUES (CURRENT_TIMESTAMP(), ?, ?, ?, ?, ?)`,
            [body.id_sala, id, body.nome, body.cabecalho, body.periodo]
        );

        await pool.execute("UPDATE salas SET id_experimento = ? WHERE id = ?", [id, body.id_sala]);

        res.json({status: 'ok', id: id});
    }
    catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

export default router;