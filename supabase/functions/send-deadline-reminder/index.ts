import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    const emailPromises = assignments.map(async (assignment: any) => {
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
                <p>Dear ${assignment.auditor.full_name},</p>
                
                <div class="alert">
                  <h3>Your assignment deadline is approaching!</h3>
                  <p><strong>Client:</strong> ${assignment.client_name}</p>
                  <p><strong>Branch:</strong> ${assignment.branch_name}</p>
                  <p><strong>Deadline:</strong> ${new Date(assignment.deadline_date).toLocaleDateString('en-IN')}</p>
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

      return fetch('https://api.resend.com/emails', {
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
    });

    await Promise.all(emailPromises);

    return new Response(
      JSON.stringify({ message: `Sent ${emailPromises.length} deadline reminders` }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});