import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import './LoginPage.css';
import './RegisterPage.css';

export default function RegisterPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Password strength criteria
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isStrong = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
    const passwordsMatch = password === confirmPassword && password.length > 0;

    const login = useAuthStore(state => state.login);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isStrong) {
            setError('Please ensure your password meets all strength requirements.');
            return;
        }

        if (!passwordsMatch) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8555';
            
            const response = await fetch(`${apiUrl}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Registration failed');
            }
            
            const data = await response.json();
            login(data.access_token, username);
            navigate('/');
            
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card glass-panel register-card">
                <div className="login-header">
                    <h2>Create Account</h2>
                    <p>Join NodalPy and start building</p>
                </div>
                
                {error && <div className="login-error">{error}</div>}
                
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label>Username</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Choose a username"
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Create a strong password"
                            required 
                        />
                    </div>

                    <div className="password-strength">
                        <div className={`strength-criteria ${hasLength ? 'met' : ''}`}>
                            <span className="icon">{hasLength ? '✓' : '○'}</span>
                            <span>At least 8 characters</span>
                        </div>
                        <div className={`strength-criteria ${hasUpper && hasLower ? 'met' : ''}`}>
                            <span className="icon">{hasUpper && hasLower ? '✓' : '○'}</span>
                            <span>Upper & lowercase letters</span>
                        </div>
                        <div className={`strength-criteria ${hasNumber ? 'met' : ''}`}>
                            <span className="icon">{hasNumber ? '✓' : '○'}</span>
                            <span>At least one number</span>
                        </div>
                        <div className={`strength-criteria ${hasSpecial ? 'met' : ''}`}>
                            <span className="icon">{hasSpecial ? '✓' : '○'}</span>
                            <span>At least one special character</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input 
                            type="password" 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            required 
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="login-button" 
                        disabled={loading || !isStrong || !passwordsMatch || !username}
                    >
                        {loading ? 'Creating account...' : 'Sign up'}
                    </button>
                </form>
                
                <div className="auth-switch">
                    <p>Already have an account? <Link to="/login">Log in</Link></p>
                </div>
            </div>
        </div>
    );
}
