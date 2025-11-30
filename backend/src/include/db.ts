import mysql, { Pool } from "mysql2/promise";
import { ambiente } from "./ambiente";

let pool: Pool | null = null;

export const pegarPoolMysql = async (): Promise<Pool> => {
    if (!pool) {
        pool = await mysql.createPool({
            host: ambiente.dbHost!,
            user: ambiente.dbUser!,
            password: ambiente.dbPass!,
            database: ambiente.dbName!,
            port: Number.parseInt(ambiente.dbPort),
            ssl: ambiente.ambiente == 'prod' ? {
                ca: Buffer.from(ambiente.dbCaCertB64, 'base64').toString('utf-8')
            } : undefined
        });
        console.log("Connected to MySQL");
    }
    return pool;
};
