import { Component, ElementRef, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-modal-dialog',
  imports: [],
  templateUrl: './modal-dialog.component.html',
  styleUrl: './modal-dialog.component.scss'
})
export class ModalDialogComponent {
    @ViewChild('dialog')
    private dialog!: ElementRef<HTMLDialogElement>;
    @ViewChild('conteudo')
    private conteudo!: ElementRef<HTMLElement>;
    private abrindo = false;

    @Output() aoabrir = new EventEmitter<void>;
    @Output() aofechar = new EventEmitter<void>;


    abrir() {
        this.abrindo = true;
        this.aoabrir.emit();
        this.dialog.nativeElement.showModal();
    }

    fechar() {
        this.dialog.nativeElement.close();
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        if (this.dialog?.nativeElement.getAttribute('open') != null) {
            if (this.abrindo) {
                this.abrindo = false
            }
            else if (!this.conteudo.nativeElement.contains(event.target as any)) {
                this.dialog.nativeElement.close();
            }
        }
    }
}
