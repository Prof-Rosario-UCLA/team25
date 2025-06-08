import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client'; // Import Socket.IO client
import Peer from 'simple-peer'; // Import simple-peer for WebRTC
import VideoStream from '../components/VideoStream'; // Import our video component

// Separate GameOverScreen component for better stability
const GameOverScreen = ({ winner, onLeave }) => {
    if (!winner) return null;
    
    return (
        <div className="fixed inset-0 bg-gradient-to-b from-green-50 to-green-100 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <h1 className="text-4xl font-bold text-green-600 mb-4">🎉 Game Over! 🎉</h1>
                <p className="text-2xl font-semibold text-gray-800 mb-6">
                    {winner.username || "Unknown Player"} Wins!
                </p>
                <button 
                    onClick={onLeave}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg shadow-md transition-colors"
                >
                    Return to Lobby
                </button>
            </div>
        </div>
    );
};

const Room = () => {
    const navigate = useNavigate();
    const { roomCode } = useParams();
    const socketRef = useRef(null); // Socket.IO connection reference
    const eliminationInProgress = useRef(false); // Component-level ref for elimination state
    const playerLeftDuringGame = useRef(false); // Track if a player left mid-game
    const gameOverProcessed = useRef(false); // New ref to track if game over was processed
    const isConnecting = useRef(false); // Prevent multiple connection attempts
    
    // WebRTC related state and refs
    const [localStream, setLocalStream] = useState(null);
    const [peerConnections, setPeerConnections] = useState({});
    const [playerStreams, setPlayerStreams] = useState({});
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const peersRef = useRef({});

    const [currentAnimal, setCurrentAnimal] = useState(null);
    const [expectedStartLetter, setExpectedStartLetter] = useState(null);
    const [inputAnimal, setInputAnimal] = useState('');
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(30);
    const [gameWinner, setGameWinner] = useState(null);
    const [players, setPlayers] = useState([]);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const [currentUserId, setCurrentUserId] = useState(null); // Track current user's socket ID
    const [gameStarted, setGameStarted] = useState(false);

    // Initialize camera access
    useEffect(() => {
        // Only request camera access when we have a valid socket connection
        if (!socketRef.current || !currentUserId) return;
        
        const getMediaStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                
                // Mute audio based on state
                stream.getAudioTracks().forEach(track => {
                    track.enabled = audioEnabled;
                });
                
                // Disable video based on state
                stream.getVideoTracks().forEach(track => {
                    track.enabled = videoEnabled;
                });
                
                setLocalStream(stream);
                
                // Add stream to state for self-view
                setPlayerStreams(prev => ({
                    ...prev,
                    [currentUserId]: stream
                }));
                
                // Emit ready for connection signal
                socketRef.current.emit('webrtc-ready', { roomCode });
                
                console.log('Local media stream obtained');
            } catch (error) {
                console.error('Error accessing media devices:', error);
                setError('Unable to access camera or microphone');
            }
        };

        getMediaStream();
        
        // Clean up function
        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [currentUserId, roomCode]);

    // Helper function to safely check player elimination status
    const isPlayerEliminated = (player) => {
        return player && player.isEliminated === true;
    };

    // Get current player information with safety check
    const currentPlayer = players[currentPlayerIndex] || null;
    const isCurrentUser = currentPlayer?.socketId === currentUserId;
    const isInputDisabled = !isCurrentUser || isPlayerEliminated(currentPlayer) || gameWinner;

    // Initialize Socket.IO connection and join room - SIMPLIFIED
    useEffect(() => {
        if (isConnecting.current) return;
        isConnecting.current = true;
        
        console.log("Setting up socket connection to room:", roomCode);
        
        // Generate a persistent user ID if one doesn't exist
        if (!localStorage.getItem('persistentUserId')) {
            localStorage.setItem('persistentUserId', `user_${Math.random().toString(36).substr(2, 9)}`);
        }
        const persistentUserId = localStorage.getItem('persistentUserId');
        
        // Create socket connection with persistent ID
        socketRef.current = io(import.meta.env.VITE_API_URL, {
            auth: { 
                username: localStorage.getItem('username') || `Player-${persistentUserId.substring(0, 4)}`,
                persistentUserId: persistentUserId
            },
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        // Fetch initial room data
        const fetchRoomData = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/rooms/${roomCode}`);
                const roomData = response.data;
                
                setPlayers(roomData.players);
                setGameStarted(roomData.gameStarted);
                
                if (roomData.gameStarted) {
                    setCurrentAnimal(roomData.currentAnimal);
                    setExpectedStartLetter(roomData.expectedStartLetter);
                    setCurrentPlayerIndex(roomData.currentTurnIndex);
                }
                
                // Check if there's already a winner (for players who join mid-game)
                if (roomData.gameWinner) {
                    const winner = roomData.players.find(p => p.socketId === roomData.gameWinner);
                    if (winner) {
                        setGameWinner(winner);
                        gameOverProcessed.current = true;
                    }
                }
            } catch (error) {
                console.error('Failed to fetch room data:', error);
                setError('Failed to load room data');
            }
        };
        
        // Wait for connection before setting up room
        socketRef.current.on('connect', () => {
            console.log('Socket connected:', socketRef.current.id);
            
            // Set current user ID only after successful connection
            setCurrentUserId(socketRef.current.id);
            
            // Join room with persistent ID
            socketRef.current.emit('join-room', {
                roomCode,
                persistentUserId
            });
            
            // Fetch initial room data after a delay to ensure server is updated
            setTimeout(fetchRoomData, 800);
        });
        
        socketRef.current.on('reconnect', () => {
            console.log('Socket reconnected');
        });
        
        socketRef.current.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setError('Failed to connect to game server');
        });
        
        // Clean up on unmount
        return () => {
            console.log("CLEANUP: Disconnecting socket", socketRef.current?.id);
            isConnecting.current = false;
            
            // Stop local stream
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            
            // Close all peer connections
            Object.values(peersRef.current).forEach(peer => {
                if (peer.peer) {
                    peer.peer.destroy();
                }
            });
            
            if (socketRef.current) {
                socketRef.current.off(); // Remove all listeners
                if (socketRef.current.connected) {
                    socketRef.current.emit('leave-room', {
                        roomCode,
                        persistentUserId: localStorage.getItem('persistentUserId')
                    });
                    socketRef.current.disconnect();
                }
                socketRef.current = null;
            }
        };
    }, [roomCode]); // ONLY depend on roomCode

    // Setup WebRTC event handlers
    useEffect(() => {
        if (!socketRef.current || !localStream) return;
        
        // When a new user is ready for connections
        socketRef.current.on('webrtc-ready', ({ socketId }) => {
            console.log(`User ${socketId} is ready for WebRTC connection`);
            
            // Don't connect to yourself
            if (socketId === currentUserId) return;
            
            // Create a new peer as the initiator
            const peer = new Peer({
                initiator: true,
                trickle: false,
                stream: localStream
            });
            
            // Handle when peer generates signal data (offer)
            peer.on('signal', data => {
                console.log(`Sending signal to ${socketId}`);
                socketRef.current.emit('webrtc-signal', {
                    to: socketId,
                    from: currentUserId,
                    signal: data,
                    roomCode
                });
            });
            
            // Handle incoming stream
            peer.on('stream', stream => {
                console.log(`Received stream from ${socketId}`);
                setPlayerStreams(prev => ({
                    ...prev,
                    [socketId]: stream
                }));
            });
            
            // Handle connection errors
            peer.on('error', err => {
                console.error(`Peer connection error with ${socketId}:`, err);
            });
            
            // Store the peer
            peersRef.current[socketId] = { peer, socketId };
            setPeerConnections(prev => ({ ...prev, [socketId]: peer }));
        });
        
        // When receiving a WebRTC signal
        socketRef.current.on('webrtc-signal', ({ from, signal }) => {
            console.log(`Received signal from ${from}`);
            
            // Check if we already have a peer for this user
            const existingPeer = peersRef.current[from];
            
            if (existingPeer) {
                // If peer exists, just signal it
                existingPeer.peer.signal(signal);
            } else {
                // Create a new peer as the receiver
                const peer = new Peer({
                    initiator: false,
                    trickle: false,
                    stream: localStream
                });
                
                // Handle when peer generates signal data (answer)
                peer.on('signal', data => {
                    socketRef.current.emit('webrtc-signal', {
                        to: from,
                        from: currentUserId,
                        signal: data,
                        roomCode
                    });
                });
                
                // Handle incoming stream
                peer.on('stream', stream => {
                    console.log(`Received stream from ${from}`);
                    setPlayerStreams(prev => ({
                        ...prev,
                        [from]: stream
                    }));
                });
                
                // Handle connection errors
                peer.on('error', err => {
                    console.error(`Peer connection error with ${from}:`, err);
                });
                
                // Signal the peer with the received offer
                peer.signal(signal);
                
                // Store the peer
                peersRef.current[from] = { peer, socketId: from };
                setPeerConnections(prev => ({ ...prev, [from]: peer }));
            }
        });
        
        // When a user leaves
        socketRef.current.on('webrtc-user-left', ({ socketId }) => {
            console.log(`User ${socketId} left WebRTC connection`);
            
            // Close and remove the peer connection
            if (peersRef.current[socketId]) {
                peersRef.current[socketId].peer.destroy();
                
                // Remove the peer
                const newPeers = { ...peersRef.current };
                delete newPeers[socketId];
                peersRef.current = newPeers;
                
                // Update state
                setPeerConnections(prev => {
                    const newConnections = { ...prev };
                    delete newConnections[socketId];
                    return newConnections;
                });
                
                // Remove the stream
                setPlayerStreams(prev => {
                    const newStreams = { ...prev };
                    delete newStreams[socketId];
                    return newStreams;
                });
            }
        });
        
        // Setup clean-up
        return () => {
            if (socketRef.current) {
                socketRef.current.off('webrtc-ready');
                socketRef.current.off('webrtc-signal');
                socketRef.current.off('webrtc-user-left');
            }
        };
    }, [localStream, currentUserId, roomCode]);

    // Regular game event handlers
    useEffect(() => {
        if (!socketRef.current) return;
        
        // Remove any existing listeners to prevent duplicates
        socketRef.current.off('animal-submitted');
        socketRef.current.off('player-eliminated');
        socketRef.current.off('game-started');
        socketRef.current.off('player-joined');
        socketRef.current.off('player-left');
        socketRef.current.off('turn-changed');
        socketRef.current.off('game-over');
        
        // Set up fresh listeners
        socketRef.current.on('animal-submitted', ({ animal }) => {
            console.log("Animal submitted event received:", animal);
            setCurrentAnimal(animal);
            const lastLetter = animal[animal.length - 1].toUpperCase();
            setExpectedStartLetter(lastLetter);
            setTimeLeft(30); // Reset timer when an animal is submitted
        });
        
        // Enhanced player elimination handler with better guards and debug logs
        socketRef.current.on('player-eliminated', ({ socketId }) => {
            console.log("Player eliminated event received:", socketId);
            
            // Don't process eliminations if game is already over
            if (gameWinner) {
                console.log("Ignoring elimination - game already has a winner");
                return;
            }
            
            // First check if this player is already eliminated to avoid duplicate state updates
            const alreadyEliminated = players.some(p => p.socketId === socketId && p.isEliminated);
            if (alreadyEliminated) {
                console.log("Player already eliminated, ignoring event");
                return;
            }
            
            // Update players state with eliminated player
            setPlayers(prevPlayers => 
                prevPlayers.map(player => 
                    player.socketId === socketId 
                        ? { ...player, isEliminated: true } 
                        : player
                )
            );
        });
        
        socketRef.current.on('game-started', ({ expectedStartLetter }) => {
            console.log("Game started event received with letter:", expectedStartLetter);
            setGameStarted(true);
            setExpectedStartLetter(expectedStartLetter);
        });
        
        socketRef.current.on('player-joined', ({ players }) => {
            console.log("Player joined event received, players:", players.length);
            setPlayers(players);
        });
        
        // Improved player left handler to avoid state conflicts
        socketRef.current.on('player-left', ({ players }) => {
            console.log("Player left event received, players:", players.length);
            
            if (gameStarted) {
                playerLeftDuringGame.current = true;
                // Short delay to allow other events to process first
                setTimeout(() => {
                    setPlayers(players);
                    playerLeftDuringGame.current = false;
                }, 100);
            } else {
                setPlayers(players);
            }
        });
        
        socketRef.current.on('turn-changed', ({ currentTurnIndex }) => {
            console.log("Turn changed event received, new turn index:", currentTurnIndex);
            setCurrentPlayerIndex(currentTurnIndex);
            // Reset the timer whenever the turn changes
            setTimeLeft(30);
        });
        
        // CRITICAL FIX: Completely redesigned game-over event handler
        socketRef.current.on('game-over', ({ winner }) => {
            console.log("GAME OVER EVENT RECEIVED", winner);
            
            // Safety checks
            if (!winner || !winner.socketId) {
                console.error("Invalid winner data received:", winner);
                return;
            }
            
            // Prevent duplicate processing
            if (gameOverProcessed.current) {
                console.log("Game over already processed, ignoring duplicate event");
                return;
            }
            
            // Mark as processed immediately
            gameOverProcessed.current = true;
            eliminationInProgress.current = true;
            
            // Create a safe winner object with all necessary properties
            const safeWinner = {
                socketId: winner.socketId,
                username: winner.username || "Unknown Player",
                isHost: !!winner.isHost
            };
            
            console.log("Setting game winner to:", safeWinner.username);
            
            // Update state with a delay to ensure it doesn't conflict with other state updates
            setTimeout(() => {
                setGameWinner(safeWinner);
            }, 300);
        });
        
        return () => {
            // Clean up listeners when dependencies change
            if (socketRef.current) {
                socketRef.current.off('animal-submitted');
                socketRef.current.off('player-eliminated');
                socketRef.current.off('game-started');
                socketRef.current.off('player-joined');
                socketRef.current.off('player-left');
                socketRef.current.off('turn-changed');
                socketRef.current.off('game-over');
            }
        };
    }, [players.length, gameWinner]); // Minimal dependencies to prevent reconnection loops

    // Toggle video
    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setVideoEnabled(!videoEnabled);
        }
    };

    // Toggle audio
    const toggleAudio = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setAudioEnabled(!audioAudio);
        }
    };

    // UPDATED: Handle finding the next player
    const getNextActivePlayerIndex = (currentIndex, playersList) => {
        if (!playersList || playersList.length === 0) return 0;

        let nextIndex = (currentIndex + 1) % playersList.length;
        
        // Add safety check to avoid infinite loop
        let safetyCounter = 0;
        while (playersList[nextIndex]?.isEliminated && safetyCounter < playersList.length) {
            nextIndex = (nextIndex + 1) % playersList.length;
            safetyCounter++;
        }
        
        return nextIndex;
    };

    // Add a function to handle starting the game
    const handleStartGame = async () => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/rooms/${roomCode}/start`);
            // The game started event will be handled by the socket listener
        } catch (error) {
            console.error('Failed to start game:', error);
            if (error.response?.data?.message) {
                setError(error.response.data.message);
            } else {
                setError('Failed to start the game');
            }
            
            // Clear error after 3 seconds
            setTimeout(() => setError(''), 3000);
        }
    };

    // Improved timer and player elimination with more robust guards
    useEffect(() => {
        // Don't run timer if game is over, not started, or timer expired
        if (gameWinner || !gameStarted || timeLeft <= 0) {
            if (timeLeft <= 0 && !gameWinner && isCurrentUser && currentPlayer && !isPlayerEliminated(currentPlayer)) {
                // Extra safety checks
                if (!eliminationInProgress.current && socketRef.current && socketRef.current.connected) {
                    eliminationInProgress.current = true;
                    console.log("Sending player elimination signal for:", currentPlayer.socketId);
                    
                    // Use only the socket event
                    socketRef.current.emit('player-eliminated', { 
                        roomCode, 
                        socketId: currentPlayer.socketId 
                    });
                }
            }
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prevTime) => prevTime - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, gameWinner, currentPlayerIndex, gameStarted, isCurrentUser, roomCode, currentPlayer]);

    // Reset the elimination flag when the turn changes
    useEffect(() => {
        eliminationInProgress.current = false;
    }, [currentPlayerIndex]);

    const handleLeaveRoom = async () => {
        try {
            // Mark player as leaving so we avoid any game over calculations
            if (socketRef.current) {
                socketRef.current.emit('leave-room', {
                    roomCode,
                    persistentUserId: localStorage.getItem('persistentUserId')
                });
            }
            
            await axios.post(`${import.meta.env.VITE_API_URL}/api/rooms/${roomCode}/leave`, {
                socketId: currentUserId
            });
            
            navigate('/lobby');
        } catch (error) {
            console.error('Failed to leave room:', error);
            // Force navigation even if the request fails
            navigate('/lobby');
        }
    };

    const handleAnimalSubmit = async () => {
        if (!inputAnimal || gameWinner || !isCurrentUser) return;

        try {
            // First validate the animal
            const checkResponse = await axios.post(`${import.meta.env.VITE_API_URL}/api/animals/check`, {
                animal: inputAnimal,
                requiredStartLetter: expectedStartLetter.toLowerCase(),
            });

            if (checkResponse.data.valid) {
                const newAnimal = inputAnimal.trim();
                
                // ONLY use the socket event, remove the API call
                socketRef.current.emit('submit-animal', {
                    roomCode,
                    animal: newAnimal
                });

                setInputAnimal('');
                setError('');
            } else {
                setError(checkResponse.data.message);
            }
        } catch (err) {
            setError('Failed to check animal. Try again.');
        }
    };

    const getNextPlayerForDisplay = () => {
        if (gameWinner) return null;
        const nextIndex = getNextActivePlayerIndex(currentPlayerIndex, players);
        return players[nextIndex];
    };

    const nextPlayer = getNextPlayerForDisplay();

    // Filter out duplicate players before rendering
    const uniquePlayers = players.filter((player, index, self) =>
      index === self.findIndex((p) => (
        p.socketId === player.socketId
      ))
    );

    return (
        <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4 relative">
            {/* Render the GameOverScreen as an overlay, not a replacement */}
            {gameWinner && <GameOverScreen winner={gameWinner} onLeave={handleLeaveRoom} />}
            
            {/* Room code and leave button */}
            <div className="absolute top-4 right-4 flex items-center gap-4">
                <div className="bg-white px-4 py-2 rounded-lg shadow-md">
                    <span className="text-gray-500 text-sm mr-2">Room Code:</span>
                    <span className="font-bold">{roomCode}</span>
                </div>
                <button 
                    onClick={handleLeaveRoom}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md transition-colors"
                >
                    Leave Room
                </button>
            </div>
            
            {/* Video Controls */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
                <button
                    onClick={toggleVideo}
                    className={`p-2 rounded-full ${videoEnabled ? 'bg-green-500' : 'bg-red-500'} text-white`}
                    title={videoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                    {videoEnabled ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"></path>
                        </svg>
                    )}
                </button>
                <button
                    onClick={toggleAudio}
                    className={`p-2 rounded-full ${audioEnabled ? 'bg-green-500' : 'bg-red-500'} text-white`}
                    title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                    {audioEnabled ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path>
                        </svg>
                    )}
                </button>
            </div>

            {/* Timer - only show when game has started */}
            {gameStarted && (
                <div className="text-center mt-16 mb-8">
                    <div className="inline-block bg-white px-6 py-3 rounded-full shadow-md">
                        <span className="text-2xl font-bold text-green-700">
                            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                        </span>
                    </div>
                </div>
            )}

            {/* Main game area */}
            <section className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 mb-12">
                {/* Show start button or waiting message when game hasn't started */}
                {!gameStarted && (
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-800 mb-4">Waiting for game to start</h2>
                        
                        {/* Add debug info for troubleshooting */}
                        <div className="text-xs text-gray-400 mb-2">
                            Your ID: {currentUserId || 'Not connected'}
                        </div>
                        
                        {/* Only show start button to host player */}
                        {uniquePlayers.length > 0 && currentUserId && uniquePlayers.some(p => p.isHost && p.socketId === currentUserId) ? (
                            <button 
                                onClick={handleStartGame}
                                disabled={uniquePlayers.length < 2}
                                className={`px-6 py-3 rounded-lg shadow-md transition-colors ${
                                    uniquePlayers.length < 2 
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                }`}
                            >
                                {uniquePlayers.length < 2 
                                    ? 'Need at least 2 players' 
                                    : 'Start Game'}
                            </button>
                        ) : (
                            <p className="text-gray-600">Waiting for host to start the game...</p>
                        )}
                    </div>
                )}

                {/* Show game content when game has started */}
                {gameStarted && (
                    <>
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-gray-800 mb-2">Current Word</h2>
                            <div className="bg-green-100 p-6 rounded-lg">
                                <p className="text-4xl font-bold text-green-800">
                                    {currentAnimal ? currentAnimal : expectedStartLetter ? `Start with "${expectedStartLetter}"` : "Waiting..."}
                                </p>
                            </div>
                        </div>
                            
                        <div className="mt-6 text-center">
                            {expectedStartLetter && (
                                <p className="text-lg mb-2 text-gray-700">
                                    Enter an animal starting with <strong className="text-green-600">{expectedStartLetter.toUpperCase()}</strong>:
                                </p>
                            )}
                            <input
                                type="text"
                                value={inputAnimal}
                                onChange={(e) => setInputAnimal(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAnimalSubmit();
                                    }
                                }}
                                className="border px-4 py-2 rounded-md w-1/2"
                                placeholder="Type an animal"
                                disabled={isInputDisabled}
                            />
                            <button
                                onClick={handleAnimalSubmit}
                                className="ml-4 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md disabled:bg-gray-300"
                                disabled={isInputDisabled}
                            >
                                Submit
                            </button>
                            {error && <p className="mt-2 text-red-600">{error}</p>}
                        </div>

                        {uniquePlayers.length > 0 && currentPlayer && (
                            <div className="border-t border-gray-200 pt-6 mt-6">
                                <p className="text-center text-lg mb-2">Current Player's Turn</p>
                                <div className="bg-green-100 p-6 rounded-lg flex justify-center items-center">
                                    <p className="text-4xl font-bold text-green-800">
                                        {currentPlayer?.username || 'Loading...'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {nextPlayer && nextPlayer.socketId !== currentPlayer?.socketId && (
                            <div className="border-t border-gray-200 pt-6">
                                <p className="text-center text-lg mb-2">Next Player's Turn</p>
                                <div className="bg-green-50 p-4 rounded-lg text-center">
                                    <p className="text-xl font-medium text-green-700">{nextPlayer.username}</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* Player containers at bottom - NOW WITH VIDEO! */}
            <section className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {uniquePlayers.map((player, index) => (
                        <div key={`${player.socketId || 'unknown'}-${index}`} className="flex flex-col items-center">
                            <div className={`w-full aspect-video rounded-lg shadow-md relative overflow-hidden ${
                                player.isEliminated ? 'bg-red-200' : 'bg-gray-200'
                            } ${
                                index === currentPlayerIndex && !player.isEliminated ? 'border-4 border-green-500' : ''
                            }`}>
                                {/* Video stream or placeholder */}
                                {playerStreams[player.socketId] ? (
                                    <VideoStream 
                                        stream={playerStreams[player.socketId]} 
                                        muted={player.socketId === currentUserId}
                                        isEliminated={player.isEliminated}
                                    />
                                ) : (
                                    <div className="h-full flex items-center justify-center">
                                        {player.isEliminated ? (
                                            <div className="text-center">
                                                <svg className="w-12 h-12 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                                </svg>
                                                <p className="text-red-600 font-medium">Eliminated</p>
                                            </div>
                                        ) : (
                                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                            </svg>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 bg-white px-4 py-1 rounded-lg shadow-sm">
                                <p className={`font-medium ${
                                    player.isEliminated ? 'text-red-500' : 
                                    index === currentPlayerIndex ? 'text-green-600' : 'text-gray-700'
                                }`}>
                                    {player.username || 'Unknown Player'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
};

export default Room;