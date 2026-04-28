import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MicButton from './MicButton'

describe('MicButton', () => {
  it('idle 상태에서 기본 배경색(#FFF0DC)을 가진다', () => {
    const { container } = render(<MicButton state="idle" onPress={vi.fn()} />)
    expect(container.querySelector('.bg-\\[\\#FFF0DC\\]')).toBeTruthy()
  })

  it('listening 상태에서 주황 배경(#E8820C)과 animate-pulse를 가진다', () => {
    const { container } = render(<MicButton state="listening" onPress={vi.fn()} />)
    expect(container.querySelector('.bg-\\[\\#E8820C\\]')).toBeTruthy()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('processing 상태에서 버튼에 pointer-events-none이 적용된다', () => {
    const { container } = render(<MicButton state="processing" onPress={vi.fn()} />)
    expect(container.querySelector('.pointer-events-none')).toBeTruthy()
  })

  it('speaking 상태에서 버튼에 pointer-events-none이 적용된다', () => {
    const { container } = render(<MicButton state="speaking" onPress={vi.fn()} />)
    expect(container.querySelector('.pointer-events-none')).toBeTruthy()
  })

  it('idle 상태에서 클릭 시 onPress가 호출된다', async () => {
    const onPress = vi.fn()
    render(<MicButton state="idle" onPress={onPress} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('listening 상태에서 클릭 시 onPress가 호출된다 (stopListening 트리거)', async () => {
    const onPress = vi.fn()
    render(<MicButton state="listening" onPress={onPress} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('aria-label이 state에 따라 변경된다', () => {
    const { rerender } = render(<MicButton state="idle" onPress={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', '녹음 시작')

    rerender(<MicButton state="listening" onPress={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', '녹음 중지')

    rerender(<MicButton state="processing" onPress={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'AI 응답 중')

    rerender(<MicButton state="speaking" onPress={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'AI 말하는 중')
  })
})
