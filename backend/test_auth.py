import asyncio
import httpx

async def test():
    import os
    token = os.getenv("SUPABASE_ANON_KEY", "your-anon-key")
    supabase_url = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
    async with httpx.AsyncClient() as client:
        # Note: we also need apikey for Supabase API endpoints
        r = await client.get(f'{supabase_url}/auth/v1/user', headers={
            'Authorization': f'Bearer {token}',
            'apikey': token
        })
        print(r.status_code, r.text)

asyncio.run(test())
