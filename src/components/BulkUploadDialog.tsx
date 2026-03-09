import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BulkUploadDialogProps {
  userId: string;
  onSuccess: () => void;
}

export function BulkUploadDialog({ userId, onSuccess }: BulkUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // Helper to accurately parse Excel dates to Supabase accepted YYYY-MM-DD format
  const parseExcelDate = (excelDate: any) => {
    if (!excelDate) return new Date().toISOString().split('T')[0];
    
    // If it's a number, it's an Excel date serial code
    if (typeof excelDate === 'number') {
      const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    
    try {
      const d = new Date(excelDate);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch(e) {
      console.error("Date parse error", e);
    }
    
    return new Date().toISOString().split('T')[0];
  };

  // Helper to parse "Yes", "No", "True", "False" from Excel to Booleans
  const parseBoolean = (val: any) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const lower = val.toLowerCase().trim();
      return lower === 'yes' || lower === 'y' || lower === 'true' || lower === '1';
    }
    if (typeof val === 'number') return val === 1;
    return false;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });

      if (jsonData.length === 0) {
        throw new Error("The uploaded Excel file is empty.");
      }

      // Map rows EXACTLY to the Supabase schema provided
      const assignments = jsonData.map((row: any) => ({
        client_name: String(row['Client Name'] || row['client_name'] || 'Unknown Client'),
        branch_name: String(row['Branch Name'] || row['branch_name'] || 'Main Branch'),
        industry: row['Industry'] || row['industry'] || null,
        address: String(row['Address'] || row['address'] || 'N/A'),
        city: String(row['City'] || row['city'] || 'Unknown City'),
        state: String(row['State'] || row['state'] || 'Unknown State'),
        pincode: String(row['Pincode'] || row['pincode'] || '000000'),
        audit_type: String(row['Audit Type'] || row['audit_type'] || 'Stock Audit'),
        audit_date: parseExcelDate(row['Audit Date'] || row['audit_date']),
        deadline_date: parseExcelDate(row['Deadline Date'] || row['deadline_date']),
        duration: String(row['Duration'] || row['duration'] || '1 Day'),
        qualification_required: row['Qualification Required'] || row['qualification_required'] || null,
        
        // Finances & Payouts
        fees: parseFloat(row['Fees'] || row['fees'] || 0),
        ope: parseFloat(row['OPE'] || row['ope'] || 0),
        reimbursement_food: parseFloat(row['Reimbursement Food'] || row['reimbursement_food'] || 0),
        reimbursement_conveyance: parseFloat(row['Reimbursement Conveyance'] || row['reimbursement_conveyance'] || 0),
        reimbursement_courier: parseFloat(row['Reimbursement Courier'] || row['reimbursement_courier'] || 0),
        reimbursement: row['Reimbursement Guidelines'] || row['reimbursement'] || null,
        
        // Logistics & Asset Requirements (Matching the exact DB schema names)
        requires_laptop: parseBoolean(row['Laptop Required'] || row['requires_laptop']),
        requires_smartphone: parseBoolean(row['Smartphone Required'] || row['requires_smartphone']),
        requires_bike: parseBoolean(row['Bike Required'] || row['requires_bike']),
        additional_info: row['Additional Info'] || row['additional_info'] || null,
        
        created_by: userId,
        status: 'open' 
      }));

      const { error } = await supabase.from('assignments').insert(assignments);

      if (error) {
        console.error("Supabase Insert Error:", error);
        throw new Error(error.message);
      }

      toast({
        title: 'Success',
        description: `${assignments.length} assignments uploaded successfully!`,
      });

      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || "Failed to process the Excel file. Please check the template format.",
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Client Name': 'SBI',
        'Branch Name': 'Marine Lines',
        'Industry': 'Banking',
        'Address': '123 Main Street',
        'City': 'Mumbai',
        'State': 'Maharashtra',
        'Pincode': '400001',
        'Audit Type': 'Stock Audit',
        'Audit Date': '2024-01-15',
        'Deadline Date': '2024-01-20',
        'Duration': '2 Days',
        'Qualification Required': 'CA / Semi-CA',
        'Fees': 15000,
        'OPE': 2000,
        'Reimbursement Food': 500,
        'Reimbursement Conveyance': 1000,
        'Reimbursement Courier': 200,
        'Reimbursement Guidelines': 'Actuals as per company limits',
        'Laptop Required': 'Yes',
        'Smartphone Required': 'Yes',
        'Bike Required': 'No',
        'Additional Info': 'Please carry valid ID proof.'
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    
    const wscols = [
      {wch: 15}, {wch: 15}, {wch: 12}, {wch: 25}, {wch: 15}, {wch: 15}, {wch: 10}, 
      {wch: 15}, {wch: 12}, {wch: 15}, {wch: 10}, {wch: 20}, {wch: 10}, {wch: 10},
      {wch: 18}, {wch: 25}, {wch: 20}, {wch: 30}, {wch: 15}, {wch: 20}, {wch: 15}, {wch: 30}
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assignments');
    XLSX.writeFile(wb, 'assignment_template_v2.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Upload Assignments</DialogTitle>
          <DialogDescription>
            Upload an Excel file with detailed assignment requirements.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg border">
            <p className="font-semibold text-foreground mb-2">Template now supports full payouts & logistics!</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>Core:</strong> Client Name, Branch, City, State, Dates</li>
              <li><strong>Payouts:</strong> Fees, OPE, Food, Conveyance, Courier</li>
              <li><strong>Requirements (Yes/No):</strong> Laptop, Smartphone, Bike</li>
              <li><strong>Details:</strong> Industry, Duration, Qualification, Info</li>
            </ul>
          </div>
          
          <Button variant="outline" onClick={downloadTemplate} className="w-full font-medium">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
            Download Updated Template
          </Button>

          <div className="space-y-2 pt-2 border-t">
            <label htmlFor="file-upload" className="text-sm font-medium">
              Upload Filled Template (.xlsx)
            </label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
              className="cursor-pointer"
            />
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 p-3 rounded-md">
              <Upload className="h-4 w-4 animate-bounce" />
              Processing and uploading assignments...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}