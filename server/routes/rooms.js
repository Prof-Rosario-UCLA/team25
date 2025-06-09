import express from 'express';
import Room from '../models/Room.js';
import { nanoid } from 'nanoid';

const router = express.Router();

const appCache = new Map();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Sets a value in the cache with a Time-To-Live (TTL).
 * Assumes 'value' is already a plain JavaScript object.
 * @param {string} key - The cache key.
 * @param {any} value - The plain object value to cache.
 * @param {number} [ttl=DEFAULT_CACHE_TTL] - TTL in milliseconds.
 */
function setCache(key, value, ttl = DEFAULT_CACHE_TTL) {
  const oldEntry = appCache.get(key);
  if (oldEntry && oldEntry.timeoutId) {
    clearTimeout(oldEntry.timeoutId);
  }
  const timeoutId = setTimeout(() => {
    appCache.delete(key);
  }, ttl);
  appCache.set(key, { data: value, timeoutId });
}

/**
 * Gets a value from the cache.
 * @param {string} key - The cache key.
 * @returns {any|null} - The cached plain object or null if not found/expired.
 */
function getCache(key) {
  const entry = appCache.get(key);
  if (entry) {
    return entry.data;
  }
  return null;
}

/**
 * Deletes a value from the cache.
 * @param {string} key - The cache key.
 */
function delCache(key) {
  const entry = appCache.get(key);
  if (entry && entry.timeoutId) {
    clearTimeout(entry.timeoutId);
  }
  const deleted = appCache.delete(key);
  return deleted;
}

const CACHE_KEYS = {
  OPEN_ROOMS: 'rooms:open', // For the list of all available rooms
  ROOM_PREFIX: 'room:',     // Prefix for individual room data
};

/**
 * Helper function to convert a Mongoose Room document (and its subdocuments)
 * into a standardized plain JavaScript object.
 * @param {import('mongoose').Document} roomDocument - The Mongoose document for a room.
 * @returns {object|null} A plain JavaScript object representing the room, or null.
 */
function toPlainRoomObject(roomDocument) {
  if (!roomDocument) return null;

  // Start with Mongoose's toObject, include virtuals if you use them
  const plainRoom = roomDocument.toObject({ virtuals: true });

  // Ensure players array contains fully plain objects
  if (roomDocument.players && Array.isArray(roomDocument.players)) {
    plainRoom.players = roomDocument.players.map(p => {
      let playerObj = p;
      if (p && typeof p.toObject === 'function') {
        // If p is a Mongoose subdocument
        playerObj = p.toObject({ virtuals: true });
      } else if (p) {
        // If p is already somewhat plain or needs to be cloned
        playerObj = { ...p };
      }
      // Ensure _id is stringified if present in player subdocument
      if (playerObj && playerObj._id) {
        playerObj.id = playerObj._id.toString();
      }
      delete playerObj.__v; // Remove Mongoose version key from player
      return playerObj;
    });
  }

  // Ensure top-level _id is stringified and available as 'id' for consistency
  if (roomDocument._id) {
    plainRoom.id = roomDocument._id.toString();
  }
  // Remove Mongoose version key __v if present and not needed
  delete plainRoom.__v;

  return plainRoom;
}

// POST /api/rooms/create
router.post('/create', async (req, res) => {
  try {
    const roomCode = nanoid(6).toUpperCase();
    const room = new Room({ code: roomCode, players: [] });
    await room.save();
    delCache(CACHE_KEYS.OPEN_ROOMS); // Invalidate the list of open rooms
    res.json({ roomCode });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ message: 'Server error creating room' });
  }
});

// POST /api/rooms/:roomCode/join
router.post('/:roomCode/join', async (req, res) => {
  const { username, socketId, persistentUserId } = req.body;
  const { roomCode } = req.params;
  const roomCacheKey = `${CACHE_KEYS.ROOM_PREFIX}${roomCode}`;

  try {
    const room = await Room.findOne({ code: roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const existingPlayer = room.players.find(p => p.persistentUserId === persistentUserId);

    if (existingPlayer) {
      existingPlayer.socketId = socketId;
      if (username) existingPlayer.username = username;
    } else {
      const isFirstPlayer = room.players.length === 0;
      room.players.push({
        username,
        socketId,
        persistentUserId,
        isHost: isFirstPlayer,
        isEliminated: false
      });
    }
    const savedRoom = await room.save();
    
    delCache(roomCacheKey); // Invalidate specific room cache
    delCache(CACHE_KEYS.OPEN_ROOMS); // Invalidate open rooms list (player count changed)

    const plainRoomResponse = toPlainRoomObject(savedRoom);
    res.json({ success: true, room: plainRoomResponse });
  } catch (error) {
    console.error(`Error in /${roomCode}/join:`, error);
    res.status(500).json({ message: 'Server error joining room' });
  }
});

// GET /api/rooms (List of open rooms for the lobby)
router.get('/', async (req, res) => {
  try {
    const cachedRooms = getCache(CACHE_KEYS.OPEN_ROOMS);
    if (cachedRooms) {
      return res.json(cachedRooms);
    }
    const roomsFromDB = await Room.find({ gameStarted: false });
    // Format for the open rooms list is simpler
    const formattedRooms = roomsFromDB.map(room => ({
      id: room._id.toString(), // Ensure ID is a string
      code: room.code,
      players: room.players.length,
    }));
    
    setCache(CACHE_KEYS.OPEN_ROOMS, formattedRooms);
    res.json(formattedRooms);
  } catch (err) {
    console.error('Error fetching rooms list:', err);
    res.status(500).json({ error: 'Failed to fetch rooms list' });
  }
});

// GET /api/rooms/:roomCode (Specific room data)
router.get('/:roomCode', async (req, res) => {
  const { roomCode } = req.params;
  const roomCacheKey = `${CACHE_KEYS.ROOM_PREFIX}${roomCode}`;

  try {
    console.log(`[Cache Debug] GET /api/rooms/${roomCode}: Bypassing cache read, fetching from DB for initial load.`);
    const roomFromDB = await Room.findOne({ code: roomCode });
    if (!roomFromDB) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    const plainRoom = toPlainRoomObject(roomFromDB);
    setCache(roomCacheKey, plainRoom); // Populate cache after fetching fresh data
    res.json(plainRoom);
  } catch (err) {
    console.error(`Error fetching room /api/rooms/${roomCode}: `, err);
    res.status(500).json({ message: 'Server error fetching specific room' });
  }
});

// POST /api/rooms/:roomCode/leave
router.post('/:roomCode/leave', async (req, res) => {
  const { socketId } = req.body;
  const { roomCode } = req.params;
  const roomCacheKey = `${CACHE_KEYS.ROOM_PREFIX}${roomCode}`;

  try {
    const room = await Room.findOne({ code: roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    room.players = room.players.filter(p => p.socketId !== socketId);
    await room.save();
    
    delCache(roomCacheKey); 
    delCache(CACHE_KEYS.OPEN_ROOMS); 
    res.json({ success: true }); // No room data needed in response here
  } catch (error) {
    console.error(`Error in /${roomCode}/leave:`, error);
    res.status(500).json({ message: 'Server error leaving room' });
  }
});

// POST /api/rooms/:roomCode/start
router.post('/:roomCode/start', async (req, res) => {
  const { roomCode } = req.params;
  const roomCacheKey = `${CACHE_KEYS.ROOM_PREFIX}${roomCode}`;
  try {
    const room = await Room.findOne({ code: roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (room.players.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 players are required to start the game'
      });
    }

    const startLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));

    room.gameStarted = true;
    room.expectedStartLetter = startLetter;
    room.currentTurnIndex = 0;
    const savedRoom = await room.save();
    
    delCache(roomCacheKey); 
    delCache(CACHE_KEYS.OPEN_ROOMS); // Game started, so remove from open list

    const plainRoomForSocketAndResponse = toPlainRoomObject(savedRoom);
    req.app.get('io').to(roomCode).emit('game-started', {
      expectedStartLetter: plainRoomForSocketAndResponse.expectedStartLetter,
      currentTurnIndex: plainRoomForSocketAndResponse.currentTurnIndex,
      players: plainRoomForSocketAndResponse.players 
    });
    
    res.json({ success: true, room: plainRoomForSocketAndResponse });
  } catch (error) {
    console.error(`Error in /${roomCode}/start:`, error);
    res.status(500).json({ message: 'Server error starting game' });
  }
});

// POST /api/rooms/:roomCode/submit-animal
router.post('/:roomCode/submit-animal', async (req, res) => {
  const { animal } = req.body;
  const { roomCode } = req.params;
  const roomCacheKey = `${CACHE_KEYS.ROOM_PREFIX}${roomCode}`;

  try {
    const updatedRoom = await Room.findOneAndUpdate(
      { code: roomCode },
      {
        currentAnimal: animal,
        expectedStartLetter: animal.slice(-1).toUpperCase()
      },
      { new: true }
    );
    
    if (!updatedRoom) {
        return res.status(404).json({ message: 'Room not found for submitting animal.' });
    }
    
    delCache(roomCacheKey); 
    // No need to return full room data, socket event will handle UI update
    res.json({ success: true }); 
  } catch (error)
{
    console.error('Error submitting animal:', error);
    res.status(500).json({ message: 'Server error submitting animal' });
  }
});

// POST /api/rooms/:roomCode/eliminate
router.post('/:roomCode/eliminate', async (req, res) => {
  const { socketId } = req.body;
  const { roomCode } = req.params;
  const roomCacheKey = `${CACHE_KEYS.ROOM_PREFIX}${roomCode}`;

  try {
    const updatedRoom = await Room.findOneAndUpdate(
      { code: roomCode, "players.socketId": socketId },
      { $set: { "players.$.isEliminated": true } },
      { new: true } 
    );

    if (!updatedRoom) {
      return res.status(404).json({ message: 'Room or player not found for elimination.' });
    }
    
    delCache(roomCacheKey); 
    const plainRoomResponse = toPlainRoomObject(updatedRoom);
    res.json({ success: true, room: plainRoomResponse });
  } catch (error) {
    console.error('Error eliminating player:', error);
    res.status(500).json({ message: 'Server error eliminating player' });
  }
});

export default router;