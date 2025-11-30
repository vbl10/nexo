import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MqttService } from '../../../services/mqtt.service';
import { ApiService, Experimento, Sala, Variavel } from '../../../services/api.service';
import { RepositorioFuncoes } from '../../../uteis/repositorio-funcoes';
import { NovoExpComponent } from './novo-exp/novo-exp.component';
import { Subscription } from 'rxjs';
import { safeFilename, transporMatriz } from '../../../uteis/uteis';
import { ToggleSwitchComponent } from '../../../components/toggle-switch/toggle-switch.component';

@Component({
    selector: 'app-plotter',
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        NovoExpComponent,
        ToggleSwitchComponent
    ],
    templateUrl: './plotter.component.html',
    styleUrls: ['../painel.scss', './plotter.component.scss'],
})
export class PlotterComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input('salaPronta') salaPronta!: Promise<Sala>;

    @ViewChild('canvasPlotter') 
    canvasPlotter!: ElementRef<HTMLCanvasElement>;
    
    @ViewChild('btnIniciarParar') 
    btnIniciarParar!: ElementRef<HTMLButtonElement>;

    @ViewChild('dialogNovoExp')
    dialogNovoExp!: NovoExpComponent;

    divPlotterContainer!: HTMLElement;
    resizeObserver: ResizeObserver;
    ctx?: CanvasRenderingContext2D;

    subscricoes: Subscription[] = [];
    subsExperimento: Subscription[] = [];

    mostrarOpcoes = false;

    experimentos: Experimento[] = [];
    idExperimentoSelecionado: number = 0;
    idExperimentoEmAndamento: number = 0;

    seguirAmostras = true;    

    corFundo = 'white';
    corGrade = 'black';
    corTexto = 'black';
    espessuraLinhas = 4;
    
    // Indica segmentos de contiguidade de amostras em plots.amostras
    amostras = new BancoDeAmostras<number[]>();
    plots: {
        nome: string, 
        habilitado: boolean, 
        cor: string, 
        unidade: string
    }[] = [];

    ts = 1000; //periodo de amostragem em ms

    quebraEscalaPx = {x: 200, y: 100};
    escalaBaseX = 20;
    escalaBaseY = 50;
    _escalaX = this.escalaBaseX; //amostras
    _escalaY = this.escalaBaseY; //°C
    _acumuladorAmpliacao = 0; //expoente de base 10
    translacaoX = 0.5; //amostas
    translacaoY = -3;

    mousePlotterUltimoClique = {x: 0, y: 0};
    translacaoUltimoClique = {x: 0, y: 0};
    mousePressionado = false;

    width = 400;
    height = 400;

    constructor(
        private mqttService: MqttService,
        private elmtRef: ElementRef,
        private apiService: ApiService
    ) {
        this.resizeObserver = new ResizeObserver(entries => {
            const pixelRatio = window.devicePixelRatio;
            this.width = entries[0].contentRect.width;
            this.height = entries[0].contentRect.height;
            this.canvasPlotter.nativeElement.width = this.width * pixelRatio;
            this.canvasPlotter.nativeElement.height = this.height * pixelRatio;
            this.desenhar();
        });
    }

    ngOnInit(): void {
        this.salaPronta.then(sala => {
            this.apiService.pegarExperimentos(sala.id)
            .then(experimentos => {
                this.experimentos = experimentos;
                this.idExperimentoEmAndamento = experimentos.find(exp => exp.emAndamento)?.id ?? 0;
                this.idExperimentoSelecionado = 
                    this.idExperimentoEmAndamento != 0
                    ? this.idExperimentoEmAndamento
                    : experimentos.at(0)?.id ?? 0;
                this.aoEscolherExperimento();
            });

            this.subscricoes.push(
                this.mqttService.subscreverEmNovoExperimento(idNovoExperimento => {
                    this.apiService.pegarExperimento(sala.id, idNovoExperimento)
                    .then(exp => {
                        this.experimentos.splice(0, 0, exp);
                        this.idExperimentoSelecionado = this.idExperimentoEmAndamento = idNovoExperimento;
                        this.aoEscolherExperimento();
                    });
                }),
                this.mqttService.subscreverEmFimExperimento(idExperimento => {
                    const exp = this.experimentos.find(exp => exp.id == idExperimento);
                    if (exp && exp.emAndamento) {
                        exp.emAndamento = false;
                        this.idExperimentoEmAndamento = 0;
                        this.subsExperimento.forEach(subs => subs.unsubscribe());
                        this.subsExperimento.length = 0;
                    }
                })
            );
        })
        
    }

    ngAfterViewInit(): void {
        if (!this.canvasPlotter.nativeElement.parentElement) throw new Error("Canvas deve ter container!");
        this.divPlotterContainer = this.canvasPlotter.nativeElement.parentElement;

        const ctx = this.canvasPlotter.nativeElement.getContext('2d');
        if (!ctx) throw new Error("Falha ao pegar contexto 2d do canvas.");
        this.ctx = ctx;

        this.resizeObserver.observe(this.divPlotterContainer);

        //registrar eventos
        this.canvasPlotter.nativeElement.addEventListener('mousedown', (e) => this.aoMouseClique(e.offsetX, e.offsetY));
        this.canvasPlotter.nativeElement.addEventListener('mouseup', (e) => this.aoMouseSoltar(e.offsetX, e.offsetY));
        this.canvasPlotter.nativeElement.addEventListener('mousemove', (e) => this.aoMouseMover(e.offsetX, e.offsetY));
        this.canvasPlotter.nativeElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.aoMouseRolar(e.offsetX, e.offsetY, e.deltaY)
        });
        this.inicializarEventosTouch(this.canvasPlotter.nativeElement);

        //carregar estilos
        const estilosRaiz = getComputedStyle(this.elmtRef.nativeElement);
        this.corFundo = estilosRaiz.getPropertyValue('--cor-fundo').trim();
        this.corGrade = estilosRaiz.getPropertyValue('--cor-grade').trim();
        this.corTexto = estilosRaiz.getPropertyValue('--texto');
    }

    ngOnDestroy(): void {
        this.subscricoes.forEach(subs => subs.unsubscribe());
        this.subsExperimento.forEach(subs => subs.unsubscribe());
    }

    alternarPlotagem() {
        if (this.idExperimentoEmAndamento != 0) {
            this.pararPlotagem();
        }
        else {
            this.novoExperimento();
        }
    }

    novoExperimento() {
        this.dialogNovoExp.abrir();
    }
    
    pararPlotagem() {
        this.mqttService.pararExperimento();
    }

    async aoEscolherExperimento() {
        this.amostras.limpar();
        this.plots.length = 0;
        this.subsExperimento.forEach(subs => subs.unsubscribe());
        this.subsExperimento.length = 0;
        
        const sala = await this.salaPronta;
        if (typeof this.idExperimentoSelecionado == 'string')
            this.idExperimentoSelecionado = Number.parseInt(this.idExperimentoSelecionado);

        if (this.idExperimentoSelecionado != 0) {
            const id = this.idExperimentoSelecionado;
            const experimento = this.experimentos.find(exp => exp.id == id);
            if (!experimento) {
                console.error("Erro ao selecionar experimento");
                return;
            }
            const funcoes = new RepositorioFuncoes(
                experimento.cabecalho.map((col, idx) => {
                    return {
                        nome: idx.toString(),
                        expr: col.f
                    }
                })
            );

            const puxarAmostrasDoBanco = (primeira?: number, ultima?: number) => {
                return this.apiService.pegarAmostras(sala.id, id, primeira, ultima)
                    .then(blocos => {
                        if (blocos.length == 0) return;
                        return Promise.all(blocos.map(async bloco => {
                            return {
                                id: bloco.id,
                                bloco: await Promise.all(bloco.bloco.map((valor, idx) => 
                                    funcoes.chamar((idx % experimento.cabecalho.length).toString(), valor))
                                )
                            }
                        }))
                    })
                    .then(blocos => { 
                        blocos?.forEach(bloco => {
                            const amostras: number[][] = [];
                            for (let i = Math.floor(bloco.bloco.length / experimento.cabecalho.length); i > 0; i--)
                                amostras.push([]);
                            bloco.bloco.forEach((val, idx) => amostras[Math.floor(idx / experimento.cabecalho.length)].push(val));
                            this.amostras.inserir(bloco.id, amostras);
                        });
                    })
            }
            await puxarAmostrasDoBanco();

            this.ts = experimento.periodo;
            this.plots = 
                experimento.cabecalho
                .map((col, index) => {
                    return {
                        nome: col.nome,
                        unidade: col.unidade,
                        cor: `hsl(${index * (Math.sqrt(5) / 2 - 0.5) * 360} 90 50)`,
                        habilitado: true,
                    }
                })
            this.desenhar();

            // Atualizar plots em tempo real
            if (experimento.emAndamento) {
                this.subsExperimento.push(
                    this.mqttService.subscreverEmExperimento(async bloco => {
                        if (bloco.amostras.length == 0) return;
                        this.amostras.inserir(
                            bloco.id, 
                            await Promise.all(
                                bloco.amostras.map(async amostra => 
                                    await Promise.all(
                                        amostra.map((val, idx) => 
                                            funcoes.chamar(idx.toString(), val)
                                        )
                                    )
                                )
                            )
                        );
                        if (!this.amostras.contiguo()) {
                            const ultimoBloco = this.amostras.blocos.at(-1);
                            if (ultimoBloco) {
                                let sinc = false;
                                this.amostras.pegarBlocosFaltando().forEach(blocoFaltando => {
                                    // Se o bloco faltando é antigo o bastante, estará no banco de dados...
                                    if ((ultimoBloco.id + ultimoBloco.amostras.length - 1 - blocoFaltando.ultimo) * this.ts > 5000)
                                        puxarAmostrasDoBanco(blocoFaltando.primeiro, blocoFaltando.ultimo)
                                    // Senão, ainda está no buffer do embarcado...
                                    else
                                        sinc = true;
                                })
                                if (sinc) this.mqttService.sincronizarExperimento();
                            }
                        }
                        this.desenhar();
                    })
                );
                this.mqttService.sincronizarExperimento();
            }
        }
    }

    restaurar() {
        this.acumuladorAmpliacao = 0;
        this.translacaoX = 0;
        this.translacaoY = 0;
        this.desenhar();
    }

    salvar() {
        let saida = `Tempo (ms),${this.plots.map(plot => `${plot.nome} ${plot.unidade.length > 0 ? `(${plot.unidade})` : ''}`).join(',')}\n`
        saida += Array.from(this.amostras).map((amostra, idx) => [idx * this.ts, ...amostra].join(',')).join('\n');

        const blob = new Blob([saida], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${safeFilename(this.experimentos.find(exp => exp.id == this.idExperimentoSelecionado)?.nome ?? Date.now().toString())}.csv`;
        a.download = a.download.replaceAll('/', '-').replaceAll(':', '-').replaceAll(',', '-');
        a.click();
        URL.revokeObjectURL(a.href);
    }

    alternarVisualizacaoPlot(idx: number) {
        this.plots[idx].habilitado = !this.plots[idx].habilitado;
        this.desenhar();
    }

    temAlgumPlotHabilitado() {
        return this.plots.findIndex(plot => plot.habilitado) !== -1;
    }

    alternarVisualizacaoTodosPlots() {
        if (this.temAlgumPlotHabilitado()) {
            this.plots.forEach(plot => plot.habilitado = false);
        }
        else {
            this.plots.forEach(plot => plot.habilitado = true);
        }
        this.desenhar();
    }

    focarEmPlotY(event: Event, idx: number) {
        event.stopPropagation();
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (let bloco of this.amostras.blocos) {
            for (let amostra of bloco.amostras) {
                min = amostra[idx] < min ? amostra[idx] : min;
                max = amostra[idx] > max ? amostra[idx] : max;
            }
        }
        let diff = max - min;
        if (diff == 0) diff = this.escalaBaseY / 1.15;
        this.escalaY = diff * 1.15;
        this.translacaoY = (max + min - this.escalaY) / 2;
        this.desenhar();
    }
    focarEmPlotTempo(event: Event) {
        event.stopPropagation();
        this.escalaX = this.amostras.tamanho;
        this.translacaoX = this.amostras.tamanho - this.escalaX;
        this.desenhar();
    }

    get acumuladorAmpliacao() {
        return this._acumuladorAmpliacao;
    }
    set acumuladorAmpliacao(val: number) {
        this._acumuladorAmpliacao = Math.round(val * 10000) / 10000;
        this._escalaX = Math.round(this.escalaBaseX * Math.pow(10, val) * 10000) / 10000;
        this._escalaY = Math.round(this.escalaBaseY * Math.pow(10, val) * 10000) / 10000;
    }

    get escalaX() {
        return this._escalaX;
    }
    set escalaX(val: number) {
        this._escalaX = val;
        this.escalaBaseX = Math.round(val / Math.pow(10, this._acumuladorAmpliacao));
    }
    get escalaY() {
        return this._escalaY;
    }
    set escalaY(val: number) {
        this._escalaY = val;
        this.escalaBaseY = Math.round(val / Math.pow(10, this._acumuladorAmpliacao));
    }

    Object_keys(obj: {[key: string]: any}): string[] {
        return Object.keys(obj);
    }

    inicializarEventosTouch(canvas: HTMLCanvasElement) {
        // Para pinch zoom
        let pinchDistAnterior: number | null = null;

        // TouchStart -------------------------------------------------------------
        canvas.addEventListener("touchstart", (ev) => {
            if (ev.touches.length === 1) {
                const t = ev.touches[0];
                this.aoMouseClique(t.clientX, t.clientY);
            } else if (ev.touches.length === 2) {
                // Começou pinch
                pinchDistAnterior = this.distanciaTouch(ev.touches[0], ev.touches[1]);
            }
        }, { passive: false });

        // TouchMove --------------------------------------------------------------
        canvas.addEventListener("touchmove", (ev) => {
            ev.preventDefault(); // evita scroll do navegador

            if (ev.touches.length === 1) {
                // Arrasto normal
                const t = ev.touches[0];
                this.aoMouseMover(t.clientX, t.clientY);
            }

            else if (ev.touches.length === 2) {
                // Pinch zoom
                const pinchDistAtual = this.distanciaTouch(ev.touches[0], ev.touches[1]);

                if (pinchDistAnterior != null) {
                    const canvasRect = canvas.getBoundingClientRect();
                    const touches = Array.from(ev.touches).map(touch => {
                        return {
                            x: touch.clientX - canvasRect.left,
                            y: touch.clientY - canvasRect.top
                        }
                    })
                    const centro = {
                        x: (touches[0].x + touches[1].x) / 2,
                        y: (touches[0].y + touches[1].y) / 2
                    };

                    const fator = pinchDistAtual / pinchDistAnterior;
                    pinchDistAnterior = pinchDistAtual;
                    const rodaFake = -(fator - 1) * 3000; 

                    // aplica translacao igual ao scroll do mouse
                    this.aoMouseRolar(centro.x, centro.y, rodaFake);
                }
            }
        }, { passive: false });

        // TouchEnd ---------------------------------------------------------------
        canvas.addEventListener("touchend", () => {
            this.aoMouseSoltar(0, 0);
            pinchDistAnterior = null;
        });
    }

    distanciaTouch(a: Touch, b: Touch) {
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.sqrt(dx*dx + dy*dy);
    }


    aoMouseClique(mx: number, my: number) {
        this.mousePlotterUltimoClique = this.mouseParaPlotter({x: mx, y: my});
        this.translacaoUltimoClique = {x: this.translacaoX, y: this.translacaoY};
        this.mousePressionado = true;
    }
    aoMouseSoltar(mx: number, my: number) {
        this.mousePressionado = false;
    }
    aoMouseMover(mx: number, my: number) {
        if (this.mousePressionado) {
            if (!this.seguirAmostras) {
                this.translacaoX = this.translacaoUltimoClique.x;
            }
            this.translacaoY = this.translacaoUltimoClique.y;
            let mousePlotter = this.mouseParaPlotter({x: mx, y: my});
            let delta = {x: mousePlotter.x - this.mousePlotterUltimoClique.x, y: mousePlotter.y - this.mousePlotterUltimoClique.y};
            if (!this.seguirAmostras) {
                this.translacaoX = this.translacaoUltimoClique.x - delta.x;
            }
            this.translacaoY = this.translacaoUltimoClique.y - delta.y;
            this.desenhar();
        }
    }
    aoMouseRolar(mx: number, my: number, roda: number) {
        let mousePloterPosAntgo = this.mouseParaPlotter({x: mx, y: my});
        this.acumuladorAmpliacao += roda / 10000;
        
        let mousePloterPosNovo = this.mouseParaPlotter({x: mx, y: my});
        let delta = {x: mousePloterPosNovo.x - mousePloterPosAntgo.x, y: mousePloterPosNovo.y - mousePloterPosAntgo.y};
        if (!this.seguirAmostras) {
            this.translacaoX -= delta.x;
        }
        else {
            this.translacaoX = this.amostras.tamanho - this._escalaX - 1;
        }
        this.translacaoY -= delta.y;
        this.desenhar();
    }


    pegarDimensaoPlotter() {
        return {
            x: this.width,
            y: this.height
        }
    }

    mouseParaPlotter(m: {x: number, y: number}) {
        return {
            x: m.x / this.pegarDimensaoPlotter().x * this._escalaX + this.translacaoX,
            y: (this.pegarDimensaoPlotter().y - m.y) / this.pegarDimensaoPlotter().y * this._escalaY + this.translacaoY
        };
    }
    plotterParaMouse(p: {x: number, y: number}) {
        return {
            x: (p.x - this.translacaoX) * this.pegarDimensaoPlotter().x / this._escalaX,
            y: -(p.y - this.translacaoY) * this.pegarDimensaoPlotter().y / this._escalaY + this.height
        };
    }
        
    desenhar() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        ctx.save();
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

        //limpar a tela
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = this.corFundo;
        ctx.fillRect(0, 0, width, height);

        if (this.seguirAmostras) {
            this.translacaoX = this.amostras.tamanho - (this.amostras.tamanho ? 1 : 0) - this._escalaX;
        }

        const pegarDx = () => {
            const quebraDeEscalaPlotter = this.quebraEscalaPx.x / this.pegarDimensaoPlotter().x * this._escalaX;
            const ordemMagnitude = Math.floor(Math.log10(quebraDeEscalaPlotter));
            const mantissaQuebra = quebraDeEscalaPlotter / Math.pow(10, ordemMagnitude);
            const mantissa = mantissaQuebra < 2 ? 1 : mantissaQuebra < 5 ? 2 : 5;
            return mantissa * Math.pow(10, ordemMagnitude);
        }
        const dx = pegarDx();
        const x0 = Math.floor(this.translacaoX / dx) * dx;               //valor do primeiro rótulo a desenhar
        const x1 = Math.floor((this.translacaoX + this._escalaX) / dx) * dx;   //valor do ultimo rótulo a desenhar
        
        const pegarDy = () => {
            const quebraDeEscalaPlotter = this.quebraEscalaPx.y / this.pegarDimensaoPlotter().y * this._escalaY;
            const ordemMagnitude = Math.floor(Math.log10(quebraDeEscalaPlotter));
            const mantissaQuebra = quebraDeEscalaPlotter / Math.pow(10, ordemMagnitude);
            const mantissa = mantissaQuebra < 2 ? 1 : mantissaQuebra < 5 ? 2 : 5;
            return mantissa * Math.pow(10, ordemMagnitude);
        }
        const dy = pegarDy();
        const y0 = Math.floor(this.translacaoY / dy) * dy;
        const y1 = Math.floor((this.translacaoY + this._escalaY) / dy) * dy;
        

        //desenhar grade
        {
            ctx.lineWidth = 1;
            ctx.strokeStyle = this.corGrade;

            //eixos x e y
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, this.pegarDimensaoPlotter().y);
            ctx.lineTo(width, this.pegarDimensaoPlotter().y);
            ctx.stroke();

            //x
            ctx.textBaseline = 'bottom';
            ctx.textAlign = 'center';
            for (let x = x0; x <= x1; x += dx) {
                const posX =  (x - this.translacaoX) * this.pegarDimensaoPlotter().x / this._escalaX;
                ctx.beginPath();
                ctx.moveTo(posX, 0);
                ctx.lineTo(posX, this.pegarDimensaoPlotter().y);
                ctx.stroke();
            }

            //y
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            for (let y = y0; y <= y1; y += dy) {
                const posY = this.pegarDimensaoPlotter().y - (y - this.translacaoY) * this.pegarDimensaoPlotter().y / this._escalaY;
                ctx.beginPath();
                ctx.moveTo(width, posY);
                ctx.lineTo(0, posY);
                ctx.stroke();
            }
        }

        //desenhar graficos
        if (this.amostras.tamanho > 0) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(width, 0);
            ctx.lineTo(width, this.pegarDimensaoPlotter().y);
            ctx.lineTo(0, this.pegarDimensaoPlotter().y);
            ctx.closePath();
            ctx.save();
            ctx.clip();

            const a0 = Math.min(this.amostras.tamanho - 1, Math.max(0, Math.floor(this.translacaoX) - 1));            //indice da primeira amostra a ser desenhada
            const a1 = Math.min(this.amostras.tamanho - 1, Math.max(0, Math.floor(this.translacaoX + this._escalaX) + 1));   //indice da ultima amostra a ser desenhada

            ctx.lineWidth = this.espessuraLinhas;
            for (let i = 0; i < this.plots.length; i++) {
                const plot = this.plots[i];
                if (plot.habilitado) {
                    ctx.strokeStyle = plot.cor;

                    let pontos = [];
                    for (let a = a0; a <= a1; a++) {
                        pontos.push([
                            (a - this.translacaoX) * this.pegarDimensaoPlotter().x / this._escalaX,
                            this.pegarDimensaoPlotter().y - (this.amostras.em(a)[i] - this.translacaoY) * this.pegarDimensaoPlotter().y / this._escalaY
                        ]);
                    }


                    ctx.beginPath();
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.moveTo(pontos[0][0], pontos[0][1]);
                    for (let j = 1; j < pontos.length; j++) {
                        ctx.lineTo(pontos[j][0], pontos[j][1]);
                    }
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        //desenhar números
        {
            ctx.fillStyle = this.corTexto;
            ctx.strokeStyle = this.corFundo;
            ctx.lineWidth = 3;
            ctx.font = '0.8em Arial';

            function formatarNumero(n: number) {
                let exp = n == 0 ? 0 : Math.log10(Math.abs(n));
                exp = exp < -15 ? 0 : exp;
                const expAbs = Math.abs(exp);
                if (expAbs > 4) {
                    const ordemMagnitude = (exp < 0 ? Math.ceil(expAbs) : Math.floor(expAbs)) * (exp > 1 ? 1 : -1);
                    let fator = Math.round(n / Math.pow(10, ordemMagnitude) * 10) / 10;
                    return `${fator}e${ordemMagnitude > 0 ? '+' : ''}${ordemMagnitude}`
                }
                return (Math.round(n * 100000) / 100000).toString();
            }

            //x
            ctx.textBaseline = 'bottom';
            ctx.textAlign = 'center';
            for (let x = x0; x <= x1; x += dx) {
                const posX =  (x - this.translacaoX) * this.pegarDimensaoPlotter().x / this._escalaX;
                
                ctx.strokeText(
                    formatarNumero(x),
                    posX, 
                    this.pegarDimensaoPlotter().y - 5
                );
                ctx.fillText(
                    formatarNumero(x),
                    posX, 
                    this.pegarDimensaoPlotter().y - 5
                );
            }

            //y
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            for (let y = y0; y <= y1; y += dy) {
                const posY = this.pegarDimensaoPlotter().y - (y - this.translacaoY) * this.pegarDimensaoPlotter().y / this._escalaY;

                ctx.strokeText(
                    formatarNumero(y),
                    5, 
                    posY
                );
                ctx.fillText(
                    formatarNumero(y),
                    5, 
                    posY
                );
            }
        }

        ctx.restore();
    }
}

class BancoDeAmostras<T> {
    blocos: {
        id: number,
        amostras: T[]
    }[] = [];
    private _tamanho = 0;
    get tamanho() {
        return this._tamanho;
    }

    inserir(id: number, amostras: T[]) {
        this.blocos.push({id, amostras});
        this.blocos.sort((a, b) => a.id - b.id);
        this._tamanho += amostras.length;

        // Fundir blocos contíguos
        for (let i = 0; i < this.blocos.length; i++) {
            if (i + 1 < this.blocos.length) {
                const sobreposicao = this.blocos[i].id + this.blocos[i].amostras.length - this.blocos[i + 1].id;
                if (sobreposicao >= 0) {
                    if (this.blocos[i + 1].amostras.length > sobreposicao) {
                        if (sobreposicao > 0) {
                            this.blocos[i].amostras.splice(
                                -sobreposicao, 
                                sobreposicao, 
                                ...this.blocos[i + 1].amostras
                            );
                            this._tamanho -= sobreposicao;
                        }
                        else {
                            this.blocos[i].amostras.push(...this.blocos[i + 1].amostras);
                        }
                    }
                    else {
                        this._tamanho -= this.blocos[i + 1].amostras.length;
                    }
                    this.blocos.splice(i + 1, 1);
                    i--;
                }
            }
        }
    }

    [Symbol.iterator]() {
        let idx = 0;
        let idxBloco = 0;
        const blocos = this.blocos;

        return {
            next: (): IteratorResult<T> => {
                if (idx < blocos[idxBloco].amostras.length) {
                    return { value: blocos[idxBloco].amostras[idx++], done: false }
                }
                else if (idxBloco + 1 < blocos.length) {
                    idxBloco++;
                    idx = 0;
                    return { value: blocos[idxBloco].amostras[idx++], done: false }
                }
                else {
                    return { value: undefined, done: true }
                }
            }
        }
    }

    em(indice: number) {
        for (let i = 0, j = 0; i < this.blocos.length; i++) {
            const k = j + this.blocos[i].amostras.length;
            if (indice < k) {
                return this.blocos[i].amostras[indice - j];
            }
            j = k;
        }
        throw new RangeError(`Índice ${indice} fora dos limites`);
    }

    limpar() {
        this.blocos.length = 0;
        this._tamanho = 0;
    }

    contiguo() {
        return this.blocos.length <= 1;
    }

    pegarBlocosFaltando(): {primeiro: number, ultimo: number}[] {
        const faixasFaltando: {primeiro: number, ultimo: number}[] = [];
        for (let i = 0; i < this.blocos.length; i++) {
            if (i + 1 < this.blocos.length) {
                faixasFaltando.push({
                    primeiro: this.blocos[i].id + this.blocos[i].amostras.length,
                    ultimo: this.blocos[i + 1].id - 1
                });
            }
        }
        return faixasFaltando;
    }
};