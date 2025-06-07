import React, {useEffect, useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';



const Login = () => {
    const navigate = useNavigate();

    // Handle form submission
    const handleSubmit = (event) => {
        event.preventDefault();
        const username = event.target.username.value;
        const password = event.target.password.value;

        // Basic validation
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
            credentials: 'include', // Important for cookies
            body: JSON.stringify({ username, password }),
        })
        .then(response => {
            if (response.ok) {
                localStorage.setItem('username', username); // Store username in local storage
                navigate('/lobby'); // Redirect to lobby on success
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

    if (loading) {
    return (
        <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-100">
        <div className="text-green-800 text-2xl">Loading...</div>
        </main>
    );
    }
    

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 md:p-6 lg:p-8 bg-gray-50">
      <section className="bg-white rounded-lg shadow-md p-6 lg:p-8 w-full max-w-md flex flex-col items-center">
        <header className="text-center w-full">
          <h1 className="text-3xl font-bold mb-6">Welcome Back</h1>
          <p className="text-gray-600 mb-8">Log in to continue to LoopZoo!</p>
        </header>
        
        <form className="login-form w-full" onSubmit={handleSubmit}>
          <fieldset className="mb-6">
            <legend className="sr-only">Login Information</legend>
            
            <div className="form-group mb-4">
              <label htmlFor="username" className="block mb-2 font-medium">Username</label>
              <input 
                id="username" 
                name="username"
                className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" 
                required 
              />
            </div>
            
            <div className="form-group mb-4">
              <label htmlFor="password" className="block mb-2 font-medium">Password</label>
              <input 
                type="password" 
                id="password" 
                name="password"
                className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" 
                required 
              />
            </div>
          </fieldset>
        
          
          <button 
            type="submit" 
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors w-full font-medium"
          >
            Log In
          </button>
        </form>
        
        <footer className="w-full text-center mt-8">
          <p>Don't have an account? <a href="/signup" className="text-green-600 hover:underline">Sign Up</a></p>
        </footer>
      </section>
    </main>
  );
};

export default Login;