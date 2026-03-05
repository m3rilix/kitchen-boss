import { useNavigate } from 'react-router-dom';
import { SessionSetup } from './SessionSetup';

export function SessionSetupPage() {
  const navigate = useNavigate();
  
  return <SessionSetup onAdminClick={() => navigate('/admin')} />;
}
