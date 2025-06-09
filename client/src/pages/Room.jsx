import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import VideoStream from '../components/VideoStream';

// ICE SERVER Config
const ICE_SERVERS = {
  iceServers: [
    {
      urls: "stun:stun.relay.metered.ca:80",
    },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "31cfe41599e682ee040758a1",
      credential: "otMFqqBiUzsAGZH0",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "31cfe41599e682ee040758a1",
      credential: "otMFqqBiUzsAGZH0",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "31cfe41599e682ee040758a1",
      credential: "otMFqqBiUzsAGZH0",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "31cfe41599e682ee040758a1",
      credential: "otMFqqBiUzsAGZH0",
    },
  ]
};

// Separate GameOverScreen component
const GameOverScreen = ({ winner, onLeave }) => {
    if (!winner) return null;
    
    return (
        <div className="fixed inset-0 bg-gradient-to-b from-green-50 to-green-100 flex items-center justify-center z-50 p-3">
            <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 md:p-10 text-center">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-600 mb-3 sm:mb-4">🎉 Game Over! 🎉</h1>
                <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6">
                    {winner.username || "Player"} Wins!
                </p>
                <button 
                    onClick={onLeave}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 sm:px-6 sm:py-2.5 rounded-lg shadow-md transition-colors text-sm sm:text-base"
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
    const socketRef = useRef(null);
    const eliminationInProgress = useRef(false);
    const playerLeftDuringGame = useRef(false);
    const gameOverProcessed = useRef(false);
    const isConnecting = useRef(false);
    
    // WebRTC related state
    const [localStream, setLocalStream] = useState(null);
    const [playerStreams, setPlayerStreams] = useState({});
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const peerConnectionsRef = useRef({});
    
    // Status indicators (debug)
    const [isCameraActive, setIsCameraActive] = useState(false);
    // const [connectionStatus, setConnectionStatus] = useState('Not connected'); // Keep if needed for UI
    const [webRTCError, setWebRTCError] = useState('');
    const [webRTCSupported, setWebRTCSupported] = useState(true);

    // Game state
    const [currentAnimal, setCurrentAnimal] = useState(null);
    const [expectedStartLetter, setExpectedStartLetter] = useState(null);
    const [inputAnimal, setInputAnimal] = useState('');
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(30);
    const [gameWinner, setGameWinner] = useState(null);
    const [players, setPlayers] = useState([]);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [gameStarted, setGameStarted] = useState(false);
    const [usedAnimals, setUsedAnimals] = useState(new Set()); // For tracking used animals

    // Check WebRTC support on component mount
    useEffect(() => {
        if (!window.RTCPeerConnection) {
            setWebRTCSupported(false);
            setWebRTCError('WebRTC is not supported in this browser');
        }
    }, []);

    // Helper function
    const isPlayerEliminated = (player) => {
        return player && player.isEliminated === true;
    };

    // Get current player information with safety check
    const currentPlayer = players[currentPlayerIndex] || null;
    const isCurrentUser = currentPlayer?.socketId === currentUserId;
    const isInputDisabled = !isCurrentUser || isPlayerEliminated(currentPlayer) || gameWinner;

    // Update player streams when currentUserId changes to ensure self-view is maintained
    useEffect(() => {
        if (currentUserId && localStream) {
            setPlayerStreams(prev => ({
                ...prev,
                [currentUserId]: localStream
            }));
        }
    }, [currentUserId, localStream]);

    // Media Handling
    const setupCamera = async () => {
        try {
            console.log("Setting up camera...");
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            const emptyStream = new MediaStream();
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setIsCameraActive(true);
            } catch (err) {
                console.warn("Could not access camera+mic:", err.message);
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    setIsCameraActive(false);
                } catch (err2) {
                    console.warn("Could not access audio:", err2.message);
                    stream = emptyStream;
                    setIsCameraActive(false);
                }
            }
            setLocalStream(stream);
            if (currentUserId) {
                setPlayerStreams(prev => ({ ...prev, [currentUserId]: stream }));
            }
            return stream;
        } catch (err) {
            console.error("Setup camera error:", err);
            return new MediaStream();
        }
    };

    // Initialize Socket.IO connection and join room
    useEffect(() => {
        if (isConnecting.current) return;
        isConnecting.current = true;
        
        if (!localStorage.getItem('persistentUserId')) {
            localStorage.setItem('persistentUserId', `user_${Math.random().toString(36).substr(2, 9)}`);
        }
        const persistentUserId = localStorage.getItem('persistentUserId');
        
        socketRef.current = io(import.meta.env.VITE_API_URL, {
            auth: { 
                username: localStorage.getItem('username') || `Player-${persistentUserId.substring(0, 4)}`,
                persistentUserId: persistentUserId
            },
            withCredentials: true, reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000
        });
        
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

                    const initialUsed = new Set();
                    if (roomData.currentAnimal) {
                        initialUsed.add(roomData.currentAnimal.toUpperCase());
                    }
                    setUsedAnimals(initialUsed);

                    const timerEndTime = localStorage.getItem(`timerEndTime_${roomCode}`);
                    if (timerEndTime) {
                        const remaining = Math.max(0, Math.round((parseInt(timerEndTime) - Date.now()) / 1000));
                        setTimeLeft(remaining);
                    } else {
                         // If no timer in localStorage but game started, server initiated turn, set timer
                        localStorage.setItem(`timerEndTime_${roomCode}`, Date.now() + 30000);
                        setTimeLeft(30);
                    }
                } else {
                    setUsedAnimals(new Set()); // Reset if game is not started
                }
                
                if (roomData.gameWinner) {
                    const winner = roomData.players.find(p => p.socketId === roomData.gameWinner);
                    if (winner) {
                        setGameWinner(winner);
                        gameOverProcessed.current = true;
                        localStorage.removeItem(`timerEndTime_${roomCode}`);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch room data:', error);
                setError('Failed to load room data');
            }
        };
        
        socketRef.current.on('connect', async () => {
            setCurrentUserId(socketRef.current.id);
            socketRef.current.emit('join-room', { roomCode, persistentUserId });
            setTimeout(fetchRoomData, 800);
            await setupCamera();
            setTimeout(() => {
                if (socketRef.current && socketRef.current.connected) {
                    socketRef.current.emit('webrtc-ready', { roomCode });
                }
            }, 2000);
        });
        
        socketRef.current.on('connect_error', (error) => setError('Failed to connect to game server'));
        
        return () => {
            isConnecting.current = false;
            if (localStream) localStream.getTracks().forEach(track => track.stop());
            Object.values(peerConnectionsRef.current).forEach(pc => pc?.destroy());
            peerConnectionsRef.current = {};
            if (socketRef.current) {
                socketRef.current.off();
                if (socketRef.current.connected) {
                    socketRef.current.emit('leave-room', { roomCode, persistentUserId: localStorage.getItem('persistentUserId') });
                    socketRef.current.disconnect();
                }
                socketRef.current = null;
            }
            // Do not clear timer on unmount if user might come back to same game session
        };
    }, [roomCode]); // localStream removed as setupCamera is called within

    // WebRTC signaling
    useEffect(() => {
        if (!socketRef.current || !webRTCSupported || !currentUserId || !localStream) return; // Ensure localStream is ready
        
        socketRef.current.on('webrtc-ready', ({ socketId: remoteSocketId }) => {
            if (remoteSocketId === currentUserId) return;
            const amInitiator = currentUserId > remoteSocketId;
            if (amInitiator) {
                setTimeout(() => createPeer(remoteSocketId, true, null), 500);
            }
        });
        
        socketRef.current.on('webrtc-signal', ({ from, signal }) => {
            const existingPeer = peerConnectionsRef.current[from];
            if (existingPeer) {
                try { existingPeer.signal(signal); }
                catch (err) { destroyPeer(from); createPeer(from, false, signal); }
            } else {
                createPeer(from, false, signal);
            }
        });
        
        socketRef.current.on('webrtc-user-left', ({ socketId }) => destroyPeer(socketId));
        
        return () => {
            if (socketRef.current) {
                socketRef.current.off('webrtc-ready');
                socketRef.current.off('webrtc-signal');
                socketRef.current.off('webrtc-user-left');
            }
        };
    }, [webRTCSupported, currentUserId, localStream, roomCode]); 

    const createPeerBase = (peerId, isInitiator, incomingSignal, streamToUse, type) => {
        try {
            destroyPeer(peerId);
            const peer = new Peer({ initiator: isInitiator, trickle: true, config: ICE_SERVERS, stream: streamToUse });
            peer.on('signal', data => {
                if (socketRef.current?.connected) socketRef.current.emit('webrtc-signal', { to: peerId, from: currentUserId, signal: data, roomCode });
            });
            peer.on('stream', remoteStream => setPlayerStreams(prev => ({ ...prev, [peerId]: remoteStream })));
            peer.on('track', (track, remoteStream) => setPlayerStreams(prev => ({ ...prev, [peerId]: remoteStream })));
            peer.on('error', err => {
                console.error(`Peer error (${type}) with ${peerId}:`, err.message);
                destroyPeer(peerId);
                if (type === 'primary' && (err.message.includes('Stream') || err.message.includes('track') || err.message.includes('getUserMedia'))) {
                    createPeerWithoutStream(peerId, isInitiator, incomingSignal); // Fallback
                } else {
                     setTimeout(() => { if (socketRef.current?.connected) socketRef.current.emit('webrtc-ready', { roomCode }); }, 5000 + Math.random() * 1000);
                }
            });
            peer.on('close', () => destroyPeer(peerId));
            if (!isInitiator && incomingSignal) peer.signal(incomingSignal);
            peerConnectionsRef.current[peerId] = peer; return peer;
        } catch (err) {
            console.error(`Critical error creating ${type} peer for ${peerId}:`, err);
            destroyPeer(peerId);
            if (type === 'primary') return createPeerWithoutStream(peerId, isInitiator, incomingSignal); // Attempt fallback on critical primary error
            return null;
        }
    };
    
    const createPeerWithoutStream = (peerId, isInitiator, incomingSignal = null) => {
        return createPeerBase(peerId, isInitiator, incomingSignal, new MediaStream(), 'fallback');
    };

    const createPeer = (peerId, isInitiator, incomingSignal = null) => {
        if (!localStream || !localStream.getTracks || localStream.getTracks().length === 0) {
            return createPeerWithoutStream(peerId, isInitiator, incomingSignal);
        }
        return createPeerBase(peerId, isInitiator, incomingSignal, localStream, 'primary');
    };

    const destroyPeer = (peerId) => {
        if (peerConnectionsRef.current[peerId]) {
            try { peerConnectionsRef.current[peerId].destroy(); } catch (err) { console.error(`Error destroying peer for ${peerId}:`, err); }
            delete peerConnectionsRef.current[peerId];
            if (peerId !== currentUserId) {
                setPlayerStreams(prev => { const newStreams = { ...prev }; delete newStreams[peerId]; return newStreams; });
            }
        }
    };
    
    const retryMediaAccess = async () => {
        const newStream = await setupCamera();
        if (newStream && socketRef.current?.connected) {
             // Re-signal readiness or re-establish peers if necessary
            Object.keys(peerConnectionsRef.current).forEach(peerId => {
                destroyPeer(peerId);
            });
            socketRef.current.emit('webrtc-ready', { roomCode }); // Signal readiness again for others to initiate
        }
    };

    // Game logic socket event handlers
    useEffect(() => {
        if (!socketRef.current) return;
        const handlers = {
            'animal-submitted': ({ animal }) => {
                setCurrentAnimal(animal);
                setExpectedStartLetter(animal[animal.length - 1].toUpperCase());
                setTimeLeft(30);
                localStorage.setItem(`timerEndTime_${roomCode}`, Date.now() + 30000);
                setUsedAnimals(prev => new Set(prev).add(animal.toUpperCase()));
            },
            'player-eliminated': ({ socketId }) => {
                if (gameWinner || players.some(p => p.socketId === socketId && p.isEliminated)) return;
                setPlayers(prev => prev.map(p => p.socketId === socketId ? { ...p, isEliminated: true } : p));
            },
            'game-started': ({ expectedStartLetter, initialAnimal }) => { // Assuming server might send initialAnimal
                setGameStarted(true);
                setExpectedStartLetter(expectedStartLetter);
                setTimeLeft(30);
                localStorage.setItem(`timerEndTime_${roomCode}`, Date.now() + 30000);
                const newUsed = new Set();
                if (initialAnimal) { // If game starts with an animal
                    newUsed.add(initialAnimal.toUpperCase());
                    setCurrentAnimal(initialAnimal);
                } else {
                    setCurrentAnimal(null); // No animal at the very start
                }
                setUsedAnimals(newUsed);
                setGameWinner(null); // Reset winner
                gameOverProcessed.current = false;
            },
            'player-joined': ({ players: newPlayers }) => setPlayers(newPlayers),
            'player-left': ({ players: newPlayers }) => {
                if (gameStarted) {
                    playerLeftDuringGame.current = true;
                    setTimeout(() => { setPlayers(newPlayers); playerLeftDuringGame.current = false; }, 100);
                } else setPlayers(newPlayers);
            },
            'turn-changed': ({ currentTurnIndex: newIndex }) => {
                setCurrentPlayerIndex(newIndex);
                setTimeLeft(30);
                localStorage.setItem(`timerEndTime_${roomCode}`, Date.now() + 30000);
            },
            'game-over': ({ winner }) => {
                if (!winner || !winner.socketId || gameOverProcessed.current) return;
                gameOverProcessed.current = true;
                eliminationInProgress.current = true; // Prevent further eliminations
                const safeWinner = { socketId: winner.socketId, username: winner.username || "Player", isHost: !!winner.isHost };
                setTimeout(() => setGameWinner(safeWinner), 300);
                localStorage.removeItem(`timerEndTime_${roomCode}`);
            }
        };

        Object.entries(handlers).forEach(([event, handler]) => socketRef.current.on(event, handler));
        return () => {
            if (socketRef.current) {
                Object.keys(handlers).forEach(event => socketRef.current.off(event));
            }
        };
    }, [players.length, gameWinner, roomCode]); // roomCode for localStorage key

    const toggleVideo = () => { if (localStream) try { localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled); setVideoEnabled(prev => !prev); } catch (e) { console.error('Toggle video error:', e); } };
    const toggleAudio = () => { if (localStream) try { localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled); setAudioEnabled(prev => !prev); } catch (e) { console.error('Toggle audio error:', e); } };
    
    const handleStartGame = async () => { try { await axios.post(`${import.meta.env.VITE_API_URL}/api/rooms/${roomCode}/start`); } catch (e) { setError(e.response?.data?.message || 'Failed to start game'); setTimeout(() => setError(''), 3000); } };

    // Timer countdown and auto-elimination logic
    useEffect(() => {
        if (gameWinner || !gameStarted) { // If game over or not started, clear interval and do nothing
            return;
        }

        if (timeLeft <= 0) {
            if (!gameWinner && isCurrentUser && currentPlayer && !isPlayerEliminated(currentPlayer) && !eliminationInProgress.current && socketRef.current?.connected) {
                eliminationInProgress.current = true;
                socketRef.current.emit('player-eliminated', { roomCode, socketId: currentPlayer.socketId });
                // Timer for this turn is up, no need to keep its localStorage key
                // localStorage.removeItem(`timerEndTime_${roomCode}`); // Or let new turn overwrite it
            }
            return; // Stop interval if time is up
        }

        const intervalId = setInterval(() => {
            const endTimeString = localStorage.getItem(`timerEndTime_${roomCode}`);
            if (endTimeString) {
                const endTime = parseInt(endTimeString);
                if (!isNaN(endTime)) {
                    const newTime = Math.max(0, Math.round((endTime - Date.now()) / 1000));
                    setTimeLeft(newTime);
                } else {
                    // Fallback if endTime is invalid, decrement locally (less accurate)
                    setTimeLeft(prev => Math.max(0, prev - 1));
                }
            } else {
                // If no endTime, might be start of game/turn before localStorage is set by event
                // Or if it was cleared unexpectedly. For safety, decrement locally.
                // This path should ideally not be hit frequently if events set localStorage correctly.
                setTimeLeft(prev => Math.max(0, prev - 1));
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [timeLeft, gameWinner, gameStarted, isCurrentUser, roomCode, currentPlayer, players, eliminationInProgress]);


    useEffect(() => { eliminationInProgress.current = false; }, [currentPlayerIndex]);

    const handleLeaveRoom = async () => {
        try {
            if (socketRef.current?.connected) {
                socketRef.current.emit('leave-room', { roomCode, persistentUserId: localStorage.getItem('persistentUserId') });
            }
            await axios.post(`${import.meta.env.VITE_API_URL}/api/rooms/${roomCode}/leave`, { socketId: currentUserId });
        } catch (e) {
            console.error('Leave room error:', e);
        } finally {
            localStorage.removeItem(`timerEndTime_${roomCode}`); // Clean up timer on leave
            navigate('/lobby');
        }
    };

    const handleAnimalSubmit = async () => {
        if (!inputAnimal || gameWinner || !isCurrentUser || isPlayerEliminated(currentPlayer)) return;

        const trimmedAnimal = inputAnimal.trim();
        if (!trimmedAnimal) {
            setError("Animal name cannot be empty.");
            setTimeout(() => setError(''), 3000);
            return;
        }
        const submittedAnimalUpper = trimmedAnimal.toUpperCase();

        if (usedAnimals.has(submittedAnimalUpper)) {
            setError("This animal has already been used in this round.");
            setTimeout(() => setError(''), 3000);
            return;
        }

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/animals/check`, {
                animal: trimmedAnimal,
                requiredStartLetter: expectedStartLetter.toLowerCase()
            });
            if (res.data.valid) {
                if (socketRef.current?.connected) {
                    socketRef.current.emit('submit-animal', { roomCode, animal: trimmedAnimal });
                }
                setInputAnimal('');
                setError('');
                // usedAnimals will be updated via the 'animal-submitted' socket event
            } else {
                setError(res.data.message);
                setTimeout(() => setError(''), 3000);
            }
        } catch (e) {
            setError('Failed to check animal. Try again.');
            setTimeout(() => setError(''), 3000);
        }
    };
    
    const getNextActivePlayerIndex = (currentIndex, playersList) => { if (!playersList || playersList.length === 0) return 0; let nextI = (currentIndex + 1) % playersList.length; let count = 0; while (playersList[nextI]?.isEliminated && count < playersList.length) { nextI = (nextI + 1) % playersList.length; count++; } return nextI; };
    const getNextPlayerForDisplay = () => { if (gameWinner) return null; const nextI = getNextActivePlayerIndex(currentPlayerIndex, players); return players[nextI]; };
    const nextPlayer = getNextPlayerForDisplay();
    const uniquePlayers = players.filter((player, index, self) => index === self.findIndex((p) => p.socketId === player.socketId));

    return (
        <main className="h-screen w-screen bg-gradient-to-b from-green-50 to-green-100 p-2 sm:p-3 flex flex-col overflow-hidden">
            {gameWinner && <GameOverScreen winner={gameWinner} onLeave={handleLeaveRoom} />}
            {!webRTCSupported && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-3">
                    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 max-w-xs sm:max-w-sm text-xs sm:text-sm">
                        <h2 className="text-lg sm:text-xl font-bold text-red-600 mb-2 sm:mb-3">WebRTC Not Supported</h2>
                        <p className="text-gray-800 mb-3 sm:mb-4">WebRTC is required for video. Please use a modern browser.</p>
                        <button onClick={handleLeaveRoom} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm">Return to Lobby</button>
                    </div>
                </div>
            )}
            
            {/* Header Controls */}
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2 sm:mb-3 flex-shrink-0">
                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={toggleVideo} className={`p-1.5 sm:p-2 rounded-full ${videoEnabled ? 'bg-green-500' : 'bg-red-500'} text-white`} title={videoEnabled ? "Cam Off" : "Cam On"}>
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{videoEnabled ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"></path>}</svg>
                    </button>
                    <button onClick={toggleAudio} className={`p-1.5 sm:p-2 rounded-full ${audioEnabled ? 'bg-green-500' : 'bg-red-500'} text-white`} title={audioEnabled ? "Mute" : "Unmute"}>
                         <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{audioEnabled ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path>}</svg>
                    </button>
                    {!isCameraActive && (
                        <button onClick={retryMediaAccess} className="bg-yellow-500 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded text-xs sm:text-sm font-semibold">Retry Cam</button>
                    )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-sm text-xs sm:text-sm">
                        <span className="text-gray-500 mr-1">Code:</span><span className="font-bold">{roomCode}</span>
                    </div>
                    <button onClick={handleLeaveRoom} className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-sm transition-colors text-xs sm:text-sm">Leave</button>
                </div>
            </div>
            
            {/* Scrollable Content Area */}
            <div className="flex-grow overflow-y-auto pb-3">
                {gameStarted && !gameWinner && ( // Show timer only if game started and no winner
                    <div className="text-center my-2 sm:my-3">
                        <div className="inline-block bg-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-md">
                            <span className="text-lg sm:text-xl font-bold text-green-700">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
                        </div>
                    </div>
                )}

                <section className="max-w-md sm:max-w-lg mx-auto bg-white rounded-xl shadow-lg p-3 sm:p-4 mb-3 sm:mb-4">
                    {!gameStarted && (
                        <div className="text-center mb-3 sm:mb-4">
                            <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 mb-2 sm:mb-3">Waiting for game...</h2>
                            {uniquePlayers.some(p => p.isHost && p.socketId === currentUserId) ? (
                                <button onClick={handleStartGame} disabled={uniquePlayers.length < 2} className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-md transition-colors text-xs sm:text-sm ${uniquePlayers.length < 2 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}>
                                    {uniquePlayers.length < 2 ? 'Need 2+ players' : 'Start Game'}
                                </button>
                            ) : <p className="text-gray-600 text-xs sm:text-sm">Waiting for host...</p>}
                        </div>
                    )}
                    {gameStarted && (
                        <>
                            <div className="text-center mb-3 sm:mb-4">
                                <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 mb-1 sm:mb-1.5">Current Word</h2>
                                <div className="bg-green-100 p-2 sm:p-3 rounded-lg">
                                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-800 break-all">{currentAnimal || (expectedStartLetter ? `Start with "${expectedStartLetter}"` : "...")}</p>
                                </div>
                            </div>
                            <div className="mt-2 sm:mt-3 text-center">
                                {expectedStartLetter && <p className="text-xs sm:text-sm mb-1 text-gray-700">Animal starting with <strong className="text-green-600">{expectedStartLetter.toUpperCase()}</strong>:</p>}
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2">
                                    <input type="text" value={inputAnimal} onChange={(e) => setInputAnimal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAnimalSubmit(); }}} className="border px-2 py-1.5 sm:px-3 rounded-md w-full sm:w-auto sm:flex-grow text-xs sm:text-sm" placeholder="Type animal" disabled={isInputDisabled} />
                                    <button onClick={handleAnimalSubmit} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md disabled:bg-gray-300 w-full sm:w-auto text-xs sm:text-sm" disabled={isInputDisabled}>Submit</button>
                                </div>
                                {error && <p className="mt-1 text-red-600 text-xs sm:text-sm">{error}</p>}
                            </div>
                            {currentPlayer && (
                                <div className="border-t border-gray-200 pt-2 sm:pt-3 mt-2 sm:mt-3">
                                    <p className="text-center text-xs sm:text-sm mb-1">Current Turn:</p>
                                    <div className="bg-green-100 p-2 sm:p-3 rounded-lg text-center">
                                        <p className="text-base sm:text-lg md:text-xl font-bold text-green-800 break-all">{currentPlayer?.username || '...'}</p>
                                    </div>
                                </div>
                            )}
                            {nextPlayer && nextPlayer.socketId !== currentPlayer?.socketId && (
                                <div className="border-t border-gray-200 pt-2 sm:pt-3 mt-2 sm:mt-3">
                                    <p className="text-center text-xs sm:text-sm mb-1">Next Turn:</p>
                                    <div className="bg-green-50 p-1.5 sm:p-2 rounded-lg text-center">
                                        <p className="text-sm sm:text-base md:text-lg font-medium text-green-700 break-all">{nextPlayer.username}</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>

                <section className="max-w-5xl mx-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                        {uniquePlayers.map((player, index) => (
                            <div key={`${player.socketId || 'player'}-${index}`} className="flex flex-col items-center">
                                <div className={`w-full aspect-[4/3] rounded-md shadow-sm relative overflow-hidden ${player.isEliminated ? 'bg-red-200 opacity-60' : 'bg-gray-200'} ${players[currentPlayerIndex]?.socketId === player.socketId && !player.isEliminated ? 'border-2 sm:border-3 border-green-500' : ''}`}>
                                    {playerStreams[player.socketId] ? (
                                        <VideoStream stream={playerStreams[player.socketId]} muted={player.socketId === currentUserId} isEliminated={player.isEliminated} />
                                    ) : (
                                        <div className="h-full flex items-center justify-center p-1">
                                            {player.isEliminated ? (
                                                <div className="text-center"><svg className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 mx-auto mb-0.5 sm:mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg><p className="text-red-600 font-medium text-[10px] sm:text-xs">Eliminated</p></div>
                                            ) : (
                                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-1 bg-white px-1.5 py-0.5 sm:px-2 rounded-md shadow-xs text-center">
                                    <p className={`font-medium text-[10px] sm:text-xs truncate max-w-[70px] xs:max-w-[100px] sm:max-w-[120px] ${player.isEliminated ? 'text-red-500 line-through' : players[currentPlayerIndex]?.socketId === player.socketId ? 'text-green-600' : 'text-gray-700'}`}>
                                        {player.username || 'Player'}{player.socketId === currentUserId && ' (You)'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
};

export default Room;