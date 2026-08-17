import asyncio
import httpx

async def test():
    import os
    token = os.getenv("SUPABASE_ANON_KEY", "your-anon-key")
    async with httpx.AsyncClient() as client:
        r = await client.get('http://localhost:8000/api/alerts', headers={'Authorization': f'Bearer {token}'})
        print(r.status_code, r.text)

asyncio.run(test())
