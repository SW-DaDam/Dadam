import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatBubble from './ChatBubble'

describe('ChatBubble', () => {
  it('role=ai 시 AI 배지가 렌더링된다', () => {
    render(<ChatBubble role="ai" lines={['안녕하세요']} time="오전 9:00" />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('role=user 시 AI 배지가 없다', () => {
    render(<ChatBubble role="user" lines={['안녕']} time="오전 9:01" />)
    expect(screen.queryByText('AI')).not.toBeInTheDocument()
  })

  it('lines 배열의 각 항목이 렌더링된다', () => {
    render(<ChatBubble role="ai" lines={['첫째 줄', '둘째 줄']} time="오전 9:02" />)
    expect(screen.getByText('첫째 줄')).toBeInTheDocument()
    expect(screen.getByText('둘째 줄')).toBeInTheDocument()
  })

  it('time prop이 표시된다', () => {
    render(<ChatBubble role="ai" lines={['테스트']} time="오후 3:30" />)
    expect(screen.getByText('오후 3:30')).toBeInTheDocument()
  })
})
