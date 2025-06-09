import React, {useEffect, useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';

const COOKIE_CONSENT_KEY = 'cookieConsentAccepted';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  
  useEffect(() => {

    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setShowCookieBanner(true);
    }

    const checkAuth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/check`, {
          method: 'GET',
          credentials: 'include', // Important for cookies
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            navigate('/lobby'); // Redirect to lobby if authenticated
          }
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleAcceptCookies = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setShowCookieBanner(false);
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-100">
        <div className="text-green-800 text-2xl">Loading...</div>
      </main>
    );
  }

  return (
    <>
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4">
      <section className="text-center max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-green-800 mb-6">LoopZoo</h1>
          <p className="text-xl text-gray-700 mb-8">Try to chain as many animals as possible!</p>
        </header>
        
        <div className="space-y-4 md:space-y-0 md:space-x-4 md:flex md:justify-center">
          <Link 
            to="/login" 
            className="inline-block bg-green-600 text-white py-3 px-8 rounded-lg font-medium text-lg hover:bg-green-700 transition-colors shadow-md w-full md:w-auto"
          >
            Log In
          </Link>
          
          <Link 
            to="/signup" 
            className="inline-block bg-white text-green-600 border border-green-600 py-3 px-8 rounded-lg font-medium text-lg hover:bg-green-100 transition-colors shadow-md w-full md:w-auto"
          >
            Sign Up
          </Link>
        </div>
        
        <footer className="mt-16 text-gray-600">
          <p className="text-sm">LoopZoo. Hakob Atajyan and Ethan Dao, CS144 Spring 2025</p>
        </footer>
      </section>
    </main>

      {/* Cookie Consent Banner */}
      {showCookieBanner && (
        <div className="fixed bottom-0 left-0 right-0 bg-green-700 text-white p-4 flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0 md:space-x-4 shadow-lg z-50">
          <p className="text-sm md:text-base max-w-xl">
            We use cookies to improve your experience. By continuing to use our site, you agree to our use of cookies and your rights.
          </p>
          <button
            onClick={handleAcceptCookies}
            className="bg-white text-green-700 font-semibold px-6 py-2 rounded hover:bg-green-100 transition"
          >
            Accept
          </button>
        </div>
      )}
    </>





  );
};

export default Home;