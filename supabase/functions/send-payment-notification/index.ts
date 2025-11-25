import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, auditorName, invoiceNumber, amount, status, paymentDate }: PaymentNotificationRequest = await req.json();

    const statusColors: Record<string, string> = {
      approved: '#10b981',
      processing: '#f59e0b',
      paid: '#22c55e',
      rejected: '#ef4444',
    };

    const statusEmoji: Record<string, string> = {
      approved: '✅',
      processing: '⏳',
      paid: '💰',
      rejected: '❌',
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, ${statusColors[status]} 0%, ${statusColors[status]}dd 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .amount { font-size: 32px; font-weight: bold; color: ${statusColors[status]}; text-align: center; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${statusEmoji[status]} Payment Status Update</h1>
            </div>
            <div class="content">
              <p>Dear ${auditorName},</p>
              <p>Your payment status has been updated.</p>
              
              <div class="details">
                <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                <p><strong>Status:</strong> ${status.toUpperCase()}</p>
                ${paymentDate ? `<p><strong>Payment Date:</strong> ${new Date(paymentDate).toLocaleDateString('en-IN')}</p>` : ''}
                
                <div class="amount">₹${amount.toLocaleString('en-IN')}</div>
              </div>
              
              <p>${status === 'paid' 
                ? 'The payment has been successfully processed and credited to your account.' 
                : status === 'approved' 
                ? 'Your invoice has been approved and is being processed for payment.'
                : status === 'processing'
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
        subject: `${statusEmoji[status]} Payment Update - ${invoiceNumber}`,
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