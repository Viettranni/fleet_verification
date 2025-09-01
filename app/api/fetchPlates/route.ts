// app/api/fetchPlates/route.ts
import { supabase } from "@/lib/supabaseClient"

interface Plate {
  id: number;
  plate: string;
  plate_url: string;
  created_at: string;
  isInWarehouse: boolean;
}

export async function GET() {
  let allPlates: any[] = []
  let from = 0
  const pageSize = 100
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
        .from<"plates", Plate>("plates")
        .select("*")

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

    if (!data || data.length === 0) hasMore = false
    else {
      allPlates = [...allPlates, ...data]
      from += pageSize
    }
  }

  return new Response(JSON.stringify(allPlates), { status: 200 })
}
