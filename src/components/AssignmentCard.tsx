import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { MapPin, Calendar, DollarSign, Briefcase } from 'lucide-react';

interface AssignmentCardProps {
  assignment: {
    id: string;
    client_name: string;
    branch_name: string;
    city: string;
    state: string;
    audit_type: string;
    audit_date: string;
    fees: number;
    status: string;
  };
  onApply?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  showApplyButton?: boolean;
  showDetailsButton?: boolean;
}

export const AssignmentCard = ({ 
  assignment, 
  onApply, 
  onViewDetails,
  showApplyButton = false,
  showDetailsButton = false
}: AssignmentCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{assignment.client_name}</CardTitle>
            <CardDescription>{assignment.branch_name}</CardDescription>
          </div>
          <StatusBadge status={assignment.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{assignment.city}, {assignment.state}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Briefcase className="h-4 w-4" />
          <span>{assignment.audit_type}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{new Date(assignment.audit_date).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <DollarSign className="h-4 w-4" />
          <span>₹{assignment.fees.toLocaleString()}</span>
        </div>
      </CardContent>
      {(showApplyButton || showDetailsButton) && (
        <CardFooter className="gap-2">
          {showApplyButton && onApply && (
            <Button onClick={() => onApply(assignment.id)} className="flex-1">
              Apply Now
            </Button>
          )}
          {showDetailsButton && onViewDetails && (
            <Button onClick={() => onViewDetails(assignment.id)} variant="outline" className="flex-1">
              View Details
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
};
