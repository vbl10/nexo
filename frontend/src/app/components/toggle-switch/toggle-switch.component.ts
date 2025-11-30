import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-toggle-switch',
    imports: [CommonModule, FormsModule],
    templateUrl: './toggle-switch.component.html',
    styleUrl: './toggle-switch.component.scss',
})
export class ToggleSwitchComponent {
    @Input() estado!: boolean | number;
    @Input() tamanho: 'normal' | 'pequeno' = 'normal';
    @Output() estadoChange = new EventEmitter<boolean | number>();
    @Output() change = new EventEmitter<boolean | number>();

    @Input() disabled!: boolean;

    @Input() id: string = '';

    toggle() {
        if (!this.disabled) {
            if (typeof this.estado == 'boolean')
                this.estadoChange.emit(!this.estado);
            else
                this.estadoChange.emit(this.estado == 1 ? 0 : 1);
            this.change.emit(this.estado);
        }
    }
}
