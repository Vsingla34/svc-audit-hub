import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

interface MapboxAssignmentsMapProps {
  token: string;
}

const MapboxAssignmentsMap = ({ token }: MapboxAssignmentsMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    filterAssignments();
  }, [assignments, selectedState, selectedCity, selectedStatus]);

  useEffect(() => {
    if (token && mapContainer.current && filteredAssignments.length > 0) {
      initializeMap();
    }
  }, [token, filteredAssignments]);

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('assignments')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (data) {
      setAssignments(data);
    }
  };

  const filterAssignments = () => {
    let filtered = [...assignments];

    if (selectedState !== 'all') {
      filtered = filtered.filter(a => a.state === selectedState);
    }
    if (selectedCity !== 'all') {
      filtered = filtered.filter(a => a.city === selectedCity);
    }
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(a => a.status === selectedStatus);
    }

    setFilteredAssignments(filtered);
  };

  const initializeMap = () => {
    if (!mapContainer.current) return;
    
    // If map already exists, just update markers, don't re-initialize
    if (!map.current) {
        mapboxgl.accessToken = token;
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [78.9629, 20.5937], // Center of India
          zoom: 4,
        });
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add markers for each assignment
    filteredAssignments.forEach((assignment) => {
      if (assignment.latitude && assignment.longitude) {
        const statusColors: Record<string, string> = {
          open: '#3b82f6',
          allotted: '#f59e0b',
          completed: '#22c55e',
          cancelled: '#ef4444',
        };

        const el = document.createElement('div');
        el.className = 'assignment-marker';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = statusColors[assignment.status] || '#6b7280';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 10px;">
            <h3 style="font-weight: bold; margin-bottom: 8px;">${assignment.client_name}</h3>
            <p style="margin: 4px 0;"><strong>Branch:</strong> ${assignment.branch_name}</p>
            <p style="margin: 4px 0;"><strong>Location:</strong> ${assignment.city}, ${assignment.state}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${assignment.audit_type}</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> <span style="text-transform: capitalize;">${assignment.status}</span></p>
            <p style="margin: 4px 0;"><strong>Fees:</strong> ₹${assignment.fees.toLocaleString('en-IN')}</p>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([assignment.longitude, assignment.latitude])
          .setPopup(popup)
          .addTo(map.current!);

        markers.current.push(marker);
      }
    });
  };

  const uniqueCities = Array.from(new Set(assignments.map(a => a.city))).sort();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>State</Label>
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
            <div className="space-y-2">
              <Label>City</Label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {uniqueCities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
        <CardContent className="p-0">
          <div ref={mapContainer} className="w-full h-[600px] rounded-lg" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#3b82f6] border-2 border-white"></div>
              <span className="text-sm">Open</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#f59e0b] border-2 border-white"></div>
              <span className="text-sm">Allotted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#22c55e] border-2 border-white"></div>
              <span className="text-sm">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#ef4444] border-2 border-white"></div>
              <span className="text-sm">Cancelled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapboxAssignmentsMap;