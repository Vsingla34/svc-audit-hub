import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  to: string;
  auditorName: string;
  assignmentDetails: {
    clientName: string;
    branchName: string;
    city: string;
    state: string;
    auditDate: string;
    fees: number;
  };
}

// Input validation helpers
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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

function validateDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
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

    // Check if caller is an admin
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      console.error('Unauthorized: Only admins can send assignment notifications');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Parse and validate input
    const body = await req.json();
    const { to, auditorName, assignmentDetails }: NotificationRequest = body;

    // Validate email
    if (!to || !validateEmail(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify email belongs to an actual auditor
    const { data: auditorProfile, error: auditorError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', to)
      .single();

    if (auditorError || !auditorProfile) {
      console.error('Email does not belong to a registered auditor:', to);
      return new Response(
        JSON.stringify({ error: 'Email does not belong to a registered user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate required fields
    if (!auditorName || typeof auditorName !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid auditor name' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!assignmentDetails || typeof assignmentDetails !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid assignment details' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!assignmentDetails.auditDate || !validateDate(assignmentDetails.auditDate)) {
      return new Response(
        JSON.stringify({ error: 'Invalid audit date' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (typeof assignmentDetails.fees !== 'number' || assignmentDetails.fees < 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid fees amount' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Admin', user.id, 'sending assignment notification to:', to);

    // Sanitize all string inputs before using in HTML
    const safeAuditorName = sanitizeHtml(auditorName);
    const safeClientName = sanitizeHtml(assignmentDetails.clientName || '');
    const safeBranchName = sanitizeHtml(assignmentDetails.branchName || '');
    const safeCity = sanitizeHtml(assignmentDetails.city || '');
    const safeState = sanitizeHtml(assignmentDetails.state || '');
    const safeAuditDate = new Date(assignmentDetails.auditDate).toLocaleDateString('en-IN');
    const safeFees = Number(assignmentDetails.fees).toLocaleString('en-IN');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .label { font-weight: bold; color: #1e40af; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Assignment Allotted!</h1>
            </div>
            <div class="content">
              <p>Dear ${safeAuditorName},</p>
              <p>Congratulations! You have been allotted a new audit assignment.</p>
              
              <div class="details">
                <h3>Assignment Details</h3>
                <div class="detail-row">
                  <span class="label">Client:</span>
                  <span>${safeClientName}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Branch:</span>
                  <span>${safeBranchName}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span>${safeCity}, ${safeState}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Audit Date:</span>
                  <span>${safeAuditDate}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Fees:</span>
                  <span>₹${safeFees}</span>
                </div>
              </div>
              
              <p>Please log in to your dashboard to view complete details and start your audit work.</p>
              
              <div class="footer">
                <p>This is an automated notification from Post Audit Management Portal</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Audit Portal <notifications@resend.dev>',
        to: [to],
        subject: '🎉 New Assignment Allotted - Post Audit Portal',
        html: emailHtml,
      }),
    });

    const data = await res.json();
    console.log('Email sent successfully to:', to);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in send-assignment-notification:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
