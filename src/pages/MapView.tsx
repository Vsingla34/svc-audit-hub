import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import MapboxAssignmentsMap from '@/components/MapboxAssignmentsMap';

export default function MapView() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-primary">Assignments Map</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <MapboxAssignmentsMap />
      </main>
    </div>
  );
}