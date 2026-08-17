import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath('backend'))

from backend.app.db.client import get_supabase_client

async def main():
    client = await get_supabase_client()
    result = await client.from_('alerts').select('*').execute()
    print("Alerts:", result.data)

asyncio.run(main())
