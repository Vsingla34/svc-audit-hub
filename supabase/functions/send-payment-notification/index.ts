import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentNotificationRequest {
  to: string;
  auditorName: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  paymentDate?: string;
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

const VALID_STATUSES = ['approved', 'processing', 'paid', 'rejected', 'pending'];

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
      console.error('Unauthorized: Only admins can send payment notifications');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Parse and validate input
    const body = await req.json();
    const { to, auditorName, invoiceNumber, amount, status, paymentDate }: PaymentNotificationRequest = body;

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
      console.error('Email does not belong to a registered user:', to);
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

    if (!invoiceNumber || typeof invoiceNumber !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid invoice number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount < 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!status || !VALID_STATUSES.includes(status.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid status. Must be one of: ' + VALID_STATUSES.join(', ') }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (paymentDate && !validateDate(paymentDate)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment date' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Admin', user.id, 'sending payment notification to:', to);

    // Sanitize inputs
    const safeAuditorName = sanitizeHtml(auditorName);
    const safeInvoiceNumber = sanitizeHtml(invoiceNumber);
    const safeStatus = status.toLowerCase();
    const safeAmount = Number(amount).toLocaleString('en-IN');

    const statusColors: Record<string, string> = {
      approved: '#10b981',
      processing: '#f59e0b',
      paid: '#22c55e',
      rejected: '#ef4444',
      pending: '#6b7280',
    };

    const statusEmoji: Record<string, string> = {
      approved: '✅',
      processing: '⏳',
      paid: '💰',
      rejected: '❌',
      pending: '📋',
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, ${statusColors[safeStatus] || '#6b7280'} 0%, ${statusColors[safeStatus] || '#6b7280'}dd 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .amount { font-size: 32px; font-weight: bold; color: ${statusColors[safeStatus] || '#6b7280'}; text-align: center; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${statusEmoji[safeStatus] || '📋'} Payment Status Update</h1>
            </div>
            <div class="content">
              <p>Dear ${safeAuditorName},</p>
              <p>Your payment status has been updated.</p>
              
              <div class="details">
                <p><strong>Invoice Number:</strong> ${safeInvoiceNumber}</p>
                <p><strong>Status:</strong> ${safeStatus.toUpperCase()}</p>
                ${paymentDate ? `<p><strong>Payment Date:</strong> ${new Date(paymentDate).toLocaleDateString('en-IN')}</p>` : ''}
                
                <div class="amount">₹${safeAmount}</div>
              </div>
              
              <p>${safeStatus === 'paid' 
                ? 'The payment has been successfully processed and credited to your account.' 
                : safeStatus === 'approved' 
                ? 'Your invoice has been approved and is being processed for payment.'
                : safeStatus === 'processing'
                ? 'Your payment is currently being processed.'
                : 'Please contact the administrator for more information.'
              }</p>
              
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
        subject: `${statusEmoji[safeStatus] || '📋'} Payment Update - ${safeInvoiceNumber}`,
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
    console.error('Error in send-payment-notification:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
