import { Injectable } from '@angular/core';
import mqtt from 'mqtt';
import { ApiService, Experimento, ModeloSala, MqttBroker, TipoVariavel } from './api.service';
import { ambiente } from '../../ambientes/ambiente';
import { RepositorioFuncoes } from '../uteis/repositorio-funcoes';
import { BehaviorSubject, Observable, ReplaySubject, Subscription } from 'rxjs';
import { stringAleatoria } from '../uteis/uteis';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root',
})
export class MqttService {
    public modelo?: ModeloSala;
    public variaveis: Variaveis = {atuadores: {}, sensores: {}};
    
    private variaveisSubject = new BehaviorSubject<Variaveis>(this.variaveis);
    public variaveisObservable = this.variaveisSubject.asObservable();

    private novoExperimentoSubject = new ReplaySubject<number>();
    private experimentoSubject = new ReplaySubject<{id: number, amostras: number[][]}>();
    private fimExperimentoSubject = new ReplaySubject<number>();

    private cliente?: mqtt.MqttClient;
    private codigoSala = '';
    private funcoes?: RepositorioFuncoes;

    private promiseInicioExperimento?: {
        codigo: string,
        resolve: () => void,
        reject: () => void
    };

    // Mock de embarcado em experimento
    private idUltimaAmostra: number = 0;
    private bufferAmostras: number[][] = [];
    private idExperimento?: number;
    
    constructor(
        private authService: AuthService,
        private apiService: ApiService
    ) {
    }

    async conectar(codigoSala: string, modelo: ModeloSala, broker?: MqttBroker) {
        this.desconectar();

        this.codigoSala = codigoSala;
        this.modelo = modelo;
        
        const modelosFuncoes: {nome: string, expr: string}[] = [];
        modelo.atuadores.forEach(atuador => {
            Object.entries(atuador.configuracoes.variaveis).forEach(([nome, variavel]) => {
                modelosFuncoes.push({nome: `${atuador.codigo}-${nome}`, expr: variavel.f});
                modelosFuncoes.push({nome: `${atuador.codigo}-${nome}-inv`, expr: variavel.f_inv});
                this.variaveis.atuadores[`${atuador.codigo}-${nome}`] = {
                    nome: variavel.nome,
                    unidade: variavel.unidade,
                    tipo: variavel.tipo, 
                    valor: 0, 
                    confirmado: false
                };
            })
        })
        modelo.sensores.forEach(sensor => {
            Object.entries(sensor.configuracoes.variaveis).forEach(([nome, variavel]) => {
                modelosFuncoes.push({nome: `${sensor.codigo}-${nome}`, expr: variavel.f});
                this.variaveis.sensores[`${sensor.codigo}-${nome}`] = {
                    tipo: variavel.tipo, 
                    nome: variavel.nome,
                    unidade: variavel.unidade,
                    valor: 0
                };
            })
        });
        
        try {
            this.funcoes?.destruir();
            this.funcoes = new RepositorioFuncoes(modelosFuncoes);
            
            await Promise.all(
                Object.entries(this.variaveis.atuadores)
                    .filter(([codigo, atuador]) => atuador.tipo == 'limitada')
                    .map(async ([codigo, atuador]) => {
                        atuador.min = await this.funcoes?.chamar(codigo, 0) ?? 0;
                        atuador.max = await this.funcoes?.chamar(codigo, 1) ?? 1;
                        atuador.passo = (atuador.max - atuador.min) / 1000;
                        atuador.valor = atuador.min;
                    })
            );
        }
        catch (e) {
            throw new Error("Erro ao criar funções");
        }

        this.variaveisSubject.next(this.variaveis);

        if (['dev', 'static'].includes(ambiente.ambiente)) {
            // simular resposta do embarcado ao topico mqtt 'status'
            setTimeout(() => {
                this.aoReceberMensagem(
                    `${this.codigoSala}/status`, 
                    JSON.stringify(
                        Object.fromEntries(
                            Object.entries(this.variaveis.atuadores)
                            .concat(Object.entries(this.variaveis.sensores))
                            .map(([codigo, variavel]) => [codigo, variavel.valor])
                        )
                    )
                );
            }, 1000)

            // simular envio de amostras caso sala esteja em experimento
            this.apiService.pegarExperimentoEmAndamento(this.codigoSala)
                .then(exp => {
                    if (exp) {
                        this.simularExperimento(exp);
                    }
                })

            return;
        }

        if (!broker)
            throw new Error("Broker MQTT indefinido");

        const opcoes: any = {};
        if (broker.username) opcoes['username'] = broker.username;
        if (broker.password) opcoes['password'] = broker.password;
        this.cliente = mqtt.connect(broker.url, opcoes);
        this.cliente?.on('connect', () => {
            console.log('MQTT Conectado!');
            this.cliente?.on('message', this.aoReceberMensagem);
            this.cliente?.subscribe(`${codigoSala}/status`);
            this.cliente?.subscribe(`${codigoSala}/novo-exp`);
            this.cliente?.subscribe(`${codigoSala}/exp`);
            this.cliente?.subscribe(`${codigoSala}/fim-exp`);
            this.cliente?.publish(`${codigoSala}/get`, 'status');
        });
    }

    desconectar() {
        this.cliente?.end();
        this.cliente = undefined;
        this.codigoSala = '';
        this.modelo = undefined;
        this.variaveis.atuadores = {};
        this.variaveis.sensores = {};
        this.funcoes?.destruir();
        this.funcoes = undefined;
    }

    private aoReceberMensagem = (
        topico: string,
        msg: string | Buffer<ArrayBufferLike>
    ) => {
        if (typeof msg != 'string') {
            const decoder = new TextDecoder('utf-8');
            msg = decoder.decode(msg);
        }
        const segmentos = topico.split('/').slice(1);
        switch (segmentos[0]) {
            case 'status':
                {
                    const dispositivos = JSON.parse(msg) as {[key: string]: number};
                    const sensores = Object.fromEntries(Object.entries(dispositivos).filter(([codigo, valor]) => codigo in this.variaveis.sensores));
                    const atuadores = Object.fromEntries(Object.entries(dispositivos).filter(([codigo, valor]) => codigo in this.variaveis.atuadores));
                    if (sensores) {
                        for (let [codigo, x] of Object.entries(sensores)) {
                            if (this.variaveis.sensores[codigo]) {
                                this.funcoes?.chamar(codigo, x)
                                    .then(y => {
                                        this.variaveis.sensores[codigo].valor = y;
                                        this.variaveisSubject.next(this.variaveis);
                                    });
                            }
                        }
                    }
                    if (atuadores) {
                        for (let [codigo, x] of Object.entries(atuadores)) {
                            if (this.variaveis.atuadores[codigo]) {
                                this.funcoes?.chamar(codigo, x)
                                    .then(y => {
                                        this.variaveis.atuadores[codigo].valor = y;
                                        this.variaveis.atuadores[codigo].confirmado = true;
                                        this.variaveisSubject.next(this.variaveis);
                                    })
                            }   
                        }
                    }
                }
                break;
            case 'novo-exp':
                {
                    const {idExperimento, codigoRequisicao} = JSON.parse(msg);
                    if (this.promiseInicioExperimento) {
                        if (codigoRequisicao == this.promiseInicioExperimento.codigo)
                            this.promiseInicioExperimento.resolve();
                        else this.promiseInicioExperimento.reject();
                    }
                    this.novoExperimentoSubject.next(idExperimento);
                }
                break;
            case 'exp':
                this.experimentoSubject.next(JSON.parse(msg)); // Amostras sem passar por f(x)
                break;
            case 'fim-exp':
                this.fimExperimentoSubject.next(Number.parseInt(msg));
                this.experimentoSubject = new ReplaySubject();
                break;
        }
    }

    definirAtuador(
        codigo: string,
        valor: number
    ) {
        if (!this.variaveis.atuadores[codigo])
            throw new Error(`Atuador ${codigo} não existe`);

        this.variaveis.atuadores[codigo].confirmado = false;

        this.funcoes?.chamar(`${codigo}-inv`, valor)
            .then(val => {
                if (['dev', 'static'].includes(ambiente.ambiente)) {
                    // simular resposta mqtt com atraso
                    setTimeout(async () => {
                        const json = {} as {[key: string]: number};
                        json[codigo] = val;
                        this.aoReceberMensagem(
                            `${this.codigoSala}/status`, 
                            JSON.stringify(json)
                        )
                    }, 1000);
                }
                else if (this.cliente) {
                    const json = {} as {[key: string]: number};
                    json[codigo] = val;
                    this.cliente.publish(`${this.codigoSala}/set`, JSON.stringify(json));
                }
            })
    }

    iniciarExperimento(
        nome: string, 
        periodoAmostragemMs: number
    ) {
        const codigoRequisicao = stringAleatoria();
        const promiseMqtt = new Promise<void>((resolve, reject) => {
            this.promiseInicioExperimento = {
                codigo: codigoRequisicao,
                resolve, 
                reject
            }
        });
        const promise = Promise.race([
            promiseMqtt,
            new Promise<void>((res, rej) => setTimeout(() => { rej("timeout") }, 10000))
        ]).finally(() => {
            this.promiseInicioExperimento = undefined;
        });

        if (ambiente.ambiente == 'dev') {
            if (!this.authService.estaLogado())
                throw new Error("Usuário não logado");
            
            // simular resposta do embarcado
            setTimeout(() => {
                fetch(`${ambiente.apiUrlBase}/experimentos`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        auth: this.authService.token,
                        id_sala: this.codigoSala,
                        nome: nome,
                        periodo: periodoAmostragemMs,
                        cabecalho: 
                            [...this.modelo!.atuadores, ...this.modelo!.sensores]
                            .map(disp => {
                                return Object.entries(disp.configuracoes.variaveis).map(([codigo, variavel]) => {
                                    return {
                                        codigo: `${disp.codigo}-${codigo}`,
                                        nome: variavel.nome,
                                        unidade: variavel.unidade,
                                        f: variavel.f
                                    }
                                })
                            })
                            .flat()
                    })
                })
                .then(resp => resp.json())
                .then(resp => {
                    const idExperimento = resp.id as number;
                    this.aoReceberMensagem(
                        `${this.codigoSala}/novo-exp`, 
                        JSON.stringify({
                            idExperimento,
                            codigoRequisicao
                        })
                    );
                    this.apiService.pegarExperimento(this.codigoSala, idExperimento)
                    .then(exp => {
                        this.simularExperimento(exp);
                    })
                })
            }, 1000);
        }
        else {
            this.cliente?.publish(
                `${this.codigoSala}/iniciar-exp`, 
                JSON.stringify({
                    codigo: codigoRequisicao,
                    nome: nome,
                    periodo: periodoAmostragemMs
                })
            );
        }
        return promise;
    }
    private async simularExperimento(experimento: Experimento) {
        if (!this.funcoes)
            return;
        const funcoes = this.funcoes;
        this.idExperimento = experimento.id;
        this.idUltimaAmostra = experimento.qtdAmostras;
        this.bufferAmostras.length = 0;

        const coletarAmostra = async () => {
            const amostra = await Promise.all([
                ...Object.entries(this.variaveis.atuadores).map(([codigo, variavel]) => funcoes.chamar(`${codigo}-inv`, variavel.valor)),
                ...Object.values(this.variaveis.sensores).map(variavel => (this.idUltimaAmostra % 10))
            ]);
            this.idUltimaAmostra++;
            this.bufferAmostras.push(amostra);
        }

        // Coletar algumas amostras para simular perda de bloco de amostras (amostras no buffer que ainda não estão no bd)
        for (let i = 0; i < 3; i++) await coletarAmostra();

        const loop = async () => {
            if (!this.idExperimento) return;

            await coletarAmostra();

            this.aoReceberMensagem(`${this.codigoSala}/exp`, JSON.stringify({id: this.idUltimaAmostra, amostras: [this.bufferAmostras.at(-1)]}));

            if (this.bufferAmostras.length > 9) {
                const len = this.bufferAmostras.length;
                fetch(`${ambiente.apiUrlBase}/amostras`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        auth: this.authService.token,
                        id_sala: this.codigoSala,
                        id_experimento: this.idExperimento,
                        amostras: this.bufferAmostras
                    })
                })
                .then(resp =>resp.json())
                .then(resp => {
                    if (resp.status == 'ok') {
                        this.bufferAmostras.splice(0, len);
                    }
                    else throw new Error(resp.erro);
                })
            }
            
            setTimeout(loop, experimento.periodo);
        };
        loop();
    }
    sincronizarExperimento() {
        if (ambiente.ambiente == 'dev') {
            this.aoReceberMensagem(
                `${this.codigoSala}/exp`, 
                JSON.stringify({
                    id: this.idUltimaAmostra - this.bufferAmostras.length + 1,
                    amostras: this.bufferAmostras
                })
            )
        }
        else {
            this.cliente?.publish(`${this.codigoSala}/sinc-exp`, '');
        }
    }
    pararExperimento() {
        if (ambiente.ambiente == 'dev') {
            if (this.idExperimento == undefined) return;
            const idExperimento = this.idExperimento;
            this.idExperimento = undefined;

            fetch(`${ambiente.apiUrlBase}/salas`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    auth: this.authService.token,
                    id: this.codigoSala,
                    parar_experimento: true
                })
            })
            .then(() => {
                this.aoReceberMensagem(`${this.codigoSala}/fim-exp`, idExperimento.toString());
            })
        }
        else
            this.cliente?.publish(`${this.codigoSala}/parar-exp`, '');
    }

    subscreverEmNovoExperimento(tratador: (idNovoExperimento: number) => void) {
        return this.novoExperimentoSubject.subscribe(tratador);
    }
    subscreverEmExperimento(tratador: (bloco: {id: number, amostras: number[][]}) => void) {
        return this.experimentoSubject.subscribe(tratador);
    }
    subscreverEmFimExperimento(tratador: (idExperimento: number) => void) {
        return this.fimExperimentoSubject.subscribe(tratador);
    }
}

export type VariavelMQTT = {
    nome: string,
    unidade: string,
    valor: number, 
    tipo: TipoVariavel, 
    confirmado?: boolean, 
    min?: number, 
    max?: number,
    passo?: number
}

export type Variaveis = { 
    atuadores: {[key: string]: VariavelMQTT }, 
    sensores: {[key: string]: VariavelMQTT } 
}