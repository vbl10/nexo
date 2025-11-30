import express, { Request, Response } from "express";
import cors from "cors";
import rotaUsuarios from "./apis/usuarios";
import rotaSalas from "./apis/salas";
import rotaExperimentos from "./apis/experimentos";
import rotaAmostras from "./apis/amostras";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/usuarios", rotaUsuarios);
app.use("/salas", rotaSalas);
app.use("/experimentos", rotaExperimentos);
app.use("/amostras", rotaAmostras);

export default app;
