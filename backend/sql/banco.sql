CREATE TABLE IF NOT EXISTS usuarios
(
    usuario VARCHAR(30) PRIMARY KEY COLLATE utf8mb4_bin, /* "COLLATE utf8mb4_bin" para que "A" != "a" */
    nome VARCHAR(30) NOT NULL,
    hash_senha CHAR(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS mqtt_brokers
(
    id INT PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(512) NOT NULL,
    host VARCHAR(256) NOT NULL,
    porta INT NOT NULL,
    username VARCHAR(30),
    password VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS salas
(
    id CHAR(12) PRIMARY KEY COLLATE utf8mb4_bin,
    nome VARCHAR(256),
    id_mqtt_broker INT,
    FOREIGN KEY (id_mqtt_broker) REFERENCES mqtt_brokers(id),
    modelo TEXT,
    id_experimento INT -- Referencia um experimento se houver um em andamento.
);

CREATE TABLE IF NOT EXISTS salas_usuarios
(
    usuario VARCHAR(30) COLLATE utf8mb4_bin,
    FOREIGN KEY (usuario) REFERENCES usuarios(usuario) ON DELETE CASCADE, 
    id_sala CHAR(12) COLLATE utf8mb4_bin,
    FOREIGN KEY (id_sala) REFERENCES salas(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario, id_sala),
    proprietario BOOLEAN
);

CREATE TABLE IF NOT EXISTS streams
(
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    id_sala CHAR(12) COLLATE utf8mb4_bin NOT NULL,
    FOREIGN KEY (id_sala) REFERENCES salas(id) ON DELETE CASCADE,

    arn VARCHAR(256),
    url_reproducao VARCHAR(256),
    url_transmissao VARCHAR(256)
);

CREATE TABLE IF NOT EXISTS experimentos
(
    id_sala CHAR(12) COLLATE utf8mb4_bin NOT NULL,
    id INT NOT NULL,
    FOREIGN KEY (id_sala) REFERENCES salas(id) ON DELETE CASCADE,
    PRIMARY KEY (id_sala, id),

    nome VARCHAR(256) NOT NULL,
    inicio DATETIME NOT NULL,
    cabecalho VARCHAR(1024) NOT NULL, -- vide tipo "Experimento.cabecalho" definido em "api.service.ts"
    periodo INT NOT NULL -- ms
);

-- Adicionar referência circular salas <--> experimentos
ALTER TABLE salas
    ADD CONSTRAINT fk_salas_experimentos
    FOREIGN KEY (id, id_experimento) REFERENCES experimentos(id_sala, id)
;

CREATE TABLE IF NOT EXISTS amostras
(
    id_sala CHAR(12) COLLATE utf8mb4_bin NOT NULL,
    id_experimento INT NOT NULL,
    id INT NOT NULL,
    FOREIGN KEY (id_sala, id_experimento) REFERENCES experimentos(id_sala, id) ON DELETE CASCADE,
    PRIMARY KEY (id_sala, id_experimento, id),

    bloco BLOB -- Vetor de floats de 4 bytes em binário (tam. = núm. de colunas no cabecalho)
);