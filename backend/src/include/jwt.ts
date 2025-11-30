import jwt from "jsonwebtoken";
import { ambiente } from "./ambiente";

export function gerarToken(usuario: string, nome: string) {
    const payload = {
        usuario,
        nome,
        iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, ambiente.jwtSecret, { algorithm: "HS256" });
}

export function decodificarToken(token: string, lancarExcecao = false) {
    try {
        return jwt.verify(token, ambiente.jwtSecret) as {usuario: string, nome: string, iat: number};
    }
    catch (erro: any) {
        if (lancarExcecao) throw erro;
    }
    return undefined;
}
