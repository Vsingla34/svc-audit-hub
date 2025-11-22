import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const getVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'default';
      case 'applied':
      case 'pending':
        return 'secondary';
      case 'allotted':
      case 'accepted':
      case 'in_progress':
        return 'default';
      case 'completed':
      case 'approved':
        return 'default';
      case 'paid':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'approved':
      case 'paid':
        return 'bg-accent text-accent-foreground';
      case 'pending':
      case 'applied':
        return 'bg-warning text-warning-foreground';
      case 'open':
        return 'bg-primary text-primary-foreground';
      case 'allotted':
      case 'in_progress':
        return 'bg-primary/80 text-primary-foreground';
      default:
        return '';
    }
  };

  return (
    <Badge variant={getVariant(status)} className={getStatusColor(status)}>
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );
};
