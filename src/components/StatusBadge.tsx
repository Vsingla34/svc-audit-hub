import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const getVariantAndLabel = (status: string): { variant: BadgeVariant; label: string } => {
    const normalized = status.toLowerCase().replace('_', ' ');
    
    switch (status.toLowerCase()) {
      case 'open':
        return { variant: 'info', label: 'Open' };
      case 'pending':
      case 'applied':
        return { variant: 'warning', label: normalized.charAt(0).toUpperCase() + normalized.slice(1) };
      case 'allotted':
      case 'in_progress':
        return { variant: 'info', label: status === 'in_progress' ? 'In Progress' : 'Allotted' };
      case 'completed':
      case 'approved':
      case 'paid':
      case 'accepted':
        return { variant: 'success', label: normalized.charAt(0).toUpperCase() + normalized.slice(1) };
      case 'rejected':
        return { variant: 'destructive', label: 'Rejected' };
      case 'draft':
        return { variant: 'secondary', label: 'Draft' };
      default:
        return { variant: 'outline', label: normalized.charAt(0).toUpperCase() + normalized.slice(1) };
    }
  };

  const { variant, label } = getVariantAndLabel(status);

  return (
    <Badge variant={variant}>
      <span className="status-dot" style={{ 
        backgroundColor: variant === 'success' ? 'hsl(var(--success))' : 
                        variant === 'warning' ? 'hsl(var(--warning))' : 
                        variant === 'destructive' ? 'hsl(var(--destructive))' : 
                        variant === 'info' ? 'hsl(var(--info))' : 
                        'currentColor'
      }} />
      {label}
    </Badge>
  );
};
