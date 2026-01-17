import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Upload, FileText, Image, Trash2, Download, 
  Plus, FileImage, Receipt, Camera, File, ExternalLink
} from 'lucide-react';

interface Document {
  id: string;
  assignment_id: string;
  uploaded_by: string;
  document_type: string;
  file_path: string;
  file_name: string;
  file_size: number;
  description: string | null;
  created_at: string;
}

interface AssignmentDocumentsProps {
  assignmentId: string;
  canUpload?: boolean;
}

const documentTypes = [
  { value: 'photo', label: 'Site Photo', icon: Camera },
  { value: 'receipt', label: 'Receipt/Invoice', icon: Receipt },
  { value: 'supporting', label: 'Supporting Document', icon: FileText },
  { value: 'id_proof', label: 'ID Proof', icon: FileImage },
  { value: 'other', label: 'Other', icon: File },
];

export function AssignmentDocuments({ assignmentId, canUpload = true }: AssignmentDocumentsProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('supporting');
  const [description, setDescription] = useState('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDocuments();
  }, [assignmentId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignment_documents')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
      
      // Generate signed URLs for all documents
      if (data && data.length > 0) {
        const urls: Record<string, string> = {};
        for (const doc of data) {
          const { data: urlData } = await supabase.storage
            .from('kyc-documents')
            .createSignedUrl(doc.file_path, 3600);
          if (urlData) {
            urls[doc.id] = urlData.signedUrl;
          }
        }
        setSignedUrls(urls);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `doc-${assignmentId}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Insert document record
      const { error: insertError } = await supabase
        .from('assignment_documents')
        .insert({
          assignment_id: assignmentId,
          uploaded_by: user.id,
          document_type: documentType,
          file_path: filePath,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          description: description || null,
        });

      if (insertError) throw insertError;

      // Log activity
      await supabase.from('assignment_activities').insert({
        assignment_id: assignmentId,
        user_id: user.id,
        activity_type: 'document_uploaded',
        description: `Uploaded ${documentTypes.find(t => t.value === documentType)?.label || 'document'}: ${selectedFile.name}`,
        metadata: { file_name: selectedFile.name, document_type: documentType },
      });

      toast.success('Document uploaded successfully');
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setDescription('');
      setDocumentType('supporting');
      fetchDocuments();
    } catch (error: any) {
      toast.error('Failed to upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Delete this document?')) return;

    try {
      // Delete from storage
      await supabase.storage.from('kyc-documents').remove([doc.file_path]);

      // Delete record
      const { error } = await supabase
        .from('assignment_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast.success('Document deleted');
      fetchDocuments();
    } catch (error: any) {
      toast.error('Failed to delete: ' + error.message);
    }
  };

  const getDocTypeIcon = (type: string) => {
    const docType = documentTypes.find(t => t.value === type);
    return docType?.icon || File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Supporting Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Supporting Documents
              </CardTitle>
              <CardDescription className="mt-1">
                Upload photos, receipts, and other supporting documents
              </CardDescription>
            </div>
            {canUpload && (
              <Button onClick={() => setUploadDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Document
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No documents uploaded yet</p>
              {canUpload && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Upload Document
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {documents.map(doc => {
                const Icon = getDocTypeIcon(doc.document_type);
                const signedUrl = signedUrls[doc.id];
                
                return (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {documentTypes.find(t => t.value === doc.document_type)?.label} • {formatFileSize(doc.file_size || 0)} • {format(new Date(doc.created_at), 'dd MMM yyyy')}
                        </p>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {signedUrl && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => window.open(signedUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {canUpload && doc.uploaded_by === user?.id && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(doc)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add supporting documents for this assignment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select File</Label>
              <Input 
                type="file" 
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Supported: Images, PDF, Word documents (max 10MB)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the document"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setUploadDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex-1"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
