import { NextResponse } from 'next/server';
import { IntegrationManager } from '@/lib/integrationManager';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const clientId = process.env.INSTAGRAM_APP_ID;
    const clientSecret = process.env.INSTAGRAM_APP_SECRET;
    const redirectUri = 'http://localhost:3000/api/auth/instagram/callback';

    try {
        // 1. Exchange code for short-lived token
        const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`);
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            throw new Error(tokenData.error.message || "Token exchange failed");
        }

        const shortLivedToken = tokenData.access_token;

        // 2. Exchange for long-lived token
        const longLivedRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortLivedToken}`);
        const longLivedData = await longLivedRes.json();
        const longLivedToken = longLivedData.access_token || shortLivedToken;

        // 3. Debug: Check who we are authenticated as
        const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${longLivedToken}`);
        const meData = await meRes.json();
        console.log('[Instagram Auth] Authenticated as:', JSON.stringify(meData));

        // 4. Search for Instagram account using multiple methods
        let igAccountId = '';
        let igUsername = '';
        let pageAccessToken = longLivedToken;
        const debugInfo: string[] = [];
        const userId = meData.id;

        debugInfo.push(`Authenticated as: ${meData.name || meData.id || 'unknown'} (${userId})`);

        // Method A: me/accounts (classic Pages)
        const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account,connected_instagram_account&access_token=${longLivedToken}`);
        const pagesData = await pagesRes.json();
        console.log('[Instagram Auth] me/accounts:', JSON.stringify(pagesData));
        debugInfo.push(`me/accounts pages: ${pagesData.data?.length || 0}`);

        let allPages = pagesData.data || [];

        // Method B: If no pages, try me?fields=accounts (embedded)
        if (allPages.length === 0) {
            try {
                const embeddedRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=accounts{id,name,access_token,instagram_business_account,connected_instagram_account}&access_token=${longLivedToken}`);
                const embeddedData = await embeddedRes.json();
                console.log('[Instagram Auth] me?fields=accounts:', JSON.stringify(embeddedData));
                if (embeddedData.accounts?.data?.length > 0) {
                    allPages = embeddedData.accounts.data;
                    debugInfo.push(`me?fields=accounts pages: ${allPages.length}`);
                } else {
                    debugInfo.push(`me?fields=accounts: ${JSON.stringify(embeddedData).substring(0, 300)}`);
                }
            } catch (e: any) {
                debugInfo.push(`me?fields=accounts error: ${e.message}`);
            }
        }

        // Method C: Try businesses → owned_pages
        if (allPages.length === 0) {
            try {
                const bizRes = await fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${longLivedToken}`);
                const bizData = await bizRes.json();
                console.log('[Instagram Auth] businesses:', JSON.stringify(bizData));
                debugInfo.push(`businesses: ${JSON.stringify(bizData).substring(0, 300)}`);

                if (bizData.data) {
                    for (const biz of bizData.data) {
                        const bpRes = await fetch(`https://graph.facebook.com/v21.0/${biz.id}/owned_pages?fields=id,name,access_token,instagram_business_account,connected_instagram_account&access_token=${longLivedToken}`);
                        const bpData = await bpRes.json();
                        console.log(`[Instagram Auth] business ${biz.id} pages:`, JSON.stringify(bpData));
                        if (bpData.data?.length > 0) {
                            allPages = bpData.data;
                            debugInfo.push(`business ${biz.name} pages: ${allPages.length}`);
                            break;
                        }
                    }
                }
            } catch (e: any) {
                debugInfo.push(`businesses error: ${e.message}`);
            }
        }

        // Method D: Try directly with user ID
        if (allPages.length === 0 && userId) {
            try {
                const directRes = await fetch(`https://graph.facebook.com/v21.0/${userId}/accounts?fields=id,name,access_token,instagram_business_account,connected_instagram_account&access_token=${longLivedToken}`);
                const directData = await directRes.json();
                console.log('[Instagram Auth] userId/accounts:', JSON.stringify(directData));
                if (directData.data?.length > 0) {
                    allPages = directData.data;
                    debugInfo.push(`userId/accounts pages: ${allPages.length}`);
                } else {
                    debugInfo.push(`userId/accounts: ${JSON.stringify(directData).substring(0, 300)}`);
                }
            } catch (e: any) {
                debugInfo.push(`userId/accounts error: ${e.message}`);
            }
        }

        debugInfo.push(`Total pages found: ${allPages.length}`);

        if (allPages.length > 0) {
            for (const page of allPages) {
                debugInfo.push(`Page: "${page.name}" (${page.id})`);

                // Check inline fields
                if (page.instagram_business_account?.id) {
                    igAccountId = page.instagram_business_account.id;
                    pageAccessToken = page.access_token || longLivedToken;
                    debugInfo.push(`  ✓ Found via instagram_business_account`);
                    break;
                }
                if (page.connected_instagram_account?.id) {
                    igAccountId = page.connected_instagram_account.id;
                    pageAccessToken = page.access_token || longLivedToken;
                    debugInfo.push(`  ✓ Found via connected_instagram_account`);
                    break;
                }

                // Explicit lookup
                try {
                    const igRes = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account,connected_instagram_account&access_token=${page.access_token || longLivedToken}`);
                    const igData = await igRes.json();
                    debugInfo.push(`  explicit lookup: ${JSON.stringify(igData)}`);
                    if (igData.instagram_business_account?.id) {
                        igAccountId = igData.instagram_business_account.id;
                        pageAccessToken = page.access_token || longLivedToken;
                        break;
                    }
                    if (igData.connected_instagram_account?.id) {
                        igAccountId = igData.connected_instagram_account.id;
                        pageAccessToken = page.access_token || longLivedToken;
                        break;
                    }
                } catch (e: any) {
                    debugInfo.push(`  explicit lookup error: ${e.message}`);
                }
            }
        } else {
            debugInfo.push(`All methods returned 0 pages.`);
        }

        // Get username if found
        if (igAccountId) {
            try {
                const profileRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}?fields=username,profile_picture_url&access_token=${pageAccessToken}`);
                const profileData = await profileRes.json();
                igUsername = profileData.username || 'Instagram Business';
            } catch {
                igUsername = 'Instagram Business';
            }
        }

        if (!igAccountId) {
            const debugHtml = debugInfo.map((d: string) => `<li style="text-align:left;margin:4px 0;word-break:break-all">${d}</li>`).join('');
            return new NextResponse(`
                <html>
                <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding:30px 40px;">
                    <h1 style="color:#f87171">❌ No Instagram Business Account Found</h1>
                    <p>Your Facebook Pages do not have an Instagram Business account linked.</p>
                    <div style="background:#222; border-radius:8px; padding:16px; margin:20px auto; max-width:700px; text-align:left;">
                        <h3 style="color:#fbbf24; margin-top:0;">🔍 Debug Info</h3>
                        <ul style="color:#9ca3af; font-size:12px; font-family:monospace; list-style:none; padding:0;">${debugHtml}</ul>
                    </div>
                </body>
                </html>
            `, { headers: { 'Content-Type': 'text/html' } });
        }

        // 5. Save tokens
        await IntegrationManager.saveTokens('Instagram', {
            access_token: pageAccessToken,
            ig_account_id: igAccountId,
            username: igUsername,
            expires_at: Date.now() + (longLivedData.expires_in || 5184000) * 1000
        });

        return new NextResponse(`
            <html>
            <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
                <h1 style="color:#4ade80">✅ Connected to Instagram</h1>
                <p>Account: <strong>@${igUsername}</strong></p>
                <p>You can close this window now.</p>
                <script>
                    if(window.opener) {
                        window.opener.postMessage({ type: 'instagram-connected', username: '${igUsername}' }, '*');
                    }
                    setTimeout(() => window.close(), 2000);
                </script>
            </body>
            </html>
        `, { headers: { 'Content-Type': 'text/html' } });

    } catch (error: any) {
        console.error("Instagram OAuth Error:", error);
        return new NextResponse(`
            <html>
            <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
                <h1 style="color:#f87171">❌ Authentication Failed</h1>
                <p>${error.message || 'Unknown error'}</p>
                <script>setTimeout(() => window.close(), 4000);</script>
            </body>
            </html>
        `, { headers: { 'Content-Type': 'text/html' } });
    }
}
