import express, { Request, Response } from "express";
import { AcessoNegado, ParametroFaltante, ParametroInvalido, RequisicaoRuim, tratarExcecao, UsuarioNaoLogado } from "../include/excecoes";
import { decodificarToken } from "../include/jwt";
import { pegarPoolMysql } from "../include/db";
import { ModeloSala } from "../include/tipos";
import { randomBytes } from "crypto";
import { ambiente } from "../include/ambiente";
import { criarCanalIvs, excluirCanalIvs } from "../include/api-ivs";

const router = express.Router();

//GET
router.get("", async (req, res) => {
    try {
        const query = req.query as {
            auth?: string, 
            id?: string, 
            codigo_ou_nome?: string
        }
        if (!query.auth) throw new ParametroFaltante("auth");
        const auth = decodificarToken(query.auth);
        if (!auth) throw new UsuarioNaoLogado();

        const pool = await pegarPoolMysql();        

        const resBody = {
            status: 'ok'
        } as any;

        if (query.id !== undefined) {
            const sala = resBody.sala = await pool.execute(
                `
                select 
                    salas.id, 
                    salas.nome,
                    salas_usuarios.proprietario, 
                    salas.modelo, 
                    COALESCE(salas.id_experimento, 0) as id_experimento,
                    mqtt_brokers.url as mqtt_broker__url,
                    mqtt_brokers.host as mqtt_broker__host,
                    mqtt_brokers.porta as mqtt_broker__porta,
                    mqtt_brokers.username as mqtt_broker__username,
                    mqtt_brokers.password as mqtt_broker__password 
                from salas 
                join salas_usuarios on salas_usuarios.id_sala = salas.id 
                join mqtt_brokers on mqtt_brokers.id = salas.id_mqtt_broker 
                where salas.id = ? and salas_usuarios.usuario = ?
                `, 
                [query.id, auth.usuario]
            )
            .then(([rows]) => {
                const sala = (rows as any[])[0];
                return sala  
                    ? {
                        id: sala.id,
                        nome: sala.nome,
                        proprietario: sala.proprietario == 1,
                        modelo: JSON.parse(sala.modelo) as ModeloSala,
                        id_experimento: sala.id_experimento,
                        mqtt_broker: {
                            url: sala.mqtt_broker__url,
                            host: sala.mqtt_broker__host,
                            porta: sala.mqtt_broker__porta,
                            username: sala.mqtt_broker__username,
                            password: sala.mqtt_broker__password
                        }
                    }
                    : undefined
            });

            // Adicionar streams às câmeras
            if (sala?.modelo) {
                const streams = await pool.execute(
                    "SELECT id, url_reproducao, url_transmissao FROM streams WHERE id_sala = ?", 
                    [query.id]
                ).then(([rows]) => rows as {id: number, url_reproducao: string, url_transmissao: string}[]);

                await Promise.all(sala.modelo.cameras.map(async cam => {
                    const stream = streams.find(stream => stream.id == cam.id);
                    if (stream) {
                        cam.url_reproducao = stream.url_reproducao;
                        if (sala.proprietario) {
                            cam.url_transmissao = stream.url_transmissao;
                            cam.stream_key = stream.url_transmissao.substring(stream.url_transmissao.lastIndexOf('/') + 1);
                        }
                    }
                }));
            }
        }
        else if (query.codigo_ou_nome) {
            const [rows]: any = await pool.execute(
                `
                    SELECT salas.id, salas.nome, COALESCE(salas_usuarios.proprietario, FALSE) AS proprietario
                    FROM salas
                    LEFT JOIN salas_usuarios 
                    ON salas_usuarios.id_sala = salas.id 
                    AND salas_usuarios.usuario = ?
                    WHERE salas.nome LIKE ? OR salas.id LIKE ?
                    ORDER BY salas.nome
                `,
                [auth.usuario, `%${query.codigo_ou_nome}%`, `%${query.codigo_ou_nome}%`]
            );
            resBody.salas = rows;
        } else {
            //Pegar todas as salas
            const [rows]: any = await pool.execute(
                `
                    SELECT salas.id, salas.nome, salas_usuarios.proprietario
                    FROM salas
                    JOIN salas_usuarios ON salas_usuarios.id_sala = salas.id
                    WHERE salas_usuarios.usuario = ?
                    ORDER BY salas.nome
                `,
                [auth.usuario]
            );
            resBody.salas = rows;
        }

        res.json(resBody);
    }
    catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

//POST
router.post("", async (req, res) => {
    try {
        const acoes = ['criar', 'favoritar', 'desfavoritar'] as const;
        type Acao = typeof acoes[number];

        const body = req.body as {
            auth?: string,
            acao?: Acao,
            modelo?: ModeloSala
            id_sala?: string
        };

        const resBody = {
            status: 'ok'
        } as any;

        if (!body.auth) throw new ParametroFaltante("auth");
        const auth = decodificarToken(body.auth);
        if (!auth) throw new UsuarioNaoLogado();

        if (!body.acao) 
            throw new ParametroFaltante("acao");
        if (!acoes.includes(body.acao)) 
            throw new ParametroInvalido('acao', body.acao, acoes.map(acao => `"${acao}"`));

        const pool = await pegarPoolMysql();

        switch (body.acao) {
            case 'criar': {
                if (!body.modelo) throw new ParametroFaltante('modelo');

                const idSala = randomBytes(6).toString('hex').slice(0, 12);

                // criar sala
                await pool.execute(
                    "INSERT INTO salas (id, nome, id_mqtt_broker) VALUES (?, ?, 1)",
                    [idSala, body.modelo.nome]
                );
                // associar usuário à sala
                await pool.execute(
                    "INSERT INTO salas_usuarios (usuario, id_sala, proprietario) VALUES (?, ?, TRUE)",
                    [auth.usuario, idSala]
                );

                // crair câmeras, atualizar modelo
                if (body.modelo.cameras && body.modelo.cameras.length > 0) {
                    await Promise.all(
                        body.modelo.cameras.map(async camera => {
                            const canal = ambiente.ambiente == 'prod'
                                ? await criarCanalIvs()
                                : {
                                    arn: '', 
                                    playbackUrl: 'https://fcc3ddae59ed.us-west-2.playback.live-video.net/api/video/v1/us-west-2.893648527354.channel.DmumNckWFTqz.m3u8',
                                    transmissionUrl: ''
                                };
                            
                            return pool.execute(
                                    'INSERT INTO streams (id_sala, arn, url_reproducao, url_transmissao) VALUES (?, ?, ?, ?)', 
                                    [idSala, canal.arn, canal.playbackUrl, canal.transmissionUrl]
                                )
                                .then(([rows]) => {
                                    camera.id = (rows as any).insertId;
                                })
                        })
                    );
                }
                // inserir modelo atualizado com id's das câmeras
                await pool.execute(
                    'UPDATE salas SET modelo = ? WHERE id = ?', 
                    [JSON.stringify(body.modelo), idSala]
                );
            }
            break;
            case 'favoritar': {
                const { id_sala } = body;
                if (!id_sala) throw new ParametroFaltante("id_sala");

                await pool.execute(
                    "INSERT INTO salas_usuarios (usuario, id_sala, proprietario) VALUES (?, ?, FALSE)",
                    [auth.usuario, id_sala]
                );
            }
            break;
            case 'desfavoritar': {
                const { id_sala } = body;
                if (!id_sala) throw new ParametroFaltante("id_sala");

                await pool.execute(
                    "DELETE FROM salas_usuarios WHERE usuario = ? AND id_sala = ?",
                    [auth.usuario, id_sala]
                );
            }
            break;
        }
        res.json(resBody);
    }
    catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
})

//DELETE
router.delete("", async (req, res) => {
    try {
        const query = req.query as { auth?: string; id?: string };
        if (!query.auth) throw new ParametroFaltante("auth");
        const auth = decodificarToken(query.auth);
        if (!auth) throw new UsuarioNaoLogado();

        if (!query.id) throw new ParametroFaltante("id");

        const pool = await pegarPoolMysql();

        // verificar se o usuário é proprietário da sala
        const [proprietarioRows]: any = await pool.execute(
            "SELECT proprietario FROM salas_usuarios WHERE usuario = ? AND id_sala = ?",
            [auth.usuario, query.id]
        );

        const ehProprietario = proprietarioRows.length && proprietarioRows[0].proprietario === 1;
        
        if (!ehProprietario) {
            throw new AcessoNegado();
        }

        // buscar todas as streams associadas à sala
        const [streams]: any = await pool.execute(
            "SELECT id, arn FROM streams WHERE id_sala = ?",
            [query.id]
        );

        // apagar cada stream associada à sala
        for (const s of streams) {
            if (s.arn && String(s.arn).length > 0) {
                try {
                    await excluirCanalIvs(s.arn);
                } catch (e: any) {
                    console.warn(`Falha ao excluir canal IVS arn=${s.arn}:`, e?.message ?? e);
                }
            }
        }

        // apagar a sala (ON DELETE CASCADE para salas_usuarios e streams)
        await pool.execute("DELETE FROM salas WHERE id = ?", [query.id]);

        res.json({ status: "ok" });

    } catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});

//PATCH
router.patch("", async (req, res) => {
    try {
        const body = req.body as {
            auth?: string;
            id?: string;
            nome?: string;
            modelo?: any;
            parar_experimento?: boolean;
        };

        if (!body.auth) throw new ParametroFaltante("auth");
        const auth = decodificarToken(body.auth);
        if (!auth) throw new UsuarioNaoLogado();

        if (!body.id) throw new ParametroFaltante("id");

        const pool = await pegarPoolMysql();

        // Atualizar nome da sala
        if (body.nome) {
            await pool.execute(
                "UPDATE salas SET nome = ? WHERE id = ?",
                [body.nome, body.id]
            );
        }

        // Atualizar modelo (câmeras, streams etc.)
        if (body.modelo) {
            const id = body.id;
            const modeloNovo = body.modelo;

            // Excluir streams apagadas do modelo
            const idsPresentes = (modeloNovo.cameras ?? []).map((cam: any) => cam.id);
            const [streamsAntigas]: any = await pool.execute(
                "SELECT id, arn FROM streams WHERE id_sala = ?",
                [id]
            );

            for (const stream of streamsAntigas) {
                if (!idsPresentes.includes(stream.id)) {
                    if (stream.arn && stream.arn.length > 0) {
                        try {
                            await excluirCanalIvs(stream.arn);
                        } catch (err) {
                            console.warn(`Falha ao excluir canal IVS ${stream.arn}`, err);
                        }
                    }
                    await pool.execute("DELETE FROM streams WHERE id = ?", [stream.id]);
                }
            }

            // Criar streams para câmeras novas (sem id)
            for (const camera of modeloNovo.cameras ?? []) {
                if (!camera.id || camera.id === "") {
                    const canal =
                        ambiente.ambiente === "prod"
                            ? await criarCanalIvs()
                            : {
                                  arn: "",
                                  playbackUrl:
                                      "https://fcc3ddae59ed.us-west-2.playback.live-video.net/api/video/v1/us-west-2.893648527354.channel.DmumNckWFTqz.m3u8",
                                  transmissionUrl: "",
                              };

                    const [result]: any = await pool.execute(
                        "INSERT INTO streams (id_sala, arn, url_reproducao, url_transmissao) VALUES (?, ?, ?, ?)",
                        [id, canal.arn, canal.playbackUrl, canal.transmissionUrl]
                    );

                    camera.id = result.insertId;
                }
            }

            // Atualizar modelo no banco
            await pool.execute("UPDATE salas SET modelo = ? WHERE id = ?", [
                JSON.stringify(modeloNovo),
                id,
            ]);
        }

        // Parar experimento ativo
        if (body.parar_experimento) {
            await pool.execute("UPDATE salas SET id_experimento = NULL WHERE id = ?", [
                body.id,
            ]);
        }

        res.json({status: "ok"});

    } catch (erro: any) {
        tratarExcecao(erro, req, res);
    }
});


export default router;
