import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';
import { SessionSetup } from './SessionSetup';

export function SessionSetupPage() {
  const navigate = useNavigate();
  const { session } = useSessionStore();
  
  // Navigate to session page when session is created
  useEffect(() => {
    if (session) {
      navigate('/session');
    }
  }, [session, navigate]);
  
  return <SessionSetup onAdminClick={() => navigate('/admin')} />;
}
