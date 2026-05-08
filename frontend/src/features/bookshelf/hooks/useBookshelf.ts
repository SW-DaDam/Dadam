import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { BookWithStats } from '@/types/domain'

export function useBookshelf() {
  const [books, setBooks] = useState<BookWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBooks() {
      const { data, error } = await supabase
        .from('books')
        .select('*, chapters(id, comments(id))')
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (error || !data) return

      setBooks(
        data.map(({ chapters, ...book }) => ({
          ...book,
          commentCount: (chapters as { comments: { id: string }[] }[])
            .reduce((sum, ch) => sum + (ch.comments?.length ?? 0), 0),
        })),
      )
    }

    fetchBooks().finally(() => setLoading(false))
  }, [])

  return { books, loading }
}
