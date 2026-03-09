import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Building2, Calendar, DollarSign, Briefcase } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface EditAssignmentDialogProps {
  assignment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditAssignmentDialog({ assignment, open, onOpenChange, onSuccess }: EditAssignmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Core details
    client_name: '',
    branch_name: '',
    city: '',
    state: '',
    industry: '',
    
    // Audit specs
    audit_type: '',
    audit_date: '',
    deadline_date: '',
    duration: '',
    qualification_required: '',
    
    // Finances & Reimbursements
    fees: 0,
    ope: 0,
    reimbursement_food: 0,
    reimbursement_conveyance: 0,
    reimbursement_courier: 0,
    reimbursement: '',
    
    // Logistics & Asset Requirements
    requires_laptop: false,
    requires_smartphone: false,
    requires_bike: false,
    additional_info: '',
  });

  // Pre-fill form when the assignment changes or dialog opens
  useEffect(() => {
    if (assignment && open) {
      setFormData({
        client_name: assignment.client_name || '',
        branch_name: assignment.branch_name || '',
        city: assignment.city || '',
        state: assignment.state || '',
        industry: assignment.industry || '',
        
        audit_type: assignment.audit_type || '',
        audit_date: assignment.audit_date ? new Date(assignment.audit_date).toISOString().split('T')[0] : '',
        deadline_date: assignment.deadline_date ? new Date(assignment.deadline_date).toISOString().split('T')[0] : '',
        duration: assignment.duration || '1 Day',
        qualification_required: assignment.qualification_required || '',
        
        fees: assignment.fees || 0,
        ope: assignment.ope || 0,
        reimbursement_food: assignment.reimbursement_food || 0,
        reimbursement_conveyance: assignment.reimbursement_conveyance || 0,
        reimbursement_courier: assignment.reimbursement_courier || 0,
        reimbursement: assignment.reimbursement || '',
        
        requires_laptop: assignment.requires_laptop || false,
        requires_smartphone: assignment.requires_smartphone || false,
        requires_bike: assignment.requires_bike || false,
        additional_info: assignment.additional_info || '',
      });
    }
  }, [assignment, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Auto-parse number fields safely
    const numericFields = ['fees', 'ope', 'reimbursement_food', 'reimbursement_conveyance', 'reimbursement_courier'];
    
    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value,
    }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="bg-muted/30 p-6 border-b sticky top-0 z-10 backdrop-blur-sm">
            <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-primary" /> Edit Assignment
            </DialogTitle>
            <DialogDescription>
                Update requirements and details for {assignment?.client_name} - {assignment?.branch_name}
            </DialogDescription>
            </DialogHeader>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          {/* SECTION 1: Core Details */}
          <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-primary">
                  <Building2 className="h-5 w-5" /> Core Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="client_name">Client Name *</Label>
                    <Input id="client_name" name="client_name" value={formData.client_name} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="branch_name">Branch Name *</Label>
                    <Input id="branch_name" name="branch_name" value={formData.branch_name} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input id="industry" name="industry" value={formData.industry} onChange={handleChange} placeholder="e.g. Banking, Retail" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input id="city" name="city" value={formData.city} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input id="state" name="state" value={formData.state} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="qualification_required">Required Qualification</Label>
                    <Input id="qualification_required" name="qualification_required" value={formData.qualification_required} onChange={handleChange} placeholder="e.g. CA, Semi-CA" />
                </div>
              </div>
          </div>

          <Separator />

          {/* SECTION 2: Schedule & Timelines */}
          <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-primary">
                  <Calendar className="h-5 w-5" /> Schedule & Timeline
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="audit_type">Audit Type *</Label>
                    <Input id="audit_type" name="audit_type" value={formData.audit_type} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="audit_date">Audit Date *</Label>
                    <Input id="audit_date" name="audit_date" type="date" value={formData.audit_date} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="deadline_date">Deadline Date *</Label>
                    <Input id="deadline_date" name="deadline_date" type="date" value={formData.deadline_date} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="duration">Estimated Duration</Label>
                    <Input id="duration" name="duration" value={formData.duration} onChange={handleChange} placeholder="e.g. 2 Days" />
                </div>
              </div>
          </div>

          <Separator />

          {/* SECTION 3: Payouts & Finances */}
          <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-primary">
                  <DollarSign className="h-5 w-5" /> Payouts & Allowances
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="fees">Base Fees (₹) *</Label>
                    <Input id="fees" name="fees" type="number" min="0" value={formData.fees} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ope">OPE Limit (₹)</Label>
                    <Input id="ope" name="ope" type="number" min="0" value={formData.ope} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reimbursement_food">Food (₹)</Label>
                    <Input id="reimbursement_food" name="reimbursement_food" type="number" min="0" value={formData.reimbursement_food} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reimbursement_conveyance">Conveyance (₹)</Label>
                    <Input id="reimbursement_conveyance" name="reimbursement_conveyance" type="number" min="0" value={formData.reimbursement_conveyance} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reimbursement_courier">Courier (₹)</Label>
                    <Input id="reimbursement_courier" name="reimbursement_courier" type="number" min="0" value={formData.reimbursement_courier} onChange={handleChange} />
                </div>
                <div className="space-y-2 md:col-span-5">
                    <Label htmlFor="reimbursement">Reimbursement Guidelines</Label>
                    <Input id="reimbursement" name="reimbursement" value={formData.reimbursement} onChange={handleChange} placeholder="e.g. Train 3AC, Auto Actuals..." />
                </div>
              </div>
          </div>

          <Separator />

          {/* SECTION 4: Logistics & Assets */}
          <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-primary">
                  <Briefcase className="h-5 w-5" /> Requirements & Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Asset Toggles */}
                  <div className="space-y-4 bg-muted/20 p-4 rounded-xl border">
                      <Label className="text-base">Asset Requirements</Label>
                      <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                              <Checkbox id="requires_smartphone" checked={formData.requires_smartphone} onCheckedChange={(c) => handleCheckboxChange('requires_smartphone', !!c)} />
                              <label htmlFor="requires_smartphone" className="text-sm font-medium leading-none cursor-pointer">Requires Smartphone</label>
                          </div>
                          <div className="flex items-center space-x-2">
                              <Checkbox id="requires_laptop" checked={formData.requires_laptop} onCheckedChange={(c) => handleCheckboxChange('requires_laptop', !!c)} />
                              <label htmlFor="requires_laptop" className="text-sm font-medium leading-none cursor-pointer">Requires Laptop</label>
                          </div>
                          <div className="flex items-center space-x-2">
                              <Checkbox id="requires_bike" checked={formData.requires_bike} onCheckedChange={(c) => handleCheckboxChange('requires_bike', !!c)} />
                              <label htmlFor="requires_bike" className="text-sm font-medium leading-none cursor-pointer">Requires Two-Wheeler (Bike)</label>
                          </div>
                      </div>
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-2">
                      <Label htmlFor="additional_info">Additional Instructions</Label>
                      <Textarea 
                         id="additional_info" 
                         name="additional_info" 
                         value={formData.additional_info} 
                         onChange={handleChange} 
                         placeholder="Enter any special instructions, documents to carry, etc..."
                         className="h-32 resize-none"
                      />
                  </div>
              </div>
          </div>

          {/* Fixed Footer for scrolling */}
          <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t mt-8">
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                </Button>
            </DialogFooter>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}