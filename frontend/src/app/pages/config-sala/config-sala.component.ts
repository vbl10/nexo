import { Component, Input, ViewChild } from '@angular/core';
import { Arranjo, AutoFormComponent, Controle, Grupo, GrupoDinamico, SeletorCompartilhado, SeletorEstatico, Texto } from '../../components/auto-form/auto-form.component';
import { CommonModule } from '@angular/common';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, tiposAtuador, tiposSensor } from '../../services/api.service';
import { RepositorioFuncoes } from '../../uteis/repositorio-funcoes';
import { stringAleatoria } from '../../uteis/uteis';

@Component({
    selector: 'app-config-sala',
    imports: [
        AutoFormComponent,
        CommonModule,
        RouterLink,
        TranslateModule
    ],
    templateUrl: './config-sala.component.html',
    styleUrl: './config-sala.component.scss',
})
export class ConfigSalaComponent {
    JSON_stringfy = JSON.stringify;

    @ViewChild('autoForm')
    autoForm!: AutoFormComponent;

    codigoSala?: string;

    portas: Porta[] = [
        {
            codigo: 4,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 13,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 14,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 16,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 17,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 18,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 19,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 21,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 22,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 23,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 25,
            propriedades: ['in', 'out', 'dac', 'pwm']
        }, {
            codigo: 26,
            propriedades: ['in', 'out', 'dac', 'pwm']
        }, {
            codigo: 27,
            propriedades: ['in', 'out', 'pwm']
        }, {
            codigo: 32,
            propriedades: ['in', 'out', 'adc', 'pwm']
        }, {
            codigo: 33,
            propriedades: ['in', 'out', 'adc', 'pwm']
        }, {
            codigo: 34,
            propriedades: ['in', 'adc']
        }, {
            codigo: 35,
            propriedades: ['in', 'adc']
        }, {
            codigo: 36,
            propriedades: ['in', 'adc']
        }, {
            codigo: 39,
            propriedades: ['in', 'adc']
        },
    ];

    portasLivres = this.portas.map((val, index) => index);
    portasOpcoes = this.portas.map(val => val.codigo);

    form!: Grupo;


    constructor(
        private apiService: ApiService,
        private router: Router,
        translateService: TranslateService,
        activeRoute: ActivatedRoute
    ) {
        activeRoute.paramMap.subscribe(
            val => {
                this.codigoSala = val.get('codigo') ?? undefined;
                if (this.codigoSala) {
                    apiService.pegarSala(this.codigoSala)
                        .then(sala => {
                            this.form.definirValor(sala.modelo);
                        })
                }
            }
        )
        const subs = translateService.get('config-sala').subscribe(
            val => {
                this.gerarForm(val);
                setTimeout(() => subs.unsubscribe(), 1);
            }
        )
    }

    criarSeletorPorta(filtroPorta: (props: PortaPropriedade[]) => boolean, nomeDinamico = false) {
        return new SeletorCompartilhado(
            this.portasOpcoes, 
            this.portasLivres, 
            {
                filtro: val => this.portas[val]?.propriedades ? filtroPorta(this.portas[val].propriedades) : false,
                nome: nomeDinamico ? undefined : 'config-sala.porta',
                caminhoTraducoesOpcoes: 'config-sala.portas'
            }
        )
    } 

    grupoVariaveis(campos: {[key:string]: {tipo: 'binaria' | 'limitada' | 'livre', valorInicialUnidade?: string}}, funcaoInversa = false) {
        return new Grupo(
            Object.fromEntries(
                Object.entries(campos)
                .map(([nome, opcoes]) => [nome, new Grupo({
                    tipo: new Texto({
                        visivel: false,
                        valorInicial: opcoes.tipo
                    }),
                    nome: new Texto({
                        nome: 'config-sala.variavel.nome',
                        info: true, 
                        validators: [Validators.required],
                    }),
                    unidade: new Texto({
                        nome: 'config-sala.variavel.unidade',
                        valorInicial: opcoes.valorInicialUnidade,
                        info: true, 
                    }),
                    f: new Texto({
                        nome: 'config-sala.variavel.f',
                        valorInicial: 'x', 
                        info: true, 
                        checagemOrtografica: false, 
                        asyncValidators: [funcaoValida], 
                    }),
                    ...(!funcaoInversa ? {} : {
                        f_inv: new Texto({
                            nome: 'config-sala.variavel.f_inv',
                            valorInicial: 'x', 
                            info: true, 
                            checagemOrtografica: false, 
                            asyncValidators: [funcaoValida], 
                        }),
                    })
                }, { titulo: 'label', retraido: false })])
            ), 
            { titulo: 'label', retraido: false }
        );
    }
    
    gerarForm(traducoes: any) {
        this.form = new Grupo({
            nome: new Texto({
                valorInicial: traducoes.nome['valor-inicial'], 
                validators: [Validators.required]
            }, {
                rotulo: {classe: 'h2'},
                entrada: {classe: 'h3', estilo: 'color: hsl(from var(--texto) h s l / 0.9)'}
            }),
            cameras: new Arranjo(
                () => new Grupo({
                    nome: new Texto({validators: [Validators.required]}),
                    id: new Texto({visivel: false})
                }),
                { qtd: 0, adicionar: true, remover: true },
                {},
                { titulo: 'h2', retraido: false }
            ),
            sensores: new Arranjo(
                () => new Grupo(
                    {
                        tipo: new SeletorEstatico(tiposSensor),
                        codigo: new Texto({
                            visivel: false,
                            valorInicial: stringAleatoria()
                        }),
                        configuracoes: new GrupoDinamico(
                            (sensor, sensorAntigo) => {
                                if (sensor?.tipo == sensorAntigo?.tipo)
                                    return null;

                                const campos: {[key: string]: Controle} = {}
                                let id = '';
                                
                                switch (sensor.tipo) {
                                    case 'digital':
                                        id = 'digital';
                                        campos['porta'] = this.criarSeletorPorta(props => props.includes('in'));
                                        campos['variaveis'] = this.grupoVariaveis({digital: {tipo: 'binaria'}});
                                        break;
                                    case 'analogico':
                                        id = 'analogico';
                                        campos['porta'] = this.criarSeletorPorta(props => props.includes('in') && props.includes('adc'));
                                        campos['variaveis'] = this.grupoVariaveis({analogica: {tipo: 'limitada'}});
                                        break;
                                    case 'dht11':
                                        id = 'dht11';
                                        campos['porta'] = this.criarSeletorPorta(props => props.includes('in'));
                                        campos['variaveis'] = this.grupoVariaveis({
                                            temperatura: {
                                                tipo: 'livre',
                                                valorInicialUnidade: '°C'
                                            }, 
                                            umidade: {
                                                tipo: 'livre',
                                                valorInicialUnidade: '%'
                                            }
                                        });
                                        
                                        break;
                                    case 'carga':
                                        id = 'carga';
                                        campos['modulo'] = new SeletorEstatico(['hx711']);
                                        campos['carga-maxima'] = new SeletorEstatico(['500g', '1kg', '2kg', '5kg', '10kg']);
                                        campos['porta-a'] = this.criarSeletorPorta(props => props.includes('in'), true);
                                        campos['porta-b'] = this.criarSeletorPorta(props => props.includes('in'), true);
                                        campos['variaveis'] = this.grupoVariaveis({carga: { tipo: 'livre', valorInicialUnidade: 'kg' }});
                                        break;
                                    case 'distancia':
                                        id = 'distancia';
                                        campos['modulo'] = new SeletorEstatico(['hcsr04']);
                                        campos['porta-a'] = this.criarSeletorPorta(props => props.includes('in'), true);
                                        campos['porta-b'] = this.criarSeletorPorta(props => props.includes('in'), true);
                                        campos['variaveis'] = this.grupoVariaveis({distancia: { tipo: 'livre', valorInicialUnidade: 'm' }});
                                        break;
                                    default:
                                        return null;
                                }
                                return {id, campos};
                            },
                            undefined,
                            {
                                retraido: true,
                                titulo: 'label'
                            }
                        )
                    }, {
                        container: true
                    }
                ), {
                    qtd: 0,
                    adicionar: true,
                    remover: true
                }, {}, {
                    titulo: 'h2',
                    retraido: false
                }
            ),
            atuadores: new Arranjo(
                () => new Grupo({
                    tipo: new SeletorEstatico(tiposAtuador),
                    codigo: new Texto({
                        visivel: false,
                        valorInicial: stringAleatoria()
                    }),
                    configuracoes: new GrupoDinamico(
                        (atuador, atuadorAntigo) => {
                            if (atuador?.tipo == atuadorAntigo?.tipo)
                                return null;

                            const campos: {[key: string]: Controle} = {};
                            let id = '';

                            switch (atuador.tipo) {
                                case 'digital':
                                    id = 'digital';
                                    campos['porta'] = this.criarSeletorPorta(props => props.includes('out'));
                                    campos['variaveis'] = campos['variaveis'] = this.grupoVariaveis({digital: {tipo: 'binaria'}}, true);
                                    break;
                                case 'analogico':
                                    id = 'analogico';
                                    campos['porta'] = this.criarSeletorPorta(props => props.includes('out') && (props.includes('dac') || props.includes('pwm')));
                                    campos['variaveis'] = this.grupoVariaveis({analogica: {tipo: 'limitada'}}, true);
                                    break;
                                case 'motor-dc':
                                    id = 'motor-dc';
                                    campos['porta-a'] = this.criarSeletorPorta(props => props.includes('out') && (props.includes('dac') || props.includes('pwm')), true);
                                    campos['porta-b'] = this.criarSeletorPorta(props => props.includes('out') && (props.includes('dac') || props.includes('pwm')), true);
                                    campos['variaveis'] = this.grupoVariaveis({potencia: {tipo: 'limitada', valorInicialUnidade: '%'}}, true);
                                    break;
                            }

                            return {id, campos};
                        }, undefined, {
                            retraido: true,
                            titulo: 'label'
                        }
                    )
                }, {
                    container: true
                }), {
                    qtd: 0,
                    adicionar: true,
                    remover: true
                }, {}, {
                    titulo: 'h2',
                    retraido: false
                }
            )
        }, {
            estilo: 'gap: 40px'
        })
        this.form.definirNome('config-sala');
    }

    salvar() {
        if (this.codigoSala) {
            this.apiService.salvarSala(this.codigoSala, this.form.controle.value)
                .then(() => this.router.navigateByUrl('/painel'))
        }
        else {
            this.apiService.criarSala(this.form.controle.value)
                .then(() => this.router.navigateByUrl('/painel'))
        }
    }
}

async function funcaoValida(controle: AbstractControl): Promise<ValidationErrors | null> {
    let r = null;
    try {
        if (controle.value.length > 0) {
            await new Promise<void>((resolve, reject) => {
                new RepositorioFuncoes(
                    [{nome: 'f', expr: controle.value}],
                    async (repo) => {
                        try {
                            await repo.chamar('f', 0);
                            resolve();
                        }
                        catch (erro) {
                            reject(erro)
                        }
                        repo.destruir();
                    },
                    (evtErro) => {
                        reject(evtErro);
                    }
                );
            })
        }
    }
    catch (erro) {
        r = {'expressao-invalida': erro instanceof Error ? erro.name : true}
    }
    return r;
}

type PortaPropriedade = 'in' | 'out' | 'adc' | 'dac' | 'pwm';
type Porta = {
    codigo: number,
    propriedades?: PortaPropriedade[];
}