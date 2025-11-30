export class RepositorioFuncoes {
    private worker?: Worker;
    private pronto = false;
    private promisePronto: Promise<void>;
    private chamadas: { [key: string]: {resolve: (res: number) => void, reject: (reason: any) => void} } = {};

    constructor(funcoes: {nome: string, expr: string}[], aoPronto?: (repo: RepositorioFuncoes) => void, aoErro?: (evtErro: any) => void) {
        const script = `
            const {${Object.getOwnPropertyNames(Math).join(',')}} = Math;
            function ln(x) {
                return log(x) / LN10;
            }
            const funcoes = {
                ${
                    funcoes.map(funcao => {
                        return `
                            "${funcao.nome}": (x) => {
                                return ${funcao.expr};
                            }
                        `
                    }).join(',\n')
                }
            }
            
            onmessage = (e) => {
                const {codigo, nome, x} = e.data;
                if (!funcoes[nome]) 
                    throw new Error(\`Função \${nome} não existe\`);
                let resultado;
                try {
                    resultado = funcoes[nome](x);
                    if (typeof resultado !== 'number') {
                        const e = new Error("Resultado deve ser numérico");
                        e.name = 'resultado-nao-numerico';
                        throw e;
                    }
                }
                catch (erro) {
                    postMessage({codigo, nome, erro});
                    return;
                }
                postMessage({codigo, nome, resultado});
            }

            postMessage({tipo: 'pronto'});
        `;

        const blob = new Blob([script], {type: 'application/javascript'});
        const url = URL.createObjectURL(blob);

        let resolvePronto: () => void, rejectPronto: (reason?: any) => void;
        this.promisePronto = new Promise<void>((resolve, reject) => {
            resolvePronto = resolve;
            rejectPronto = reject;
        })
        this.worker = new Worker(url);
        this.worker.onerror = (ev) => {
            this.worker?.terminate();
            this.worker = undefined;
            aoErro?.(ev);
            rejectPronto(ev);
            ev.preventDefault();
        }
        this.worker.onmessage = (ev) => {
            if (ev.data.tipo == 'pronto') {
                this.pronto = true;
                aoPronto?.(this);
                resolvePronto();
                return;
            }

            const {codigo, nome, resultado, erro} = ev.data as {codigo: string, nome: string, resultado?: number, erro?: any};
            
            if (resultado != undefined)
                this.chamadas[codigo].resolve(resultado);
            else 
                this.chamadas[codigo].reject(erro);

            delete this.chamadas[codigo];
        }
    }

    destruir() {
        this.worker?.terminate();
    }

    chamar(nome: string, x: number): Promise<number> {
        return this.promisePronto
            .then(() => {
                let codigo: string;
                do {
                    codigo = Math.random().toString(36).slice(2);
                } while (this.chamadas[codigo]);
        
                const promessa = new Promise<number>((resolve, reject) => {
                    this.chamadas[codigo] = {resolve, reject};
                })
                this.worker?.postMessage({codigo, nome, x});
        
                return promessa;
            });
    }
}