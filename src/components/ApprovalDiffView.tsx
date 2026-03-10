import { useState, useEffect } from 'react';
import { Check, X, ArrowRight, ExternalLink, FileText, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ApprovalDiffProps {
  type: 'Profile' | 'Bank';
  currentData: Record<string, any>;
  pendingData: Record<string, any>;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

// Helper Component: Generates secure, expiring links for private KYC documents
function SecureFileLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string>('#');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSignedUrl() {
      if (!path) return;
      if (path.startsWith('http')) {
        setUrl(path);
        setLoading(false);
        return;
      }

      // Generate a secure URL that expires in 1 hour
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(path, 3600);

      if (data?.signedUrl) {
        setUrl(data.signedUrl);
      } else if (error) {
        console.error("Error fetching secure document link:", error);
      }
      setLoading(false);
    }

    fetchSignedUrl();
  }, [path]);

  if (loading) {
    return <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-2"><div className="h-3 w-3 border-2 border-[#4338CA] border-t-transparent rounded-full animate-spin"/> Securing link...</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-[#4338CA] hover:text-[#4338CA]/80 hover:underline font-semibold bg-[#4338CA]/10 px-3 py-1.5 rounded-lg transition-all border border-[#4338CA]/20 hover:bg-[#4338CA]/20 shadow-sm w-fit"
    >
      <FileText className="h-4 w-4" />
      View Attached Document
      <ExternalLink className="h-3 w-3 ml-1 opacity-70" />
    </a>
  );
}

// THIS IS THE EXPORT THAT VITE WAS LOOKING FOR
export function ApprovalDiffView({ type, currentData, pendingData, onApprove, onReject, isProcessing }: ApprovalDiffProps) {
  
  // Formats keys like 'full_name' into 'Full Name'
  const formatKeyName = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Detect if a key corresponds to an uploaded file
  const isFileField = (key: string) => {
    const lowerKey = key.toLowerCase();
    return lowerKey.endsWith('_url') || 
           lowerKey.includes('photo') || 
           lowerKey.includes('resume') || 
           lowerKey.includes('cheque') || 
           lowerKey.includes('pan_card') || 
           lowerKey.includes('aadhaar');
  };

  // Safely renders any value type
  const renderValue = (key: string, val: any) => {
    if (val === null || val === undefined || val === '') return <em className="text-gray-400 font-normal">Not Provided</em>;
    if (typeof val === 'boolean') return val ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Yes</Badge> : <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-none">No</Badge>;
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : <em className="text-gray-400 font-normal">None Selected</em>;
    
    // If this field is a file URL, render our beautiful secure link button
    if (typeof val === 'string' && isFileField(key)) {
      return <SecureFileLink path={val} />;
    }

    return String(val);
  };

  // FIX FOR [object Object]: Flattens nested relation objects (like the 'profiles' join)
  const flattenData = (data: Record<string, any> | null) => {
    if (!data) return {};
    const flat: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Extract nested keys (e.g. pulls full_name out of the profiles object)
        for (const [subKey, subValue] of Object.entries(value)) {
          flat[subKey] = subValue;
        }
      } else {
        flat[key] = value;
      }
    }
    return flat;
  };

  const flatCurrent = flattenData(currentData);
  const flatPending = flattenData(pendingData);

  // 1. Get ALL unique keys to show the full profile context
  const allKeys = Array.from(new Set([...Object.keys(flatCurrent), ...Object.keys(flatPending)]));

  // 2. Filter out system/internal keys that the admin doesn't need to read
  const ignoreKeys = ['id', 'created_at', 'updated_at', 'user_id', 'profile_status', 'bank_status', 'rejection_reason', 'pending_profile_data', 'pending_bank_data', 'profiles'];
  
  // 3. Map keys to display objects
  const displayItems = allKeys
    .filter(key => !ignoreKeys.includes(key))
    .map(key => {
      const oldValue = flatCurrent[key];
      // If pending explicitly has this key, use it. Otherwise fallback to old data (unchanged context)
      const newValue = (key in flatPending) ? flatPending[key] : oldValue;
      
      const isChanged = (key in flatPending) && JSON.stringify(oldValue) !== JSON.stringify(newValue);
      
      return { key, oldValue, newValue, isChanged };
    })
    .filter(item => {
       // Hide fields that are completely empty AND didn't change (keeps UI clean)
       const isEmpty = (item.newValue === null || item.newValue === '' || item.newValue === undefined || (Array.isArray(item.newValue) && item.newValue.length === 0));
       return !isEmpty || item.isChanged;
    });

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-h-[85vh]">
      
      {/* HEADER */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {type} Application Review
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Review the details below before approving.</p>
        </div>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 px-3 py-1 shadow-sm">
          <AlertCircle className="h-3.5 w-3.5 mr-1.5" /> Pending Approval
        </Badge>
      </div>

      {/* ALERT FOR BANK INFO */}
      {type === 'Profile' && (
        <div className="px-6 pt-4 shrink-0">
          <Alert className="bg-blue-50/50 border-blue-100 text-blue-800">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs font-medium">
              Note: Bank & Payment KYC documents are reviewed in a separate approval flow to maintain data security.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* CONTENT LIST */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {displayItems.length === 0 ? (
           <div className="py-16 text-center flex flex-col items-center bg-gray-50 rounded-xl border border-dashed">
              <Check className="h-12 w-12 text-green-500 mb-3 opacity-50" />
              <p className="text-gray-600 font-medium text-lg">No details provided yet.</p>
           </div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            {displayItems.map(({ key, oldValue, newValue, isChanged }, index) => {
              const hasOldValue = oldValue !== null && oldValue !== undefined && oldValue !== '' && !(Array.isArray(oldValue) && oldValue.length === 0);
              const isEven = index % 2 === 0;
              
              return (
                <div key={key} className={`flex flex-col sm:flex-row sm:items-start p-4 transition-colors ${isEven ? 'bg-gray-50/50' : 'bg-white'} ${index !== displayItems.length - 1 ? 'border-b' : ''} ${isChanged ? 'bg-blue-50/30' : ''}`}>
                  
                  {/* Field Label (Left) */}
                  <div className="w-full sm:w-1/3 flex flex-col gap-1.5 pr-4 mb-2 sm:mb-0">
                    <span className="font-semibold text-sm text-gray-700">
                      {formatKeyName(key)}
                    </span>
                    
                    <div className="flex gap-2">
                      {isChanged && hasOldValue && <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-800 border-amber-300 uppercase tracking-widest px-2 py-0">Edited</Badge>}
                      {isChanged && !hasOldValue && <Badge variant="outline" className="text-[9px] bg-green-100 text-green-800 border-green-300 uppercase tracking-widest px-2 py-0">New</Badge>}
                    </div>
                  </div>
                  
                  {/* Values (Right) */}
                  <div className="w-full sm:w-2/3 flex flex-col sm:flex-row sm:items-center gap-3">
                    {isChanged && hasOldValue ? (
                      // Display Diff (Old -> New)
                      <div className="flex flex-col sm:flex-row gap-3 w-full items-start sm:items-center">
                        <div className="flex-1 bg-gray-100/80 p-3 rounded-lg border border-gray-200 line-through text-sm text-gray-500 break-words w-full">
                          {renderValue(key, oldValue)}
                        </div>
                        <ArrowRight className="h-5 w-5 text-blue-400 shrink-0 hidden sm:block" />
                        <div className="flex-1 bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm font-semibold text-blue-900 break-words w-full shadow-sm ring-1 ring-blue-500/10">
                          {renderValue(key, newValue)}
                        </div>
                      </div>
                    ) : (
                      // Display Standard Value
                      <div className={`w-full text-sm font-medium break-words p-1 ${isChanged ? 'text-blue-800 font-semibold' : 'text-gray-900'}`}>
                        {renderValue(key, newValue)}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex gap-4 p-5 border-t bg-gray-50 shrink-0 justify-end">
        <Button size="lg" onClick={onReject} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 bg-white" disabled={isProcessing}>
          <X className="h-4 w-4 mr-2" /> Reject Application
        </Button>
        <Button size="lg" onClick={onApprove} className="bg-[#4338CA] hover:bg-[#4338CA]/90 text-white shadow-md" disabled={isProcessing}>
          <Check className="h-4 w-4 mr-2" /> {isProcessing ? 'Processing...' : 'Approve & Publish'}
        </Button>
      </div>
    </div>
  );
}