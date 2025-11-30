import { randomBytes } from "crypto";
import {
    IvsClient,
    CreateChannelCommand,
    DeleteChannelCommand,
} from "@aws-sdk/client-ivs";

let ivs: IvsClient | undefined;
function pegarIvsClient() {
    if (!ivs) {
        ivs = new IvsClient({ region: "us-east-1" });
    }
    return ivs;
}

export function criarCanalIvs() {
    return pegarIvsClient()
        .send(new CreateChannelCommand({
            name: `nexo-${randomBytes(6).toString("hex").slice(0, 12)}`,
            type: "BASIC",
            latencyMode: "NORMAL",
        }))
        .then((res) => {
            if (res.channel && res.streamKey) {
                return {
                    arn: res.channel.arn,
                    playbackUrl: res.channel.playbackUrl,
                    transmissionUrl: `rtmps://${res.channel.ingestEndpoint}:443/app/${res.streamKey.value}`,
                    streamKey: res.streamKey,
                };
            }
            else throw Error("Falha ao criar stream");
        });
}

export function excluirCanalIvs(arn: string) {
    return pegarIvsClient()
        .send(new DeleteChannelCommand({arn}))
}
