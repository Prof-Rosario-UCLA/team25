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
import Room from './models/Room.js';



// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server and bind to app
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});


app.set('io', io);

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
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

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Replace the join-room handler with this:
  socket.on('join-room', async (data) => {
    const { roomCode, persistentUserId } = data;
    socket.join(roomCode);
    console.log(`${socket.id} joined room ${roomCode}`);
    
    // Get username from socket auth
    const username = socket.handshake.auth?.username || 
                    `Player-${socket.id.substring(0, 4)}`;
    
    try {
      // First check if the room exists
      const room = await Room.findOne({ code: roomCode });
      if (!room) return;
      
      // Check if player with this persistentUserId already exists
      const existingPlayer = room.players.find(p => p.persistentUserId === persistentUserId);
      
      if (existingPlayer) {
        // Update existing player's socket ID using atomic operation
        await Room.findOneAndUpdate(
          { 
            code: roomCode, 
            "players.persistentUserId": persistentUserId 
          },
          { 
            $set: { "players.$.socketId": socket.id } 
          },
          { new: true }
        );
      } else {
        // Add new player using atomic operation
        const isFirstPlayer = room.players.length === 0;
        
        await Room.findOneAndUpdate(
          { code: roomCode },
          { 
            $push: { 
              players: { 
                socketId: socket.id,
                persistentUserId,
                username,
                isHost: isFirstPlayer,
                isEliminated: false 
              } 
            } 
          },
          { new: true }
        );
      }
      
      // Get updated players list after the update
      const updatedRoom = await Room.findOne({ code: roomCode });
      
      // Broadcast updated player list to all clients in the room
      io.to(roomCode).emit('player-joined', { players: updatedRoom.players });
    } catch (error) {
      console.error('Error in join-room handler:', error);
    }
  });

  async function checkAndHandleGameOver(roomCode, io) {
    const room = await Room.findOne({ code: roomCode });
  
    if (!room || !room.gameStarted) return;
  
    const activePlayers = room.players.filter(player => !player.eliminated);
  
    if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        console.log(`Winner determined: ${winner.username}`);
  
        io.to(roomCode).emit('game-over', { winner });
    }
  }

  socket.on('leave-room', async (roomCode) => {
    try {
      // If roomCode is an object, extract the roomCode property
      const actualRoomCode = typeof roomCode === 'object' ? roomCode.roomCode : roomCode;
      
      socket.leave(actualRoomCode);
      console.log(`${socket.id} left room ${actualRoomCode}`);
      
      // Use atomic operation to remove player and get updated players list
      const updatedRoom = await Room.findOneAndUpdate(
        { code: actualRoomCode },
        { $pull: { players: { socketId: socket.id } } },
        { new: true } // Return the updated document
      );
      
      if (!updatedRoom) return;
      
      // Broadcast updated player list to all clients in the room
      io.to(actualRoomCode).emit('player-left', { players: updatedRoom.players });

      // Check for auto-win
      await checkAndHandleGameOver(actualRoomCode, io);

    } catch (error) {
      console.error('Error in leave-room handler:', error);
    }
  });

  socket.on('submit-animal', async ({ roomCode, animal }) => {
    try {
      // Emit animal submission to all clients
      io.to(roomCode).emit('animal-submitted', { animal });
      
      // Update the database
      const room = await Room.findOne({ code: roomCode });
      if (!room) return;
      
      // Set the current animal and letter
      room.currentAnimal = animal;
      room.expectedStartLetter = animal.slice(-1).toUpperCase();
      
      // Calculate next turn (skip eliminated players)
      let nextTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
      let loopGuard = 0;
      
      // Skip eliminated players
      while (room.players[nextTurnIndex]?.isEliminated && loopGuard < room.players.length) {
        nextTurnIndex = (nextTurnIndex + 1) % room.players.length;
        loopGuard++;
      }
      
      // Update room with new turn index
      room.currentTurnIndex = nextTurnIndex;
      
      // Use findOneAndUpdate to avoid version conflicts
      await Room.findOneAndUpdate(
        { _id: room._id },
        { 
          currentAnimal: animal,
          expectedStartLetter: animal.slice(-1).toUpperCase(),
          currentTurnIndex: nextTurnIndex 
        }
      );
      
      // Notify all clients about turn change
      io.to(roomCode).emit('turn-changed', { currentTurnIndex: nextTurnIndex });
    } catch (error) {
      console.error('Error in submit-animal handler:', error);
    }
  });

  // In server/index.js - player-eliminated handler
  socket.on('player-eliminated', async ({ roomCode, socketId }) => {
    try {
      // First update the player state in database
      await Room.findOneAndUpdate(
        { code: roomCode, "players.socketId": socketId },
        { $set: { "players.$.isEliminated": true } }
      );
      
      // Get updated room state AFTER the update
      const room = await Room.findOne({ code: roomCode });
      if (!room) return;
      
      // STEP 1: Broadcast elimination to all clients
      io.to(roomCode).emit('player-eliminated', { socketId });
      
      // STEP 2: Check if game is over (only one active player left)
      const activePlayers = room.players.filter(p => !p.isEliminated);
      if (activePlayers.length === 1 && room.players.length > 1) {
        // Game over - emit winner event and update room state
        const winner = activePlayers[0];
        
        await Room.findOneAndUpdate(
          { code: roomCode },
          { gameWinner: winner.socketId }
        );
        
        // Send game-over event with complete winner data
        io.to(roomCode).emit('game-over', { 
          winner: {
            socketId: winner.socketId,
            username: winner.username,
            isHost: winner.isHost
          }
        });
        return; // IMPORTANT: Return early, don't process turn change
      }
      
      // If current player was eliminated, advance turn
      const playerIndex = room.players.findIndex(p => p.socketId === socketId);
      if (playerIndex === room.currentTurnIndex) {
        // Find next active player
        let nextIndex = room.currentTurnIndex;
        let loopCount = 0;
        
        do {
          nextIndex = (nextIndex + 1) % room.players.length;
          loopCount++;
        } while (
          room.players[nextIndex]?.isEliminated && 
          loopCount < room.players.length
        );
        
        // Update turn index in database
        await Room.findOneAndUpdate(
          { code: roomCode },
          { currentTurnIndex: nextIndex }
        );
        
        // Notify all clients about turn change
        io.to(roomCode).emit('turn-changed', { currentTurnIndex: nextIndex });
      }
    } catch (error) {
      console.error('Error in player-eliminated handler:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
  
});


server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});