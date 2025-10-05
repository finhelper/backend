import app from "./app";
import { connectDB } from "./config/database";


const startServer = async (): Promise<void> => {
  try {
    const PORT = process.env.PORT || 5000;
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error: unknown) {
    console.error(`App Listen Error: ${error}`);
    process.exit(1);
  }
};

startServer();
