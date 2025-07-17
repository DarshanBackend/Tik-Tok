import express from 'express';
import cors from 'cors';
import { connectDB } from './src/config/db.js';
import indexRouter from './src/routes/indexRoutes.js';


const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.static('public'));


// router
app.use("/api", indexRouter)


// Connect to database
connectDB();  

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});