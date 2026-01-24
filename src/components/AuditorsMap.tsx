import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import L from 'leaflet';

// Fix for default Leaflet icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom violet icon for auditors
const violetIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Central coordinates for all Indian States/UTs
const STATE_COORDINATES: Record<string, [number, number]> = {
  'Andhra Pradesh': [15.9129, 79.7400],
  'Arunachal Pradesh': [28.2180, 94.7278],
  'Assam': [26.2006, 92.9376],
  'Bihar': [25.0961, 85.3131],
  'Chandigarh': [30.7333, 76.7794],
  'Chhattisgarh': [21.2787, 81.8661],
  'Delhi': [28.7041, 77.1025],
  'Goa': [15.2993, 74.1240],
  'Gujarat': [22.2587, 71.1924],
  'Haryana': [29.0588, 76.0856],
  'Himachal Pradesh': [31.1048, 77.1734],
  'Jammu and Kashmir': [33.7782, 76.5762],
  'Jharkhand': [23.6102, 85.2799],
  'Karnataka': [15.3173, 75.7139],
  'Kerala': [10.8505, 76.2711],
  'Ladakh': [34.1526, 77.5770],
  'Lakshadweep': [10.5667, 72.6417],
  'Madhya Pradesh': [22.9734, 78.6569],
  'Maharashtra': [19.7515, 75.7139],
  'Manipur': [24.6637, 93.9063],
  'Meghalaya': [25.4670, 91.3662],
  'Mizoram': [23.1645, 92.9376],
  'Nagaland': [26.1584, 94.5624],
  'Odisha': [20.9517, 85.0985],
  'Puducherry': [11.9416, 79.8083],
  'Punjab': [31.1471, 75.3412],
  'Rajasthan': [27.0238, 74.2179],
  'Sikkim': [27.5330, 88.5122],
  'Tamil Nadu': [11.1271, 78.6569],
  'Telangana': [18.1124, 79.0193],
  'Tripura': [23.9408, 91.9882],
  'Uttar Pradesh': [26.8467, 80.9462],
  'Uttarakhand': [30.0668, 79.0193],
  'West Bengal': [22.9868, 87.8550],
  'Andaman and Nicobar Islands': [11.7401, 92.6586],
  'Dadra and Nagar Haveli and Daman and Diu': [20.1809, 73.0169]
};

const INDIAN_STATES = Object.keys(STATE_COORDINATES).sort();

interface GeocodedAuditor {
  id: string;
  name: string;
  email: string;
  city: string;
  state: string;
  rating: number;
  lat: number;
  lng: number;
  qualifications: string[];
}

const AuditorsMap = () => {
  const [geocodedData, setGeocodedData] = useState<GeocodedAuditor[]>([]);
  const [selectedState, setSelectedState] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditors();
  }, []);

  const fetchAuditors = async () => {
    setLoading(true);
    setGeocodedData([]);
    
    try {
      // Fetch all auditors that have a State defined
      const { data, error } = await supabase
        .from('auditor_profiles')
        .select('*, profiles(full_name, email, phone)')
        .not('base_state', 'is', null);

      if (error) throw error;
      
      const processed: GeocodedAuditor[] = [];

      if (data) {
        data.forEach(auditor => {
          const stateName = auditor.base_state?.trim();
          
          // Only plot if we have coordinates for this state
          if (stateName && STATE_COORDINATES[stateName]) {
            const [baseLat, baseLng] = STATE_COORDINATES[stateName];
            
            // Add randomness (Jitter) so markers don't overlap perfectly
            // Range is roughly +/- 0.3 degrees (~30km jitter)
            const latJitter = (Math.random() - 0.5) * 0.6;
            const lngJitter = (Math.random() - 0.5) * 0.6;

            processed.push({
              id: auditor.user_id,
              name: auditor.profiles?.full_name || 'Auditor',
              email: auditor.profiles?.email,
              city: auditor.base_city || '',
              state: stateName,
              rating: auditor.rating || 0,
              qualifications: auditor.qualifications || [],
              lat: baseLat + latJitter,
              lng: baseLng + lngJitter,
            });
          }
        });
      }

      setGeocodedData(processed);
    } catch (error) {
      console.error('Error fetching auditors:', error);
      toast.error('Failed to load auditor map');
    } finally {
      setLoading(false);
    }
  };

  const filteredAuditors = selectedState === 'all' 
    ? geocodedData 
    : geocodedData.filter(a => a.state === selectedState);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 px-4 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Filter className="h-4 w-4" />
              Filter Auditors
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Total Found: {filteredAuditors.length}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Filter by State</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {INDIAN_STATES.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg border">
          {/* Reduced height to 350px as requested */}
          <div className="h-[350px] w-full z-0 relative">
             <MapContainer center={[22.5937, 78.9629]} zoom={4} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {filteredAuditors.map((auditor) => (
                <Marker 
                  key={auditor.id} 
                  position={[auditor.lat, auditor.lng]}
                  icon={violetIcon}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-bold text-sm mb-1">{auditor.name}</h3>
                      <div className="text-xs text-muted-foreground mb-2 flex flex-col">
                        <span>{auditor.email}</span>
                      </div>
                      <div className="space-y-1 text-xs border-t pt-2">
                        <p className="flex items-center justify-between">
                          <span className="font-semibold">Location:</span> 
                          <span>{auditor.city}, {auditor.state}</span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span className="font-semibold">Rating:</span>
                          <span className="text-amber-500 font-bold">★ {auditor.rating || 'N/A'}</span>
                        </p>
                        {auditor.qualifications.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {auditor.qualifications.slice(0, 3).map(q => (
                              <Badge key={q} variant="secondary" className="text-[10px] px-1 h-4">{q}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>
      
      <div className="text-[10px] text-muted-foreground text-center">
        Auditors are shown based on their registered State.
      </div>
    </div>
  );
};

export default AuditorsMap;