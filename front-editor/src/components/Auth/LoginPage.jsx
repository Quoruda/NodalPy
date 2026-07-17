import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import './LoginPage.css';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const login = useAuthStore(state => state.login);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            
            // Support for Docker dynamic URL or Localhost fallback
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8555';
            
            const response = await fetch(`${apiUrl}/api/auth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            });
            
            if (!response.ok) {
                throw new Error('Invalid credentials');
            }
            
            const data = await response.json();
            login(data.access_token, username);
            
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card glass-panel">
                <div className="login-header">
                    <h2>NodalPy</h2>
                    <p>Log in to your workspace</p>
                </div>
                
                {error && <div className="login-error">{error}</div>}
                
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label>Username</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="admin"
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required 
                        />
                    </div>
                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Logging in...' : 'Log in'}
                    </button>
                </form>
                
                <div className="auth-switch">
                    <p>Don't have an account? <Link to="/register">Sign up</Link></p>
                </div>
            </div>
        </div>
    );
}
