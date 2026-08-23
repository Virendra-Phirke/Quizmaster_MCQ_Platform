// Supabase Edge Function: Handle Clerk user.deleted webhook
// When a user is deleted from Clerk dashboard, this function deletes
// their profile from Supabase. CASCADE will clean up tests, results, etc.

// Deno runtime types — this file runs on Supabase Edge Functions (Deno), not Node.js
declare const Deno: {
    serve(handler: (req: Request) => Response | Promise<Response>): void;
    env: {
        get(key: string): string | undefined;
    };
};

// @ts-ignore — Deno URL import; runs fine on Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore — Deno URL import
import { Webhook } from 'https://esm.sh/svix@1.21.0';

// Deterministic UUID from Clerk ID — must match clerkUtils.ts logic exactly
async function generateUUIDFromClerkId(clerkId: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(clerkId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return [
        hashHex.slice(0, 8),
        hashHex.slice(8, 12),
        '4' + hashHex.slice(13, 16),
        '8' + hashHex.slice(17, 20),
        hashHex.slice(20, 32),
    ].join('-');
}

Deno.serve(async (req) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const payload = await req.text();

        // Verify webhook signature
        const webhookSecret = Deno.env.get('CLERK_WEBHOOK_SECRET');
        if (!webhookSecret) {
            console.error('CLERK_WEBHOOK_SECRET not set');
            return new Response('Server configuration error', { status: 500 });
        }

        const svix_id = req.headers.get('svix-id');
        const svix_timestamp = req.headers.get('svix-timestamp');
        const svix_signature = req.headers.get('svix-signature');

        if (!svix_id || !svix_timestamp || !svix_signature) {
            console.error('Missing svix headers');
            return new Response('Missing svix headers', { status: 400 });
        }

        let event;
        try {
            const wh = new Webhook(webhookSecret);
            event = wh.verify(payload, {
                'svix-id': svix_id,
                'svix-timestamp': svix_timestamp,
                'svix-signature': svix_signature,
            }) as any;
        } catch (err) {
            console.error('Invalid webhook signature. Error:', err);
            return new Response('Invalid signature', { status: 401 });
        }

        // Handle user.deleted and user.updated events
        if (event.type !== 'user.deleted' && event.type !== 'user.updated') {
            return new Response(JSON.stringify({ message: `Ignored event: ${event.type}` }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const clerkUserId = event.data?.id;
        if (!clerkUserId) {
            console.error('No user ID in webhook payload');
            return new Response('Missing user ID', { status: 400 });
        }

        console.log(`Processing ${event.type} for Clerk ID: ${clerkUserId}`);

        // Generate the deterministic UUID that matches the profiles table
        const supabaseUUID = await generateUUIDFromClerkId(clerkUserId);
        console.log(`Mapped to Supabase UUID: ${supabaseUUID}`);

        // Use service role key to bypass RLS
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        if (event.type === 'user.deleted') {
            // Delete the profile — CASCADE will clean up tests, questions, test_results, reviews, etc.
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', supabaseUUID);

            if (error) {
                console.error('Error deleting profile:', error);
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            console.log(`Successfully deleted profile ${supabaseUUID} and all related data`);

            return new Response(
                JSON.stringify({
                    success: true,
                    message: `Deleted user ${supabaseUUID} and all related data`,
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        } else if (event.type === 'user.updated') {
            const name = `${event.data?.first_name || ''} ${event.data?.last_name || ''}`.trim() || 'Unknown User';
            const email = event.data?.email_addresses?.[0]?.email_address || 'unknown@example.com';

            const { error } = await supabase
                .from('profiles')
                .update({ name, email })
                .eq('id', supabaseUUID);

            if (error) {
                console.error('Error updating profile:', error);
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            console.log(`Successfully updated profile ${supabaseUUID}`);

            return new Response(
                JSON.stringify({
                    success: true,
                    message: `Updated user ${supabaseUUID}`,
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        return new Response(JSON.stringify({ message: `Successfully handled event: ${event.type}` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('Webhook processing error:', err);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
});
