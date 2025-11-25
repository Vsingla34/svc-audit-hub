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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, auditorName, assignmentDetails }: NotificationRequest = await req.json();

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
              <p>Dear ${auditorName},</p>
              <p>Congratulations! You have been allotted a new audit assignment.</p>
              
              <div class="details">
                <h3>Assignment Details</h3>
                <div class="detail-row">
                  <span class="label">Client:</span>
                  <span>${assignmentDetails.clientName}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Branch:</span>
                  <span>${assignmentDetails.branchName}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span>${assignmentDetails.city}, ${assignmentDetails.state}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Audit Date:</span>
                  <span>${new Date(assignmentDetails.auditDate).toLocaleDateString('en-IN')}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Fees:</span>
                  <span>₹${assignmentDetails.fees.toLocaleString('en-IN')}</span>
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

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});