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

// Use a more descriptive name: roomCode -> Set of socketIds
const webrtcReadyUsersByRoom = {}; 

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

  async function checkAndHandleGameOver(roomCodeToCheck, ioInstance) {
    try {
      const room = await Room.findOne({ code: roomCodeToCheck });
    
      // Ensure room exists and game has started
      if (!room || !room.gameStarted) {
        // console.log(`Game over check for room ${roomCodeToCheck}: Room not found or game not started.`);
        return;
      }
    
      // Filter for active (not eliminated) players
      // Ensuring consistency with 'isEliminated' field used elsewhere
      const activePlayers = room.players.filter(player => !player.isEliminated);
    
      // Check if only one player remains and the game had multiple players initially
      if (activePlayers.length === 1 && room.players.length > 1) {
          const winner = activePlayers[0];
          console.log(`Game over: Winner determined in room ${roomCodeToCheck}: ${winner.username}`);
    
          // Update the room with the winner
          await Room.findOneAndUpdate(
            { code: roomCodeToCheck },
            { gameWinner: winner.socketId } // Store winner's socketId
          );

          // Emit a structured game-over event, consistent with player-eliminated handler
          ioInstance.to(roomCodeToCheck).emit('game-over', { 
            winner: {
              socketId: winner.socketId,
              username: winner.username,
              isHost: winner.isHost // Assuming isHost is relevant for the client
            }
          });
      } else {
        // console.log(`Game over check for room ${roomCodeToCheck}: ${activePlayers.length} active players. No winner yet.`);
      }
    } catch (error) {
      console.error(`Error in checkAndHandleGameOver for room ${roomCodeToCheck}:`, error);
    }
  }

  // Merged 'leave-room' handler
  socket.on('leave-room', async (data) => {
    let currentRoomCode; // To store the processed room code
    try {
      // Determine roomCode (from hakob-game-routes, handles object or string)
      // Added a null check for data if it's an object
      if (typeof data === 'object' && data !== null && data.roomCode) {
        currentRoomCode = data.roomCode;
      } else if (typeof data === 'string') {
        currentRoomCode = data;
      }

      if (!currentRoomCode) {
        console.error(`Leave-room event for ${socket.id} missing a valid roomCode. Data received:`, data);
        return;
      }
      
      socket.leave(currentRoomCode);
      console.log(`${socket.id} left room ${currentRoomCode}`);
      
      // WebRTC cleanup (from hakob-game-routes)
      if (webrtcReadyUsersByRoom[currentRoomCode]) {
        webrtcReadyUsersByRoom[currentRoomCode].delete(socket.id);
        if (webrtcReadyUsersByRoom[currentRoomCode].size === 0) {
          delete webrtcReadyUsersByRoom[currentRoomCode];
          console.log(`Cleaned up empty webrtcReadyUsersByRoom for ${currentRoomCode}.`);
        }
      }
      
      // Notify others about WebRTC disconnection (from hakob-game-routes)
      socket.to(currentRoomCode).emit('webrtc-user-left', { socketId: socket.id });
      
      // Use atomic operation to remove player and get updated players list
      const updatedRoom = await Room.findOneAndUpdate(
        { code: currentRoomCode },
        { $pull: { players: { socketId: socket.id } } },
        { new: true } // Return the updated document
      );
      
      if (!updatedRoom) {
        // This can happen if the room was already deleted or the player was already removed.
        console.log(`Room ${currentRoomCode} not found or player ${socket.id} not in it after trying to leave (findOneAndUpdate returned null).`);
        // Potentially, if the room was deleted by another process (e.g. last player left), this is fine.
        // If we expect updatedRoom to always exist if currentRoomCode was valid, this might indicate an issue.
        // For now, we'll just return if no updatedRoom.
        return;
      }
      
      // Broadcast updated player list to all clients in the room
      io.to(currentRoomCode).emit('player-left', { players: updatedRoom.players });

      // Check for auto-win if a player leaves (from ethan-game-routes)
      // Pass the main 'io' instance to the helper function
      await checkAndHandleGameOver(currentRoomCode, io);

      // Delete room if it becomes empty (from ethan-game-routes)
      if (updatedRoom.players.length === 0) {
        await Room.deleteOne({ code: currentRoomCode });
        console.log(`Room ${currentRoomCode} deleted because it became empty after player ${socket.id} left.`);
      }

    } catch (error) {
      console.error(`Error in leave-room handler for room ${currentRoomCode || 'unknown'}:`, error);
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

  // Updated disconnect handler with WebRTC cleanup
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Clean up webrtcReadyUsersByRoom for all rooms this user was in
    for (const roomCode in webrtcReadyUsersByRoom) {
      if (webrtcReadyUsersByRoom[roomCode].has(socket.id)) {
        webrtcReadyUsersByRoom[roomCode].delete(socket.id);
        console.log(`Removed ${socket.id} from webrtcReadyUsersByRoom for ${roomCode} on disconnect.`);
        
        // Notify others in this room about WebRTC disconnection
        socket.to(roomCode).emit('webrtc-user-left', { socketId: socket.id });
        
        // Clean up empty room entries from the map
        if (webrtcReadyUsersByRoom[roomCode].size === 0) {
          delete webrtcReadyUsersByRoom[roomCode];
          console.log(`Cleaned up empty webrtcReadyUsersByRoom for ${roomCode} on disconnect.`);
        }
      }
    }
    // The rest of your disconnect logic for game state can remain
    // (e.g., notifying rooms about player leaving for game logic, not just WebRTC)
    const rooms = [...socket.rooms].filter(room => room !== socket.id); // Get rooms socket was in
    rooms.forEach(async roomCode => { // Iterate over each room
        try {
            // This part is similar to 'leave-room' but for disconnect
            const updatedRoom = await Room.findOneAndUpdate(
                { code: roomCode },
                { $pull: { players: { socketId: socket.id } } },
                { new: true }
            );
            if (updatedRoom) {
                io.to(roomCode).emit('player-left', { players: updatedRoom.players });
                // Potentially handle game logic if a player disconnects mid-game
                // For example, check if the game needs to end or turn needs to change
            }
        } catch (error) {
            console.error(`Error handling disconnect for room ${roomCode}:`, error);
        }
    });
  });

  // Updated WebRTC signaling handler with user tracking
  socket.on('webrtc-ready', ({ roomCode }) => {
    if (!roomCode) {
      console.error(`User ${socket.id} sent webrtc-ready without a roomCode.`);
      return;
    }
    console.log(`User ${socket.id} is ready for WebRTC in room ${roomCode}`);
    
    // Initialize the room's ready users set if it doesn't exist
    if (!webrtcReadyUsersByRoom[roomCode]) {
      webrtcReadyUsersByRoom[roomCode] = new Set();
    }
    
    // Get other users already ready in this room BEFORE adding the current user
    const otherReadyUsersInThisRoom = Array.from(webrtcReadyUsersByRoom[roomCode]);

    // Add current user to the set of ready users for this room
    // Do this after fetching others, so current user doesn't get their own ready event from this emission
    webrtcReadyUsersByRoom[roomCode].add(socket.id);
    
    // Notify all OTHER users (who were already ready) in the room that this new user (socket.id) is ready
    otherReadyUsersInThisRoom.forEach(readyUserId => {
      // No need to check readyUserId !== socket.id, as otherReadyUsersInThisRoom was populated before current user was added
      io.to(readyUserId).emit('webrtc-ready', { socketId: socket.id, roomCode });
      console.log(`Notified ${readyUserId} that new user ${socket.id} is ready in ${roomCode}`);
    });
    
    // Notify THIS new user (socket.id) about all other users who were already ready
    if (otherReadyUsersInThisRoom.length > 0) {
      console.log(`Informing new user ${socket.id} about existing ready users in ${roomCode}:`, otherReadyUsersInThisRoom);
      otherReadyUsersInThisRoom.forEach(readyUserId => {
        socket.emit('webrtc-ready', { socketId: readyUserId, roomCode });
      });
    }
  });

  socket.on('webrtc-signal', ({ to, from, signal, roomCode }) => {
    // roomCode is not strictly needed for direct signaling if 'to' is a socketId,
    // but good to have for logging or potential future routing.
    console.log(`Relaying WebRTC signal from ${from} to ${to} in room ${roomCode || 'N/A'}`);
    // Forward the signal to the intended recipient
    io.to(to).emit('webrtc-signal', { from, signal });
  });

  // Add a new handler for ICE candidates (if you're using trickle ICE)
  socket.on('ice-candidate', ({ to, from, candidate, roomCode }) => {
    console.log(`Relaying ICE candidate from ${from} to ${to} in room ${roomCode || 'N/A'}`);
    io.to(to).emit('ice-candidate', { from, candidate });
  });
  
});


server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
