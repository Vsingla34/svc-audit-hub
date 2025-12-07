import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HTML sanitization helper
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
      SUPABASE_URL,
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if caller is an admin
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      console.error('Unauthorized: Only admins can trigger deadline reminders');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('Admin', user.id, 'triggering deadline reminders');

    // Find assignments with deadlines within 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        *,
        auditor:profiles!assignments_allotted_to_fkey(email, full_name)
      `)
      .eq('status', 'allotted')
      .lte('deadline_date', threeDaysFromNow.toISOString().split('T')[0])
      .not('allotted_to', 'is', null);

    if (error) throw error;

    if (!assignments || assignments.length === 0) {
      console.log('No assignments with upcoming deadlines found');
      return new Response(
        JSON.stringify({ message: 'No assignments with upcoming deadlines found', count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${assignments.length} assignments with upcoming deadlines`);

    const emailPromises = assignments.map(async (assignment: any) => {
      // Skip if auditor email is not available
      if (!assignment.auditor?.email) {
        console.warn('Skipping assignment without auditor email:', assignment.id);
        return null;
      }

      // Sanitize all inputs
      const safeFullName = sanitizeHtml(assignment.auditor.full_name || 'Auditor');
      const safeClientName = sanitizeHtml(assignment.client_name || '');
      const safeBranchName = sanitizeHtml(assignment.branch_name || '');
      const safeDeadline = new Date(assignment.deadline_date).toLocaleDateString('en-IN');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
              .content { background: #fef3c7; padding: 30px; border-radius: 0 0 8px 8px; }
              .alert { background: white; padding: 20px; border-left: 4px solid #ef4444; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ Deadline Reminder</h1>
              </div>
              <div class="content">
                <p>Dear ${safeFullName},</p>
                
                <div class="alert">
                  <h3>Your assignment deadline is approaching!</h3>
                  <p><strong>Client:</strong> ${safeClientName}</p>
                  <p><strong>Branch:</strong> ${safeBranchName}</p>
                  <p><strong>Deadline:</strong> ${safeDeadline}</p>
                </div>
                
                <p>Please ensure you complete and submit your audit report before the deadline.</p>
                
                <div class="footer">
                  <p>This is an automated reminder from Post Audit Management Portal</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Audit Portal <notifications@resend.dev>',
            to: [assignment.auditor.email],
            subject: '⚠️ Assignment Deadline Reminder - Post Audit Portal',
            html: emailHtml,
          }),
        });

        const result = await res.json();
        console.log('Email sent to:', assignment.auditor.email, 'Result:', result);
        return result;
      } catch (emailError) {
        console.error('Failed to send email to:', assignment.auditor.email, emailError);
        return null;
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r !== null).length;

    console.log(`Successfully sent ${successCount} deadline reminders`);

    return new Response(
      JSON.stringify({ message: `Sent ${successCount} deadline reminders`, count: successCount }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in send-deadline-reminder:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
