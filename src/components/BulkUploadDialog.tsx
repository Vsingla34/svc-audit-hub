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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const assignments = jsonData.map((row: any) => ({
        client_name: row['Client Name'] || row['client_name'],
        branch_name: row['Branch Name'] || row['branch_name'],
        address: row['Address'] || row['address'],
        city: row['City'] || row['city'],
        state: row['State'] || row['state'],
        pincode: String(row['Pincode'] || row['pincode']),
        audit_type: row['Audit Type'] || row['audit_type'] || 'Stock Audit',
        audit_date: row['Audit Date'] || row['audit_date'],
        deadline_date: row['Deadline Date'] || row['deadline_date'],
        fees: parseFloat(row['Fees'] || row['fees'] || 0),
        ope: parseFloat(row['OPE'] || row['ope'] || 0),
        created_by: userId,
      }));

      const { error } = await supabase.from('assignments').insert(assignments);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${assignments.length} assignments uploaded successfully!`,
      });

      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Client Name': 'SBI',
        'Branch Name': 'Marine Lines',
        'Address': '123 Main Street',
        'City': 'Mumbai',
        'State': 'Maharashtra',
        'Pincode': '400001',
        'Audit Type': 'Stock Audit',
        'Audit Date': '2024-01-15',
        'Deadline Date': '2024-01-20',
        'Fees': 15000,
        'OPE': 2000,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assignments');
    XLSX.writeFile(wb, 'assignment_template.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Upload Assignments</DialogTitle>
          <DialogDescription>
            Upload an Excel file with assignment details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Required columns:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Client Name, Branch Name, Address</li>
              <li>City, State, Pincode</li>
              <li>Audit Type, Audit Date, Deadline Date</li>
              <li>Fees, OPE (optional)</li>
            </ul>
          </div>
          
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            Download Template
          </Button>

          <div className="space-y-2">
            <label htmlFor="file-upload" className="text-sm font-medium">
              Upload Excel File
            </label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Upload className="h-4 w-4 animate-pulse" />
              Processing file...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}