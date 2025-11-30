export type Ambiente = {
    readonly ambiente: 'dev' | 'prod' | 'teste' | 'static';
    readonly apiUrlBase: string;
}