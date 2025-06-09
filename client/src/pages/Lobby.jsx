import React, {useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';

const Lobby = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [rooms, setRooms] = useState([]);
    const [joinCode, setJoinCode] = useState('');
    
      
    useEffect(() => {
    const checkAuth = async () => {
        try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/check`, {
            method: 'GET',
            credentials: 'include', // Important for cookies
        });
        
        // If response is not OK or user is not authenticated, redirect to home
        if (!response.ok) {
            navigate('/'); 
            return;
        }
        
        const data = await response.json();
        if (!data.authenticated) {
            navigate('/'); 
        }
        } catch (error) {
        console.error('Error checking authentication:', error);
        navigate('/'); // Redirect on error as well
        } finally {
        setLoading(false);
        }
    }
    checkAuth();

    // clear game variables from localStorage (sanity check)
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('timerEndTime_')) {
            localStorage.removeItem(key);
        }
    }

    }, [navigate]); 

    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
                    method: 'GET',
                    credentials: 'include',
                });
                if (!res.ok) throw new Error('Failed to fetch rooms');
                const data = await res.json();
                setRooms(data);
            } catch (err) {
                console.error('Error fetching rooms:', err);
            }
        };
    
        fetchRooms();
        const interval = setInterval(fetchRooms, 5000); // refresh every 5 seconds
    
        return () => clearInterval(interval);
    }, []);
    
    if (loading) {
    return (
        <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4">
        <div className="text-green-800 text-xl sm:text-2xl">Loading...</div>
        </main>
    );
    }
    


    const handleCreateRoom = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
      
          const data = await res.json();
          navigate(`/room/${data.roomCode}`);
        } catch (err) {
          console.error('Failed to create room:', err);
        }
    };

    const handleJoinRoom = async (roomCodeToJoin) => {
        if (!roomCodeToJoin.trim()) {
            // Optionally, set an error state here to inform the user
            console.log("Room code cannot be empty");
            return;
        }
        try {
            navigate(`/room/${roomCodeToJoin.trim()}`);
        } catch (err) {
            console.error('Failed to join room:', err);
        }
    };
      

    const handleLogout = () => {
        fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include', // Important for cookies
        })
            .then(response => {
            if (response.ok) {
                // Clear local storage
                localStorage.removeItem('username');
                // Redirect to login or home page
                navigate('/');
            }
            })
            .catch(error => {
            console.error('Error during logout:', error);
            });
    };

    return (
        <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-3 sm:p-4 md:p-6 lg:p-8">
            {/* Header */}
            <header className="flex justify-between items-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-green-800">Game Lobby</h1>
                <button
                    onClick={handleLogout}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 hover:text-gray-900 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-sm sm:text-base"
                >
                    Logout
                </button>
            </header>

            <div className="flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8">
                {/* Left column - Create/Join */}
                <section className="lg:w-2/3 flex flex-col gap-4 md:gap-6">
                    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
                        <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-800">Create a New Room</h2>
                        <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Start a new game and invite your friends!</p>
                        <button
                            onClick={handleCreateRoom}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 sm:py-3 px-4 rounded-lg font-medium transition-colors shadow-md text-sm sm:text-base"
                        >
                            Create Room
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
                        <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-800">Join a Room</h2>
                        <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Enter a room code to join an existing game.</p>
                        
                        <div className="flex flex-col xs:flex-row gap-2">
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="Enter room code"
                                className="flex-grow border border-gray-300 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm sm:text-base"
                                maxLength={6}
                            />
                            <button
                                onClick={() => handleJoinRoom(joinCode)}
                                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 sm:py-2.5 sm:px-6 rounded-lg font-medium transition-colors shadow-md text-sm sm:text-base"
                            >
                                Join
                            </button>
                        </div>
                    </div>
                </section>

                {/* Right column - Room list */}
                <section className="lg:w-1/3">
                    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 h-full flex flex-col">
                        <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-800 flex-shrink-0">Available Rooms</h2>
                        
                        {rooms.length === 0 ? (
                            <p className="text-gray-500 text-center py-4 text-sm sm:text-base flex-grow flex items-center justify-center">No rooms available. Create one!</p>
                        ) : (
                            <div className="overflow-y-auto max-h-[24rem] sm:max-h-96 flex-grow">
                                <table className="w-full text-sm">
                                    <thead className="border-b sticky top-0 bg-white z-10">
                                        <tr>
                                            <th className="text-left py-2 px-2 sm:px-3 font-semibold text-gray-600 text-xs sm:text-sm">Code</th>
                                            <th className="text-center py-2 px-1 sm:px-2 font-semibold text-gray-600 text-xs sm:text-sm">Players</th>
                                            <th className="text-right py-2 px-1 sm:px-2"></th> {/* Action column */}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rooms.map(room => (
                                            <tr key={room.id} className="border-b hover:bg-green-50">
                                                <td className="py-2.5 sm:py-3 px-2 sm:px-3 font-medium text-xs sm:text-sm">{room.code}</td>
                                                <td className="py-2.5 sm:py-3 px-1 sm:px-2 text-center">
                                                    <span className={`inline-flex items-center ${room.players >= 4 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} py-0.5 px-1.5 sm:py-1 sm:px-2 rounded-full text-xs`}>
                                                        {room.players}/4
                                                    </span>
                                                </td>
                                                <td className="py-2.5 sm:py-3 px-1 sm:px-2 text-right">
                                                    <button
                                                        onClick={() => handleJoinRoom(room.code)}
                                                        disabled={room.players >= 4}
                                                        className={`text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-colors text-xs sm:text-sm ${room.players >= 4 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
                                                    >
                                                        Join
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
};

export default Lobby;