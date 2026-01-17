import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusChangeRequest {
  assignmentId: string;
  newStatus: string;
  previousStatus: string;
}

// Input validation helpers
function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function sanitizeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .slice(0, 500);
}

const statusLabels: Record<string, string> = {
  'open': 'Open',
  'allotted': 'Allotted',
  'in_progress': 'In Progress',
  'completed': 'Completed',
  'paid': 'Paid',
  'cancelled': 'Cancelled',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify JWT and get the caller's identity
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create client with user's JWT to verify identity
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Invalid or expired token:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse and validate input
    const body = await req.json();
    const { assignmentId, newStatus, previousStatus }: StatusChangeRequest = body;

    // Validate assignment ID
    if (!assignmentId || !validateUUID(assignmentId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid assignment ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate status
    if (!newStatus || typeof newStatus !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid status' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get assignment details
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select(`
        *,
        auditor:profiles!assignments_allotted_to_fkey(id, email, full_name, phone)
      `)
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      console.error('Assignment not found:', assignmentError?.message);
      return new Response(
        JSON.stringify({ error: 'Assignment not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Log activity
    await supabase.from('assignment_activities').insert({
      assignment_id: assignmentId,
      user_id: user.id,
      activity_type: 'status_change',
      description: `Status changed from ${statusLabels[previousStatus] || previousStatus} to ${statusLabels[newStatus] || newStatus}`,
      metadata: { previous_status: previousStatus, new_status: newStatus },
    });

    // Send email notification to auditor if assigned
    if (assignment.auditor?.email && RESEND_API_KEY) {
      const safeAuditorName = sanitizeHtml(assignment.auditor.full_name || 'Auditor');
      const safeClientName = sanitizeHtml(assignment.client_name || '');
      const safeBranchName = sanitizeHtml(assignment.branch_name || '');
      const safeNewStatus = statusLabels[newStatus] || newStatus;
      const safePreviousStatus = statusLabels[previousStatus] || previousStatus;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
              .status-completed { background: #dcfce7; color: #166534; }
              .status-allotted { background: #dbeafe; color: #1e40af; }
              .status-default { background: #f3f4f6; color: #374151; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📋 Assignment Status Update</h1>
              </div>
              <div class="content">
                <p>Dear ${safeAuditorName},</p>
                <p>The status of your assignment has been updated:</p>
                
                <p style="text-align: center; margin: 20px 0;">
                  <span class="status-badge status-default">${safePreviousStatus}</span>
                  <span style="margin: 0 10px;">→</span>
                  <span class="status-badge ${newStatus === 'completed' ? 'status-completed' : newStatus === 'allotted' ? 'status-allotted' : 'status-default'}">${safeNewStatus}</span>
                </p>
                
                <p><strong>Assignment:</strong> ${safeClientName} - ${safeBranchName}</p>
                
                <p>Please log in to your dashboard to view more details.</p>
                
                <div class="footer">
                  <p>This is an automated notification from Post Audit Management Portal</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Audit Portal <notifications@resend.dev>',
            to: [assignment.auditor.email],
            subject: `📋 Assignment Status Updated: ${safeNewStatus}`,
            html: emailHtml,
          }),
        });
        console.log('Status change email sent to:', assignment.auditor.email);
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Create in-app notification
    if (assignment.allotted_to) {
      await supabase.from('notifications').insert({
        user_id: assignment.allotted_to,
        title: 'Assignment Status Updated',
        message: `Your assignment for ${assignment.client_name} - ${assignment.branch_name} is now ${statusLabels[newStatus] || newStatus}.`,
        type: 'status_change',
        related_assignment_id: assignmentId,
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Status change notification sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-status-notification:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
