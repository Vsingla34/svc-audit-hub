import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';

interface AssignmentFiltersProps {
  filterStatus: string;
  filterState: string;
  filterCity: string;
  filterAuditType: string;
  filterDateFrom: string;
  filterDateTo: string;
  onFilterChange: (filters: {
    status?: string;
    state?: string;
    city?: string;
    auditType?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => void;
  onReset: () => void;
  states: string[];
  cities: string[];
  auditTypes: string[];
}

export function AssignmentFilters({
  filterStatus,
  filterState,
  filterCity,
  filterAuditType,
  filterDateFrom,
  filterDateTo,
  onFilterChange,
  onReset,
  states,
  cities,
  auditTypes,
}: AssignmentFiltersProps) {
  return (
    <div className="bg-card p-4 rounded-lg border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </h3>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="space-y-2">
          <Label htmlFor="filter-status">Status</Label>
          <Select value={filterStatus} onValueChange={(value) => onFilterChange({ status: value })}>
            <SelectTrigger id="filter-status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="allotted">Allotted</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-state">State</Label>
          <Select value={filterState} onValueChange={(value) => onFilterChange({ state: value })}>
            <SelectTrigger id="filter-state">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-city">City</Label>
          <Select value={filterCity} onValueChange={(value) => onFilterChange({ city: value })}>
            <SelectTrigger id="filter-city">
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-audit-type">Audit Type</Label>
          <Select value={filterAuditType} onValueChange={(value) => onFilterChange({ auditType: value })}>
            <SelectTrigger id="filter-audit-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {auditTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-date-from">From Date</Label>
          <Input
            id="filter-date-from"
            type="date"
            value={filterDateFrom}
            onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-date-to">To Date</Label>
          <Input
            id="filter-date-to"
            type="date"
            value={filterDateTo}
            onChange={(e) => onFilterChange({ dateTo: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}