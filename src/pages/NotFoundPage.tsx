import { useNavigate } from 'react-router-dom';
import { NotFoundState } from '@/components/ui/StateDisplay';

export function NotFoundPage() {
  const navigate = useNavigate();
  return <NotFoundState onHome={() => navigate('/dashboard')} />;
}
