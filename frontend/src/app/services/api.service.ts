import { Injectable, model } from '@angular/core';
import { AuthService } from './auth.service';
import { ambiente } from '../../ambientes/ambiente';
import { MqttService } from './mqtt.service';

@Injectable({
    providedIn: 'root',
})
export class ApiService {
    constructor(private authService: AuthService) {}

    // salas ================
    pegarSalas(): Promise<SalaEmArranjo[]> {
        if (ambiente.ambiente == 'static') {
            return new Promise(resolve => {
                resolve(
                    (
                        JSON.parse(localStorage.getItem('salas') ?? '{"salas": []}').salas as Sala[]
                    ).map((sala): SalaEmArranjo => {return {id: sala.id, nome: sala.modelo.nome, proprietario: sala.proprietario}})
                );
            })
        }

        if (!this.authService.estaLogado()) 
            throw new UsuarioNaoLogado();

        return fetch(`${ambiente.apiUrlBase}/salas?auth=${this.authService.token}`)
            .then(resp => resp.json())
            .then(resp => {
                validarRespostaApi(resp);
                return resp.salas;
            });
    }

    pegarSala(id: string): Promise<Sala> {
        if (ambiente.ambiente == 'static') {
            return new Promise((resolve, reject) => {
                const salas = JSON.parse(localStorage.getItem('salas') ?? '{"salas": []}').salas as Sala[];
                const sala = salas.find(val => val.id == id);
                if (sala) resolve(sala);
                else reject(`Sala de código ${id} não encontrada`);
            })
        }


        if (!this.authService.estaLogado()) 
            throw new UsuarioNaoLogado();

        const params = new URLSearchParams();
        params.set('id', id);
        return fetch(`${ambiente.apiUrlBase}/salas?auth=${this.authService.token}&${params.toString()}`)
            .then(resp =>resp.json())
            .then(resp => {
                validarRespostaApi(resp);
                return resp.sala;
            });
    }

    removerSala(id: string) {
        if (ambiente.ambiente == 'static') {
            const salas = JSON.parse(localStorage.getItem('salas') ?? '{"salas": []}').salas as Sala[];
            const index = salas.findIndex(val => val.id == id);
            if (index == -1)
                throw new Error(`Sala de código ${id} não encontrada`);
            salas.splice(index, 1);
            localStorage.setItem('salas', JSON.stringify({salas}));
            return Promise.resolve();
        }

        if (!this.authService.estaLogado())
            throw new UsuarioNaoLogado();

        return fetch(`${ambiente.apiUrlBase}/salas?auth=${this.authService.token}&id=${id}`, { method: "DELETE" })
            .then(resp => resp.json())
            .then(resp => validarRespostaApi(resp))
    }

    criarSala(modelo: ModeloSala): Promise<void> {
        if (ambiente.ambiente == 'static') {
            const salas = JSON.parse(localStorage.getItem('salas') ?? '{"salas": []}');
            const id = Math.random().toString(36).slice(2);
            const sala: Sala = {
                id,
                modelo,
                proprietario: true,
                mqtt_broker: {
                    id: 0,
                    url: ''
                }
            };
            salas.salas.push(sala);
            localStorage.setItem('salas', JSON.stringify(salas));
            return Promise.resolve();
        }

        if (!this.authService.estaLogado())
            throw new UsuarioNaoLogado();

        return fetch(`${ambiente.apiUrlBase}/salas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth: this.authService.token,
                criarStreams: ambiente.ambiente == 'teste' || ambiente.ambiente == 'prod',
                acao: 'criar',
                modelo
            })
        })
        .then(resp => resp.json())
        .then(resp => validarRespostaApi(resp));
    }

    salvarSala(id: string, modelo: ModeloSala): Promise<void> {
        if (ambiente.ambiente == 'static') {
            const salas = JSON.parse(localStorage.getItem('salas') ?? '{"salas": []}') as {salas: Sala[]};
            const sala: Sala = {
                id,
                modelo,
                proprietario: true,
                mqtt_broker: {
                    id: 0,
                    url: ''
                }
            };
            const index = salas.salas.findIndex(sala => sala.id == id);
            if (index != -1)
                salas.salas[index] = sala;
            else
                salas.salas.push(sala);

            localStorage.setItem('salas', JSON.stringify(salas));

            return Promise.resolve();
        }

        return fetch(`${ambiente.apiUrlBase}/salas`, {
            method: "PATCH",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth: this.authService.token,
                id: id,
                nome: modelo.nome,
                modelo: modelo,
                criarStreams: ambiente.ambiente == 'teste' || ambiente.ambiente == 'prod'
            })
        })
            .then(resp => resp.json())
            .then(resp => validarRespostaApi(resp))
    }

    favoritarSala(id: string): Promise<void> {
        if (ambiente.ambiente == 'static') {
            return Promise.resolve();
        }

        if (!this.authService.estaLogado())
            throw new UsuarioNaoLogado();

        return fetch(`${ambiente.apiUrlBase}/salas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth: this.authService.token,
                acao: 'favoritar',
                id_sala: id
            })
        })
            .then(resp => resp.json())
            .then(resp => validarRespostaApi(resp))    
    }

    desfavoritarSala(id: string): Promise<void> {
        if (ambiente.ambiente == 'static') {
            return Promise.resolve();
        }

        if (!this.authService.estaLogado())
            throw new UsuarioNaoLogado();

        return fetch(`${ambiente.apiUrlBase}/salas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth: this.authService.token,
                acao: 'desfavoritar',
                id_sala: id
            })
        })
            .then(resp => resp.json())
            .then(resp => validarRespostaApi(resp))    
    }

    buscarSalaPorCodigoOuNome(codigoOuNome: string): Promise<SalaEmArranjo[]> {
        if (ambiente.ambiente == 'static')
            return Promise.reject("Não implementado");

        if (!this.authService.estaLogado())
            throw new UsuarioNaoLogado();

        const params = new URLSearchParams();
        params.set('codigo_ou_nome', codigoOuNome);
        return fetch(`${ambiente.apiUrlBase}/salas?auth=${this.authService.token}&${params.toString()}`)
            .then(resp => resp.json())
            .then(resp => {
                validarRespostaApi(resp);
                return resp.salas;
            })
    }

    // experimentos
    pegarExperimentos(idSala: string, limite?: number): Promise<Experimento[]> {
        if (ambiente.ambiente == 'static') {
            return Promise.resolve([]);
        }
        
        if (!this.authService.estaLogado())
            throw new UsuarioNaoLogado();

        return fetch(
            `${ambiente.apiUrlBase}/experimentos?auth=${this.authService.token}&id_sala=${idSala}${limite ? `&limite=${limite}` : ''}`
        ).then(resp => resp.json())
        .then(resp => {
            validarRespostaApi(resp);
            return resp.experimentos.map((exp: any) => this.tratarExperimento(exp));
        })
    }

    pegarExperimento(idSala: string, idExperimento: number): Promise<Experimento> {
        if (ambiente.ambiente == 'static') {
            return Promise.reject('Não implementado para ambiente estático');
        }
        
        if (!this.authService.estaLogado())
            throw new UsuarioNaoLogado();

        return fetch(
            `${ambiente.apiUrlBase}/experimentos?auth=${this.authService.token}&id_sala=${idSala}&id_experimento=${idExperimento}`
        ).then(resp => resp.json())
        .then(resp => {
            validarRespostaApi(resp);
            return this.tratarExperimento(resp.experimento);
        })
    }

    pegarExperimentoEmAndamento(idSala: string): Promise<Experimento | null> {
        return fetch(`${ambiente.apiUrlBase}/experimentos?auth=${this.authService.token}&id_sala=${idSala}&em_andamento=1`)
            .then(resp => resp.json())
            .then(resp => {
                validarRespostaApi(resp);
                return resp.experimento ? this.tratarExperimento(resp.experimento) : null;
            })
    }

    private tratarExperimento(exp: any): Experimento {
        return {
            id: exp.id,
            nome: exp.nome,
            inicio: new Date(exp.inicio),
            cabecalho: exp.cabecalho,
            periodo: exp.periodo,
            emAndamento: exp.em_andamento,
            qtdAmostras: exp.qtd_amostras
        }
    }

    pegarAmostras(idSala: string, idExperimento: number, primeira?: number, ultima?: number): Promise<{id: number, bloco: number[]}[]> {
        if (!this.authService.estaLogado())
            throw new UsuarioNaoLogado();

        return fetch(
            `${ambiente.apiUrlBase}/amostras` +
            `?auth=${this.authService.token}` + 
            `&id_sala=${idSala}` + 
            `&id_experimento=${idExperimento}` + 
            (primeira ? `&primeira=${primeira}` : '') +
            (ultima ? `&ultima=${ultima}` : '')
        )
            .then(resp => resp.json())
            .then(resp => {
                validarRespostaApi(resp);
                return resp.blocos;
            })
    }
}

class UsuarioNaoLogado extends Error {
    constructor() {
        super("Usuário não logado");
    }
}

class ErroApiNexo extends Error {
    constructor(respostaApiNexo: any) {
        super(respostaApiNexo?.erro ?? "Mensagens de erro suprimidas pelas configurações do servidor");
    }
}

function validarRespostaApi(resposta: any) {
    if (resposta.status != "ok") 
        throw new ErroApiNexo(resposta);
}

export type Experimento = {
    id: number,
    nome: string,
    inicio: Date,
    cabecalho: {
        codigo: string,
        nome: string,
        unidade: string,
        f: string
    }[],
    periodo: number,
    emAndamento: boolean,
    qtdAmostras: number
};

export type MqttBroker = {
    id: number,
    url: string,
    username?: string,
    password?: string
};

export type TipoVariavel = 'binaria' | 'limitada' | 'livre';
export type Variavel = {
    tipo: TipoVariavel,
    nome: string,
    unidade: string,
    f: string,
    f_inv: string
};

export const tiposSensor = ['digital', 'analogico', 'dht11', 'carga', 'distancia'] as const;
export type TipoSensor = typeof tiposSensor[number];

export const tiposAtuador = ['digital', 'analogico', 'motor-dc'] as const;
export type TipoAtuador = typeof tiposAtuador[number];

export type Sensor = {
    codigo: string,
    tipo: TipoSensor,
    configuracoes: {
        variaveis: {[key: string]: Variavel}
        // ...outras configurações específicas ao tipo
    }
}
export type Atuador = {
    codigo: string,
    tipo: TipoAtuador,
    configuracoes: {
        variaveis: {[key: string]: Variavel}
        // ...outras configurações específicas ao tipo
    }
}

export type Camera = {
    id: number,
    nome: string,
    url_reproducao?: string,
    url_transmissao?: string,
    stream_key?: string
};

export type ModeloSala = {
    nome: string,
    cameras: Camera[],
    sensores: Sensor[],
    atuadores: Atuador[]
};

export type Sala = {
    id: string;
    proprietario: boolean;
    modelo: ModeloSala;
    mqtt_broker: MqttBroker;
};

export type SalaEmArranjo = {
    id: string;
    nome: string;
    proprietario: boolean;
}