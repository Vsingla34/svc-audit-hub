import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, IndianRupee, MapPin, Briefcase, Laptop, Smartphone, Bike, CalendarDays, FileText } from 'lucide-react';

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", 
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", 
  "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", 
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal"
];

const AUDIT_TYPES = [
  "Statutory Audit", "Internal Audit", "Tax Audit", "Stock/Inventory Audit",
  "Concurrent Audit", "Forensic Audit", "Information Systems (IS) Audit",
  "Compliance Audit", "Management Audit", "Operational Audit", "Financial Audit",
  "Secretarial Audit", "Due Diligence", "Fixed Assets Audit", "Revenue Audit", "Other"
];

export function CreateAssignmentDialog({ onAssignmentCreated }: { onAssignmentCreated: () => void }) {
  const { user } = useAuth(); // CRITICAL: Needed for 'created_by' field
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // State mapped exactly to your DB schema
  const [formData, setFormData] = useState({
    client_name: '',
    branch_name: '',
    audit_type: '',
    industry: '',
    duration: '',
    qualification_required: '',
    address: '',
    state: '',
    city: '',
    pincode: '', 
    audit_date: '',
    deadline_date: '',
    additional_info: '',
    requires_smartphone: false,
    requires_laptop: false,
    requires_bike: false,
    fees: '',
    ope: '',
    reimbursement_food: '',
    reimbursement_courier: '',
    reimbursement_conveyance: '',
    reimbursement: '' // text notes
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData({ ...formData, [name]: checked });
  };

  const handleStateChange = (value: string) => {
    setFormData({ ...formData, state: value });
  };

  const handleAuditTypeChange = (value: string) => {
    setFormData({ ...formData, audit_type: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to create an assignment.");
      return;
    }
    setSaving(true);
    try {
      if (!formData.audit_type) throw new Error("Please select an Audit Type");
      if (!formData.state) throw new Error("Please select a State");

      // Construct payload EXACTLY matching your database columns
      const payload = {
        client_name: formData.client_name,
        branch_name: formData.branch_name,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        audit_type: formData.audit_type,
        industry: formData.industry || null,
        audit_date: formData.audit_date,
        deadline_date: formData.deadline_date,
        duration: formData.duration || null,
        qualification_required: formData.qualification_required || null,
        additional_info: formData.additional_info || null,
        
        // Payout Details
        fees: Number(formData.fees) || 0,
        ope: Number(formData.ope) || 0,
        reimbursement: formData.reimbursement || null,
        reimbursement_food: Number(formData.reimbursement_food) || 0,
        reimbursement_courier: Number(formData.reimbursement_courier) || 0,
        reimbursement_conveyance: Number(formData.reimbursement_conveyance) || 0,

        // Asset Requirements (Syncing both laptop columns just in case)
        requires_smartphone: formData.requires_smartphone,
        requires_laptop: formData.requires_laptop,
        laptop_required: formData.requires_laptop, 
        requires_bike: formData.requires_bike,

        // System Fields
        status: 'open',
        created_by: user.id // Mandatory in your schema
      };

      const { error } = await supabase.from('assignments').insert([payload]);

      if (error) throw error;

      toast.success("Assignment created successfully!");
      setOpen(false);
      onAssignmentCreated(); 
      
      // Reset form on success
      setFormData({
        client_name: '', branch_name: '', audit_type: '', industry: '', duration: '', qualification_required: '',
        address: '', state: '', city: '', pincode: '', audit_date: '', deadline_date: '', additional_info: '',
        requires_smartphone: false, requires_laptop: false, requires_bike: false,
        fees: '', ope: '', reimbursement_food: '', reimbursement_courier: '', reimbursement_conveyance: '', reimbursement: ''
      });
      
    } catch (error: any) {
      toast.error(error.message || "Failed to create assignment");
      console.error("Assignment Creation Error:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#4338CA] hover:bg-[#4338CA]/90 text-white">
          <Plus className="mr-2 h-4 w-4" /> Create Assignment
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create New Assignment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 mt-4">
          
          {/* SECTION 1: BASIC DETAILS */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
              <Briefcase className="h-4 w-4" /> Core Audit Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input required name="client_name" value={formData.client_name} onChange={handleChange} placeholder="e.g. HDFC Bank" />
              </div>
              <div className="space-y-2">
                <Label>Branch/Unit Name *</Label>
                <Input required name="branch_name" value={formData.branch_name} onChange={handleChange} placeholder="e.g. Connaught Place Branch" />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input name="industry" value={formData.industry} onChange={handleChange} placeholder="e.g. Banking, Retail" />
              </div>
              <div className="space-y-2">
                <Label>Audit Type *</Label>
                <Select value={formData.audit_type} onValueChange={handleAuditTypeChange} required>
                  <SelectTrigger><SelectValue placeholder="Select Audit Type" /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {AUDIT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Required Qualification</Label>
                <Input name="qualification_required" value={formData.qualification_required} onChange={handleChange} placeholder="e.g. CA, B.Com" />
              </div>
              <div className="space-y-2">
                <Label>Est. Duration</Label>
                <Input name="duration" value={formData.duration} onChange={handleChange} placeholder="e.g. 2 Days, 1 Week" />
              </div>
            </div>
          </div>

          {/* SECTION 2: LOCATION & DATES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                <MapPin className="h-4 w-4" /> Location
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Full Address *</Label>
                  <Textarea required name="address" value={formData.address} onChange={handleChange} placeholder="Enter the complete address..." className="resize-none" />
                </div>
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input required name="city" value={formData.city} onChange={handleChange} placeholder="City Name" />
                </div>
                <div className="space-y-2">
                  <Label>PIN Code *</Label>
                  <Input required name="pincode" value={formData.pincode} onChange={handleChange} placeholder="PIN" maxLength={6} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>State *</Label>
                  <Select value={formData.state} onValueChange={handleStateChange} required>
                    <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {INDIAN_STATES.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                <CalendarDays className="h-4 w-4" /> Schedule & Requirements
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Audit Date *</Label>
                  <Input required type="date" name="audit_date" value={formData.audit_date} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Report Deadline *</Label>
                  <Input required type="date" name="deadline_date" value={formData.deadline_date} onChange={handleChange} />
                </div>
                
                <div className="col-span-2 space-y-3 pt-2">
                  <Label>Required Assets</Label>
                  <div className="flex flex-wrap gap-4 bg-muted/20 p-3 rounded-lg border">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="req_smartphone" checked={formData.requires_smartphone} onCheckedChange={(c) => handleCheckboxChange('requires_smartphone', !!c)} />
                      <Label htmlFor="req_smartphone" className="flex items-center gap-1 cursor-pointer"><Smartphone className="h-4 w-4 text-muted-foreground"/> Phone</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="req_laptop" checked={formData.requires_laptop} onCheckedChange={(c) => handleCheckboxChange('requires_laptop', !!c)} />
                      <Label htmlFor="req_laptop" className="flex items-center gap-1 cursor-pointer"><Laptop className="h-4 w-4 text-muted-foreground"/> Laptop</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="req_bike" checked={formData.requires_bike} onCheckedChange={(c) => handleCheckboxChange('requires_bike', !!c)} />
                      <Label htmlFor="req_bike" className="flex items-center gap-1 cursor-pointer"><Bike className="h-4 w-4 text-muted-foreground"/> Two-Wheeler</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: PAYOUT & REIMBURSEMENTS */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
              <IndianRupee className="h-4 w-4" /> Payout & Reimbursements
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Base Fees (₹) *</Label>
                <Input required type="number" name="fees" value={formData.fees} onChange={handleChange} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">OPE Limit (₹)</Label>
                <Input type="number" name="ope" value={formData.ope} onChange={handleChange} placeholder="0" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-muted-foreground">Reimbursement Guidelines</Label>
                <Input name="reimbursement" value={formData.reimbursement} onChange={handleChange} placeholder="e.g. As per actuals, Bill required" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/10 p-4 rounded-lg border">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Food Allowance (₹)</Label>
                <Input type="number" name="reimbursement_food" value={formData.reimbursement_food} onChange={handleChange} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Courier Charges (₹)</Label>
                <Input type="number" name="reimbursement_courier" value={formData.reimbursement_courier} onChange={handleChange} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Conveyance (₹)</Label>
                <Input type="number" name="reimbursement_conveyance" value={formData.reimbursement_conveyance} onChange={handleChange} placeholder="0" />
              </div>
            </div>
          </div>

          {/* SECTION 4: ADDITIONAL INFO */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
              <FileText className="h-4 w-4" /> Additional Information
            </h3>
            <Textarea 
              name="additional_info" 
              value={formData.additional_info} 
              onChange={handleChange} 
              placeholder="Any other instructions, scope of work summary, or special requirements for the auditor..." 
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background/95 backdrop-blur py-4 z-10">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-[#4338CA] hover:bg-[#4338CA]/90 px-8" disabled={saving}>
              {saving ? 'Creating Assignment...' : 'Publish Assignment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}