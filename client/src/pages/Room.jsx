import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import VideoStream from '../components/VideoStream';

// Minimal ICE servers config - less is often more reliable
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }, // Added another Google STUN as a fallback
    { 
      urls: 'turn:openrelay.metered.ca:443?transport=tcp', // Try port 443 with TCP
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    { 
      urls: 'turn:openrelay.metered.ca:3478', // Try standard TURN port
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

// Separate GameOverScreen component
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
    
    // Status indicators (still tracked internally but not shown on UI)
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('Not connected');
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

    // Check WebRTC support on component mount
    useEffect(() => {
        if (!window.RTCPeerConnection) {
            setWebRTCSupported(false);
            setWebRTCError('WebRTC is not supported in this browser');
        }
    }, []);

    // Helper function to safely check player elimination status
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

    // REVISED MEDIA HANDLING: Simpler, more reliable approach with better self-view
    const setupCamera = async () => {
        try {
            console.log("Setting up camera...");
            
            // Close any existing stream first
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            
            // Create an empty stream as fallback
            const emptyStream = new MediaStream();
            
            // Try to get camera and microphone
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: true 
                });
                console.log("Got camera and microphone access");
                setIsCameraActive(true);
            } catch (err) {
                console.warn("Could not access camera+mic:", err.message);
                
                try {
                    // Try audio only as fallback
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        video: false, 
                        audio: true 
                    });
                    console.log("Got audio only");
                    setIsCameraActive(false);
                } catch (err2) {
                    console.warn("Could not access audio:", err2.message);
                    stream = emptyStream;
                    setIsCameraActive(false);
                }
            }
            
            // Set the stream
            setLocalStream(stream);
            
            // IMPORTANT: Always add the stream to playerStreams for self-view
            if (currentUserId) {
                setPlayerStreams(prev => ({
                    ...prev,
                    [currentUserId]: stream
                }));
            }
            
            return stream;
        } catch (err) {
            console.error("Setup camera error:", err);
            return new MediaStream(); // Return empty stream as fallback
        }
    };

    // Initialize Socket.IO connection and join room
    useEffect(() => {
        if (isConnecting.current) return;
        isConnecting.current = true;
        
        console.log("Setting up socket connection to room:", roomCode);
        
        // Generate a persistent user ID if one doesn't exist
        if (!localStorage.getItem('persistentUserId')) {
            localStorage.setItem('persistentUserId', `user_${Math.random().toString(36).substr(2, 9)}`);
        }
        const persistentUserId = localStorage.getItem('persistentUserId');
        
        // Create socket connection
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
                
                // Check if there's already a winner
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
        socketRef.current.on('connect', async () => {
            console.log('Socket connected:', socketRef.current.id);
            setCurrentUserId(socketRef.current.id);
            
            // Join room
            socketRef.current.emit('join-room', {
                roomCode,
                persistentUserId
            });
            
            // Fetch initial room data after a delay
            setTimeout(fetchRoomData, 800);
            
            // Setup camera after socket is connected
            await setupCamera();
            
            // Signal ready for WebRTC connections
            setTimeout(() => {
                if (socketRef.current && socketRef.current.connected) {
                    socketRef.current.emit('webrtc-ready', { roomCode });
                }
            }, 2000);
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
                try {
                    localStream.getTracks().forEach(track => track.stop());
                } catch (err) {
                    console.error('Error stopping tracks:', err);
                }
            }
            
            // Close all peer connections
            Object.values(peerConnectionsRef.current).forEach(pc => {
                if (pc) {
                    try {
                        pc.destroy();
                    } catch (err) {
                        console.error('Error destroying peer:', err);
                    }
                }
            });
            
            // Clear peer references
            peerConnectionsRef.current = {};
            
            if (socketRef.current) {
                socketRef.current.off();
                if (socketRef.current.connected) {
                    try {
                        socketRef.current.emit('leave-room', {
                            roomCode,
                            persistentUserId: localStorage.getItem('persistentUserId')
                        });
                        socketRef.current.disconnect();
                    } catch (err) {
                        console.error('Error during socket disconnect:', err);
                    }
                }
                socketRef.current = null;
            }
        };
    }, [roomCode]);

    // WebRTC signaling with simplified approach
    useEffect(() => {
        if (!socketRef.current || !webRTCSupported || !currentUserId) return;
        
        console.log('Setting up WebRTC handlers');
        
        // When another user is ready to connect
        socketRef.current.on('webrtc-ready', ({ socketId: remoteSocketId }) => {
            if (remoteSocketId === currentUserId) return; // Don't connect to yourself
            
            // Determine initiator based on lexicographical comparison of socket IDs.
            // This ensures only one peer initiates, preventing race conditions.
            const amInitiator = currentUserId > remoteSocketId; 

            console.log(`User ${remoteSocketId} is ready. Current user ${currentUserId}. Am I initiator? ${amInitiator}`);

            if (amInitiator) {
                console.log(`I (${currentUserId}) will initiate connection to ${remoteSocketId}`);
                const attemptPeerCreation = () => {
                    // createPeer will internally decide to use localStream or fallback.
                    setTimeout(() => createPeer(remoteSocketId, true, null), 500); // true: I am the initiator
                };

                if (localStream && localStream.getTracks && localStream.getTracks().length > 0) {
                    attemptPeerCreation();
                } else {
                    console.warn(`Local stream not ready for WebRTC with ${remoteSocketId}, attempting to set up camera first...`);
                    setupCamera().then(newStream => {
                        console.log(`Camera setup finished for WebRTC ready with ${remoteSocketId}. New stream has tracks: ${!!(newStream && newStream.getTracks && newStream.getTracks().length > 0)}`);
                        attemptPeerCreation();
                    }).catch(err => {
                        console.error(`Error setting up camera during WebRTC ready for ${remoteSocketId}, proceeding with peer creation (will likely use fallback):`, err);
                        attemptPeerCreation();
                    });
                }
            } else {
                console.log(`I (${currentUserId}) will wait for ${remoteSocketId} to initiate.`);
                // The other peer (remoteSocketId) will initiate.
                // Our 'webrtc-signal' handler will create the peer when their offer arrives.
            }
        });
        
        // When receiving a WebRTC signal
        socketRef.current.on('webrtc-signal', ({ from, signal }) => {
            console.log(`Received signal from ${from}`);
            const existingPeer = peerConnectionsRef.current[from];
            
            if (existingPeer) {
                try {
                    existingPeer.signal(signal);
                } catch (err) {
                    console.error(`Error signaling existing peer ${from}:`, err.message);
                    // If signaling fails, the peer might be in a bad state. Recreate it.
                    destroyPeer(from); 
                    createPeer(from, false, signal); // false for initiator as this is a response
                }
            } 
            // Otherwise, create a new peer as the receiver
            else {
                // If no peer exists, and we are receiving a signal, we are the receiver.
                createPeer(from, false, signal); // false for initiator
            }
        });
        
        // When a user leaves
        socketRef.current.on('webrtc-user-left', ({ socketId }) => {
            console.log(`User ${socketId} left`);
            destroyPeer(socketId);
        });
        
        return () => {
            if (socketRef.current) {
                socketRef.current.off('webrtc-ready');
                socketRef.current.off('webrtc-signal');
                socketRef.current.off('webrtc-user-left');
            }
        };
    }, [webRTCSupported, currentUserId, localStream, roomCode]); // localStream dependency is important, roomCode for createPeer

    // Fallback function to create a peer, ensuring a MediaStream object is always passed
    const createPeerWithoutStream = (peerId, isInitiator, incomingSignal = null) => {
        try {
            console.log(`Creating ${isInitiator ? 'initiator' : 'receiver'} peer (FALLBACK, ensuring stream object) for ${peerId}`);
            
            destroyPeer(peerId);
            
            let streamForPeer;
            if (localStream && localStream.getTracks && localStream.getTracks().length > 0) {
                streamForPeer = localStream;
                console.log(`Using existing localStream for peer ${peerId} in fallback.`);
            } else {
                streamForPeer = new MediaStream(); // Pass an empty stream object
                console.log(`Using new empty MediaStream for peer ${peerId} in fallback (localStream not valid or no tracks).`);
            }
            
            const peer = new Peer({
                initiator: isInitiator,
                trickle: true,
                config: ICE_SERVERS,
                stream: streamForPeer // Always pass a MediaStream object
            });
            
            peer.on('signal', data => {
                console.log(`Sending signal (fallback) to ${peerId}`);
                try {
                    if (socketRef.current && socketRef.current.connected) {
                        socketRef.current.emit('webrtc-signal', {
                            to: peerId,
                            from: currentUserId,
                            signal: data,
                            roomCode
                        });
                    }
                } catch (err) {
                    console.error('Error sending signal (fallback):', err);
                }
            });
            
            peer.on('connect', () => {
                console.log(`Connected (fallback) to ${peerId}`);
                setConnectionStatus(`Connected to ${peerId}`);
                // If connected with an empty stream, and localStream is now valid, try adding tracks.
                if (streamForPeer !== localStream && localStream && localStream.getTracks && localStream.getTracks().length > 0) {
                    console.log(`Attempting to add tracks to existing peer ${peerId} after fallback connection.`);
                    try {
                        localStream.getTracks().forEach(track => {
                            if (peer.addTrack && typeof peer.addTrack === 'function') {
                                peer.addTrack(track, localStream);
                            } else {
                                console.warn(`peer.addTrack is not available on fallback peer ${peerId}`);
                            }
                        });
                    } catch (err) {
                        console.warn(`Could not add tracks to fallback peer ${peerId} after connect:`, err.message);
                    }
                }
            });
            
            peer.on('stream', remoteStream => {
                console.log(`Received stream (fallback) from ${peerId}`);
                setPlayerStreams(prev => ({ ...prev, [peerId]: remoteStream }));
            });
            
            peer.on('track', (track, remoteStream) => {
                console.log(`Received track (fallback) from ${peerId}`);
                setPlayerStreams(prev => ({ ...prev, [peerId]: remoteStream }));
            });
            
            peer.on('error', err => {
                console.error(`Peer error (fallback) with ${peerId}:`, err.message);
                if (err.message.includes('cannot signal after peer is destroyed')) {
                    console.warn(`Fallback peer ${peerId} was already destroyed. Not attempting recreation.`);
                    destroyPeer(peerId);
                    return;
                }
                setTimeout(() => {
                    destroyPeer(peerId);
                    if (socketRef.current && socketRef.current.connected) {
                        socketRef.current.emit('webrtc-ready', { roomCode });
                    }
                }, 5000 + Math.random() * 1000);
            });
            
            peer.on('close', () => {
                console.log(`Connection closed (fallback) with ${peerId}`);
                destroyPeer(peerId);
            });
            
            if (!isInitiator && incomingSignal) {
                try {
                    peer.signal(incomingSignal);
                } catch (err) {
                    console.error(`Error processing incoming signal (fallback) for ${peerId}:`, err);
                }
            }
            
            peerConnectionsRef.current[peerId] = peer;
            return peer;
        } catch (err) {
            console.error(`Critical error creating peer (fallback) for ${peerId}:`, err);
            destroyPeer(peerId); 
            return null;
        }
    };

    // Helper function to create a peer connection WITH stream (primary method)
    const createPeer = (peerId, isInitiator, incomingSignal = null) => {
        try {
            console.log(`Creating ${isInitiator ? 'initiator' : 'receiver'} peer (PRIMARY) for ${peerId}`);
            
            destroyPeer(peerId); // Ensure any old peer is gone
            
            if (!localStream || !localStream.getTracks || localStream.getTracks().length === 0) {
                console.warn(`Local stream not valid or no tracks for PRIMARY peer ${peerId}. Falling back to createPeerWithoutStream.`);
                return createPeerWithoutStream(peerId, isInitiator, incomingSignal);
            }
            
            let peer;
            try {
                peer = new Peer({
                    initiator: isInitiator,
                    trickle: true,
                    config: ICE_SERVERS,
                    stream: localStream // Use the valid localStream
                });
            } catch (err) {
                console.error(`Error instantiating Peer (primary) for ${peerId}:`, err.message);
                console.log("Falling back to createPeerWithoutStream due to primary instantiation error.");
                return createPeerWithoutStream(peerId, isInitiator, incomingSignal);
            }
            
            peer.on('signal', data => {
                console.log(`Sending signal (primary) to ${peerId}`);
                try {
                    if (socketRef.current && socketRef.current.connected) {
                        socketRef.current.emit('webrtc-signal', {
                            to: peerId,
                            from: currentUserId,
                            signal: data,
                            roomCode
                        });
                    }
                } catch (err) {
                    console.error('Error sending signal (primary):', err);
                }
            });
            
            peer.on('connect', () => {
                console.log(`Connected (primary) to ${peerId}`);
                setConnectionStatus(`Connected to ${peerId}`);
            });
            
            peer.on('stream', remoteStream => {
                console.log(`Received stream (primary) from ${peerId}`);
                setPlayerStreams(prev => ({ ...prev, [peerId]: remoteStream }));
            });
            
            peer.on('track', (track, remoteStream) => {
                console.log(`Received track (primary) from ${peerId}`);
                setPlayerStreams(prev => ({ ...prev, [peerId]: remoteStream }));
            });
            
            peer.on('error', err => {
                console.error(`Peer error (primary) with ${peerId}:`, err.message);
                if (err.message.includes('cannot signal after peer is destroyed')) {
                    console.warn(`Primary peer ${peerId} was already destroyed. Not attempting recreation.`);
                    destroyPeer(peerId);
                    return;
                }

                if (err.message.includes('Stream') || err.message.includes('track') || err.message.includes('getUserMedia')) {
                    console.log(`Primary peer for ${peerId} failed with stream-related error, attempting fallback.`);
                    destroyPeer(peerId);
                    return createPeerWithoutStream(peerId, isInitiator, incomingSignal);
                }
                
                setTimeout(() => {
                    destroyPeer(peerId);
                    if (socketRef.current && socketRef.current.connected) {
                        socketRef.current.emit('webrtc-ready', { roomCode });
                    }
                }, 5000 + Math.random() * 1000);
            });
            
            peer.on('close', () => {
                console.log(`Connection closed (primary) with ${peerId}`);
                destroyPeer(peerId);
            });
            
            if (!isInitiator && incomingSignal) {
                try {
                    peer.signal(incomingSignal);
                } catch (err) {
                    console.error(`Error processing incoming signal (primary) for ${peerId}:`, err);
                    console.log(`Signaling error for primary peer ${peerId}, attempting fallback recreation.`);
                    destroyPeer(peerId);
                    return createPeerWithoutStream(peerId, false, incomingSignal); 
                }
            }
            
            peerConnectionsRef.current[peerId] = peer;
            return peer;

        } catch (err) {
            console.error(`Critical error creating peer (primary) for ${peerId}:`, err);
            return createPeerWithoutStream(peerId, isInitiator, incomingSignal);
        }
    };

    // Helper function to destroy a peer connection
    const destroyPeer = (peerId) => {
        if (peerConnectionsRef.current[peerId]) {
            try {
                peerConnectionsRef.current[peerId].destroy();
            } catch (err) {
                console.error(`Error destroying peer for ${peerId}:`, err);
            }
            
            delete peerConnectionsRef.current[peerId];
            
            // Remove the stream - but don't remove your own stream
            if (peerId !== currentUserId) {
                setPlayerStreams(prev => {
                    const newStreams = { ...prev };
                    delete newStreams[peerId];
                    return newStreams;
                });
            }
        }
    };

    // Function to retry camera access
    const retryMediaAccess = async () => {
        const stream = await setupCamera();
        
        // Signal ready for WebRTC connections
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('webrtc-ready', { roomCode });
        }
    };

    // Regular game event handlers
    useEffect(() => {
        if (!socketRef.current) return;
        
        // Remove existing listeners
        socketRef.current.off('animal-submitted');
        socketRef.current.off('player-eliminated');
        socketRef.current.off('game-started');
        socketRef.current.off('player-joined');
        socketRef.current.off('player-left');
        socketRef.current.off('turn-changed');
        socketRef.current.off('game-over');
        
        // Set up fresh listeners
        socketRef.current.on('animal-submitted', ({ animal }) => {
            console.log("Animal submitted:", animal);
            setCurrentAnimal(animal);
            const lastLetter = animal[animal.length - 1].toUpperCase();
            setExpectedStartLetter(lastLetter);
            setTimeLeft(30);
        });
        
        socketRef.current.on('player-eliminated', ({ socketId }) => {
            console.log("Player eliminated:", socketId);
            
            if (gameWinner) {
                console.log("Ignoring elimination - game already has a winner");
                return;
            }
            
            const alreadyEliminated = players.some(p => p.socketId === socketId && p.isEliminated);
            if (alreadyEliminated) {
                console.log("Player already eliminated, ignoring event");
                return;
            }
            
            setPlayers(prevPlayers => 
                prevPlayers.map(player => 
                    player.socketId === socketId 
                        ? { ...player, isEliminated: true } 
                        : player
                )
            );
        });
        
        socketRef.current.on('game-started', ({ expectedStartLetter }) => {
            console.log("Game started with letter:", expectedStartLetter);
            setGameStarted(true);
            setExpectedStartLetter(expectedStartLetter);
        });
        
        socketRef.current.on('player-joined', ({ players }) => {
            console.log("Player joined, players:", players.length);
            setPlayers(players);
        });
        
        socketRef.current.on('player-left', ({ players }) => {
            console.log("Player left, players:", players.length);
            
            if (gameStarted) {
                playerLeftDuringGame.current = true;
                setTimeout(() => {
                    setPlayers(players);
                    playerLeftDuringGame.current = false;
                }, 100);
            } else {
                setPlayers(players);
            }
        });
        
        socketRef.current.on('turn-changed', ({ currentTurnIndex }) => {
            console.log("Turn changed to:", currentTurnIndex);
            setCurrentPlayerIndex(currentTurnIndex);
            setTimeLeft(30);
        });
        
        socketRef.current.on('game-over', ({ winner }) => {
            console.log("Game over, winner:", winner);
            
            if (!winner || !winner.socketId) {
                console.error("Invalid winner data:", winner);
                return;
            }
            
            if (gameOverProcessed.current) {
                console.log("Game over already processed");
                return;
            }
            
            gameOverProcessed.current = true;
            eliminationInProgress.current = true;
            
            const safeWinner = {
                socketId: winner.socketId,
                username: winner.username || "Unknown Player",
                isHost: !!winner.isHost
            };
            
            setTimeout(() => {
                setGameWinner(safeWinner);
            }, 300);
        });
        
        return () => {
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
    }, [players.length, gameWinner]);

    // Toggle video
    const toggleVideo = () => {
        if (localStream) {
            try {
                localStream.getVideoTracks().forEach(track => {
                    track.enabled = !track.enabled;
                });
                setVideoEnabled(!videoEnabled);
            } catch (err) {
                console.error('Error toggling video:', err);
            }
        }
    };

    // Toggle audio
    const toggleAudio = () => {
        if (localStream) {
            try {
                localStream.getAudioTracks().forEach(track => {
                    track.enabled = !track.enabled;
                });
                setAudioEnabled(!audioEnabled);
            } catch (err) {
                console.error('Error toggling audio:', err);
            }
        }
    };

    // Handle finding the next player
    const getNextActivePlayerIndex = (currentIndex, playersList) => {
        if (!playersList || playersList.length === 0) return 0;

        let nextIndex = (currentIndex + 1) % playersList.length;
        
        let safetyCounter = 0;
        while (playersList[nextIndex]?.isEliminated && safetyCounter < playersList.length) {
            nextIndex = (nextIndex + 1) % playersList.length;
            safetyCounter++;
        }
        
        return nextIndex;
    };

    // Handle starting the game
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
            
            setTimeout(() => setError(''), 3000);
        }
    };

    // Timer and player elimination
    useEffect(() => {
        if (gameWinner || !gameStarted || timeLeft <= 0) {
            if (timeLeft <= 0 && !gameWinner && isCurrentUser && currentPlayer && !isPlayerEliminated(currentPlayer)) {
                if (!eliminationInProgress.current && socketRef.current && socketRef.current.connected) {
                    eliminationInProgress.current = true;
                    console.log("Eliminating player:", currentPlayer.socketId);
                    
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

    // Reset elimination flag on turn change
    useEffect(() => {
        eliminationInProgress.current = false;
    }, [currentPlayerIndex]);

    // Handle leaving the room
    const handleLeaveRoom = async () => {
        try {
            if (socketRef.current && socketRef.current.connected) {
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
            navigate('/lobby');
        }
    };

    // Handle animal submission
    const handleAnimalSubmit = async () => {
        if (!inputAnimal || gameWinner || !isCurrentUser) return;

        try {
            const checkResponse = await axios.post(`${import.meta.env.VITE_API_URL}/api/animals/check`, {
                animal: inputAnimal,
                requiredStartLetter: expectedStartLetter.toLowerCase(),
            });

            if (checkResponse.data.valid) {
                const newAnimal = inputAnimal.trim();
                
                if (socketRef.current && socketRef.current.connected) {
                    socketRef.current.emit('submit-animal', {
                        roomCode,
                        animal: newAnimal
                    });
                }

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

    // Filter out duplicate players
    const uniquePlayers = players.filter((player, index, self) =>
      index === self.findIndex((p) => (
        p.socketId === player.socketId
      ))
    );

    return (
        <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4 relative">
            {/* Game over screen */}
            {gameWinner && <GameOverScreen winner={gameWinner} onLeave={handleLeaveRoom} />}
            
            {/* WebRTC not supported warning */}
            {!webRTCSupported && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
                        <h2 className="text-2xl font-bold text-red-600 mb-4">WebRTC Not Supported</h2>
                        <p className="text-gray-800 mb-6">
                            Your browser doesn't support WebRTC, which is required for video chat. 
                            Please use a modern browser like Chrome, Firefox, or Edge.
                        </p>
                        <button
                            onClick={handleLeaveRoom}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
                        >
                            Return to Lobby
                        </button>
                    </div>
                </div>
            )}
            
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
            
            {/* Camera retry button - shown only when camera access is denied */}
            {!isCameraActive && (
                <div className="absolute top-16 left-4 bg-red-800 text-white px-3 py-2 rounded-lg z-10">
                    <button 
                        onClick={retryMediaAccess}
                        className="bg-white text-red-800 px-3 py-1 rounded text-sm font-bold"
                    >
                        Retry Camera
                    </button>
                </div>
            )}

            {/* Timer */}
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
                {/* Waiting for game to start */}
                {!gameStarted && (
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-800 mb-4">Waiting for game to start</h2>
                        
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

                {/* Game in progress */}
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

            {/* Player videos */}
            <section className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {uniquePlayers.map((player, index) => (
                        <div key={`${player.socketId || 'unknown'}-${index}`} className="flex flex-col items-center">
                            <div className={`w-full aspect-video rounded-lg shadow-md relative overflow-hidden ${
                                player.isEliminated ? 'bg-red-200' : 'bg-gray-200'
                            } ${
                                index === currentPlayerIndex && !player.isEliminated ? 'border-4 border-green-500' : ''
                            }`}>
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
                                    {player.socketId === currentUserId && ' (You)'}
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