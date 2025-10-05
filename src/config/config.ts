import dotenv from "dotenv";

dotenv.config();

interface Config {
  port: number;
  mongoURI: string;
  jwtSecret: string;
  nodeEnv: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  mongoURI: process.env.MONGO_URI || "mongodb://localhost:27017/finhelper",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key",
  nodeEnv: process.env.NODE_ENV || "development",
};

export { config };
