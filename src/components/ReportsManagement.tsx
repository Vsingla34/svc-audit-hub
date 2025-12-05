import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Download, FileText, Search, Filter, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface ReportData {
  id: string;
  assignment_number: string;
  client_name: string;
  branch_name: string;
  city: string;
  state: string;
  report_url: string;
  completed_at: string;
  completion_status: string;
  auditor: {
    full_name: string;
    email: string;
  };
}

export function ReportsManagement() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, searchQuery, statusFilter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id,
          assignment_number,
          client_name,
          branch_name,
          city,
          state,
          report_url,
          completed_at,
          completion_status,
          auditor:profiles!assignments_allotted_to_fkey(full_name, email)
        `)
        .not('report_url', 'is', null)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const filterReports = () => {
    let filtered = [...reports];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (report) =>
          report.client_name?.toLowerCase().includes(query) ||
          report.branch_name?.toLowerCase().includes(query) ||
          report.assignment_number?.toLowerCase().includes(query) ||
          report.city?.toLowerCase().includes(query) ||
          report.auditor?.full_name?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((report) => report.completion_status === statusFilter);
    }

    setFilteredReports(filtered);
  };

  const downloadReport = (url: string, assignmentNumber: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${assignmentNumber}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllReports = () => {
    filteredReports.forEach((report, index) => {
      setTimeout(() => {
        downloadReport(report.report_url, report.assignment_number);
      }, index * 500);
    });
    toast.success(`Downloading ${filteredReports.length} reports...`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Audit Reports</h2>
          <p className="text-muted-foreground">View and download all submitted audit reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchReports}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {filteredReports.length > 0 && (
            <Button onClick={downloadAllReports}>
              <Download className="h-4 w-4 mr-2" />
              Download All ({filteredReports.length})
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reports</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {reports.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed Audits</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {reports.filter((r) => r.completion_status === 'completed').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Incomplete Audits</CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {reports.filter((r) => r.completion_status === 'incomplete').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by client, branch, auditor, or assignment number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submitted Reports</CardTitle>
          <CardDescription>
            Showing {filteredReports.length} of {reports.length} reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reports found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Auditor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-mono text-sm">
                        {report.assignment_number}
                      </TableCell>
                      <TableCell className="font-medium">{report.client_name}</TableCell>
                      <TableCell>{report.branch_name}</TableCell>
                      <TableCell>
                        {report.city}, {report.state}
                      </TableCell>
                      <TableCell>{report.auditor?.full_name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={report.completion_status === 'completed' ? 'default' : 'secondary'}
                          className={
                            report.completion_status === 'completed'
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                          }
                        >
                          {report.completion_status === 'completed' ? 'Completed' : 'Incomplete'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {report.completed_at
                          ? format(new Date(report.completed_at), 'dd MMM yyyy')
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(report.report_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadReport(report.report_url, report.assignment_number)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
