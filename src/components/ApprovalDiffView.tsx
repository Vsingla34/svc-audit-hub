import { Check, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ApprovalDiffProps {
  type: 'Profile' | 'Bank';
  currentData: Record<string, any>;
  pendingData: Record<string, any>;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

export function ApprovalDiffView({ type, currentData, pendingData, onApprove, onReject, isProcessing }: ApprovalDiffProps) {
  // Only look at keys that the user actually submitted in their draft
  const editedKeys = Object.keys(pendingData || {}).filter(key => pendingData[key] !== undefined && pendingData[key] !== null);

  if (editedKeys.length === 0) return <div className="p-4 text-center text-muted-foreground">No pending changes found.</div>;

  const formatKeyName = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="space-y-6 border rounded-xl p-0 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b p-4 bg-muted/30">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          {type} KYC Approval
        </h3>
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          Pending Review
        </Badge>
      </div>

      <div className="space-y-1 px-4 pb-4 max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-12 gap-4 text-xs font-bold text-muted-foreground uppercase tracking-wider pb-2 border-b">
          <span className="col-span-3">Field</span>
          <span className="col-span-4">Current Value</span>
          <span className="col-span-1 text-center"></span>
          <span className="col-span-4">Requested Change</span>
        </div>

        {editedKeys.map((key) => {
          const oldValue = currentData[key];
          const newValue = pendingData[key];
          const isChanged = String(oldValue) !== String(newValue);

          return (
            <div key={key} className={`grid grid-cols-12 gap-4 p-3 rounded-lg items-center transition-colors ${isChanged ? 'bg-blue-50/40 border border-blue-100' : 'hover:bg-muted/50'}`}>
              <span className="col-span-3 font-medium text-sm text-foreground">
                {formatKeyName(key)}
              </span>
              
              <span className="col-span-4 text-sm text-muted-foreground line-clamp-2 break-words">
                {oldValue ? String(oldValue) : <em className="text-gray-400">Empty / New</em>}
              </span>
              
              <div className="col-span-1 flex justify-center">
                {isChanged && <ArrowRight className="h-4 w-4 text-blue-500" />}
              </div>

              <span className={`col-span-4 text-sm break-words ${isChanged ? 'font-semibold text-blue-700' : 'text-foreground'}`}>
                {String(newValue)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 p-4 border-t justify-end bg-muted/10">
        <Button onClick={onReject} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" disabled={isProcessing}>
          <X className="h-4 w-4 mr-2" /> Reject
        </Button>
        <Button onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white" disabled={isProcessing}>
          <Check className="h-4 w-4 mr-2" /> {isProcessing ? 'Processing...' : 'Approve & Publish'}
        </Button>
      </div>
    </div>
  );
}