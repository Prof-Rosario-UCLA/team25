import express from 'express';
import Room from '../models/Room.js';
import { nanoid } from 'nanoid';
// import redis from '../redis.js' // Temporarily disabled Redis

const router = express.Router();

// POST /api/rooms/create
router.post('/create', async (req, res) => {
  const roomCode = nanoid(6).toUpperCase();
  const room = new Room({ code: roomCode, players: [] });
  await room.save();
  // await redis.del('rooms:open'); // Temporarily disabled Redis
  res.json({ roomCode });
});

// POST /api/:room/join
router.post('/:roomCode/join', async (req, res) => {
  const { username, socketId, persistentUserId } = req.body; // Added persistentUserId
  const { roomCode } = req.params;

  try {
    const room = await Room.findOne({ code: roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    // await redis.set(`room:${req.params.roomCode}`, JSON.stringify(room), 'EX', 300); // Temporarily disabled Redis

    // Check if player with this persistentUserId already exists
    const existingPlayer = room.players.find(p => p.persistentUserId === persistentUserId);

    if (existingPlayer) {
      // Update existing player's socket ID and username if provided
      existingPlayer.socketId = socketId;
      if (username) existingPlayer.username = username;
    } else {
      // Add new player
      const isFirstPlayer = room.players.length === 0;
      room.players.push({
        username,
        socketId,
        persistentUserId,
        isHost: isFirstPlayer,
        isEliminated: false
      });
    }
    await room.save();
    // await redis.del('rooms:open'); // Temporarily disabled Redis
    // await redis.del(`room:${req.params.roomCode}`); // Temporarily disabled Redis
    res.json({ success: true, room }); // Return the updated room
  } catch (error) {
    console.error(`Error in /${roomCode}/join:`, error);
    res.status(500).json({ message: 'Server error joining room' });
  }
});

// GET /api/rooms
router.get('/', async (req, res) => {
  try {
      // try cache before hitting db
      // const cachedRooms = await redis.get('rooms:open'); // Temporarily disabled Redis
      // if (cachedRooms) { // Temporarily disabled Redis
        // console.log('CACHE HIT:', JSON.parse(cachedRooms));
        // return res.json(JSON.parse(cachedRooms)); // Temporarily disabled Redis
      // } // Temporarily disabled Redis
      const rooms = await Room.find({ gameStarted: false });
      const formattedRooms = rooms.map(room => ({
          id: room._id,
          code: room.code,
          players: room.players.length,
      }));
      // cache result for 5 minutes
      // await redis.set('rooms:open', JSON.stringify(formattedRooms), 'EX', 300); // Temporarily disabled Redis
      res.json(formattedRooms);
  } catch (err) {
      console.error('Error fetching rooms:', err);
      res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/rooms/:roomCode
router.get('/:roomCode', async (req, res) => {
  const { roomCode } = req.params;
  try {
    // hit cache before db
    // const cacheKey = `room:${roomCode}`; // Temporarily disabled Redis
    // const cachedRoom = await redis.get(cacheKey); // Temporarily disabled Redis
    // if (cachedRoom) { // Temporarily disabled Redis
      // console.log('CACHE HIT:', JSON.parse(cachedRoom));
      // return res.json(JSON.parse(cachedRoom)); // Temporarily disabled Redis
    // } // Temporarily disabled Redis
    // hit db
    const room = await Room.findOne({ code: roomCode }); // Changed from req.params.roomCode
    if (!room) return res.status(404).json({ message: 'Room not found' });
    // cache result for 5 minutes
    // await redis.set(cacheKey, JSON.stringify(room), 'EX', 300); // Temporarily disabled Redis
    res.json(room);
  } catch (err) {
    console.error('Error fetching room: ', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/:roomCode/leave
router.post('/:roomCode/leave', async (req, res) => {
  const { socketId } = req.body; // Assuming socketId is sent in the body
  const { roomCode } = req.params;
  try {
    const room = await Room.findOne({ code: roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    // await redis.set(`room:${req.params.roomCode}`, JSON.stringify(room), 'EX', 300); // Temporarily disabled Redis

    room.players = room.players.filter(p => p.socketId !== socketId);
    await room.save();
    // await redis.del('rooms:open'); // Temporarily disabled Redis
    // await redis.del(`room:${req.params.roomCode}`); // Temporarily disabled Redis
    res.json({ success: true });
  } catch (error) {
    console.error(`Error in /${roomCode}/leave:`, error);
    res.status(500).json({ message: 'Server error leaving room' });
  }
});

// POST /api/rooms/:roomCode/start
router.post('/:roomCode/start', async (req, res) => {
  const { roomCode } = req.params;
  try {
    const room = await Room.findOne({ code: roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    // await redis.set(`room:${req.params.roomCode}`, JSON.stringify(room), 'EX', 300); // Temporarily disabled Redis

    // Require at least 2 players to start the game
    if (room.players.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 players are required to start the game'
      });
    }

    // Generate random starting letter
    const startLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));

    room.gameStarted = true;
    room.expectedStartLetter = startLetter;
    room.currentTurnIndex = 0; // Start with the first player
    await room.save();

    // Use the io object to emit to all clients in the room
    req.app.get('io').to(roomCode).emit('game-started', { // Changed from req.params.roomCode
      expectedStartLetter: startLetter,
      currentTurnIndex: room.currentTurnIndex, // Send initial turn index
      players: room.players // Send updated players list
    });
    // await redis.del(`room:${req.params.roomCode}`); // Temporarily disabled Redis
    res.json({ success: true, room }); // Return the updated room
  } catch (error) {
    console.error(`Error in /${roomCode}/start:`, error);
    res.status(500).json({ message: 'Server error starting game' });
  }
});

// POST /api/rooms/:roomCode/submit-animal
router.post('/:roomCode/submit-animal', async (req, res) => {
  const { animal } = req.body;
  const { roomCode } = req.params;

  try {
    // Find the room directly from DB
    const room = await Room.findOne({ code: roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // Only update the animal and letter
    // The socket handler will handle turn changes
    await Room.findOneAndUpdate(
      { code: roomCode },
      {
        currentAnimal: animal,
        expectedStartLetter: animal.slice(-1).toUpperCase()
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting animal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/:roomCode/eliminate
router.post('/:roomCode/eliminate', async (req, res) => {
  const { socketId } = req.body;
  const { roomCode } = req.params;

  try {
    // const room = await Room.findOne({ code: roomCode }); // Not strictly needed if just updating
    // if (!room) return res.status(404).json({ message: 'Room not found' }); // Temporarily disabled Redis
    // await redis.set(`room:${req.params.roomCode}`, JSON.stringify(room), 'EX', 300); // Temporarily disabled Redis

    // Use findOneAndUpdate to avoid version conflicts
    const updatedRoom = await Room.findOneAndUpdate(
      { code: roomCode, "players.socketId": socketId },
      { $set: { "players.$.isEliminated": true } },
      { new: true } // Return the updated document
    );

    if (!updatedRoom) {
      return res.status(404).json({ message: 'Room or player not found for elimination.' });
    }
    // await redis.del(`room:${req.params.roomCode}`); // Temporarily disabled Redis
    res.json({ success: true, room: updatedRoom });
  } catch (error) {
    console.error('Error eliminating player:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;