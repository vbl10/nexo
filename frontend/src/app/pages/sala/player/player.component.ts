import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ambiente } from '../../../../ambientes/ambiente';
import { Camera } from '../../../services/api.service';
import { CliqueCopiaComponent } from '../../../components/clique-copia/clique-copia.component';
import { TranslateModule } from '@ngx-translate/core';
import { ReplaySubject, Subscription } from 'rxjs';
import { ModalDialogComponent } from '../../../components/modal-dialog/modal-dialog.component';

declare const IVSPlayer: any;

@Component({
    selector: 'app-player',
    imports: [
        CommonModule,
        CliqueCopiaComponent,
        ModalDialogComponent,
        TranslateModule
    ],
    templateUrl: './player.component.html',
    styleUrl: './player.component.scss',
})
export class PlayerComponent implements OnChanges, AfterViewInit, OnDestroy {
    @ViewChild('video')
    videoElmt!: ElementRef<HTMLVideoElement>;

    @ViewChild('playerStatus')
    playerStatusElmt!: ElementRef<HTMLElement>;

    videoContainerResizeObserver: ResizeObserver;

    ambiente = ambiente.ambiente;

    player: any;
    reproduzindo = false;
    payload?: {type: any, code: any}
    status:
        | 'carregando'
        | 'offline'
        | 'payload'
        | 'nao-suportado'
        | 'ambiente'
        | 'conectando'
    = "carregando";

    @Input('cameras')
    cameras: Camera[] = [];

    guiaSelecionada = 0;

    constructor() {
        this.videoContainerResizeObserver = new ResizeObserver((entries) => {
            const cw = entries[0].contentRect.width;

            const x = Math.floor(cw / 16);

            const w = 16 * x;
            const h = 9 * x;

            this.videoElmt.nativeElement.width = w;
            this.videoElmt.nativeElement.height = h;
            this.playerStatusElmt.nativeElement.style.width = `${w}px`;
            this.playerStatusElmt.nativeElement.style.height = `${h}px`;
        });
    }
    
    ngOnDestroy(): void {
        this.player?.delete();
    }

    ngOnChanges(): void {
        this.btnGuiaOnClick(0);
    }

    ngAfterViewInit(): void {
        this.videoContainerResizeObserver.observe(
            this.videoElmt.nativeElement.parentElement!
        );

        if (!['dev', 'static'].includes(ambiente.ambiente) && IVSPlayer.isPlayerSupported) {
            const videoPlayer = this.videoElmt.nativeElement;

            if (true) {
                this.player = IVSPlayer.create();
                this.player.attachHTMLVideoElement(
                    videoPlayer
                );
                this.player.addEventListener('PlayerError', (payload: any) => {
                    this.reproduzindo = false;
    
                    if (
                        payload.type === 'ErrorNotAvailable' &&
                        payload.code === 404
                    ) {
                        this.status = 'offline';
                    } else {
                        this.payload = payload;
                        this.status = 'payload';
                    }
                });
                videoPlayer.addEventListener('playing', () => {
                    this.reproduzindo = true;
                });
                
                setTimeout(() => this.btnGuiaOnClick(0), 10);
            }
        }
        else {
            setTimeout(() => {
                this.status = ambiente.ambiente == 'prod' ? 'nao-suportado' : 'ambiente';
            }, 10);
        }
    }

    btnGuiaOnClick(id: number) {
        if (this.cameras.length > id && this.cameras[id].url_reproducao && this.player) {
            this.guiaSelecionada = id;
            this.reproduzindo = false;
            this.status = 'conectando';
            this.player.load(this.cameras[id].url_reproducao);
            this.player.play();
        }
    }
}
