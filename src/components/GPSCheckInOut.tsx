import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle, Clock, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GPSCheckInOutProps {
  assignmentId: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  onUpdate: () => void;
}

export function GPSCheckInOut({ assignmentId, checkInTime, checkOutTime, onUpdate }: GPSCheckInOutProps) {
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error('Unable to retrieve your location. Please enable location services.'));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const location = await getCurrentLocation();
      
      const { error } = await supabase
        .from('assignments')
        .update({
          check_in_time: new Date().toISOString(),
          check_in_lat: location.lat,
          check_in_lng: location.lng,
        })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Checked in successfully!', {
        description: `Location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
      });
      onUpdate();
    } catch (error: any) {
      toast.error('Check-in failed', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const location = await getCurrentLocation();
      
      const { error } = await supabase
        .from('assignments')
        .update({
          check_out_time: new Date().toISOString(),
          check_out_lat: location.lat,
          check_out_lng: location.lng,
        })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Checked out successfully!', {
        description: `Location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
      });
      onUpdate();
    } catch (error: any) {
      toast.error('Check-out failed', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string) => {
    return new Date(time).toLocaleString('en-IN', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              GPS Check-In/Out
            </h3>
            {checkInTime && !checkOutTime && (
              <Badge variant="default" className="animate-pulse">
                <Clock className="h-3 w-3 mr-1" />
                On-site
              </Badge>
            )}
            {checkInTime && checkOutTime && (
              <Badge variant="secondary">
                <CheckCircle className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Check In */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Check In</p>
              {checkInTime ? (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-accent-foreground" />
                  <span>{formatTime(checkInTime)}</span>
                </div>
              ) : (
                <Button
                  onClick={handleCheckIn}
                  disabled={loading}
                  className="w-full"
                  variant="default"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {loading ? 'Getting Location...' : 'Check In'}
                </Button>
              )}
            </div>

            {/* Check Out */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Check Out</p>
              {checkOutTime ? (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-accent-foreground" />
                  <span>{formatTime(checkOutTime)}</span>
                </div>
              ) : checkInTime ? (
                <Button
                  onClick={handleCheckOut}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {loading ? 'Getting Location...' : 'Check Out'}
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground p-2 text-center border rounded">
                  Check in first
                </div>
              )}
            </div>
          </div>

          {checkInTime && checkOutTime && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground text-center">
                <CheckCircle className="h-3 w-3 inline mr-1" />
                Assignment visit logged successfully
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
