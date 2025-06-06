import express from 'express';
import mongoose from 'mongoose';
import http from 'http';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRouter, { authenticateToken } from './routes/auth.js';
import animalRoutes from './routes/animals.js';
import roomRoutes from './routes/rooms.js';
import { Server } from 'socket.io';


// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server and bind to app
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'fail';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

// Middleware
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true, // Allow cookies
}));

// Root route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Use auth routes
app.use('/api/auth', authRouter);

// Use animal routes
app.use('/api/animals', animalRoutes);

// Use room routes
app.use('/api/rooms', roomRoutes);


// Protected route example
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is protected data.', userId: req.user.id });
});

// Websocket logic
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    console.log(`${socket.id} joined room ${roomCode}`);
  });

  socket.on('submit-animal', ({ roomCode, animal }) => {
    io.to(roomCode).emit('animal-submitted', { animal });
  });

  socket.on('player-eliminated', ({ roomCode, socketId }) => {
    io.to(roomCode).emit('player-eliminated', { socketId });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});