export const ambiente = {
    ambiente: process.env.AMBIENTE,
    responseError: process.env.RESPONSE_ERROR,
    urlApiIvs: process.env.URL_API_IVS,
    userPassPepper: process.env.USER_PASS_PEPPER,
    jwtSecret: process.env.JWT_SECRET,
    dbHost: process.env.DB_HOST,
    dbPort: process.env.DB_PORT,
    dbName: process.env.DB_NAME,
    dbUser: process.env.DB_USER,
    dbPass: process.env.DB_PASS,
    dbCaCertB64: process.env.DB_CA_CERT_B64,
} as {
    readonly ambiente: 'dev' | 'prod',
    readonly responseError: 'true' | 'false'
    readonly urlApiIvs: string,
    readonly userPassPepper: string,
    readonly jwtSecret: string,
    readonly dbHost: string,
    readonly dbPort: string,
    readonly dbName: string,
    readonly dbUser: string,
    readonly dbPass: string,
    readonly dbCaCertB64: string
}