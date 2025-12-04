import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface AssignmentSearchExportProps {
  assignments: any[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function AssignmentSearchExport({ assignments, searchQuery, onSearchChange }: AssignmentSearchExportProps) {
  const [exporting, setExporting] = useState(false);

  const exportToExcel = () => {
    setExporting(true);
    try {
      const exportData = assignments.map(a => ({
        'Assignment Number': a.assignment_number,
        'Client Name': a.client_name,
        'Branch Name': a.branch_name,
        'City': a.city,
        'State': a.state,
        'Pincode': a.pincode,
        'Address': a.address,
        'Audit Type': a.audit_type,
        'Audit Date': a.audit_date,
        'Deadline Date': a.deadline_date,
        'Status': a.status,
        'Fees (₹)': a.fees,
        'OPE (₹)': a.ope || 0,
        'Created At': new Date(a.created_at).toLocaleDateString(),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Assignments');
      XLSX.writeFile(wb, `assignments_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Exported to Excel successfully!');
    } catch (error) {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = () => {
    setExporting(true);
    try {
      const headers = ['Assignment Number', 'Client Name', 'Branch Name', 'City', 'State', 'Pincode', 'Audit Type', 'Audit Date', 'Deadline Date', 'Status', 'Fees', 'OPE'];
      const csvContent = [
        headers.join(','),
        ...assignments.map(a => [
          a.assignment_number,
          `"${a.client_name}"`,
          `"${a.branch_name}"`,
          a.city,
          a.state,
          a.pincode,
          a.audit_type,
          a.audit_date,
          a.deadline_date,
          a.status,
          a.fees,
          a.ope || 0,
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `assignments_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Exported to CSV successfully!');
    } catch (error) {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search assignments..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={exporting || assignments.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export ({assignments.length})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export to Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToCSV}>
              <FileText className="h-4 w-4 mr-2" />
              Export to CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
