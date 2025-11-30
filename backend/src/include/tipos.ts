export type MqttBroker = {
    id: number,
    url: string,
    host: string,
    porta: number,
    username: string,
    password: string
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
    id?: number,
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