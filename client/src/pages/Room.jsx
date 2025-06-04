import React from 'react';
import { useNavigate } from 'react-router-dom';

const Room = () => {
    const navigate = useNavigate();

    const handleLeaveRoom = () => {
        navigate('/lobby');
    };

    return (
        <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4 relative">
            {/* Room code and leave button */}
            <div className="absolute top-4 right-4 flex items-center gap-4">
                <div className="bg-white px-4 py-2 rounded-lg shadow-md">
                    <span className="text-gray-500 text-sm mr-2">Room Code:</span>
                    <span className="font-bold">XYZQ42</span>
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
                    <span className="text-2xl font-bold text-green-700">0:15</span>
                </div>
            </div>

            {/* Main game area */}
            <section className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 mb-12">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Current Word</h2>
                    <div className="bg-green-100 p-6 rounded-lg">
                        <p className="text-4xl font-bold text-green-800">Elephant</p>
                    </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                    <p className="text-center text-lg mb-2">Current Player's Turn</p>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                        <p className="text-xl font-medium text-green-700">Player 2</p>
                    </div>
                </div>
            </section>

            {/* Player containers at bottom */}
            <section className="max-w-6xl mx-auto">
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(player => (
                        <div key={player} className="flex flex-col items-center">
                            <div className={`w-full aspect-video bg-gray-200 rounded-lg shadow-md ${player === 2 ? 'border-4 border-green-500' : ''}`}>
                                {/* Camera feed placeholder */}
                                <div className="h-full flex items-center justify-center">
                                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-2 bg-white px-4 py-1 rounded-lg shadow-sm">
                                <p className={`font-medium ${player === 2 ? 'text-green-600' : 'text-gray-700'}`}>Player {player}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
};

export default Room;