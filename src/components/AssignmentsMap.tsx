import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Filter, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 5);
  }, [center, map]);
  return null;
}

const AssignmentsMap = () => {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isMapLoading, setIsMapLoading] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    filterAssignments();
  }, [assignments, selectedState, selectedCity, selectedStatus]);

  const fetchAssignments = async () => {
    setIsMapLoading(true);
    
    // Fetch ALL assignments, ignoring exact database coordinates
    const { data } = await supabase.from('assignments').select('*');

    if (data) {
      const uniqueLocations = Array.from(new Set(data.map(a => `${a.city}, ${a.state}`)));
      const coordsMap: Record<string, { lat: number; lng: number }> = {};

      // Geocode each unique City/State combination directly
      for (const location of uniqueLocations) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location + ', India')}&limit=1`);
          const geoData = await res.json();
          if (geoData && geoData.length > 0) {
            coordsMap[location] = {
              lat: parseFloat(geoData[0].lat),
              lng: parseFloat(geoData[0].lon)
            };
          }
          // Tiny 200ms delay to respect OpenStreetMap API limits
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error("Geocoding failed for:", location);
        }
      }

      // Apply city center coords to assignments
      const processedData = data.map(assignment => {
        const loc = `${assignment.city}, ${assignment.state}`;
        const coords = coordsMap[loc];
        
        // Add a tiny random offset (approx 500 meters) so pins in the same city don't perfectly overlap
        const offsetLat = (Math.random() - 0.5) * 0.01;
        const offsetLng = (Math.random() - 0.5) * 0.01;

        return {
          ...assignment,
          displayLat: (coords?.lat || assignment.latitude) + offsetLat,
          displayLng: (coords?.lng || assignment.longitude) + offsetLng,
        };
      }).filter(a => a.displayLat && a.displayLng);

      setAssignments(processedData);
    }
    setIsMapLoading(false);
  };

  const filterAssignments = () => {
    let filtered = [...assignments];
    if (selectedState !== 'all') filtered = filtered.filter(a => a.state === selectedState);
    if (selectedCity !== 'all') filtered = filtered.filter(a => a.city === selectedCity);
    if (selectedStatus !== 'all') filtered = filtered.filter(a => a.status === selectedStatus);
    setFilteredAssignments(filtered);
  };

  const uniqueCities = Array.from(new Set(assignments.map(a => a.city))).sort();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filter Assignments
            {isMapLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {INDIAN_STATES.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {uniqueCities.map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="allotted">Allotted</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg border">
          <div className="h-[450px] w-full z-0 relative">
             <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater center={[20.5937, 78.9629]} />
              
              {filteredAssignments.map((assignment) => (
                <Marker 
                  key={assignment.id} 
                  position={[assignment.displayLat, assignment.displayLng]}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-bold text-base mb-2">{assignment.client_name}</h3>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-semibold">Branch:</span> {assignment.branch_name}</p>
                        <p><span className="font-semibold">Location:</span> {assignment.city}, {assignment.state}</p>
                        <p><span className="font-semibold">Fees:</span> ₹{assignment.fees?.toLocaleString('en-IN')}</p>
                        <div className={`inline-block px-2 py-0.5 rounded text-xs text-white capitalize mt-2
                          ${assignment.status === 'open' ? 'bg-blue-500' : 
                            assignment.status === 'allotted' ? 'bg-amber-500' : 
                            assignment.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}`}>
                          {assignment.status}
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignmentsMap;