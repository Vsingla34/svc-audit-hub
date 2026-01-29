import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { addDays, format } from 'date-fns';

// Using the same competency list for Industry
const INDUSTRIES = [
  "Accounting & Bookkeeping", "Financial Reporting", "Manufacturing", "Banking", 
  "Retail", "Technology", "Healthcare", "Real Estate", "Logistics", "Hospitality",
  "Automotive", "Education", "Consulting", "Non-Profit"
];

const formSchema = z.object({
  client_name: z.string().min(2, "Client name is required"),
  branch_name: z.string().min(2, "Branch name is required"),
  assignment_number: z.string().min(1, "Assignment ID is required"),
  audit_type: z.string().min(1, "Audit type is required"),
  industry: z.string().min(1, "Industry is required"),
  audit_date: z.string().min(1, "Audit date is required"),
  deadline_date: z.string().min(1, "Deadline date is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  // Changed to coerce number to handle input type="number" correctly
  fees: z.coerce.number().min(1, "Fees must be greater than 0"),
  qualification_required: z.string().min(1, "Qualification is required"),
  duration: z.string().min(1, "Duration is required"),
  reimbursement: z.string().optional(),
  additional_info: z.string().optional(),
  laptop_required: z.boolean().default(false),
  address: z.string().min(3, "Address is required"),
  pincode: z.string().min(3, "Pincode is required"),
});

export function CreateAssignmentDialog({ onAssignmentCreated }: { onAssignmentCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  // Calculate a default deadline (e.g., 7 days from now)
  const defaultDeadline = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_name: "",
      assignment_number: "",
      audit_type: "",
      industry: "",
      city: "",
      state: "",
      fees: 0,
      qualification_required: "",
      duration: "",
      reimbursement: "",
      additional_info: "",
      laptop_required: false,
      audit_date: "",
      // Pre-fill hidden required fields so validation passes
      branch_name: "Main Branch",
      address: "TBD",
      pincode: "000000",
      deadline_date: defaultDeadline,
    },
  });

  // Watch for validation errors in console for debugging
  useEffect(() => {
    if (Object.keys(form.formState.errors).length > 0) {
      console.log("Validation Errors:", form.formState.errors);
    }
  }, [form.formState.errors]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Submitting values:", values);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from('assignments').insert({
        ...values,
        created_by: user.id,
        status: 'open',
      });

      if (error) throw error;

      toast({
        title: "Assignment Created",
        description: "The assignment has been successfully posted.",
      });
      setOpen(false);
      form.reset();
      onAssignmentCreated();
    } catch (error: any) {
      console.error("Supabase Error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create assignment",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Create Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Assignment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assignment_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignment ID</FormLabel>
                    <FormControl><Input placeholder="e.g. ASG-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="audit_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type (Audit Type)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Internal Audit">Internal Audit</SelectItem>
                        <SelectItem value="Statutory Audit">Statutory Audit</SelectItem>
                        <SelectItem value="Stock Audit">Stock Audit</SelectItem>
                        <SelectItem value="Tax Audit">Tax Audit</SelectItem>
                        <SelectItem value="Concurrent Audit">Concurrent Audit</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl><Input placeholder="Client Name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Industry" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {INDUSTRIES.map(ind => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount per man/day (₹)</FormLabel>
                    <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="qualification_required"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qualification Required</FormLabel>
                    <FormControl><Input placeholder="e.g. CA Inter, Qualified CA" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="audit_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <FormControl><Input placeholder="e.g. 5 Days" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (City)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (State)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Hidden Fields: We render them but keep them hidden. 
                Crucially, we do NOT override 'value' here so RHF can control them. */}
            <div className="hidden">
               <FormField control={form.control} name="branch_name" render={({ field }) => <Input {...field} />} />
               <FormField control={form.control} name="deadline_date" render={({ field }) => <Input {...field} />} />
               <FormField control={form.control} name="address" render={({ field }) => <Input {...field} />} />
               <FormField control={form.control} name="pincode" render={({ field }) => <Input {...field} />} />
            </div>

            <FormField
              control={form.control}
              name="reimbursement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reimbursement Policy</FormLabel>
                  <FormControl><Input placeholder="e.g. Travel & Food at actuals" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="laptop_required"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Laptop Required?</FormLabel>
                    <FormDescription>Check if the auditor must bring their own laptop.</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additional_info"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Information</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter any specific requirements, scope details, or special instructions here..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">Post Assignment</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}