// FamilyBookshelfPage 테스트 — 편집중인 책 제목 표시 + X 버튼 닫기
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import FamilyBookshelfPage from './FamilyBookshelfPage'

const mockDraftBook = {
  id: 'b1', title: '경로당의 봄', status: 'editing',
  book_type: 'monthly', year: 2026, month: 3, chapterCount: 2,
}

vi.mock('@/features/bookshelf/hooks/useBookshelf', () => ({
  useBookshelf: () => ({
    books: [mockDraftBook],
    loading: false,
  }),
}))
vi.mock('@/shared/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({ profile: { display_name: '아빠' } }),
  ),
}))
vi.mock('@/features/bookshelf/components/ShelfRack', () => ({
  ShelfRack: () => <div data-testid="shelf-rack" />,
}))

function renderPage() {
  return render(<MemoryRouter><FamilyBookshelfPage /></MemoryRouter>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('FamilyBookshelfPage — 편집중인 책 제목 표시', () => {
  it('책 제목이 헤더에 표시된다', () => {
    renderPage()
    // 제목과 (편집중)이 별도 span이므로 각각 확인
    expect(screen.getByText('경로당의 봄')).toBeTruthy()
    expect(screen.getByText('(편집중)')).toBeTruthy()
  })

  it('"편집중인 책" 고정 텍스트가 단독으로 표시되지 않는다', () => {
    renderPage()
    expect(screen.queryByText('편집중인 책')).toBeNull()
  })
})

describe('FamilyBookshelfPage — 편집중인 책 박스 X 버튼', () => {
  it('X 닫기 버튼이 렌더링된다', () => {
    renderPage()
    expect(screen.getByRole('button', { name: '닫기' })).toBeTruthy()
  })

  it('X 버튼 클릭 시 편집중인 책 박스가 사라진다', () => {
    renderPage()
    expect(screen.getByText('경로당의 봄')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByText('경로당의 봄')).toBeNull()
    expect(screen.queryByText('(편집중)')).toBeNull()
  })
})
