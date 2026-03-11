import { useNavigate } from 'react-router-dom';
import { Button } from 'primereact/button';
import './WelcomeScreen.css';

export default function WelcomeScreen() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    const token = localStorage.getItem('token');
    
    if (token) {
      // Token exists, navigate to hub
      navigate('/hub');
    } else {
      // No token, navigate to signup
      navigate('/auth/signup');
    }
  };

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <h1 className="welcome-title">Live the Community</h1>
        <p className="welcome-subtitle">A place for everyone to create and connect to others.</p>
        <Button
          label="Get Started"
          onClick={handleGetStarted}
          className="welcome-button"
          size="large"
        />
      </div>
    </div>
  );
}
