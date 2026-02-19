import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface EditAssignmentDialogProps {
  assignment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditAssignmentDialog({ assignment, open, onOpenChange, onSuccess }: EditAssignmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_name: '',
    branch_name: '',
    city: '',
    state: '',
    audit_type: '',
    audit_date: '',
    deadline_date: '',
    fees: 0,
    ope: 0,
  });

  // Pre-fill form when the assignment changes or dialog opens
  useEffect(() => {
    if (assignment && open) {
      setFormData({
        client_name: assignment.client_name || '',
        branch_name: assignment.branch_name || '',
        city: assignment.city || '',
        state: assignment.state || '',
        audit_type: assignment.audit_type || '',
        audit_date: assignment.audit_date ? new Date(assignment.audit_date).toISOString().split('T')[0] : '',
        deadline_date: assignment.deadline_date ? new Date(assignment.deadline_date).toISOString().split('T')[0] : '',
        fees: assignment.fees || 0,
        ope: assignment.ope || 0,
      });
    }
  }, [assignment, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'fees' || name === 'ope' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment?.id) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('assignments')
        .update(formData)
        .eq('id', assignment.id);

      if (error) throw error;

      toast.success('Assignment updated successfully!');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
          <DialogDescription>
            Update the details for {assignment?.client_name} - {assignment?.branch_name}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Client Name</Label>
              <Input id="client_name" name="client_name" value={formData.client_name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_name">Branch Name</Label>
              <Input id="branch_name" name="branch_name" value={formData.branch_name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" value={formData.city} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" value={formData.state} onChange={handleChange} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="audit_type">Audit Type</Label>
              <Input id="audit_type" name="audit_type" value={formData.audit_type} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit_date">Audit Date</Label>
              <Input id="audit_date" name="audit_date" type="date" value={formData.audit_date} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline_date">Deadline Date</Label>
              <Input id="deadline_date" name="deadline_date" type="date" value={formData.deadline_date} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fees">Fees (₹)</Label>
              <Input id="fees" name="fees" type="number" min="0" value={formData.fees} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ope">OPE Limit (₹)</Label>
              <Input id="ope" name="ope" type="number" min="0" value={formData.ope} onChange={handleChange} />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}