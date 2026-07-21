import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
export default function Profile() {
  const navigate = useNavigate();
  useEffect(() => navigate('/quest', { replace: true }), [navigate]);
  return null;
}
