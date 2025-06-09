import React, {useEffect, useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';



const Login = () => {
    const navigate = useNavigate();

    // Handle form submission
    const handleSubmit = (event) => {
        event.preventDefault();
        const username = event.target.username.value;
        const password = event.target.password.value;

        if (!username || !password) {
            alert("Please fill in all fields.");
            return;
        }

        // Fetch request to login
        fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', 
            body: JSON.stringify({ username, password }),
        })
        .then(response => {
            if (response.ok) {
                localStorage.setItem('username', username); // Store username in local storage
                navigate('/lobby'); // Redirect to lobby 
            } else {
                response.json().then(data => {
                    alert("Login failed.");
                });
            }
        })
        .catch(error => {
            console.error("Error during login:", error);
            alert("An error occurred while logging in.");
        });
    };

    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
    const checkAuth = async () => {
        try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/check`, {
            method: 'GET',
            credentials: 'include', 
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
    }, [navigate]); 

    if (loading) {
    return (
        <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4">
        <div className="text-green-800 text-xl sm:text-2xl">Loading...</div>
        </main>
    );
    }
    

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-green-50 to-green-100">
      <section className="bg-white rounded-xl shadow-lg p-4 py-6 sm:p-6 md:p-8 w-full max-w-md flex flex-col items-center">
        <header className="text-center w-full mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">Log in to continue to LoopZoo!</p>
        </header>
        
        <form className="login-form w-full" onSubmit={handleSubmit}>
          <fieldset className="mb-4 sm:mb-5">
            <legend className="sr-only">Login Information</legend>
            
            <div className="form-group mb-3 sm:mb-4">
              <label htmlFor="username" className="block mb-1.5 text-sm sm:text-base font-medium text-gray-700">Username</label>
              <input 
                id="username" 
                name="username"
                className="w-full border border-gray-300 p-2 sm:p-2.5 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm sm:text-base" 
                required 
              />
            </div>
            
            <div className="form-group mb-4 sm:mb-5">
              <label htmlFor="password" className="block mb-1.5 text-sm sm:text-base font-medium text-gray-700">Password</label>
              <input 
                type="password" 
                id="password" 
                name="password"
                className="w-full border border-gray-300 p-2 sm:p-2.5 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm sm:text-base" 
                required 
              />
            </div>
          </fieldset>
        
          
          <button 
            type="submit" 
            className="bg-green-600 hover:bg-green-700 text-white py-2 sm:py-2.5 px-4 rounded-lg transition-colors w-full font-medium text-sm sm:text-base shadow-sm"
          >
            Log In
          </button>
        </form>
        
        <footer className="w-full text-center mt-6 sm:mt-8">
          <p className="text-sm sm:text-base text-gray-600">Don't have an account? <Link to="/signup" className="text-green-600 hover:text-green-700 hover:underline font-medium">Sign Up</Link></p>
        </footer>
      </section>
    </main>
  );
};

export default Login;