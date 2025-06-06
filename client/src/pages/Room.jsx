import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const Room = () => {
    const navigate = useNavigate();
    const { roomCode } = useParams();

    const [currentAnimal, setCurrentAnimal] = useState(null);
    const [expectedStartLetter, setExpectedStartLetter] = useState(
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
    );
    const [inputAnimal, setInputAnimal] = useState('');
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(5);
    const [gameWinner, setGameWinner] = useState(null);

    const [players, setPlayers] = useState([
        { id: 1, name: 'Player 1', eliminated: false },
        { id: 2, name: 'Player 2', eliminated: false },
        { id: 3, name: 'Player 3', eliminated: false },
        { id: 4, name: 'Player 4', eliminated: false },
      ]);
      
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const currentPlayer = players[currentPlayerIndex];
    const isCurrentUser = currentPlayer?.id === 1;

    const isInputDisabled = !isCurrentUser || currentPlayer?.eliminated || gameWinner;

    const getNextActivePlayerIndex = (currentIndex, playersList) => {
        const activePlayers = playersList.filter(p => !p.eliminated);
        
        // check for winner (game over)
        if (activePlayers.length <= 1) {
            if (activePlayers.length === 1) {
                setGameWinner(activePlayers[0]);
            }
            return currentIndex; // current player is winner (will check if index === currentIndex to determine winner)
        }

        let nextIndex = (currentIndex + 1) % playersList.length;
        
        // get next non-eliminted player
        while (playersList[nextIndex].eliminated) {
            nextIndex = (nextIndex + 1) % playersList.length;
        }
        
        return nextIndex;
    };

    useEffect(() => {
        if (gameWinner || timeLeft <= 0) {
            if (timeLeft <= 0 && !gameWinner) {
                // eliminate player
                setPlayers(prevPlayers => {
                    const newPlayers = [...prevPlayers];
                    newPlayers[currentPlayerIndex].eliminated = true;
                    
                    // check for winner
                    const remainingPlayers = newPlayers.filter(p => !p.eliminated);
                    if (remainingPlayers.length <= 1) {
                        if (remainingPlayers.length === 1) {
                            setGameWinner(remainingPlayers[0]);
                        }
                        return newPlayers;
                    }
                    
                    return newPlayers;
                });
                
                // move to next active player
                setCurrentPlayerIndex(prevIndex => getNextActivePlayerIndex(prevIndex, players));
                setTimeLeft(5);
                setInputAnimal(''); 
                setError('');
                setCurrentAnimal(null);
            }
            return;
        }
    
        const timer = setInterval(() => {
            setTimeLeft((prevTime) => prevTime - 1);
        }, 1000);
    
        return () => clearInterval(timer);
    }, [timeLeft, gameWinner, currentPlayerIndex, players]);

    useEffect(() => {
        if (players[currentPlayerIndex]?.eliminated && !gameWinner) {
            const nextIndex = getNextActivePlayerIndex(currentPlayerIndex, players);
            if (nextIndex !== currentPlayerIndex) {
                setCurrentPlayerIndex(nextIndex);
            }
        }
    }, [players, currentPlayerIndex, gameWinner]);

    const handleLeaveRoom = () => {
        navigate('/lobby');
    };

    const handleAnimalSubmit = async () => {
        if (!inputAnimal || gameWinner) return;

        try {
            const res = await axios.post('http://localhost:3000/api/animals/check', {
                animal: inputAnimal,
                requiredStartLetter: expectedStartLetter.toLowerCase(),
            });

            if (res.data.valid) {
                const newAnimal = inputAnimal.trim();
                setCurrentAnimal(newAnimal);
                const lastLetter = newAnimal[newAnimal.length - 1].toUpperCase();
                setExpectedStartLetter(lastLetter);
                setInputAnimal('');
                setError('');
                setTimeLeft(5);

                // move to next player
                const nextIndex = getNextActivePlayerIndex(currentPlayerIndex, players);
                setCurrentPlayerIndex(nextIndex);
            } else {
                setError(res.data.message);
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

    if (gameWinner) {
        return (
            <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4 flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                    <h1 className="text-4xl font-bold text-green-600 mb-4">🎉 Game Over! 🎉</h1>
                    <p className="text-2xl font-semibold text-gray-800 mb-6">
                        {gameWinner.name} Wins!
                    </p>
                    <button 
                        onClick={handleLeaveRoom}
                        className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg shadow-md transition-colors"
                    >
                        Return to Lobby
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4 relative">
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

            {/* Timer */}
            <div className="text-center mt-16 mb-8">
                <div className="inline-block bg-white px-6 py-3 rounded-full shadow-md">
                    <span className="text-2xl font-bold text-green-700">
                        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                    </span>
                </div>
            </div>

            {/* Main game area */}
            <section className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 mb-12">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Current Word</h2>
                    <div className="bg-green-100 p-6 rounded-lg">
                        <p className="text-4xl font-bold text-green-800">
                            {currentAnimal ? currentAnimal : `Start with "${expectedStartLetter}"`}
                        </p>
                    </div>
                </div>
                    
                <div className="mt-6 text-center">
                    <p className="text-lg mb-2 text-gray-700">
                        Enter an animal starting with <strong className="text-green-600">{expectedStartLetter.toUpperCase()}</strong>:
                    </p>
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

                <div className="border-t border-gray-200 pt-6 mt-6">
                    <p className="text-center text-lg mb-2">Current Player's Turn</p>
                    <div className="bg-green-100 p-6 rounded-lg flex justify-center items-center">
                        <p className="text-4xl font-bold text-green-800">
                            {currentPlayer?.name || 'Loading...'}
                        </p>
                    </div>
                </div>

                {nextPlayer && nextPlayer.id !== currentPlayer?.id && (
                    <div className="border-t border-gray-200 pt-6">
                        <p className="text-center text-lg mb-2">Next Player's Turn</p>
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                            <p className="text-xl font-medium text-green-700">{nextPlayer.name}</p>
                        </div>
                    </div>
                )}
            </section>

            {/* Player containers at bottom */}
            <section className="max-w-6xl mx-auto">
                <div className="grid grid-cols-4 gap-4">
                    {players.map((player, index) => (
                        <div key={player.id} className="flex flex-col items-center">
                            <div className={`w-full aspect-video rounded-lg shadow-md relative ${
                                player.eliminated ? 'bg-red-200' : 'bg-gray-200'
                            } ${
                                index === currentPlayerIndex && !player.eliminated ? 'border-4 border-green-500' : ''
                            }`}>
                                {/* Camera feed placeholder */}
                                <div className="h-full flex items-center justify-center">
                                    {player.eliminated ? (
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
                            </div>
                            <div className="mt-2 bg-white px-4 py-1 rounded-lg shadow-sm">
                                <p className={`font-medium ${
                                    player.eliminated ? 'text-red-500' : 
                                    index === currentPlayerIndex ? 'text-green-600' : 'text-gray-700'
                                }`}>
                                    {player.name}
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

