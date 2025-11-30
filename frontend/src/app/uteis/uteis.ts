export function stringAleatoria() {
    return Math.random().toString(36).slice(2);
}

export function safeFilename(name: string, replacement: string = '_') {
    return name
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, replacement) // illegal on most systems
        .replace(/\s+/g, ' ') // normalize spaces
        .trim()
        .substring(0, 255); // limit length
}

export function transporMatriz(m: number[][]): number[][] {
    const t: number[][] = [];
    if (m.length == 0) return t;

    t.length = m[0].length;
    for (let i = 0; i < t.length; i++) {
        t[i] = [];
        t[i].length = m.length;
        for (let j = 0; j < m.length; j++) {
            t[i][j] = m[j][i];
        }
    }
    return t;
}

export const unidadesTempo = ['milisegundo', 'segundo', 'minuto', 'hora', 'dia', 'semana', 'mes'] as const;
export type UnidadeTempo = typeof unidadesTempo[number];
export function converterTempo(tempo: number, unidadeEntrada: UnidadeTempo, unidadeSaida: UnidadeTempo) {
    const fatores: Record<UnidadeTempo, number> = {
        milisegundo: 1,
        segundo: 1000,
        minuto: 1000 * 60,
        hora: 1000 * 60 * 60,
        dia: 1000 * 60 * 60 * 24,
        semana: 1000 * 60 * 60 * 24 * 7,
        mes: 1000 * 60 * 60 * 24 * 30
    };
    return tempo * fatores[unidadeEntrada] / fatores[unidadeSaida];
}