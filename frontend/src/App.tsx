import { RouterProvider } from 'react-router'
import { router } from '@/routes'
import { QueryProvider } from '@/shared/providers/QueryProvider'

export default function App() {
  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  )
}
