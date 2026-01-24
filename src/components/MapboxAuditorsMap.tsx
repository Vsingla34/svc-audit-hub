import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Filter, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface MapboxAuditorsMapProps {
  token: string;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const MapboxAuditorsMap = ({ token }: MapboxAuditorsMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [auditors, setAuditors] = useState<any[]>([]);
  const [filteredAuditors, setFilteredAuditors] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const markers = useRef<mapboxgl.Marker[]>([]);
  // Simple cache for geocoded cities to avoid API spam
  const [geoCache, setGeoCache] = useState<Record<string, [number, number]>>({});

  useEffect(() => {
    fetchAuditors();
  }, []);

  useEffect(() => {
    let filtered = [...auditors];
    if (selectedState !== 'all') {
      filtered = filtered.filter(a => a.base_state === selectedState);
    }
    setFilteredAuditors(filtered);
  }, [auditors, selectedState]);

  useEffect(() => {
    if (token && mapContainer.current && filteredAuditors.length > 0) {
      plotAuditors();
    }
  }, [token, filteredAuditors]);

  const fetchAuditors = async () => {
    try {
      const { data, error } = await supabase
        .from('auditor_profiles')
        .select('*, profiles(full_name, email, phone)')
        .not('base_city', 'is', null);

      if (error) throw error;
      setAuditors(data || []);
    } catch (error) {
      console.error('Error fetching auditors:', error);
      toast.error('Failed to load auditor data');
    } finally {
      setLoading(false);
    }
  };

  const geocodeCity = async (city: string, state: string) => {
    const query = `${city}, ${state}, India`;
    if (geoCache[query]) return geoCache[query];

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=in&limit=1&types=place&access_token=${token}`
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const coords = data.features[0].center as [number, number];
        setGeoCache(prev => ({ ...prev, [query]: coords }));
        return coords;
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  };

  const plotAuditors = async () => {
    if (!mapContainer.current) return;

    if (!map.current) {
        mapboxgl.accessToken = token;
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [78.9629, 20.5937],
          zoom: 4,
        });
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Group auditors by city to avoid stacking markers perfectly on top of each other
    // For simplicity in this version, we will just geocode and plot. 
    // If multiple auditors are in the same city, they will stack.
    
    // We process sequentially or in parallel batches to handle async geocoding
    for (const auditor of filteredAuditors) {
      if (!auditor.base_city) continue;

      const coords = await geocodeCity(auditor.base_city, auditor.base_state || '');
      
      if (coords) {
        const el = document.createElement('div');
        el.className = 'auditor-marker';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#7c3aed'; // Violet color for auditors
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 10px;">
            <h3 style="font-weight: bold; margin-bottom: 8px;">${auditor.profiles?.full_name || 'Auditor'}</h3>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">${auditor.profiles?.email}</p>
            <p style="margin: 4px 0;"><strong>Location:</strong> ${auditor.base_city}, ${auditor.base_state}</p>
            <p style="margin: 4px 0;"><strong>Exp:</strong> ${auditor.experience_years} Years</p>
            <p style="margin: 4px 0;"><strong>Rating:</strong> ⭐ ${auditor.rating || 'N/A'}</p>
             <p style="margin: 4px 0;"><strong>Qualification:</strong> ${auditor.qualifications?.join(', ') || 'N/A'}</p>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat(coords)
          .setPopup(popup)
          .addTo(map.current!);

        markers.current.push(marker);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Auditors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Filter by State</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {INDIAN_STATES.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1 text-sm text-muted-foreground">
              Showing {filteredAuditors.length} auditors
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div ref={mapContainer} className="w-full h-[600px] rounded-lg" />
        </CardContent>
      </Card>
      
      <div className="text-xs text-muted-foreground text-center">
        * Note: Auditor locations are approximate based on their registered Base City.
      </div>
    </div>
  );
};

export default MapboxAuditorsMap;